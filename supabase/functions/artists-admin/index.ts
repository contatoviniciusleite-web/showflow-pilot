import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ArtistPayload = {
  id?: string;
  nome?: string;
  foto_url?: string | null;
  google_calendar_id?: string | null;
  rider_padrao?: string | null;
  cor?: string;
  ativo?: boolean;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Campo de texto inválido");
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Error("Campo de texto muito longo");
  return trimmed || null;
}

function validateArtist(input: ArtistPayload) {
  const nome = cleanText(input.nome, 120);
  if (!nome) throw new Error("Nome obrigatório");

  const cor = input.cor ?? "#f59e0b";
  if (typeof cor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(cor)) throw new Error("Cor inválida");

  return {
    nome,
    google_calendar_id: cleanText(input.google_calendar_id, 255),
    rider_padrao: typeof input.rider_padrao === "string" ? input.rider_padrao.slice(0, 5000) : null,
    cor,
    ativo: typeof input.ativo === "boolean" ? input.ativo : true,
    foto_url: cleanText(input.foto_url, 500),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let sql: postgres.Sql | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (!supabaseUrl || !anonKey || !databaseUrl) return json({ error: "Configuração do backend incompleta" }, 500);
    if (!token) return json({ error: "Sessão ausente" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getClaims(token);
    const userId = authData.claims?.sub;
    if (authError || !userId) return json({ error: "Sessão inválida" }, 401);

    sql = postgres(databaseUrl, { prepare: false, max: 1 });
    const managerRows = await sql`select 1 from public.user_roles where user_id = ${userId} and role = 'gerente' limit 1`;
    if (managerRows.length === 0) return json({ error: "Acesso negado" }, 403);

    const body = req.method === "GET" ? { action: "list" } : await req.json().catch(() => ({}));
    const action = body.action ?? "list";

    if (action === "list") {
      const artists = await sql`
        select id, nome, foto_url, google_calendar_id, rider_padrao, cor, ativo
        from public.artists
        order by nome asc
      `;
      return json({ artists });
    }

    if (action === "create") {
      const artist = validateArtist(body.artist ?? {});
      const rows = await sql`
        insert into public.artists (nome, foto_url, google_calendar_id, rider_padrao, cor, ativo, updated_at)
        values (${artist.nome}, ${artist.foto_url}, ${artist.google_calendar_id}, ${artist.rider_padrao}, ${artist.cor}, ${artist.ativo}, now())
        returning id, nome, foto_url, google_calendar_id, rider_padrao, cor, ativo
      `;
      return json({ artist: rows[0] });
    }

    if (action === "update") {
      if (typeof body.id !== "string") return json({ error: "Artista inválido" }, 400);
      const artist = validateArtist(body.artist ?? {});
      const rows = await sql`
        update public.artists
        set nome = ${artist.nome},
            foto_url = ${artist.foto_url},
            google_calendar_id = ${artist.google_calendar_id},
            rider_padrao = ${artist.rider_padrao},
            cor = ${artist.cor},
            ativo = ${artist.ativo},
            updated_at = now()
        where id = ${body.id}
        returning id, nome, foto_url, google_calendar_id, rider_padrao, cor, ativo
      `;
      if (rows.length === 0) return json({ error: "Artista não encontrado" }, 404);
      return json({ artist: rows[0] });
    }

    if (action === "delete") {
      if (typeof body.id !== "string") return json({ error: "Artista inválido" }, 400);
      await sql`delete from public.artists where id = ${body.id}`;
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error) {
    console.error("Erro em artists-admin", error);
    return json({ error: error instanceof Error ? error.message : "Falha ao gerenciar artistas" }, 500);
  } finally {
    if (sql) await sql.end({ timeout: 3 });
  }
});
