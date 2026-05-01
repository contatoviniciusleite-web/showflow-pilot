import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROLES = ["gerente", "equipe", "artista", "vendedor", "financeiro"] as const;
type Role = (typeof ROLES)[number];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) && v.length <= 320;
}

function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Erro interno");
}

async function retry<T>(label: string, operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await operation();
      if (result && typeof result === "object" && "error" in result && result.error) {
        throw result.error;
      }
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`${label} falhou na tentativa ${attempt}`, error);
      if (attempt < attempts) await delay(350 * attempt);
    }
  }
  throw lastError;
}

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  const perPage = 1000;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await retry(`listUsers página ${page}`, () =>
      admin.auth.admin.listUsers({ page, perPage })
    );
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found || data.users.length < perPage) return found ?? null;
  }
  return null;
}

async function listAllAuthUsers(admin: ReturnType<typeof createClient>) {
  const users: any[] = [];
  const perPage = 1000;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await retry(`listar usuários página ${page}`, () =>
      admin.auth.admin.listUsers({ page, perPage })
    );
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }
  return users;
}

const FALLBACK_APP_ORIGIN = "https://id-preview--85509043-3457-4547-998e-38e63b8b67cc.lovable.app";

function getAppOrigin(req: Request) {
  const origin = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
  try {
    const url = new URL(origin);
    if (!["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname)) {
      return url.origin;
    }
  } catch (_) {
    // Ignore invalid or missing origin headers and use the hosted app URL.
  }
  return FALLBACK_APP_ORIGIN;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Configuração do backend incompleta" }, 500);
    }
    if (!token) return json({ error: "Sessão ausente" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getClaims(token);
    const callerId = authData.claims?.sub;
    if (authError || !callerId) return json({ error: "Sessão inválida" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: managerRows, error: managerError } = await retry("verificar gerente", () =>
      admin.from("user_roles").select("id").eq("user_id", callerId).eq("role", "gerente").limit(1)
    );
    if (managerError) throw managerError;
    if (!managerRows?.length) return json({ error: "Acesso negado" }, 403);

    const body = req.method === "GET" ? { action: "list" } : await req.json().catch(() => ({}));
    const action = body.action ?? "list";

    if (action === "list") {
      const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }, authUsers] = await Promise.all([
        retry("listar perfis", () => admin.from("profiles").select("id,nome").order("nome", { ascending: true, nullsFirst: false })),
        retry("listar papéis", () => admin.from("user_roles").select("user_id,role,artist_id").order("created_at", { ascending: true })),
        listAllAuthUsers(admin),
      ]);
      if (profilesError) throw profilesError;
      if (rolesError) throw rolesError;

      const roleMap = new Map<string, Array<{ role: string; artist_id: string | null }>>();
      for (const r of roles ?? []) {
        const list = roleMap.get(r.user_id) ?? [];
        list.push({ role: r.role, artist_id: r.artist_id });
        roleMap.set(r.user_id, list);
      }
      const emailMap = new Map(authUsers.map((u) => [u.id, { email: u.email, last_sign_in_at: u.last_sign_in_at, invited: !u.email_confirmed_at && !u.last_sign_in_at }]));
      const users = (profiles ?? []).map((p) => ({
        id: p.id,
        nome: p.nome,
        email: emailMap.get(p.id)?.email ?? null,
        last_sign_in_at: emailMap.get(p.id)?.last_sign_in_at ?? null,
        pendente: emailMap.get(p.id)?.invited ?? false,
        roles: roleMap.get(p.id) ?? [],
      }));
      return json({ users });
    }

    if (action === "invite") {
      const email = (body.email ?? "").toString().trim().toLowerCase();
      const nome = (body.nome ?? "").toString().trim();
      const role = body.role;
      const artistId = body.artist_id ?? null;

      if (!isEmail(email)) return json({ error: "E-mail inválido" }, 400);
      if (!nome || nome.length > 120) return json({ error: "Nome obrigatório" }, 400);
      if (!isRole(role)) return json({ error: "Papel inválido" }, 400);
      if (role === "artista" && !artistId) return json({ error: "Selecione o artista vinculado" }, 400);
      if (artistId && typeof artistId !== "string") return json({ error: "Artista inválido" }, 400);

      const appOrigin = getAppOrigin(req);
      const existingBeforeInvite = await findUserByEmail(admin, email);
      if (existingBeforeInvite?.last_sign_in_at || existingBeforeInvite?.email_confirmed_at) {
        return json({ error: "Este e-mail já tem acesso ativo. Use editar usuário ou remover antes de convidar novamente." }, 400);
      }

      const { data: invited, error: inviteError } = await retry("enviar convite", () =>
        admin.auth.admin.inviteUserByEmail(email, {
          data: { nome },
          redirectTo: `${appOrigin}/aceitar-convite`,
        })
      ).catch((error) => ({ data: null, error }));
      if (inviteError) {
        // If user already exists, try to fetch and continue
        if (!/already/i.test(inviteError.message)) {
          return json({ error: inviteError.message }, 400);
        }
      }

      // Find user id (either from invite or existing)
      let userId = invited?.user?.id ?? null;
      if (!userId) {
        userId = existingBeforeInvite?.id ?? (await findUserByEmail(admin, email))?.id ?? null;
      }
      if (!userId) return json({ error: "Não foi possível criar o convite" }, 500);

      const { error: profileError } = await retry("salvar perfil", () =>
        admin.from("profiles").upsert({ id: userId, nome }, { onConflict: "id" })
      );
      if (profileError) throw profileError;
      const { error: roleError } = await retry("salvar papel", () =>
        admin.from("user_roles").upsert(
          { user_id: userId, role, artist_id: role === "artista" ? artistId : null },
          { onConflict: "user_id,role" }
        )
      );
      if (roleError) throw roleError;

      return json({ ok: true, user_id: userId });
    }

    if (action === "set_roles") {
      const userId = body.user_id;
      const roles: Array<{ role: Role; artist_id?: string | null }> = body.roles ?? [];
      if (typeof userId !== "string") return json({ error: "Usuário inválido" }, 400);
      if (!Array.isArray(roles)) return json({ error: "Lista de papéis inválida" }, 400);
      for (const r of roles) {
        if (!isRole(r.role)) return json({ error: "Papel inválido" }, 400);
        if (r.role === "artista" && !r.artist_id) return json({ error: "Artista obrigatório para papel artista" }, 400);
      }
      // do not allow caller to remove their own gerente role (avoid lockout)
      if (userId === callerId && !roles.some((r) => r.role === "gerente")) {
        return json({ error: "Você não pode remover seu próprio papel de gerente" }, 400);
      }

      const { error: deleteRolesError } = await retry("remover papéis", () =>
        admin.from("user_roles").delete().eq("user_id", userId)
      );
      if (deleteRolesError) throw deleteRolesError;
      if (roles.length) {
        const { error: insertRolesError } = await retry("salvar papéis", () =>
          admin.from("user_roles").insert(
            roles.map((r) => ({ user_id: userId, role: r.role, artist_id: r.role === "artista" ? r.artist_id : null }))
          )
        );
        if (insertRolesError) throw insertRolesError;
      }
      return json({ ok: true });
    }

    if (action === "update_profile") {
      const userId = body.user_id;
      const nome = (body.nome ?? "").toString().trim();
      if (typeof userId !== "string") return json({ error: "Usuário inválido" }, 400);
      if (!nome || nome.length > 120) return json({ error: "Nome inválido" }, 400);
      const { error } = await retry("atualizar perfil", () =>
        admin.from("profiles").update({ nome, updated_at: new Date().toISOString() }).eq("id", userId)
      );
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "resend_invite") {
      const email = (body.email ?? "").toString().trim().toLowerCase();
      if (!isEmail(email)) return json({ error: "E-mail inválido" }, 400);
      const appOrigin = getAppOrigin(req);
      const existing = await findUserByEmail(admin, email);
      if (existing?.last_sign_in_at || existing?.email_confirmed_at) {
        return json({ error: "Este usuário já está ativo." }, 400);
      }
      const { error } = await retry("reenviar convite", () =>
        admin.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${appOrigin}/aceitar-convite`,
        })
      ).catch((error) => ({ data: null, error }));
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      const userId = body.user_id;
      if (typeof userId !== "string") return json({ error: "Usuário inválido" }, 400);
      if (userId === callerId) return json({ error: "Você não pode remover a si mesmo" }, 400);
      const { error } = await retry("remover usuário", () => admin.auth.admin.deleteUser(userId)).catch((error) => ({ data: null, error }));
      if (error) return json({ error: error.message }, 400);
      // profile and roles cascade via FK
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error) {
    console.error("Erro em users-admin", error);
    return json({ error: messageFrom(error) || "Falha ao gerenciar usuários" }, 500);
  }
});
