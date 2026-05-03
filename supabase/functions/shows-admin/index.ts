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

function validateShow(input: any, opts: { strictBasic?: boolean } = {}) {
  if (!input || typeof input !== "object") throw new Error("Dados inválidos");
  const artist_id = txt(input.artist_id, 64);
  if (!artist_id) throw new Error("Artista é obrigatório");
  const data_show = dateOrNull(input.data_show);
  if (!data_show) throw new Error("Data do show é obrigatória");

  const horario = timeOrNull(input.horario);
  const local = txt(input.local, 200);
  const cidade = txt(input.cidade, 120);
  const cache_total = num(input.cache_total);

  if (opts.strictBasic) {
    if (!horario) throw new Error("Horário é obrigatório");
    if (!local) throw new Error("Nome do local é obrigatório");
    if (!cidade) throw new Error("Cidade é obrigatória");
    if (!(cache_total > 0)) throw new Error("Cachê total é obrigatório");
  }

  let tipo: string | null = null;
  if (input.tipo_estrutura === "aberta" || input.tipo_estrutura === "fechada") {
    tipo = input.tipo_estrutura;
  }

  return {
    artist_id,
    data_show,
    horario,
    vendedor: txt(input.vendedor, 200),
    local,
    tipo_estrutura: tipo,
    endereco: txt(input.endereco, 300),
    cidade,
    capacidade: intOrNull(input.capacidade),
    contratante_nome: txt(input.contratante_nome, 200),
    contratante_documento: txt(input.contratante_documento, 50),
    contratante_endereco: txt(input.contratante_endereco, 300),
    contratante_cidade: txt(input.contratante_cidade, 120),
    contratante_cep: txt(input.contratante_cep, 20),
    contratante_telefone: txt(input.contratante_telefone, 50),
    contratante_email: txt(input.contratante_email, 200),
    contratante_id: txt(input.contratante_id, 64),
    cache_total,
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

async function getSettingBool(sql: postgres.Sql, key: string, fallback: boolean): Promise<boolean> {
  const rows = await sql`select value from public.app_settings where key = ${key}`;
  if (!rows.length) return fallback;
  const v = (rows[0] as any).value;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true";
  return fallback;
}

const onlyDigits = (v: string | null) => (v ?? "").replace(/\D/g, "");

/**
 * Cadastro automático de contratante a partir dos dados da minuta.
 * - Se já houver contratante_id, retorna como está.
 * - Se houver documento (CPF/CNPJ), busca por documento normalizado.
 *   - Encontrado: vincula ao existente (NÃO sobrescreve dados).
 *   - Não encontrado: cria novo com os dados da minuta e vincula.
 * - Configurável via app_settings.auto_link_contratante (default: true).
 */
async function autoLinkContratante(
  sql: postgres.Sql,
  s: any,
  userId: string,
): Promise<string | null> {
  if (s.contratante_id) return s.contratante_id;
  const enabled = await getSettingBool(sql, "auto_link_contratante", true);
  if (!enabled) return null;
  const doc = onlyDigits(s.contratante_documento);
  const nome = s.contratante_nome;
  // Sem documento e sem nome: nada a fazer
  if (!doc && !nome) return null;

  // Busca por documento normalizado (remove máscara dos dois lados)
  if (doc) {
    const found = await sql`
      select id from public.contratantes
      where regexp_replace(coalesce(documento, ''), '[^0-9]', '', 'g') = ${doc}
      limit 1
    `;
    if (found.length) return (found[0] as any).id as string;
  }

  // Sem nome → não cria
  if (!nome) return null;

  const inserted = await sql`
    insert into public.contratantes (
      nome, documento, endereco, cidade, cep, telefone, email, created_by
    ) values (
      ${nome}, ${doc || s.contratante_documento}, ${s.contratante_endereco},
      ${s.contratante_cidade}, ${s.contratante_cep}, ${s.contratante_telefone},
      ${s.contratante_email}, ${userId}
    )
    returning id
  `;
  return (inserted[0] as any).id as string;
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
          select s.*,
            to_char(s.data_show, 'YYYY-MM-DD') as data_show,
            to_char(s.data_subida, 'YYYY-MM-DD') as data_subida,
            a.nome as artist_nome, a.cor as artist_cor, a.cache_minimo as artist_cache_minimo
          from public.shows s
          left join public.artists a on a.id = s.artist_id
          order by s.data_show desc nulls last, s.created_at desc
        `;
        return json({ shows: rows, scope: canSeeAll && !isEditor ? "financeiro" : "all" });
      }
      if (isVendedor) {
        const allowedRows = await sql`select artist_id from public.vendedor_artists where vendedor_id = ${userId}`;
        const allowed = (allowedRows as any[]).map((r) => r.artist_id);
        const minhas = await sql`
          select s.*,
            to_char(s.data_show, 'YYYY-MM-DD') as data_show,
            to_char(s.data_subida, 'YYYY-MM-DD') as data_subida,
            a.nome as artist_nome, a.cor as artist_cor, a.cache_minimo as artist_cache_minimo
          from public.shows s
          left join public.artists a on a.id = s.artist_id
          where s.created_by = ${userId}
          order by s.data_show desc nulls last, s.created_at desc
        `;
        const outras = allowed.length
          ? await sql`
              select id, artist_id, artist_nome, artist_cor,
                to_char(data_show, 'YYYY-MM-DD') as data_show,
                horario, local, cidade, vendedor, status
              from public.shows_public_view
              where created_by is distinct from ${userId}
                and artist_id = any(${allowed}::uuid[])
                and status::text in ('aguardando_dados','aguardando_contratante','aguardando_pagamento','comprovante_enviado','confirmado','aprovada')
              order by data_show desc nulls last
            `
          : [];
        return json({ shows: minhas, outras_aprovadas: outras, allowed_artist_ids: allowed, scope: "vendedor" });
      }
      if (isArtista) {
        const rows = await sql`
          select s.*,
            to_char(s.data_show, 'YYYY-MM-DD') as data_show,
            to_char(s.data_subida, 'YYYY-MM-DD') as data_subida,
            a.nome as artist_nome, a.cor as artist_cor, a.cache_minimo as artist_cache_minimo
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
      const onlyVendedor = isVendedor && !isManager && !isStaff;
      if (onlyVendedor) {
        const rows = await sql`
          select a.id, a.nome, a.cor, a.cache_minimo
          from public.artists a
          join public.vendedor_artists va on va.artist_id = a.id
          where a.ativo = true and va.vendedor_id = ${userId}
          order by a.nome
        `;
        return json({ artists: rows });
      }
      const rows = await sql`select id, nome, cor, cache_minimo from public.artists where ativo = true order by nome`;
      return json({ artists: rows });
    }

    if (action === "create") {
      if (!canCreate) return json({ error: "Acesso negado" }, 403);
      // ETAPA 1: somente os 5 campos básicos são exigidos.
      const s = validateShow(body.show ?? {}, { strictBasic: true });

      // Vendedor só pode criar para artistas liberados
      if (isVendedor && !isManager && !isStaff) {
        const ok = await sql`select 1 from public.vendedor_artists where vendedor_id = ${userId} and artist_id = ${s.artist_id} limit 1`;
        if (!ok.length) return json({ error: "Você não tem permissão para vender shows deste artista." }, 403);
      }

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

      // Cadastro/vínculo automático de contratante (piloto: configurável via app_settings.auto_link_contratante)
      try { s.contratante_id = await autoLinkContratante(sql, s, userId); } catch (e) { console.error("autoLinkContratante (create)", e); }

      const rows = await sql`
        insert into public.shows (
          artist_id, data_show, horario, data_subida, vendedor,
          local, tipo_estrutura, endereco, cidade, capacidade,
          contratante_nome, contratante_documento, contratante_endereco, contratante_cidade,
          contratante_cep, contratante_telefone, contratante_email, contratante_id,
          cache_total, condicao_pagamento, encargos_extras,
          transp_onibus, transp_van, transp_aereo, transp_excesso_bagagem, transp_observacoes,
          hosp_diaria_alimentacao, hosp_hospedagem, hosp_traslado,
          camarins_rider, autorizado_por, created_by, status, updated_at
        ) values (
          ${s.artist_id}, ${s.data_show}, ${s.horario}, current_date, ${s.vendedor},
          ${s.local}, ${s.tipo_estrutura}::estrutura_tipo, ${s.endereco}, ${s.cidade}, ${s.capacidade},
          ${s.contratante_nome}, ${s.contratante_documento}, ${s.contratante_endereco}, ${s.contratante_cidade},
          ${s.contratante_cep}, ${s.contratante_telefone}, ${s.contratante_email}, ${s.contratante_id},
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

      // Cadastro/vínculo automático de contratante
      try { s.contratante_id = await autoLinkContratante(sql, s, userId); } catch (e) { console.error("autoLinkContratante (update)", e); }

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
          contratante_id = ${s.contratante_id},
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

    // ETAPA 2 — Aprovação básica: status vai para 'aguardando_dados'.
    // O vendedor ainda precisa completar os dados (Etapa 3) antes de iniciar o prazo do sinal.
    if (action === "approve") {
      if (!isManager) return json({ error: "Apenas gerente pode aprovar minutas" }, 403);
      if (typeof body.id !== "string") return json({ error: "Show inválido" }, 400);

      const existing = await sql`select created_by from public.shows where id = ${body.id}`;
      if (existing.length === 0) return json({ error: "Show não encontrado" }, 404);
      const isAuto = existing[0].created_by === userId;
      const rows = await sql`
        update public.shows
          set status = 'aguardando_dados'::show_status,
              aprovado_por = ${userId},
              aprovado_em = now(),
              auto_aprovado = ${isAuto},
              auto_aprovado_em = ${isAuto ? sql`now()` : null},
              rejeitada_motivo = null,
              rejeitada_em = null,
              rejeitada_por = null,
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
          "Minuta aprovada — complete os dados",
          `Sua minuta de ${show.artist_nome ?? "show"} em ${show.local ?? "local"} dia ${show.data_show} foi aprovada! Complete os dados para prosseguir.`,
          show.id,
        );
      }
      return json({ show });
    }

    // ETAPA 2 — Rejeição: NÃO exclui mais a minuta. Mantém com status 'rejeitada'
    // e o motivo, para o vendedor ver o histórico.
    if (action === "reject") {
      if (!isManager) return json({ error: "Apenas gerente pode rejeitar minutas" }, 403);
      if (typeof body.id !== "string") return json({ error: "Show inválido" }, 400);
      const motivo = txt(body.motivo, 1000);
      if (!motivo) return json({ error: "Motivo da rejeição é obrigatório" }, 400);
      const rows = await sql`
        update public.shows set
          status = 'rejeitada'::show_status,
          rejeitada_motivo = ${motivo},
          rejeitada_em = now(),
          rejeitada_por = ${userId},
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
          "minuta_rejeitada",
          "Minuta rejeitada",
          `Sua minuta de ${show.artist_nome ?? "show"} em ${show.data_show} foi rejeitada. Motivo: ${motivo}`,
          show.id,
        );
      }
      return json({ ok: true, show });
    }

    // ETAPA 3 — Vendedor (ou gerência/equipe) completa os dados após aprovação.
    // Ao concluir: status -> 'aguardando_pagamento', inicia contagem de 48h úteis para o sinal,
    // notifica gerência + financeiro.
    if (action === "complete_data") {
      if (typeof body.id !== "string") return json({ error: "Show inválido" }, 400);
      const owner = await sql`select created_by, status::text as status from public.shows where id = ${body.id}`;
      if (!owner.length) return json({ error: "Show não encontrado" }, 404);
      const sh0: any = owner[0];
      const isOwner = sh0.created_by === userId;
      if (!isOwner && !isEditor) return json({ error: "Acesso negado" }, 403);
      if (!["aguardando_dados", "aguardando_contratante", "pendente"].includes(sh0.status) && !isEditor) {
        return json({ error: "Esta minuta não está aguardando dados completos." }, 400);
      }

      const s = validateShow(body.show ?? {});
      // Validações mínimas dos dados completos
      if (!s.contratante_nome) return json({ error: "Nome do contratante é obrigatório" }, 400);
      if (!s.condicao_pagamento) return json({ error: "Condição de pagamento é obrigatória" }, 400);

      try { s.contratante_id = await autoLinkContratante(sql, s, userId); } catch (e) { console.error("autoLinkContratante (complete_data)", e); }

      const prazoHoras = await getSetting(sql, "prazo_comprovante_horas_uteis", 48);
      const rows = await sql`
        update public.shows set
          horario = coalesce(${s.horario}, horario),
          local = coalesce(${s.local}, local),
          tipo_estrutura = ${s.tipo_estrutura}::estrutura_tipo,
          endereco = ${s.endereco},
          cidade = coalesce(${s.cidade}, cidade),
          capacidade = ${s.capacidade},
          contratante_nome = ${s.contratante_nome},
          contratante_documento = ${s.contratante_documento},
          contratante_endereco = ${s.contratante_endereco},
          contratante_cidade = ${s.contratante_cidade},
          contratante_cep = ${s.contratante_cep},
          contratante_telefone = ${s.contratante_telefone},
          contratante_email = ${s.contratante_email},
          contratante_id = ${s.contratante_id},
          condicao_pagamento = ${s.condicao_pagamento},
          encargos_extras = ${s.encargos_extras},
          transp_onibus = ${s.transp_onibus}, transp_van = ${s.transp_van},
          transp_aereo = ${s.transp_aereo}, transp_excesso_bagagem = ${s.transp_excesso_bagagem},
          transp_observacoes = ${s.transp_observacoes},
          hosp_diaria_alimentacao = ${s.hosp_diaria_alimentacao},
          hosp_hospedagem = ${s.hosp_hospedagem}, hosp_traslado = ${s.hosp_traslado},
          camarins_rider = ${s.camarins_rider},
          autorizado_por = ${s.autorizado_por},
          contratante_link_token = null,
          contratante_link_expires_at = null,
          status = 'aguardando_pagamento'::show_status,
          dados_completos_em = now(),
          prazo_comprovante_em = public.add_business_hours_br(now(), ${prazoHoras}),
          aviso_12h_enviado_em = null,
          updated_at = now()
        where id = ${body.id}
        returning *, (select nome from public.artists where id = artist_id) as artist_nome
      `;
      const show: any = rows[0];
      const local = show.local ?? "local não informado";
      const msg = `Minuta de ${show.artist_nome ?? "—"} em ${local} dia ${show.data_show} com dados completos. Aguardando comprovante do sinal (${prazoHoras}h úteis).`;
      await notifyByRoles(sql, ["gerente", "financeiro"], "dados_completos", "Minuta com dados completos", msg, show.id);
      return json({ show });
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
      if (!isFinanceiro) return json({ error: "Apenas o financeiro pode confirmar pagamentos" }, 403);
      if (typeof body.id !== "string") return json({ error: "Show inválido" }, 400);
      const found = await sql`
        select s.*, a.nome as artist_nome from public.shows s
        left join public.artists a on a.id = s.artist_id
        where s.id = ${body.id}
      `;
      if (!found.length) return json({ error: "Show não encontrado" }, 404);
      const show: any = found[0];
      if (show.status === "confirmado") return json({ error: "Pagamento já confirmado" }, 400);
      if (show.status === "cancelada") return json({ error: "Show cancelado" }, 400);

      // snapshot do nome do financeiro
      const profRows = await sql`select nome from public.profiles where id = ${userId}`;
      const finNome = (profRows[0] as any)?.nome ?? "Financeiro";

      const updated = await sql`
        update public.shows set
          status = 'confirmado'::show_status,
          confirmado_por = ${userId},
          confirmado_por_nome = ${finNome},
          confirmado_em = now(),
          updated_at = now()
        where id = ${body.id}
        returning *
      `;
      const local = show.local ?? "local não informado";
      const msg = `Pagamento do show ${show.artist_nome ?? "—"} em ${local} dia ${show.data_show} confirmado por ${finNome}.`;
      // Vendedor (criador)
      if (show.created_by) {
        await notify(sql, show.created_by, "pagamento_confirmado", "Pagamento confirmado", msg, show.id);
      }
      // Gerência
      await notifyByRoles(sql, ["gerente"], "pagamento_confirmado", "Pagamento confirmado", msg, show.id);
      return json({ show: updated[0] });
    }

    // ============================================================
    // ANEXOS (múltiplos comprovantes / documentos)
    // ============================================================
    if (action === "add_attachment") {
      if (typeof body.show_id !== "string" || typeof body.path !== "string" || typeof body.file_name !== "string") {
        return json({ error: "Dados inválidos" }, 400);
      }
      const showRows = await sql`select id, created_by, artist_id, data_show, local, (select nome from public.artists where id = artist_id) as artist_nome from public.shows where id = ${body.show_id}`;
      if (!showRows.length) return json({ error: "Show não encontrado" }, 404);
      const sh: any = showRows[0];
      const isOwner = sh.created_by === userId;
      if (!isOwner && !isEditor && !isFinanceiro) return json({ error: "Acesso negado" }, 403);

      const tipo = txt(body.tipo, 30) ?? "comprovante";
      const mime = txt(body.mime_type, 100);
      const size = body.size_bytes ? Number(body.size_bytes) : null;

      const profRows = await sql`select nome from public.profiles where id = ${userId}`;
      const upNome = (profRows[0] as any)?.nome ?? null;

      const ins = await sql`
        insert into public.show_attachments (show_id, tipo, file_path, file_name, mime_type, size_bytes, uploaded_by, uploaded_by_nome)
        values (${body.show_id}, ${tipo}, ${body.path}, ${body.file_name}, ${mime}, ${size}, ${userId}, ${upNome})
        returning *
      `;

      // Atualiza compatibilidade do show + status (se for comprovante e ainda aguardando)
      if (tipo === "comprovante") {
        await sql`
          update public.shows set
            comprovante_url = coalesce(comprovante_url, ${body.path}),
            comprovante_enviado_em = coalesce(comprovante_enviado_em, now()),
            comprovante_enviado_por = coalesce(comprovante_enviado_por, ${userId}),
            status = case when status = 'aguardando_pagamento'::show_status then 'comprovante_enviado'::show_status else status end,
            updated_at = now()
          where id = ${body.show_id}
        `;
        // Notifica gerência/financeiro
        const msg = `Novo comprovante anexado ao show de ${sh.artist_nome ?? "—"} em ${sh.data_show}.`;
        await notifyByRoles(sql, ["gerente", "financeiro"], "comprovante_enviado", "Comprovante recebido", msg, sh.id);
      }
      return json({ attachment: ins[0] });
    }

    if (action === "list_attachments") {
      if (typeof body.show_id !== "string") return json({ error: "Show inválido" }, 400);
      const showRows = await sql`select created_by from public.shows where id = ${body.show_id}`;
      if (!showRows.length) return json({ error: "Show não encontrado" }, 404);
      if (isArtista && !isEditor && !isFinanceiro) return json({ error: "Acesso negado" }, 403);

      let rows;
      if (isEditor || isFinanceiro) {
        rows = await sql`select * from public.show_attachments where show_id = ${body.show_id} order by created_at desc`;
      } else if (isVendedor) {
        rows = await sql`select * from public.show_attachments where show_id = ${body.show_id} and uploaded_by = ${userId} order by created_at desc`;
      } else {
        return json({ error: "Acesso negado" }, 403);
      }
      return json({ attachments: rows });
    }

    if (action === "attachment_signed_url") {
      if (typeof body.id !== "string") return json({ error: "Anexo inválido" }, 400);
      const rows = await sql`select a.*, s.created_by as show_created_by from public.show_attachments a join public.shows s on s.id = a.show_id where a.id = ${body.id}`;
      if (!rows.length) return json({ error: "Anexo não encontrado" }, 404);
      const att: any = rows[0];
      const allowed = isEditor || isFinanceiro || (isVendedor && att.uploaded_by === userId);
      if (!allowed) return json({ error: "Acesso negado" }, 403);
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const { data, error } = await admin.storage.from("comprovantes").createSignedUrl(att.file_path, 600);
      if (error) return json({ error: error.message }, 500);
      return json({ url: data?.signedUrl });
    }

    if (action === "delete_attachment") {
      if (!isManager && !isFinanceiro) return json({ error: "Apenas gerência ou financeiro podem excluir anexos" }, 403);
      if (typeof body.id !== "string") return json({ error: "Anexo inválido" }, 400);
      const rows = await sql`select * from public.show_attachments where id = ${body.id}`;
      if (!rows.length) return json({ error: "Anexo não encontrado" }, 404);
      const att: any = rows[0];
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      await admin.storage.from("comprovantes").remove([att.file_path]);
      await sql`delete from public.show_attachments where id = ${body.id}`;
      return json({ ok: true });
    }

    // ============================================================
    // PAGAMENTOS (baixa manual)
    // ============================================================
    if (action === "finance_summary") {
      // Visão financeira consolidada (shows + total pago + total despesas).
      if (!isManager && !isStaff && !isFinanceiro && !isVendedor) return json({ error: "Acesso negado" }, 403);
      const restrictToOwn = !isManager && !isStaff && !isFinanceiro; // vendedor vê só os próprios
      const rows = await sql`
        select s.id, s.artist_id, s.data_show::text as data_show, s.local, s.cidade,
               s.cache_total, s.status::text as status, s.vendedor, s.created_by,
               s.confirmado_em, s.confirmado_por_nome, s.prazo_comprovante_em,
               s.aprovado_em,
               a.nome as artist_nome, a.cor as artist_cor, a.cache_minimo as artist_cache_minimo,
               coalesce(p.total_pago, 0) as total_pago,
               coalesce(e.total_despesas, 0) as total_despesas
        from public.shows s
        left join public.artists a on a.id = s.artist_id
        left join (
          select show_id, sum(valor) as total_pago from public.show_payments group by show_id
        ) p on p.show_id = s.id
        left join (
          select show_id, sum(valor) as total_despesas from public.show_expenses group by show_id
        ) e on e.show_id = s.id
        where ${restrictToOwn ? sql`s.created_by = ${userId}` : sql`true`}
        order by s.data_show desc nulls last
      `;
      return json({ shows: rows });
    }

    if (action === "list_payments") {
      if (typeof body.show_id !== "string") return json({ error: "Show inválido" }, 400);
      if (isArtista && !isEditor && !isFinanceiro) return json({ error: "Acesso negado" }, 403);
      const rows = await sql`select * from public.show_payments where show_id = ${body.show_id} order by data_pagamento desc, created_at desc`;
      return json({ payments: rows });
    }

    if (action === "register_payment") {
      if (!isFinanceiro) return json({ error: "Apenas o financeiro pode registrar pagamentos" }, 403);
      if (typeof body.show_id !== "string") return json({ error: "Show inválido" }, 400);
      const valor = num(body.valor);
      if (valor <= 0) return json({ error: "Valor é obrigatório" }, 400);
      const dataPg = dateOrNull(body.data_pagamento);
      if (!dataPg) return json({ error: "Data do pagamento é obrigatória" }, 400);
      const forma = txt(body.forma_pagamento, 20) ?? "pix";
      if (!["pix", "transferencia", "especie", "outro"].includes(forma)) {
        return json({ error: "Forma de pagamento inválida" }, 400);
      }
      const conta = txt(body.conta_destino, 200);
      const obs = txt(body.observacoes, 2000);
      const attachmentId = body.attachment_id ? txt(body.attachment_id, 64) : null;
      if (!attachmentId && !obs) return json({ error: "Observações são obrigatórias quando não há comprovante" }, 400);

      const profRows = await sql`select nome from public.profiles where id = ${userId}`;
      const finNome = (profRows[0] as any)?.nome ?? "Financeiro";

      const ins = await sql`
        insert into public.show_payments (show_id, valor, data_pagamento, forma_pagamento, conta_destino, observacoes, attachment_id, registrado_por, registrado_por_nome)
        values (${body.show_id}, ${valor}, ${dataPg}, ${forma}, ${conta}, ${obs}, ${attachmentId}, ${userId}, ${finNome})
        returning *
      `;

      const showRows = await sql`select s.*, a.nome as artist_nome from public.shows s left join public.artists a on a.id = s.artist_id where s.id = ${body.show_id}`;
      if (showRows.length) {
        const sh: any = showRows[0];
        const msg = `${finNome} registrou pagamento de R$ ${valor.toFixed(2)} para o show de ${sh.artist_nome ?? "—"} em ${sh.data_show}.`;
        if (sh.created_by) await notify(sql, sh.created_by, "pagamento_registrado", "Pagamento registrado", msg, sh.id);
        await notifyByRoles(sql, ["gerente"], "pagamento_registrado", "Pagamento registrado", msg, sh.id);
      }
      return json({ payment: ins[0] });
    }

    if (action === "delete_payment") {
      if (!isFinanceiro) return json({ error: "Apenas o financeiro pode excluir pagamentos" }, 403);
      if (typeof body.id !== "string") return json({ error: "Pagamento inválido" }, 400);
      await sql`delete from public.show_payments where id = ${body.id}`;
      return json({ ok: true });
    }

    // ============================================================
    // PARCELAS DE PAGAMENTO (cronograma)
    // ============================================================
    if (action === "list_payment_schedule") {
      if (typeof body.show_id !== "string") return json({ error: "Show inválido" }, 400);
      // Permissão coberta por RLS, mas validamos conta/papel
      const access = await sql`
        select 1 from public.shows s where s.id = ${body.show_id}
        and (
          ${isManager} or ${isStaff} or ${isFinanceiro}
          or (${isVendedor} and s.created_by = ${userId})
          or (${isArtista} and s.artist_id = (select artist_id from public.user_roles where user_id = ${userId} and role = 'artista' limit 1))
        ) limit 1`;
      if (!access.length) return json({ error: "Acesso negado" }, 403);
      const rows = await sql`select * from public.show_payment_schedule where show_id = ${body.show_id} order by ordem asc, data_prevista asc nulls last, created_at asc`;
      const totalPaidRows = await sql`select coalesce(sum(valor),0)::numeric as total from public.show_payments where show_id = ${body.show_id}`;
      const cacheRows = await sql`select cache_total from public.shows where id = ${body.show_id}`;
      return json({
        schedule: rows,
        total_pago: Number((totalPaidRows[0] as any)?.total ?? 0),
        cache_total: Number((cacheRows[0] as any)?.cache_total ?? 0),
      });
    }

    if (action === "save_payment_schedule") {
      if (typeof body.show_id !== "string") return json({ error: "Show inválido" }, 400);
      // Quem pode editar: gerente/equipe/financeiro/vendedor dono
      const ownRows = await sql`select created_by from public.shows where id = ${body.show_id}`;
      if (!ownRows.length) return json({ error: "Show não encontrado" }, 404);
      const isOwner = (ownRows[0] as any).created_by === userId;
      if (!isManager && !isStaff && !isFinanceiro && !(isVendedor && isOwner)) {
        return json({ error: "Acesso negado" }, 403);
      }
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length > 50) return json({ error: "Máximo de 50 parcelas" }, 400);
      const cleaned = items.map((it: any, idx: number) => ({
        ordem: Number.isInteger(it?.ordem) ? it.ordem : idx,
        descricao: txt(it?.descricao, 200),
        data_prevista: dateOrNull(it?.data_prevista),
        percentual: it?.percentual === null || it?.percentual === undefined || it?.percentual === "" ? null : num(it.percentual),
        valor: num(it?.valor),
        observacoes: txt(it?.observacoes, 1000),
      }));
      await sql.begin(async (tx) => {
        await tx`delete from public.show_payment_schedule where show_id = ${body.show_id}`;
        for (const it of cleaned) {
          await tx`insert into public.show_payment_schedule
            (show_id, ordem, descricao, data_prevista, percentual, valor, observacoes)
            values (${body.show_id}, ${it.ordem}, ${it.descricao}, ${it.data_prevista}, ${it.percentual}, ${it.valor}, ${it.observacoes})`;
        }
      });
      return json({ ok: true });
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

    if (action === "list_blocks") {
      const rows = await sql`
        select b.id, b.artist_id, a.nome as artist_nome, a.cor as artist_cor,
               b.data, b.motivo, b.created_at, b.created_by,
               p.nome as created_by_nome
        from public.blocked_dates b
        left join public.artists a on a.id = b.artist_id
        left join public.profiles p on p.id = b.created_by
        order by b.data desc
      `;
      return json({ blocks: rows });
    }

    if (action === "create_block") {
      if (!isManager) return json({ error: "Apenas o gerente pode bloquear datas" }, 403);
      const data = dateOrNull(body.data);
      if (!data) return json({ error: "Data é obrigatória" }, 400);
      const artist_id = body.artist_id ? txt(body.artist_id, 64) : null;
      const motivo = txt(body.motivo, 500);
      try {
        const rows = await sql`
          insert into public.blocked_dates (artist_id, data, motivo, created_by)
          values (${artist_id}, ${data}, ${motivo}, ${userId})
          returning *
        `;
        // Notifica o artista (se for bloqueio específico)
        if (artist_id) {
          const userRows = await sql`
            select user_id from public.user_roles
            where role = 'artista' and artist_id = ${artist_id}
          `;
          for (const u of userRows as any[]) {
            await notify(
              sql,
              u.user_id,
              "data_bloqueada",
              "Sua agenda foi bloqueada",
              `Sua agenda foi bloqueada em ${data}${motivo ? ` — motivo: ${motivo}` : ""}.`,
              null,
            );
          }
        }
        return json({ block: rows[0] });
      } catch (e: any) {
        if (String(e?.message ?? "").includes("duplicate")) {
          return json({ error: "Já existe um bloqueio para esta data e artista." }, 409);
        }
        throw e;
      }
    }

    if (action === "delete_block") {
      if (!isManager) return json({ error: "Apenas o gerente pode remover bloqueios" }, 403);
      if (typeof body.id !== "string") return json({ error: "Bloqueio inválido" }, 400);
      await sql`delete from public.blocked_dates where id = ${body.id}`;
      return json({ ok: true });
    }

    // ============================================================
    // CANCELAR SHOW (somente gerência)
    // ============================================================
    if (action === "cancel") {
      if (!isManager) return json({ error: "Apenas o gerente pode cancelar shows" }, 403);
      if (typeof body.id !== "string") return json({ error: "Show inválido" }, 400);
      const motivo = txt(body.motivo, 1000);
      if (!motivo) return json({ error: "Motivo do cancelamento é obrigatório" }, 400);

      const found = await sql`
        select s.*, a.nome as artist_nome
        from public.shows s left join public.artists a on a.id = s.artist_id
        where s.id = ${body.id}
      `;
      if (!found.length) return json({ error: "Show não encontrado" }, 404);
      const show: any = found[0];
      if (show.status === "cancelada") return json({ error: "Show já está cancelado" }, 400);

      const updated = await sql`
        update public.shows set
          status = 'cancelada'::show_status,
          cancelado_em = now(),
          cancelado_motivo = ${motivo},
          updated_at = now()
        where id = ${body.id}
        returning *
      `;

      // Notificações
      const dataFmt = show.data_show;
      const local = show.local ?? "local não informado";
      const artista = show.artist_nome ?? "—";
      const tituloComMotivo = "Show cancelado";
      const msgComMotivo = `O show de ${artista} em ${local} no dia ${dataFmt} foi cancelado. Motivo: ${motivo}`;
      const msgSemMotivo = `O show de ${artista} em ${local} no dia ${dataFmt} foi cancelado.`;

      // Gerência + Financeiro: com motivo
      await notifyByRoles(sql, ["gerente", "financeiro"], "show_cancelado", tituloComMotivo, msgComMotivo, body.id);

      // Artista vinculado: com motivo
      if (show.artist_id) {
        const artistUsers = await sql`
          select user_id from public.user_roles
          where role = 'artista' and artist_id = ${show.artist_id}
        `;
        for (const u of artistUsers as any[]) {
          await notify(sql, u.user_id, "show_cancelado", tituloComMotivo, msgComMotivo, body.id);
        }
      }

      // Vendedor (criador): sem motivo
      if (show.created_by) {
        await notify(sql, show.created_by, "show_cancelado", tituloComMotivo, msgSemMotivo, body.id);
      }

      return json({ show: updated[0] });
    }

    // ============================================================
    // REMARCAR SHOW (somente gerência)
    // ============================================================
    if (action === "reschedule") {
      if (!isManager) return json({ error: "Apenas o gerente pode remarcar shows" }, 403);
      if (typeof body.id !== "string") return json({ error: "Show inválido" }, 400);
      const novaData = dateOrNull(body.nova_data);
      if (!novaData) return json({ error: "Nova data é obrigatória" }, 400);
      const novoHorario = timeOrNull(body.novo_horario);
      if (!novoHorario) return json({ error: "Novo horário é obrigatório" }, 400);
      const motivo = txt(body.motivo, 1000);
      if (!motivo) return json({ error: "Motivo da remarcação é obrigatório" }, 400);

      const found = await sql`
        select s.*, a.nome as artist_nome
        from public.shows s left join public.artists a on a.id = s.artist_id
        where s.id = ${body.id}
      `;
      if (!found.length) return json({ error: "Show não encontrado" }, 404);
      const show: any = found[0];
      if (show.status === "cancelada") {
        return json({ error: "Show cancelado não pode ser remarcado" }, 400);
      }

      const dataAnterior = show.data_show;
      const horarioAnterior = show.horario;
      const dataOriginal = show.data_show_original ?? dataAnterior;
      const horarioOriginal = show.horario_original ?? horarioAnterior;

      // Atualiza o próprio registro com a nova data/horário e o histórico
      const updated = await sql`
        update public.shows set
          data_show = ${novaData},
          horario = ${novoHorario},
          data_show_original = ${dataOriginal},
          horario_original = ${horarioOriginal},
          remarcado_count = coalesce(remarcado_count, 0) + 1,
          ultima_remarcacao_em = now(),
          ultima_remarcacao_motivo = ${motivo},
          ultima_remarcacao_por = ${userId},
          updated_at = now()
        where id = ${body.id}
        returning *
      `;

      // Nome de quem remarcou
      const profRows = await sql`select nome from public.profiles where id = ${userId}`;
      const remarcadoPorNome = (profRows[0] as any)?.nome ?? null;

      // Insere no histórico
      await sql`
        insert into public.show_reschedules (
          show_id, show_anterior_id, data_anterior, horario_anterior,
          data_nova, horario_novo, motivo, remarcado_por, remarcado_por_nome
        ) values (
          ${body.id}, ${body.id}, ${dataAnterior}, ${horarioAnterior},
          ${novaData}, ${novoHorario}, ${motivo}, ${userId}, ${remarcadoPorNome}
        )
      `;

      // Notificações
      const artista = show.artist_nome ?? "—";
      const local = show.local ?? "local não informado";
      const horaFmt = String(novoHorario).slice(0, 5);
      const tituloMsg = "Show remarcado";
      const msgComMotivo = `O show de ${artista} em ${local} foi remarcado para ${novaData} às ${horaFmt}. Motivo: ${motivo}`;
      const msgSemMotivo = `O show de ${artista} em ${local} foi remarcado para ${novaData} às ${horaFmt}.`;

      await notifyByRoles(sql, ["gerente", "financeiro"], "show_remarcado", tituloMsg, msgComMotivo, body.id);

      if (show.artist_id) {
        const artistUsers = await sql`
          select user_id from public.user_roles
          where role = 'artista' and artist_id = ${show.artist_id}
        `;
        for (const u of artistUsers as any[]) {
          await notify(sql, u.user_id, "show_remarcado", tituloMsg, msgComMotivo, body.id);
        }
      }

      if (show.created_by) {
        await notify(sql, show.created_by, "show_remarcado", tituloMsg, msgSemMotivo, body.id);
      }

      return json({ show: updated[0] });
    }

    // ============================================================
    // LISTAR HISTÓRICO DE REMARCAÇÕES
    // ============================================================
    if (action === "list_reschedules") {
      if (typeof body.id !== "string") return json({ error: "Show inválido" }, 400);
      // gerência, financeiro, equipe, artista vinculado podem ver
      const showRows = await sql`select artist_id, created_by from public.shows where id = ${body.id}`;
      if (!showRows.length) return json({ error: "Show não encontrado" }, 404);
      const sh: any = showRows[0];
      const myArtistRows = isArtista
        ? await sql`select artist_id from public.user_roles where user_id = ${userId} and role = 'artista'`
        : [];
      const myArtistIds = (myArtistRows as any[]).map((r) => r.artist_id);
      const allowed =
        isManager || isStaff || isFinanceiro ||
        (isArtista && myArtistIds.includes(sh.artist_id)) ||
        (isVendedor && sh.created_by === userId);
      if (!allowed) return json({ error: "Acesso negado" }, 403);

      const rows = await sql`
        select id, data_anterior::text as data_anterior, horario_anterior::text as horario_anterior,
               data_nova::text as data_nova, horario_novo::text as horario_novo,
               motivo, remarcado_por_nome, created_at
        from public.show_reschedules
        where show_id = ${body.id}
        order by created_at desc
      `;
      return json({ reschedules: rows });
    }

    // ============================================================
    // LINK PÚBLICO PARA O CONTRATANTE PRÉ-PREENCHER A MINUTA
    // ============================================================
    // ETAPA 3 (opção A) — gera link público para o contratante preencher os dados.
    // Requer minuta já aprovada (status aguardando_dados ou aguardando_contratante).
    if (action === "generate_contratante_link") {
      if (typeof body.id !== "string") return json({ error: "Show inválido (id obrigatório)" }, 400);
      const found = await sql`select created_by, status::text as status from public.shows where id = ${body.id}`;
      if (!found.length) return json({ error: "Show não encontrado" }, 404);
      const sh0: any = found[0];
      const isOwner = sh0.created_by === userId;
      if (!isOwner && !isEditor) return json({ error: "Acesso negado" }, 403);
      if (!["aguardando_dados", "aguardando_contratante"].includes(sh0.status)) {
        return json({ error: "A minuta precisa estar aprovada (Aguardando Dados) para gerar um link." }, 400);
      }

      const validadeHoras = await getSetting(sql, "contratante_link_validade_horas", 24);
      const upd = await sql`
        update public.shows set
          status = 'aguardando_contratante'::show_status,
          contratante_link_token = gen_random_uuid(),
          contratante_link_expires_at = now() + (${validadeHoras} || ' hours')::interval,
          contratante_link_preenchido = false,
          contratante_link_preenchido_em = null,
          updated_at = now()
        where id = ${body.id}
        returning id, contratante_link_token, contratante_link_expires_at
      `;
      return json({ show: upd[0] });
    }

    if (action === "cancel_contratante_link") {
      if (typeof body.id !== "string") return json({ error: "Show inválido" }, 400);
      const found = await sql`select created_by, status::text as status from public.shows where id = ${body.id}`;
      if (!found.length) return json({ error: "Show não encontrado" }, 404);
      const sh: any = found[0];
      if (!isManager && !isStaff && sh.created_by !== userId) return json({ error: "Acesso negado" }, 403);
      if (sh.status !== "aguardando_contratante") return json({ error: "Esta minuta não está aguardando contratante." }, 400);
      await sql`
        update public.shows set
          contratante_link_token = null,
          contratante_link_expires_at = null,
          status = 'aguardando_dados'::show_status,
          updated_at = now()
        where id = ${body.id}
      `;
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
