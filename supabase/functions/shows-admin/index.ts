import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_ROLES = new Set(["gerente", "equipe", "vendedor"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function txt(v: unknown, max = 1000): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") throw new Error("Texto inválido");
  const t = v.trim();
  if (!t) return null;
  if (t.length > max) throw new Error("Texto muito longo");
  return t;
}
function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error("Valor numérico inválido");
  return n;
}
function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < 0) throw new Error("Inteiro inválido");
  return n;
}
function bool(v: unknown): boolean {
  return v === true || v === "true";
}
function dateOrNull(v: unknown): string | null {
  if (!v) return null;
  if (typeof v !== "string") throw new Error("Data inválida");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error("Data deve estar em AAAA-MM-DD");
  return v;
}
function timeOrNull(v: unknown): string | null {
  if (!v) return null;
  if (typeof v !== "string") throw new Error("Horário inválido");
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(v)) throw new Error("Horário deve estar em HH:MM");
  return v.length === 5 ? `${v}:00` : v;
}

function validateShow(input: any) {
  if (!input || typeof input !== "object") throw new Error("Dados inválidos");
  const artist_id = txt(input.artist_id, 64);
  if (!artist_id) throw new Error("Artista é obrigatório");
  const data_show = dateOrNull(input.data_show);
  if (!data_show) throw new Error("Data do show é obrigatória");

  let tipo: string | null = null;
  if (input.tipo_estrutura === "aberta" || input.tipo_estrutura === "fechada") {
    tipo = input.tipo_estrutura;
  }

  return {
    artist_id,
    data_show,
    horario: timeOrNull(input.horario),
    data_subida: dateOrNull(input.data_subida),
    vendedor: txt(input.vendedor, 200),
    local: txt(input.local, 200),
    tipo_estrutura: tipo,
    endereco: txt(input.endereco, 300),
    cidade: txt(input.cidade, 120),
    capacidade: intOrNull(input.capacidade),
    contratante_nome: txt(input.contratante_nome, 200),
    contratante_documento: txt(input.contratante_documento, 50),
    contratante_endereco: txt(input.contratante_endereco, 300),
    contratante_cidade: txt(input.contratante_cidade, 120),
    contratante_cep: txt(input.contratante_cep, 20),
    contratante_telefone: txt(input.contratante_telefone, 50),
    contratante_email: txt(input.contratante_email, 200),
    cache_total: num(input.cache_total),
    condicao_pagamento: txt(input.condicao_pagamento, 2000),
    encargos_extras: bool(input.encargos_extras),
    transp_onibus: bool(input.transp_onibus),
    transp_van: bool(input.transp_van),
    transp_aereo: bool(input.transp_aereo),
    transp_excesso_bagagem: bool(input.transp_excesso_bagagem),
    transp_observacoes: txt(input.transp_observacoes, 2000),
    hosp_diaria_alimentacao: bool(input.hosp_diaria_alimentacao),
    hosp_hospedagem: bool(input.hosp_hospedagem),
    hosp_traslado: bool(input.hosp_traslado),
    camarins_rider: txt(input.camarins_rider, 5000),
    autorizado_por: txt(input.autorizado_por, 120) ?? "Vitor D.",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let sql: postgres.Sql | null = null;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (!supabaseUrl || !anonKey || !databaseUrl) return json({ error: "Configuração do backend incompleta" }, 500);
    if (!token) return json({ error: "Sessão ausente" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getClaims(token);
    const userId = authData?.claims?.sub;
    if (authError || !userId) return json({ error: "Sessão inválida" }, 401);

    sql = postgres(databaseUrl, { prepare: false, max: 1 });
    const roleRows = await sql`select role::text as role from public.user_roles where user_id = ${userId}`;
    const roles = roleRows.map((r: any) => r.role);
    const canManage = roles.some((r: string) => ALLOWED_ROLES.has(r));
    const isManager = roles.includes("gerente");

    const body = req.method === "GET" ? { action: "list" } : await req.json().catch(() => ({}));
    const action = body.action ?? "list";

    if (action === "list") {
      // gerente/equipe/vendedor veem todos; artista vê só os seus
      let rows;
      if (canManage) {
        rows = await sql`
          select s.*, a.nome as artist_nome, a.cor as artist_cor
          from public.shows s
          left join public.artists a on a.id = s.artist_id
          order by s.data_show desc nulls last, s.created_at desc
        `;
      } else if (roles.includes("artista")) {
        rows = await sql`
          select s.*, a.nome as artist_nome, a.cor as artist_cor
          from public.shows s
          left join public.artists a on a.id = s.artist_id
          where s.artist_id in (select artist_id from public.user_roles where user_id = ${userId} and role = 'artista')
          order by s.data_show desc nulls last
        `;
      } else {
        return json({ error: "Acesso negado" }, 403);
      }
      return json({ shows: rows });
    }

    if (action === "artists") {
      const rows = await sql`select id, nome, cor from public.artists where ativo = true order by nome`;
      return json({ artists: rows });
    }

    if (!canManage) return json({ error: "Acesso negado" }, 403);

    if (action === "create") {
      const s = validateShow(body.show ?? {});
      const rows = await sql`
        insert into public.shows (
          artist_id, data_show, horario, data_subida, vendedor,
          local, tipo_estrutura, endereco, cidade, capacidade,
          contratante_nome, contratante_documento, contratante_endereco, contratante_cidade,
          contratante_cep, contratante_telefone, contratante_email,
          cache_total, condicao_pagamento, encargos_extras,
          transp_onibus, transp_van, transp_aereo, transp_excesso_bagagem, transp_observacoes,
          hosp_diaria_alimentacao, hosp_hospedagem, hosp_traslado,
          camarins_rider, autorizado_por, created_by, updated_at
        ) values (
          ${s.artist_id}, ${s.data_show}, ${s.horario}, ${s.data_subida}, ${s.vendedor},
          ${s.local}, ${s.tipo_estrutura}::estrutura_tipo, ${s.endereco}, ${s.cidade}, ${s.capacidade},
          ${s.contratante_nome}, ${s.contratante_documento}, ${s.contratante_endereco}, ${s.contratante_cidade},
          ${s.contratante_cep}, ${s.contratante_telefone}, ${s.contratante_email},
          ${s.cache_total}, ${s.condicao_pagamento}, ${s.encargos_extras},
          ${s.transp_onibus}, ${s.transp_van}, ${s.transp_aereo}, ${s.transp_excesso_bagagem}, ${s.transp_observacoes},
          ${s.hosp_diaria_alimentacao}, ${s.hosp_hospedagem}, ${s.hosp_traslado},
          ${s.camarins_rider}, ${s.autorizado_por}, ${userId}, now()
        )
        returning *
      `;
      return json({ show: rows[0] });
    }

    if (action === "update") {
      if (typeof body.id !== "string") return json({ error: "Show inválido" }, 400);
      const s = validateShow(body.show ?? {});
      const rows = await sql`
        update public.shows set
          artist_id = ${s.artist_id},
          data_show = ${s.data_show},
          horario = ${s.horario},
          data_subida = ${s.data_subida},
          vendedor = ${s.vendedor},
          local = ${s.local},
          tipo_estrutura = ${s.tipo_estrutura}::estrutura_tipo,
          endereco = ${s.endereco},
          cidade = ${s.cidade},
          capacidade = ${s.capacidade},
          contratante_nome = ${s.contratante_nome},
          contratante_documento = ${s.contratante_documento},
          contratante_endereco = ${s.contratante_endereco},
          contratante_cidade = ${s.contratante_cidade},
          contratante_cep = ${s.contratante_cep},
          contratante_telefone = ${s.contratante_telefone},
          contratante_email = ${s.contratante_email},
          cache_total = ${s.cache_total},
          condicao_pagamento = ${s.condicao_pagamento},
          encargos_extras = ${s.encargos_extras},
          transp_onibus = ${s.transp_onibus},
          transp_van = ${s.transp_van},
          transp_aereo = ${s.transp_aereo},
          transp_excesso_bagagem = ${s.transp_excesso_bagagem},
          transp_observacoes = ${s.transp_observacoes},
          hosp_diaria_alimentacao = ${s.hosp_diaria_alimentacao},
          hosp_hospedagem = ${s.hosp_hospedagem},
          hosp_traslado = ${s.hosp_traslado},
          camarins_rider = ${s.camarins_rider},
          autorizado_por = ${s.autorizado_por},
          updated_at = now()
        where id = ${body.id}
        returning *
      `;
      if (rows.length === 0) return json({ error: "Show não encontrado" }, 404);
      return json({ show: rows[0] });
    }

    if (action === "delete") {
      if (!isManager) return json({ error: "Apenas o gerente pode excluir" }, 403);
      if (typeof body.id !== "string") return json({ error: "Show inválido" }, 400);
      await sql`delete from public.shows where id = ${body.id}`;
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error) {
    console.error("Erro em shows-admin", error);
    return json({ error: error instanceof Error ? error.message : "Falha ao gerenciar shows" }, 500);
  } finally {
    if (sql) await sql.end({ timeout: 3 });
  }
});
