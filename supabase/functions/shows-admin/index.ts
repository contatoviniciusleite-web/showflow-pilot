import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_CREATE_ROLES = new Set(["gerente", "equipe", "vendedor"]);

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

async function notify(sql: postgres.Sql, userId: string, tipo: string, titulo: string, mensagem: string, showId: string | null) {
  await sql`
    insert into public.notifications (user_id, tipo, titulo, mensagem, show_id)
    values (${userId}, ${tipo}, ${titulo}, ${mensagem}, ${showId})
  `;
}

async function notifyByRoles(sql: postgres.Sql, roles: string[], tipo: string, titulo: string, mensagem: string, showId: string | null) {
  const rows = await sql`select distinct user_id from public.user_roles where role::text = any(${roles})`;
  for (const r of rows as any[]) {
    await notify(sql, r.user_id, tipo, titulo, mensagem, showId);
  }
}

async function getSetting(sql: postgres.Sql, key: string, fallback: number): Promise<number> {
  const rows = await sql`select value from public.app_settings where key = ${key}`;
  if (!rows.length) return fallback;
  const v = (rows[0] as any).value;
  return typeof v === "number" ? v : Number(v) || fallback;
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
    const isManager = roles.includes("gerente");
    const isStaff = roles.includes("equipe");
    const isVendedor = roles.includes("vendedor");
    const isArtista = roles.includes("artista");
    const isFinanceiro = roles.includes("financeiro");
    const canCreate = roles.some((r: string) => ALLOWED_CREATE_ROLES.has(r));
    const isEditor = isManager || isStaff;
    const canSeeAll = isManager || isStaff || isFinanceiro;

    const body = req.method === "GET" ? { action: "list" } : await req.json().catch(() => ({}));
    const action = body.action ?? "list";

    if (action === "list") {
      if (canSeeAll) {
        const rows = await sql`
          select s.*, a.nome as artist_nome, a.cor as artist_cor, a.cache_minimo as artist_cache_minimo
          from public.shows s
          left join public.artists a on a.id = s.artist_id
          order by s.data_show desc nulls last, s.created_at desc
        `;
        return json({ shows: rows, scope: canSeeAll && !isEditor ? "financeiro" : "all" });
      }
      if (isVendedor) {
        const minhas = await sql`
          select s.*, a.nome as artist_nome, a.cor as artist_cor, a.cache_minimo as artist_cache_minimo
          from public.shows s
          left join public.artists a on a.id = s.artist_id
          where s.created_by = ${userId}
          order by s.data_show desc nulls last, s.created_at desc
        `;
        const outras = await sql`
          select id, artist_id, artist_nome, artist_cor, data_show, horario, local, cidade, status
          from public.shows_public_view
          where created_by is distinct from ${userId}
          order by data_show desc nulls last
        `;
        return json({ shows: minhas, outras_aprovadas: outras, scope: "vendedor" });
      }
      if (isArtista) {
        const rows = await sql`
          select s.*, a.nome as artist_nome, a.cor as artist_cor, a.cache_minimo as artist_cache_minimo
          from public.shows s
          left join public.artists a on a.id = s.artist_id
          where s.artist_id in (select artist_id from public.user_roles where user_id = ${userId} and role = 'artista')
          order by s.data_show desc nulls last
        `;
        return json({ shows: rows, scope: "artista" });
      }
      return json({ error: "Acesso negado" }, 403);
    }

    if (action === "artists") {
      const rows = await sql`select id, nome, cor, cache_minimo from public.artists where ativo = true order by nome`;
      return json({ artists: rows });
    }

    if (action === "create") {
      if (!canCreate) return json({ error: "Acesso negado" }, 403);
      const s = validateShow(body.show ?? {});

      // TRAVA 0: data bloqueada (gerente bypassa)
      if (!isManager) {
        const blockRows = await sql`
          select artist_id, motivo from public.blocked_dates
          where data = ${s.data_show}
            and (artist_id = ${s.artist_id} or artist_id is null)
          limit 1
        `;
        if (blockRows.length) {
          const b: any = blockRows[0];
          const escopo = b.artist_id ? "para este artista" : "para todos os artistas";
          const motivo = b.motivo ? ` (motivo: ${b.motivo})` : "";
          return json({ error: `Esta data está bloqueada ${escopo}${motivo}. Fale com a gerência.` }, 409);
        }
      }

      // TRAVA 1: limite de shows por artista no dia
      const maxPerDay = await getSetting(sql, "max_shows_per_artist_per_day", 3);
      const countRows = await sql`
        select count(*)::int as c from public.shows
        where artist_id = ${s.artist_id}
          and data_show = ${s.data_show}
          and status::text <> 'cancelada'
      `;
      if (((countRows[0] as any).c ?? 0) >= maxPerDay) {
        return json({ error: `Este artista já possui ${maxPerDay} shows cadastrados nesta data. Limite máximo atingido.` }, 409);
      }

      // TRAVA 2: cachê mínimo
      const artistRows = await sql`select cache_minimo from public.artists where id = ${s.artist_id}`;
      const cacheMin = Number((artistRows[0] as any)?.cache_minimo ?? 0);
      if (cacheMin > 0 && s.cache_total < cacheMin && !isManager) {
        return json({ error: "O cachê informado está abaixo do mínimo permitido para este artista. Somente a gerência pode autorizar valores abaixo do mínimo." }, 403);
      }

      const rows = await sql`
        insert into public.shows (
          artist_id, data_show, horario, data_subida, vendedor,
          local, tipo_estrutura, endereco, cidade, capacidade,
          contratante_nome, contratante_documento, contratante_endereco, contratante_cidade,
          contratante_cep, contratante_telefone, contratante_email,
          cache_total, condicao_pagamento, encargos_extras,
          transp_onibus, transp_van, transp_aereo, transp_excesso_bagagem, transp_observacoes,
          hosp_diaria_alimentacao, hosp_hospedagem, hosp_traslado,
          camarins_rider, autorizado_por, created_by, status, updated_at
        ) values (
          ${s.artist_id}, ${s.data_show}, ${s.horario}, current_date, ${s.vendedor},
          ${s.local}, ${s.tipo_estrutura}::estrutura_tipo, ${s.endereco}, ${s.cidade}, ${s.capacidade},
          ${s.contratante_nome}, ${s.contratante_documento}, ${s.contratante_endereco}, ${s.contratante_cidade},
          ${s.contratante_cep}, ${s.contratante_telefone}, ${s.contratante_email},
          ${s.cache_total}, ${s.condicao_pagamento}, ${s.encargos_extras},
          ${s.transp_onibus}, ${s.transp_van}, ${s.transp_aereo}, ${s.transp_excesso_bagagem}, ${s.transp_observacoes},
          ${s.hosp_diaria_alimentacao}, ${s.hosp_hospedagem}, ${s.hosp_traslado},
          ${s.camarins_rider}, ${s.autorizado_por}, ${userId}, 'pendente'::show_status, now()
        )
        returning *
      `;
      return json({ show: rows[0] });
    }

    if (action === "update") {
      if (!isEditor) return json({ error: "Apenas gerente ou equipe podem editar minutas" }, 403);
      if (typeof body.id !== "string") return json({ error: "Show inválido" }, 400);
      const s = validateShow(body.show ?? {});

      // limite por dia (excluindo o próprio show)
      const maxPerDay = await getSetting(sql, "max_shows_per_artist_per_day", 3);
      const countRows = await sql`
        select count(*)::int as c from public.shows
        where artist_id = ${s.artist_id}
          and data_show = ${s.data_show}
          and status::text <> 'cancelada'
          and id <> ${body.id}
      `;
      if (((countRows[0] as any).c ?? 0) >= maxPerDay) {
        return json({ error: `Este artista já possui ${maxPerDay} shows cadastrados nesta data. Limite máximo atingido.` }, 409);
      }

      // cachê mínimo: gerência sempre pode; equipe só se status pendente OU acima do mínimo
      const artistRows = await sql`select cache_minimo from public.artists where id = ${s.artist_id}`;
      const cacheMin = Number((artistRows[0] as any)?.cache_minimo ?? 0);
      const currentRows = await sql`select status::text as status from public.shows where id = ${body.id}`;
      if (!currentRows.length) return json({ error: "Show não encontrado" }, 404);
      const currentStatus = (currentRows[0] as any).status as string;
      if (cacheMin > 0 && s.cache_total < cacheMin && !isManager) {
        return json({ error: "O cachê informado está abaixo do mínimo permitido para este artista. Somente a gerência pode autorizar valores abaixo do mínimo." }, 403);
      }
      // se já confirmado/aguardando e cachê < mínimo → só gerente
      if (cacheMin > 0 && s.cache_total < cacheMin && currentStatus !== "pendente" && !isManager) {
        return json({ error: "Somente a gerência pode autorizar valores abaixo do mínimo após a aprovação." }, 403);
      }

      const rows = await sql`
        update public.shows set
          artist_id = ${s.artist_id},
          data_show = ${s.data_show},
          horario = ${s.horario},
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

    if (action === "approve") {
      if (!isManager) return json({ error: "Apenas gerente pode aprovar minutas" }, 403);
      if (typeof body.id !== "string") return json({ error: "Show inválido" }, 400);

      const prazoHoras = await getSetting(sql, "prazo_comprovante_horas_uteis", 48);
      const rows = await sql`
        update public.shows
          set status = 'aguardando_pagamento'::show_status,
              aprovado_por = ${userId},
              aprovado_em = now(),
              prazo_comprovante_em = public.add_business_hours(now(), ${prazoHoras}),
              aviso_12h_enviado_em = null,
              updated_at = now()
        where id = ${body.id}
        returning *, (select nome from public.artists where id = artist_id) as artist_nome
      `;
      if (rows.length === 0) return json({ error: "Show não encontrado" }, 404);
      const show: any = rows[0];
      if (show.created_by) {
        await notify(
          sql,
          show.created_by,
          "minuta_aprovada",
          "Minuta aprovada — anexar comprovante",
          `Sua minuta de ${show.artist_nome ?? "show"} em ${show.data_show} foi aprovada. Anexe o comprovante do sinal em até ${prazoHoras}h úteis.`,
          show.id,
        );
      }
      return json({ show });
    }

    if (action === "reject") {
      if (!isManager) return json({ error: "Apenas gerente pode rejeitar minutas" }, 403);
      if (typeof body.id !== "string") return json({ error: "Show inválido" }, 400);
      const motivo = txt(body.motivo, 1000);
      if (!motivo) return json({ error: "Motivo da rejeição é obrigatório" }, 400);
      const found = await sql`
        select s.*, a.nome as artist_nome
        from public.shows s left join public.artists a on a.id = s.artist_id
        where s.id = ${body.id}
      `;
      if (found.length === 0) return json({ error: "Show não encontrado" }, 404);
      const show: any = found[0];
      if (show.created_by) {
        await notify(
          sql,
          show.created_by,
          "minuta_rejeitada",
          "Minuta rejeitada",
          `Sua minuta de ${show.artist_nome ?? "show"} em ${show.data_show} foi rejeitada. Motivo: ${motivo}`,
          null,
        );
      }
      await sql`delete from public.shows where id = ${body.id}`;
      return json({ ok: true });
    }

    if (action === "upload_comprovante") {
      if (typeof body.id !== "string" || typeof body.path !== "string") return json({ error: "Dados inválidos" }, 400);
      const found = await sql`
        select s.*, a.nome as artist_nome from public.shows s
        left join public.artists a on a.id = s.artist_id
        where s.id = ${body.id}
      `;
      if (!found.length) return json({ error: "Show não encontrado" }, 404);
      const show: any = found[0];
      const isOwner = show.created_by === userId;
      if (!isOwner && !isEditor) return json({ error: "Acesso negado" }, 403);
      if (!["aguardando_pagamento", "comprovante_enviado"].includes(show.status)) {
        return json({ error: "Show não está aguardando comprovante" }, 400);
      }

      const updated = await sql`
        update public.shows set
          comprovante_url = ${body.path},
          comprovante_enviado_em = now(),
          comprovante_enviado_por = ${userId},
          status = 'comprovante_enviado'::show_status,
          updated_at = now()
        where id = ${body.id}
        returning *
      `;
      const titulo = "Comprovante recebido";
      const msg = `Comprovante do show de ${show.artist_nome ?? "—"} em ${show.data_show} foi anexado e aguarda confirmação.`;
      await notifyByRoles(sql, ["gerente", "financeiro"], "comprovante_enviado", titulo, msg, show.id);
      return json({ show: updated[0] });
    }

    if (action === "confirm_payment") {
      if (!isManager && !isFinanceiro) return json({ error: "Apenas gerente ou financeiro pode confirmar" }, 403);
      if (typeof body.id !== "string") return json({ error: "Show inválido" }, 400);
      const found = await sql`
        select s.*, a.nome as artist_nome from public.shows s
        left join public.artists a on a.id = s.artist_id
        where s.id = ${body.id}
      `;
      if (!found.length) return json({ error: "Show não encontrado" }, 404);
      const show: any = found[0];
      if (show.status !== "comprovante_enviado") return json({ error: "Comprovante ainda não foi enviado" }, 400);

      const updated = await sql`
        update public.shows set
          status = 'confirmado'::show_status,
          confirmado_por = ${userId},
          confirmado_em = now(),
          updated_at = now()
        where id = ${body.id}
        returning *
      `;
      // TODO: atualizar Google Calendar para confirmado
      if (show.created_by) {
        await notify(
          sql,
          show.created_by,
          "pagamento_confirmado",
          "Pagamento confirmado",
          `O sinal do show de ${show.artist_nome ?? "—"} em ${show.data_show} foi confirmado.`,
          show.id,
        );
      }
      return json({ show: updated[0] });
    }

    if (action === "comprovante_signed_url") {
      if (!isManager && !isStaff && !isFinanceiro) {
        // dono pode também
        const own = await sql`select created_by from public.shows where id = ${body.id}`;
        if (!own.length || (own[0] as any).created_by !== userId) return json({ error: "Acesso negado" }, 403);
      }
      const rows = await sql`select comprovante_url from public.shows where id = ${body.id}`;
      const path = (rows[0] as any)?.comprovante_url;
      if (!path) return json({ error: "Sem comprovante" }, 404);
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const { data, error } = await admin.storage.from("comprovantes").createSignedUrl(path, 600);
      if (error) return json({ error: error.message }, 500);
      return json({ url: data?.signedUrl });
    }

    if (action === "delete") {
      if (!isManager) return json({ error: "Apenas o gerente pode excluir" }, 403);
      if (typeof body.id !== "string") return json({ error: "Show inválido" }, 400);
      await sql`delete from public.shows where id = ${body.id}`;
      return json({ ok: true });
    }

    if (action === "settings") {
      const rows = await sql`select key, value from public.app_settings`;
      return json({ settings: rows });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error) {
    console.error("Erro em shows-admin", error);
    return json({ error: error instanceof Error ? error.message : "Falha ao gerenciar shows" }, 500);
  } finally {
    if (sql) await sql.end({ timeout: 3 });
  }
});
