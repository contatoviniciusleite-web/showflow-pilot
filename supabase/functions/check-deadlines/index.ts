// Cron-invoked: envia aviso de 12h úteis e cancela shows com prazo_comprovante_em vencido.
import postgres from "npm:postgres@3.4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function notify(
  sql: postgres.Sql,
  userId: string,
  tipo: string,
  titulo: string,
  mensagem: string,
  showId: string | null,
) {
  await sql`
    insert into public.notifications (user_id, tipo, titulo, mensagem, show_id)
    values (${userId}, ${tipo}, ${titulo}, ${mensagem}, ${showId})
  `;
}

async function notifyTargets(
  sql: postgres.Sql,
  vendedorId: string | null,
  tipo: string,
  titulo: string,
  mensagem: string,
  showId: string,
) {
  const targets = new Set<string>();
  if (vendedorId) targets.add(vendedorId);
  const rows = await sql`
    select distinct user_id from public.user_roles
    where role::text in ('gerente','financeiro')
  `;
  for (const r of rows as Array<{ user_id: string }>) targets.add(r.user_id);
  for (const uid of targets) {
    await notify(sql, uid, tipo, titulo, mensagem, showId);
  }
}

async function getSetting(sql: postgres.Sql, key: string, fallback: number): Promise<number> {
  const rows = await sql`select value from public.app_settings where key = ${key}`;
  if (!rows.length) return fallback;
  const v = (rows[0] as { value: unknown }).value;
  return typeof v === "number" ? v : Number(v) || fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method === "GET") {
    return json({ ok: true, timestamp: new Date().toISOString(), message: "check-deadlines ativo" });
  }

  let sql: postgres.Sql | null = null;
  try {
    const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!databaseUrl) return json({ error: "DB url ausente" }, 500);
    sql = postgres(databaseUrl, { prepare: false, max: 1 });

    const avisoHoras = await getSetting(sql, "aviso_antes_cancelamento_horas_uteis", 12);
    const prazoHoras = await getSetting(sql, "prazo_comprovante_horas_uteis", 48);

    // limite para aviso: agora + N horas úteis (BR)
    const [{ limite }] = (await sql`
      select public.add_business_hours_br(now(), ${avisoHoras}::numeric) as limite
    `) as Array<{ limite: string }>;

    // 1) AVISO 12h úteis
    const proximos = await sql`
      select s.id, s.created_by, s.data_show, s.local, s.cidade,
             a.nome as artist_nome
      from public.shows s
      left join public.artists a on a.id = s.artist_id
      where s.status::text = 'aguardando_pagamento'
        and s.notificacao_12h_enviada = false
        and s.prazo_comprovante_em is not null
        and s.prazo_comprovante_em > now()
        and s.prazo_comprovante_em <= ${limite}
        and (s.confirmado_sem_pagamento is null or s.confirmado_sem_pagamento = false)
    `;

    let avisos = 0;
    for (const r of proximos as Array<Record<string, unknown>>) {
      const id = r.id as string;
      const titulo = "Atenção: cancelamento iminente";
      const local = [r.local, r.cidade].filter(Boolean).join(" - ") || "—";
      const msg = `Atenção: o show ${r.artist_nome ?? "—"} em ${local} dia ${r.data_show} será cancelado automaticamente em ${avisoHoras} horas caso o comprovante do sinal não seja anexado.`;
      await notifyTargets(sql, (r.created_by as string) ?? null, "prazo_proximo", titulo, msg, id);
      await sql`update public.shows set notificacao_12h_enviada = true where id = ${id}`;
      avisos += 1;
    }

    // 2) CANCELAMENTO automático
    const vencidos = await sql`
      select s.id, s.created_by, s.data_show, s.local, s.cidade,
             a.nome as artist_nome
      from public.shows s
      left join public.artists a on a.id = s.artist_id
      where s.status::text = 'aguardando_pagamento'
        and s.prazo_comprovante_em is not null
        and s.prazo_comprovante_em < now()
        and (s.confirmado_sem_pagamento is null or s.confirmado_sem_pagamento = false)
    `;

    let cancelados = 0;
    for (const r of vencidos as Array<Record<string, unknown>>) {
      const id = r.id as string;
      const motivo = `Cancelamento automático — comprovante não enviado dentro do prazo de ${prazoHoras} horas úteis.`;
      await sql`
        update public.shows set
          status = 'cancelada'::show_status,
          cancelado_em = now(),
          cancelado_motivo = ${motivo},
          updated_at = now()
        where id = ${id}
      `;
      const local = [r.local, r.cidade].filter(Boolean).join(" - ") || "—";
      const titulo = "Show CANCELADO";
      const msg = `Show ${r.artist_nome ?? "—"} em ${local} dia ${r.data_show} cancelado automaticamente por falta de comprovante dentro do prazo de ${prazoHoras}h úteis.`;
      await notifyTargets(sql, (r.created_by as string) ?? null, "show_cancelado_prazo", titulo, msg, id);
      cancelados += 1;
    }

    return json({ ok: true, avisos, cancelados });
  } catch (error) {
    console.error("check-deadlines error", error);
    return json({ error: error instanceof Error ? error.message : "Falha" }, 500);
  } finally {
    if (sql) await sql.end({ timeout: 3 });
  }
});
