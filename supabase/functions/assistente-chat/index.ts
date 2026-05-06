import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Msg = { role: "user" | "assistant" | "system"; content: string };

const MODEL = "google/gemini-3-flash-preview";

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function brl(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function buildContext(client: ReturnType<typeof createClient>, roles: string[]) {
  const parts: string[] = [];
  parts.push(`Papéis do usuário: ${roles.join(", ") || "(nenhum)"}.`);

  // Próximos shows (RLS aplicada)
  try {
    const { data: shows } = await client
      .from("shows")
      .select("id, data_show, cidade, uf, casa_show, status, valor_cache, artist_id")
      .gte("data_show", new Date().toISOString().slice(0, 10))
      .order("data_show", { ascending: true })
      .limit(15);
    if (shows?.length) {
      parts.push(
        "Próximos shows visíveis:\n" +
          shows
            .map(
              (s: any) =>
                `- ${s.data_show} | ${s.casa_show ?? "-"} (${s.cidade ?? "-"}/${s.uf ?? "-"}) | status: ${s.status} | cachê: ${brl(s.valor_cache)}`,
            )
            .join("\n"),
      );
    }
  } catch (_) {}

  // Resumo financeiro do mês para perfis financeiros
  if (roles.some((r) => ["diretor", "financeiro", "gerente"].includes(r))) {
    try {
      const start = new Date();
      start.setDate(1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      const startISO = start.toISOString().slice(0, 10);
      const endISO = end.toISOString().slice(0, 10);

      const { data: rev } = await client
        .from("producer_revenues")
        .select("valor, status, tipo")
        .gte("data_competencia", startISO)
        .lte("data_competencia", endISO);
      const { data: exp } = await client
        .from("producer_expenses")
        .select("valor, status")
        .gte("data_competencia", startISO)
        .lte("data_competencia", endISO);

      if (rev || exp) {
        const totalRev = (rev ?? []).reduce((a: number, r: any) => a + Number(r.valor || 0), 0);
        const totalExp = (exp ?? []).reduce((a: number, r: any) => a + Number(r.valor || 0), 0);
        parts.push(
          `Financeiro do mês (${startISO} a ${endISO}): receitas ${brl(totalRev)} | despesas ${brl(totalExp)} | saldo ${brl(totalRev - totalExp)}.`,
        );
      }
    } catch (_) {}
  }

  // Artistas (para gerente/diretor)
  if (roles.some((r) => ["diretor", "gerente"].includes(r))) {
    try {
      const { data: artists } = await client
        .from("artists")
        .select("nome_artistico")
        .limit(30);
      if (artists?.length) {
        parts.push("Artistas no roster: " + artists.map((a: any) => a.nome_artistico).join(", "));
      }
    } catch (_) {}
  }

  return parts.join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (!supabaseUrl || !anonKey || !serviceKey || !lovableKey) {
      return jsonResp({ error: "Configuração do backend incompleta" }, 500);
    }
    if (!token) return jsonResp({ error: "Sessão ausente" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await userClient.auth.getClaims(token);
    if (authError || !authData.claims?.sub) {
      return jsonResp({ error: "Sessão inválida" }, 401);
    }
    const userId = authData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => r.role as string);

    const body = await req.json().catch(() => ({}));
    const messages: Msg[] = Array.isArray(body?.messages) ? body.messages : [];
    if (!messages.length) return jsonResp({ error: "Mensagens ausentes" }, 400);

    // Monta contexto a partir do banco respeitando RLS do usuário logado
    const context = await buildContext(userClient, roles);

    const systemPrompt = `Você é o Assistente IA do Stage (sistema de gestão de shows e financeiro de uma produtora musical).
Responda SEMPRE em português brasileiro, de forma clara, objetiva e amigável.
Use os dados de contexto abaixo (que respeitam as permissões do usuário logado) para responder.
Se a pergunta for sobre algo fora do contexto, responda de forma geral e oriente o usuário a navegar para a página correspondente do sistema.
Não invente dados que não estejam no contexto.

CONTEXTO ATUAL:
${context}`;

    const aiBody = {
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
      ],
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(aiBody),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text().catch(() => "");
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 429) return jsonResp({ error: "Muitas requisições. Tente novamente em instantes." }, 429);
      if (aiResp.status === 402) return jsonResp({ error: "Créditos do assistente esgotados. Adicione créditos no workspace." }, 402);
      return jsonResp({ error: "Falha ao consultar o assistente" }, 500);
    }

    const data = await aiResp.json();
    const reply = data?.choices?.[0]?.message?.content ?? "Não consegui gerar uma resposta agora.";
    return jsonResp({ reply });
  } catch (error) {
    console.error("assistente-chat error", error);
    return jsonResp({ error: "Erro interno do assistente" }, 500);
  }
});
