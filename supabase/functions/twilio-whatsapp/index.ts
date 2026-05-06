import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM") ?? "whatsapp:+14155238886";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

async function sendWhatsApp(to: string, body: string) {
  const phone = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const params: Record<string, string> = { From: TWILIO_FROM, To: phone, Body: body };

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    },
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "Falha ao enviar WhatsApp");
  return data;
}

function fmtData(raw: any): string {
  try {
    const iso = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw).slice(0, 10);
    const [y, m, d] = iso.split("-");
    if (y && m && d) return `${d}/${m}/${y}`;
    return String(raw);
  } catch { return String(raw); }
}
function fmtHora(h: any): string {
  if (!h) return "—";
  if (h instanceof Date) return h.toISOString().slice(11, 16);
  return String(h).slice(0, 5);
}

async function notifyVendedorWhatsApp(show: any, tipo: "aprovada" | "rejeitada", motivo?: string) {
  try {
    if (!show?.created_by) return;
    const { data: vendedor } = await supabase
      .from("profiles")
      .select("telefone, nome")
      .eq("id", show.created_by)
      .maybeSingle();
    if (!vendedor?.telefone) {
      console.log(`[vendedor whatsapp] sem telefone — vendedor ${show.created_by}`);
      return;
    }
    const digits = String(vendedor.telefone).replace(/\D/g, "");
    if (!digits) return;
    const to = digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
    const artistNome = show.artists?.nome ?? show.artist_nome ?? "—";
    const localLinha = `${show.local ?? "—"}${show.cidade ? " — " + show.cidade : ""}`;
    const dataFmt = fmtData(show.data_show);
    const horaFmt = fmtHora(show.horario);
    const cacheFmt = Number(show.cache_total ?? 0).toLocaleString("pt-BR", {
      style: "currency", currency: "BRL",
    });
    const message = tipo === "aprovada"
      ? `✅ *ShowFlow — Stage*\n\nSua minuta foi APROVADA!\n\n🎤 ${artistNome} em ${localLinha}\n📅 ${dataFmt} às ${horaFmt}\n💰 Cachê: ${cacheFmt}\n\nComplete os dados do contratante para prosseguir.`
      : `❌ *ShowFlow — Stage*\n\nSua minuta foi REJEITADA.\n\n🎤 ${artistNome} em ${localLinha}\n📅 ${dataFmt}\n\nMotivo: ${motivo ?? "—"}\n\nCorrija e reenvie se necessário.`;
    await sendWhatsApp(to, message);
  } catch (e) {
    console.error("notifyVendedorWhatsApp error", e);
  }
}

