import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROLES = ["gerente", "equipe", "artista", "vendedor"] as const;
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

  let sql: postgres.Sql | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (!supabaseUrl || !anonKey || !serviceKey || !databaseUrl) {
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

    sql = postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 20, connect_timeout: 10, ssl: "require" });
    const managerRows = await sql`
      select 1 from public.user_roles where user_id = ${callerId} and role = 'gerente' limit 1
    `;
    if (managerRows.length === 0) return json({ error: "Acesso negado" }, 403);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const body = req.method === "GET" ? { action: "list" } : await req.json().catch(() => ({}));
    const action = body.action ?? "list";

    if (action === "list") {
      const rows = await sql`
        select
          p.id,
          p.nome,
          coalesce(json_agg(
            json_build_object('role', ur.role::text, 'artist_id', ur.artist_id)
          ) filter (where ur.role is not null), '[]'::json) as roles
        from public.profiles p
        left join public.user_roles ur on ur.user_id = p.id
        group by p.id, p.nome
        order by p.nome nulls last
      `;
      // join email from auth.users using admin
      const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (usersError) throw usersError;
      const emailMap = new Map(usersData.users.map((u) => [u.id, { email: u.email, last_sign_in_at: u.last_sign_in_at, invited: !u.email_confirmed_at && !u.last_sign_in_at }]));
      const users = rows.map((r: any) => ({
        id: r.id,
        nome: r.nome,
        email: emailMap.get(r.id)?.email ?? null,
        last_sign_in_at: emailMap.get(r.id)?.last_sign_in_at ?? null,
        pendente: emailMap.get(r.id)?.invited ?? false,
        roles: r.roles,
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

      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { nome },
        redirectTo: `${appOrigin}/aceitar-convite`,
      });
      if (inviteError) {
        // If user already exists, try to fetch and continue
        if (!/already/i.test(inviteError.message)) {
          return json({ error: inviteError.message }, 400);
        }
      }

      // Find user id (either from invite or existing)
      let userId = invited?.user?.id ?? null;
      if (!userId) {
        const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
        userId = list.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
      }
      if (!userId) return json({ error: "Não foi possível criar o convite" }, 500);

      // ensure profile
      await sql`
        insert into public.profiles (id, nome) values (${userId}, ${nome})
        on conflict (id) do update set nome = excluded.nome
      `;
      // assign role
      await sql`
        insert into public.user_roles (user_id, role, artist_id)
        values (${userId}, ${role}::app_role, ${role === "artista" ? artistId : null})
        on conflict (user_id, role) do update set artist_id = excluded.artist_id
      `;

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

      await sql.begin(async (tx) => {
        await tx`delete from public.user_roles where user_id = ${userId}`;
        for (const r of roles) {
          await tx`
            insert into public.user_roles (user_id, role, artist_id)
            values (${userId}, ${r.role}::app_role, ${r.role === "artista" ? r.artist_id : null})
          `;
        }
      });
      return json({ ok: true });
    }

    if (action === "update_profile") {
      const userId = body.user_id;
      const nome = (body.nome ?? "").toString().trim();
      if (typeof userId !== "string") return json({ error: "Usuário inválido" }, 400);
      if (!nome || nome.length > 120) return json({ error: "Nome inválido" }, 400);
      await sql`update public.profiles set nome = ${nome}, updated_at = now() where id = ${userId}`;
      return json({ ok: true });
    }

    if (action === "resend_invite") {
      const email = (body.email ?? "").toString().trim().toLowerCase();
      if (!isEmail(email)) return json({ error: "E-mail inválido" }, 400);
      const appOrigin = getAppOrigin(req);
      const { error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appOrigin}/aceitar-convite`,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      const userId = body.user_id;
      if (typeof userId !== "string") return json({ error: "Usuário inválido" }, 400);
      if (userId === callerId) return json({ error: "Você não pode remover a si mesmo" }, 400);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);
      // profile and roles cascade via FK
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error) {
    console.error("Erro em users-admin", error);
    return json({ error: error instanceof Error ? error.message : "Falha ao gerenciar usuários" }, 500);
  } finally {
    if (sql) await sql.end({ timeout: 3 });
  }
});
