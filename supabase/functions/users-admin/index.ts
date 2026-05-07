import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROLES = ["diretor", "gerente", "equipe", "artista", "vendedor", "financeiro", "socio"] as const;
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

function messageFrom(error: unknown): string {
  if (!error) return "Erro interno";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const e = error as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
    if (typeof e.error === "string") return e.error;
    if (typeof e.details === "string") return e.details;
    if (typeof e.hint === "string") return e.hint;
    try { return JSON.stringify(error); } catch { return "Erro interno"; }
  }
  return String(error);
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
      const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }, authUsers, { data: vendArt, error: vendArtError }, { data: socioArt, error: socioArtError }] = await Promise.all([
        retry("listar perfis", () => admin.from("profiles").select("id,nome").order("nome", { ascending: true, nullsFirst: false })),
        retry("listar papéis", () => admin.from("user_roles").select("user_id,role,artist_id").order("created_at", { ascending: true })),
        listAllAuthUsers(admin),
        retry("listar permissões vendedor", () => admin.from("vendedor_artists").select("vendedor_id,artist_id")),
        retry("listar vínculos sócio", () => admin.from("socio_artists").select("socio_id,artist_id")),
      ]);
      if (profilesError) throw profilesError;
      if (rolesError) throw rolesError;
      if (vendArtError) throw vendArtError;
      if (socioArtError) throw socioArtError;

      const roleMap = new Map<string, Array<{ role: string; artist_id: string | null }>>();
      for (const r of roles ?? []) {
        const list = roleMap.get(r.user_id) ?? [];
        list.push({ role: r.role, artist_id: r.artist_id });
        roleMap.set(r.user_id, list);
      }
      const vendMap = new Map<string, string[]>();
      for (const v of (vendArt ?? []) as Array<{ vendedor_id: string; artist_id: string }>) {
        const list = vendMap.get(v.vendedor_id) ?? [];
        list.push(v.artist_id);
        vendMap.set(v.vendedor_id, list);
      }
      const socioMap = new Map<string, string[]>();
      for (const v of (socioArt ?? []) as Array<{ socio_id: string; artist_id: string }>) {
        const list = socioMap.get(v.socio_id) ?? [];
        list.push(v.artist_id);
        socioMap.set(v.socio_id, list);
      }
      const emailMap = new Map(authUsers.map((u) => [u.id, { email: u.email, last_sign_in_at: u.last_sign_in_at, invited: !u.email_confirmed_at && !u.last_sign_in_at }]));
      const users = (profiles ?? []).map((p) => ({
        id: p.id,
        nome: p.nome,
        email: emailMap.get(p.id)?.email ?? null,
        last_sign_in_at: emailMap.get(p.id)?.last_sign_in_at ?? null,
        pendente: emailMap.get(p.id)?.invited ?? false,
        roles: roleMap.get(p.id) ?? [],
        vendedor_artist_ids: vendMap.get(p.id) ?? [],
        socio_artist_ids: socioMap.get(p.id) ?? [],
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
      const isActive = !!(existingBeforeInvite?.last_sign_in_at || existingBeforeInvite?.email_confirmed_at);

      let userId = existingBeforeInvite?.id ?? null;

      // Só dispara o convite se o usuário ainda não tem acesso ativo
      if (!isActive) {
        const { data: invited, error: inviteError } = await retry("enviar convite", () =>
          admin.auth.admin.inviteUserByEmail(email, {
            data: { nome },
            redirectTo: `${appOrigin}/aceitar-convite`,
          })
        ).catch((error) => ({ data: null, error }));
        if (inviteError && !/already/i.test(inviteError.message)) {
          return json({ error: inviteError.message }, 400);
        }
        userId = invited?.user?.id ?? userId ?? (await findUserByEmail(admin, email))?.id ?? null;
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

      // Permissões de artistas (vendedor)
      const vendArtIds = Array.isArray(body.vendedor_artist_ids)
        ? body.vendedor_artist_ids.filter((s: unknown): s is string => typeof s === "string")
        : null;
      if (role === "vendedor" && vendArtIds) {
        await retry("limpar permissões vendedor", () =>
          admin.from("vendedor_artists").delete().eq("vendedor_id", userId)
        );
        if (vendArtIds.length) {
          const { error: vErr } = await retry("salvar permissões vendedor", () =>
            admin.from("vendedor_artists").insert(
              vendArtIds.map((a) => ({ vendedor_id: userId, artist_id: a }))
            )
          );
          if (vErr) throw vErr;
        }
      }

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

      // Sincroniza permissões de artistas (vendedor)
      const isVendedor = roles.some((r) => r.role === "vendedor");
      const vendArtIds = Array.isArray(body.vendedor_artist_ids)
        ? body.vendedor_artist_ids.filter((s: unknown): s is string => typeof s === "string")
        : null;
      if (!isVendedor) {
        await retry("limpar permissões vendedor", () =>
          admin.from("vendedor_artists").delete().eq("vendedor_id", userId)
        );
      } else if (vendArtIds) {
        await retry("limpar permissões vendedor", () =>
          admin.from("vendedor_artists").delete().eq("vendedor_id", userId)
        );
        if (vendArtIds.length) {
          const { error: vErr } = await retry("salvar permissões vendedor", () =>
            admin.from("vendedor_artists").insert(
              vendArtIds.map((a) => ({ vendedor_id: userId, artist_id: a }))
            )
          );
          if (vErr) throw vErr;
        }
      }

      // Sincroniza vínculos de artistas (sócio)
      const isSocio = roles.some((r) => r.role === "socio");
      const socioArtIds = Array.isArray(body.socio_artist_ids)
        ? body.socio_artist_ids.filter((s: unknown): s is string => typeof s === "string")
        : null;
      if (!isSocio) {
        await retry("limpar vínculos sócio", () =>
          admin.from("socio_artists").delete().eq("socio_id", userId)
        );
      } else if (socioArtIds) {
        await retry("limpar vínculos sócio", () =>
          admin.from("socio_artists").delete().eq("socio_id", userId)
        );
        if (socioArtIds.length) {
          const { error: sErr } = await retry("salvar vínculos sócio", () =>
            admin.from("socio_artists").insert(
              socioArtIds.map((a) => ({ socio_id: userId, artist_id: a }))
            )
          );
          if (sErr) throw sErr;
        }
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