async function loadShow(showId: string) {
  const { data, error } = await supabase
    .from("shows")
    .select("id, created_by, artist_id, local, cidade, data_show, horario, cache_total, status, artists(nome)")
    .eq("id", showId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Show não encontrado");
  return data as any;
}

async function notifyByRoles(roles: string[], tipo: string, titulo: string, mensagem: string, showId: string | null) {
  const { data: rows } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", roles);
  if (!rows?.length) return;
  const seen = new Set<string>();
  const inserts = rows
    .filter((r: any) => r.user_id && !seen.has(r.user_id) && (seen.add(r.user_id), true))
    .map((r: any) => ({ user_id: r.user_id, tipo, titulo, mensagem, show_id: showId }));
  if (inserts.length) await supabase.from("notifications").insert(inserts);
}

async function approveShow(showId: string, diretorUserId: string | null) {
  const show = await loadShow(showId);
  let diretorNome = "Diretor";
  if (diretorUserId) {
    const { data: prof } = await supabase.from("profiles").select("nome").eq("id", diretorUserId).maybeSingle();
    if (prof?.nome) diretorNome = prof.nome;
  }
  const isAuto = show.created_by === diretorUserId;
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("shows")
    .update({
      status: "aprovada",
      aprovado_por: diretorUserId,
      aprovado_em: nowIso,
      autorizado_por_user_id: diretorUserId,
      autorizado_por_nome: diretorNome,
      autorizado_em: nowIso,
      autorizado_por: diretorNome,
      auto_aprovado: isAuto,
      auto_aprovado_em: isAuto ? nowIso : null,
      rejeitada_motivo: null,
      rejeitada_em: null,
      rejeitada_por: null,
    })
    .eq("id", showId);
  if (error) throw error;
  const artistNome = show.artists?.nome ?? "show";
  if (show.created_by) {
    await supabase.from("notifications").insert({
      user_id: show.created_by,
      tipo: "minuta_aprovada",
      titulo: "Minuta aprovada — complete os dados",
      mensagem: `Sua minuta de ${artistNome} em ${show.local ?? "local"} dia ${show.data_show} foi aprovada via WhatsApp! Complete os dados para prosseguir.`,
      show_id: showId,
    });
  }
  await notifyByRoles(
    ["gerente", "financeiro"],
    "minuta_aprovada",
    "Minuta aprovada",
    `Minuta de ${artistNome} em ${show.local ?? "local"} dia ${show.data_show} foi aprovada por ${diretorNome} (via WhatsApp).`,
    showId,
  );
  await notifyVendedorWhatsApp(show, "aprovada");
}

async function rejectShow(showId: string, diretorUserId: string | null, motivo: string) {
  const show = await loadShow(showId);
  const { error } = await supabase
    .from("shows")
    .update({
      status: "rejeitada",
      rejeitada_motivo: motivo,
      rejeitada_em: new Date().toISOString(),
      rejeitada_por: diretorUserId,
    })
    .eq("id", showId);
  if (error) throw error;
  const artistNome = show.artists?.nome ?? "show";
  if (show.created_by) {
    await supabase.from("notifications").insert({
      user_id: show.created_by,
      tipo: "minuta_rejeitada",
      titulo: "Minuta rejeitada",
      mensagem: `Sua minuta de ${artistNome} em ${show.data_show} foi rejeitada via WhatsApp. Motivo: ${motivo}`,
      show_id: showId,
    });
  }
  await notifyByRoles(
    ["gerente"],
    "minuta_rejeitada",
    "Minuta rejeitada",
    `Minuta de ${artistNome} em ${show.data_show} foi rejeitada (via WhatsApp). Motivo: ${motivo}`,
    showId,
  );
  await notifyVendedorWhatsApp(show, "rejeitada", motivo);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // WEBHOOK — respostas do WhatsApp (Twilio envia application/x-www-form-urlencoded)
    if (req.method === "POST" && url.pathname.endsWith("/webhook")) {
      const form = await req.formData();
      const from = form.get("From")?.toString() ?? "";
      const body = (form.get("Body")?.toString() ?? "").trim().toUpperCase();
      const phone = from.replace("whatsapp:", "");

      const { data: pending } = await supabase
        .from("whatsapp_pending_actions")
        .select("*")
        .eq("phone", phone)
        .eq("status", "aguardando")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pending) {
        if (["1", "SIM", "APROVAR"].includes(body)) {
          try {
            await approveShow(pending.show_id, pending.user_id);
            await supabase
              .from("whatsapp_pending_actions")
              .update({ status: "resolvido", resposta: "aprovado" })
              .eq("id", pending.id);
            await sendWhatsApp(
              from,
              `✅ Minuta APROVADA com sucesso!\n\n${pending.descricao ?? ""}\n\nO vendedor foi notificado.`,
            );
          } catch (e) {
            console.error("approve error", e);
            await sendWhatsApp(from, `❌ Erro ao aprovar minuta: ${e instanceof Error ? e.message : "erro"}`);
          }
        } else if (["2", "NAO", "NÃO", "REJEITAR", "RECUSAR"].includes(body)) {
          await supabase
            .from("whatsapp_pending_actions")
            .update({ status: "aguardando_motivo" })
            .eq("id", pending.id);
          await sendWhatsApp(from, `Por favor, digite o motivo da rejeição:`);
        } else {
          await sendWhatsApp(
            from,
            `Responda:\n*1* para APROVAR\n*2* para REJEITAR\n\n${pending.descricao ?? ""}`,
          );
        }
      } else {
        const { data: waitingMotivo } = await supabase
          .from("whatsapp_pending_actions")
          .select("*")
          .eq("phone", phone)
          .eq("status", "aguardando_motivo")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (waitingMotivo) {
          try {
            await rejectShow(waitingMotivo.show_id, waitingMotivo.user_id, body);
            await supabase
              .from("whatsapp_pending_actions")
              .update({ status: "resolvido", resposta: "rejeitado", motivo: body })
              .eq("id", waitingMotivo.id);
            await sendWhatsApp(
              from,
              `❌ Minuta REJEITADA.\n\nMotivo: ${body}\n\nO vendedor foi notificado.`,
            );
          } catch (e) {
            console.error("reject error", e);
            await sendWhatsApp(from, `❌ Erro ao rejeitar minuta: ${e instanceof Error ? e.message : "erro"}`);
          }
        }
      }

      return new Response('<?xml version="1.0"?><Response/>', {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    // ENVIAR NOTIFICAÇÃO
    if (req.method === "POST") {
      const { to, message, action_type, show_id, user_id, descricao } = await req.json();

      if (!to || !message) {
        return new Response(JSON.stringify({ error: "to e message são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await sendWhatsApp(to, message);

      if (action_type === "aprovacao_minuta") {
        await supabase.from("whatsapp_pending_actions").insert({
          phone: to.replace("whatsapp:", ""),
          show_id,
          user_id,
          action_type,
          descricao,
          status: "aguardando",
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("twilio-whatsapp error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
