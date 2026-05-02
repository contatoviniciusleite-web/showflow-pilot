import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function txt(v: unknown, max = 500): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string") throw new Error("Texto inválido");
  const t = v.trim();
  if (!t) return null;
  if (t.length > max) throw new Error("Texto muito longo");
  return t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Não autenticado" }, 401);
    const userId = u.user.id;

    const { data: rolesRows } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const roles = new Set((rolesRows ?? []).map((r: any) => r.role));
    const isManager = roles.has("gerente");
    const isFin = roles.has("financeiro");
    const isVendedor = roles.has("vendedor");
    const isStaff = roles.has("equipe");
    const canRead = isManager || isFin || isVendedor || isStaff;
    const canCreate = isManager || isFin || isVendedor || isStaff;
    const canUpdate = isManager || isFin;
    const canDelete = isManager;

    if (!canRead) return json({ error: "Sem permissão" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "list") {
      const { data, error } = await admin
        .from("contratantes")
        .select("*")
        .order("nome", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return json({ contratantes: data ?? [] });
    }

    if (action === "search") {
      const q = (body.q ?? "").toString().trim();
      let query = admin.from("contratantes").select("id,nome,documento,endereco,cidade,estado,cep,telefone,email,observacoes").order("nome").limit(20);
      if (q) query = query.ilike("nome", `%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return json({ contratantes: data ?? [] });
    }

    if (action === "get") {
      const id = txt(body.id, 64);
      if (!id) return json({ error: "ID obrigatório" }, 400);
      const { data: c, error } = await admin.from("contratantes").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!c) return json({ error: "Contratante não encontrado" }, 404);
      // histórico de shows vinculados
      const { data: shows } = await admin
        .from("shows")
        .select("id,data_show,local,cidade,cache_total,status,artist_id,artists(nome)")
        .eq("contratante_id", id)
        .order("data_show", { ascending: false });
      return json({ contratante: c, shows: shows ?? [] });
    }

    if (action === "create") {
      if (!canCreate) return json({ error: "Sem permissão para cadastrar" }, 403);
      const c = body.contratante ?? {};
      const nome = txt(c.nome, 200);
      if (!nome) return json({ error: "Nome é obrigatório" }, 400);
      const payload = {
        nome,
        documento: txt(c.documento, 50),
        endereco: txt(c.endereco, 300),
        cidade: txt(c.cidade, 120),
        estado: txt(c.estado, 50),
        cep: txt(c.cep, 20),
        telefone: txt(c.telefone, 50),
        email: txt(c.email, 200),
        observacoes: txt(c.observacoes, 5000),
        created_by: userId,
      };
      const { data, error } = await admin.from("contratantes").insert(payload).select().single();
      if (error) throw error;
      return json({ contratante: data });
    }

    if (action === "update") {
      if (!canUpdate) return json({ error: "Sem permissão para editar" }, 403);
      const id = txt(body.id, 64);
      if (!id) return json({ error: "ID obrigatório" }, 400);
      const c = body.contratante ?? {};
      const nome = txt(c.nome, 200);
      if (!nome) return json({ error: "Nome é obrigatório" }, 400);
      const payload = {
        nome,
        documento: txt(c.documento, 50),
        endereco: txt(c.endereco, 300),
        cidade: txt(c.cidade, 120),
        estado: txt(c.estado, 50),
        cep: txt(c.cep, 20),
        telefone: txt(c.telefone, 50),
        email: txt(c.email, 200),
        observacoes: txt(c.observacoes, 5000),
      };
      const { data, error } = await admin.from("contratantes").update(payload).eq("id", id).select().single();
      if (error) throw error;
      return json({ contratante: data });
    }

    if (action === "delete") {
      if (!canDelete) return json({ error: "Sem permissão para excluir" }, 403);
      const id = txt(body.id, 64);
      if (!id) return json({ error: "ID obrigatório" }, 400);
      const { error } = await admin.from("contratantes").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e: any) {
    return json({ error: e.message ?? "Erro interno" }, 400);
  }
});
