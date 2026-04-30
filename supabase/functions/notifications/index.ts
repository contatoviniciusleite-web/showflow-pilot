import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!supabaseUrl || !anonKey) {
      console.error("notifications: missing env");
      return json({ error: "Configuração incompleta" }, 500);
    }
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Sessão ausente" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsErr } = await client.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      console.error("notifications: auth error", claimsErr);
      return json({ error: "Sessão inválida" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const body = req.method === "GET" ? { action: "list" } : await req.json().catch(() => ({}));
    const action = body.action ?? "list";

    if (action === "list") {
      const { data, error } = await client
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        console.error("notifications.list error", error);
        return json({ error: error.message || "Falha ao listar notificações" }, 500);
      }
      return json({ notifications: data ?? [] });
    }

    if (action === "unread_count") {
      const { count, error } = await client
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("lida", false);
      if (error) {
        console.error("notifications.unread_count error", error);
        return json({ error: error.message || "Falha ao contar notificações" }, 500);
      }
      return json({ count: count ?? 0 });
    }

    if (action === "mark_read") {
      const id = typeof body.id === "string" ? body.id : null;
      let q = client.from("notifications").update({ lida: true }).eq("user_id", userId);
      if (id) q = q.eq("id", id);
      const { error } = await q;
      if (error) {
        console.error("notifications.mark_read error", error);
        return json({ error: error.message || "Falha ao marcar como lida" }, 500);
      }
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("notifications: unhandled", e);
    const msg = e instanceof Error && e.message ? e.message : "Erro interno";
    return json({ error: msg }, 500);
  }
});
