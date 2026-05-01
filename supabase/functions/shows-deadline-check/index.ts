// Cron-invoked function: envia aviso de 12h e cancela shows que estouraram o prazo de 48h úteis.
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
    const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!databaseUrl) return json({ error: "DB url ausente" }, 500);
    sql = postgres(databaseUrl, { prepare: false, max: 1 });

    const aviso = await getSetting(sql, "aviso_antes_cancelamento_horas_uteis", 12);

    const pendentes = await sql`
      select s.id, s.created_by, s.artist_id, s.data_show, s.prazo_comprovante_em, s.aviso_12h_enviado_em,
             a.nome as artist_nome
      from public.shows s
      left join public.artists a on a.id = s.artist_id
      where s.status::text = 'aguardando_pagamento'
    `;

    let avisos = 0;
    let cancelados = 0;

    for (const r of pendentes as any[]) {
      if (!r.prazo_comprovante_em) continue;

      // cancelamento
      if (new Date(r.prazo_comprovante_em).getTime() <= Date.now()) {
        await sql`
          update public.shows set
            status = 'cancelada'::show_status,
            cancelado_em = now(),
            cancelado_motivo = 'Comprovante não anexado dentro do prazo',
            updated_at = now()
          where id = ${r.id}
        `;
        const titulo = "Show CANCELADO";
        const msg = `O show de ${r.artist_nome ?? "—"} em ${r.data_show} foi cancelado automaticamente: comprovante não anexado dentro do prazo.`;
        if (r.created_by) await notify(sql, r.created_by, "show_cancelado", titulo, msg, r.id);
        await notifyByRoles(sql, ["gerente", "financeiro"], "show_cancelado", titulo, msg, r.id);
        // TODO: remover evento do Google Calendar
        cancelados += 1;
        continue;
      }

      // aviso 12h: se faltam <= aviso_horas e ainda não foi enviado
      if (!r.aviso_12h_enviado_em) {
        // calcular se prazo - now <= aviso horas (aproximação corrida; o cron roda frequente o suficiente)
        const horasRestantes = (new Date(r.prazo_comprovante_em).getTime() - Date.now()) / 3600000;
        if (horasRestantes <= aviso) {
          await sql`update public.shows set aviso_12h_enviado_em = now() where id = ${r.id}`;
          const titulo = "Atenção: cancelamento iminente";
          const msg = `Atenção: o show ${r.artist_nome ?? "—"} em ${r.data_show} será cancelado automaticamente em ${aviso} horas caso o comprovante do sinal não seja anexado.`;
          if (r.created_by) await notify(sql, r.created_by, "prazo_12h", titulo, msg, r.id);
          await notifyByRoles(sql, ["gerente", "financeiro"], "prazo_12h", titulo, msg, r.id);
          avisos += 1;
        }
      }
    }

    return json({ ok: true, processados: pendentes.length, avisos, cancelados });
  } catch (error) {
    console.error("Erro em shows-deadline-check", error);
    return json({ error: error instanceof Error ? error.message : "Falha" }, 500);
  } finally {
    if (sql) await sql.end({ timeout: 3 });
  }
});
