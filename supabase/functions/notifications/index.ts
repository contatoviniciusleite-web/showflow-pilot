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
    if (!supabaseUrl || !anonKey) return json({ error: "Configuração incompleta" }, 500);
    if (!authHeader) return json({ error: "Sessão ausente" }, 401);

    const client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: aerr } = await client.auth.getClaims(authHeader.replace(/^Bearer\s+/i, ""));
    const userId = claims?.claims?.sub;
    if (aerr || !userId) return json({ error: "Sessão inválida" }, 401);

    const body = req.method === "GET" ? { action: "list" } : await req.json().catch(() => ({}));
    const action = body.action ?? "list";

    if (action === "list") {
      const { data, error } = await client
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return json({ error: error.message }, 500);
      return json({ notifications: data ?? [] });
    }

    if (action === "unread_count") {
      const { count, error } = await client
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("lida", false);
      if (error) return json({ error: error.message }, 500);
      return json({ count: count ?? 0 });
    }

    if (action === "mark_read") {
      const id = typeof body.id === "string" ? body.id : null;
      const q = client.from("notifications").update({ lida: true }).eq("user_id", userId);
      const { error } = id ? await q.eq("id", id) : await q;
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
