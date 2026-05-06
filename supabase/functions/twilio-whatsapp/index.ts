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
