// Edge function PÚBLICA (verify_jwt = false)
// Permite que o contratante acesse e preencha a minuta via token único.
import postgres from "npm:postgres@3.4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function txt(v: unknown, max: number, required = false): string | null {
  if (v === null || v === undefined || v === "") {
    if (required) throw new Error("Campo obrigatório ausente");
    return null;
  }
  if (typeof v !== "string") throw new Error("Texto inválido");
  const t = v.trim();
  if (!t) {
    if (required) throw new Error("Campo obrigatório ausente");
    return null;
  }
  if (t.length > max) throw new Error("Texto muito longo");
  return t;
}

const onlyDigits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let sql: postgres.Sql | null = null;
  try {
    const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!databaseUrl) return json({ error: "Configuração incompleta" }, 500);

    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const action = (body as any).action ?? "get";
    const token = (body as any).token;
    if (typeof token !== "string" || !UUID_RE.test(token)) {
      return json({ error: "Token inválido" }, 400);
    }

    sql = postgres(databaseUrl, { prepare: false, max: 1 });

    const rows = await sql`
      select s.id, s.status::text as status,
        s.contratante_link_token, s.contratante_link_expires_at, s.contratante_link_preenchido,
        to_char(s.data_show, 'YYYY-MM-DD') as data_show,
        s.horario::text as horario, s.local, s.cidade, s.endereco,
        s.cache_total, s.condicao_pagamento,
        s.contratante_nome, s.contratante_documento, s.contratante_endereco,
        s.contratante_cidade, s.contratante_cep, s.contratante_telefone, s.contratante_email,
        s.created_by, s.vendedor,
        a.nome as artist_nome
      from public.shows s
      left join public.artists a on a.id = s.artist_id
      where s.contratante_link_token = ${token}::uuid
      limit 1
    `;
    if (!rows.length) return json({ error: "Link inválido ou inexistente." }, 404);
    const sh: any = rows[0];

    const now = Date.now();
    const exp = sh.contratante_link_expires_at ? new Date(sh.contratante_link_expires_at).getTime() : 0;
    const expired = !exp || exp < now;
    const preenchido = !!sh.contratante_link_preenchido;

    if (action === "get") {
      return json({
        expired,
        preenchido,
        show: {
          artist_nome: sh.artist_nome,
          data_show: sh.data_show,
          horario: sh.horario ? String(sh.horario).slice(0, 5) : null,
          local: sh.local,
          cidade: sh.cidade,
          endereco: sh.endereco,
          cache_total: Number(sh.cache_total ?? 0),
          condicao_pagamento: sh.condicao_pagamento,
          expires_at: sh.contratante_link_expires_at,
        },
      });
    }

    if (action === "submit") {
      if (expired) return json({ error: "Este link expirou. Entre em contato com o vendedor para receber um novo link." }, 410);
      if (preenchido) return json({ error: "Estes dados já foram enviados. Obrigado!" }, 409);

      const f = (body as any).form ?? {};
      try {
        const nome = txt(f.contratante_nome, 200, true)!;
        const doc = txt(f.contratante_documento, 50, true)!;
        const endereco = txt(f.contratante_endereco, 300, true)!;
        const cidade = txt(f.contratante_cidade, 120, true)!;
        const estado = txt(f.contratante_estado, 50, true);
        const cep = txt(f.contratante_cep, 20, true)!;
        const telefone = txt(f.contratante_telefone, 50, true)!;
        const email = txt(f.contratante_email, 200, true)!;
        const obs = txt(f.observacoes, 2000, false);

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "E-mail inválido" }, 400);
        const docDigits = onlyDigits(doc);
        if (docDigits.length !== 11 && docDigits.length !== 14) {
          return json({ error: "CPF ou CNPJ inválido" }, 400);
        }

        // Compor endereço com estado se vier
        const enderecoFinal = estado ? `${endereco} - ${estado}` : endereco;
        const obsExtra = obs ? `\n\n[Observações do contratante]: ${obs}` : "";

        // Buscar prazo configurável (48h úteis padrão)
        const setRows = await sql`select value from public.app_settings where key = 'prazo_comprovante_horas_uteis'`;
        const prazoHoras = setRows.length ? Number((setRows[0] as any).value) || 48 : 48;

        const upd = await sql`
          update public.shows set
            contratante_nome = ${nome},
            contratante_documento = ${docDigits},
            contratante_endereco = ${enderecoFinal},
            contratante_cidade = ${cidade},
            contratante_cep = ${onlyDigits(cep)},
            contratante_telefone = ${onlyDigits(telefone)},
            contratante_email = ${email},
            condicao_pagamento = coalesce(condicao_pagamento, '') || ${obsExtra},
            contratante_link_preenchido = true,
            contratante_link_preenchido_em = now(),
            status = 'aguardando_pagamento'::show_status,
            dados_completos_em = now(),
            prazo_comprovante_em = public.add_business_hours_br(now(), ${prazoHoras}),
            aviso_12h_enviado_em = null,
            updated_at = now()
          where contratante_link_token = ${token}::uuid
            and contratante_link_preenchido = false
            and contratante_link_expires_at > now()
          returning id, created_by
        `;
        if (!upd.length) return json({ error: "Não foi possível salvar. Link expirado ou já utilizado." }, 410);
        const updated: any = upd[0];

        // Notificações: vendedor + gerência
        const titulo = "Contratante preencheu a minuta";
        const mensagem = `O contratante ${nome} preencheu os dados da minuta de ${sh.artist_nome ?? "show"} — ${sh.data_show}. Revise e envie para aprovação.`;
        if (updated.created_by) {
          await sql`
            insert into public.notifications (user_id, tipo, titulo, mensagem, show_id)
            values (${updated.created_by}, 'contratante_preencheu', ${titulo}, ${mensagem}, ${updated.id})
          `;
        }
        const gerentes = await sql`select user_id from public.user_roles where role = 'gerente'`;
        for (const g of gerentes as any[]) {
          await sql`
            insert into public.notifications (user_id, tipo, titulo, mensagem, show_id)
            values (${g.user_id}, 'contratante_preencheu', ${titulo}, ${mensagem}, ${updated.id})
          `;
        }
        return json({ ok: true });
      } catch (e: any) {
        return json({ error: e?.message ?? "Dados inválidos" }, 400);
      }
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error) {
    console.error("contratante-link error", error);
    return json({ error: error instanceof Error ? error.message : "Erro" }, 500);
  } finally {
    if (sql) await sql.end({ timeout: 3 });
  }
});
