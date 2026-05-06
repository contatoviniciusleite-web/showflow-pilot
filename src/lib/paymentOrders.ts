// Geração e gestão de Ordens de Pagamento a partir de um fechamento finalizado.
import { supabase } from "@/integrations/supabase/client";
import { addDays, nextWednesday, parseISO } from "date-fns";

export type PaymentOrderTipo =
  | "artista" | "socio" | "equipe" | "vendedor" | "despesa" | "clipe";

export type PaymentOrderInput = {
  closing_id: string;
  artist_id: string;
  tipo: PaymentOrderTipo;
  beneficiario_nome: string;
  beneficiario_id: string | null;
  descricao: string;
  valor: number;
  data_sugerida: string; // ISO date
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function nextWednesdayAfter(dateISO: string): string {
  const d = parseISO(dateISO);
  // próxima quarta-feira após semana_fim
  const w = nextWednesday(addDays(d, 1));
  return w.toISOString().slice(0, 10);
}

function fmtDateBR(d: string | null | undefined) {
  if (!d) return "";
  const [y, m, dd] = d.split("-");
  if (!y || !m || !dd) return d;
  return `${dd}/${m}/${y}`;
}

function fmtBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}

/**
 * Gera as ordens de pagamento de um fechamento.
 * - Apenas substitui ordens com status `pendente` ou `agendado`.
 * - Mantém intactas as ordens já `pago` ou `cancelado`.
 * Retorna a quantidade de ordens já pagas e canceladas (para exibir aviso).
 */
export async function generatePaymentOrdersForClosing(
  closingId: string,
): Promise<{ created: number; keptPaid: number; keptCanceled: number }> {
  // 1. Carrega o fechamento e dados auxiliares
  const { data: closing, error: errC } = await supabase
    .from("weekly_closings")
    .select("id, artist_id, semana_inicio, semana_fim, status, artists(nome)")
    .eq("id", closingId)
    .maybeSingle();
  if (errC) throw errC;
  if (!closing) throw new Error("Fechamento não encontrado");

  const dataSugerida = nextWednesdayAfter(closing.semana_fim);
  const periodo = `${fmtDateBR(closing.semana_inicio)} a ${fmtDateBR(closing.semana_fim)}`;
  const artistName = (closing as any).artists?.nome ?? "Artista";

  const [shows, crew, expenses, clipe, distribution, partnersData, fornecedoresData] = await Promise.all([
    supabase.from("weekly_closing_shows").select("*, show:shows(vendedor)").eq("closing_id", closingId),
    supabase.from("weekly_closing_crew").select("*").eq("closing_id", closingId),
    supabase.from("weekly_closing_expenses").select("*, fornecedor:fornecedores(nome)").eq("closing_id", closingId),
    supabase.from("weekly_closing_clipe").select("*").eq("closing_id", closingId),
    supabase.from("weekly_closing_distribution").select("*").eq("closing_id", closingId).order("ordem"),
    supabase.from("artist_partners").select("*").eq("artist_id", closing.artist_id),
    supabase.from("fornecedores").select("id, nome, ativo"),
  ]);

  const distRows = distribution.data ?? [];
  const showRows = (shows.data ?? []) as any[];
  const crewRows = (crew.data ?? []) as any[];
  const expenseRows = (expenses.data ?? []) as any[];
  const clipeRows = (clipe.data ?? []) as any[];

  // Lookup de beneficiario_id (apenas best-effort)
  // Artista: pega user_role com role=artista e artist_id
  let artistUserId: string | null = null;
  {
    const { data } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "artista")
      .eq("artist_id", closing.artist_id)
      .limit(1)
      .maybeSingle();
    artistUserId = (data as any)?.user_id ?? null;
  }

  // Para vendedores: lookup por nome em profiles
  async function findUserByName(nome: string): Promise<string | null> {
    if (!nome) return null;
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .ilike("nome", nome.trim())
      .limit(1)
      .maybeSingle();
    return (data as any)?.id ?? null;
  }

  const ordens: PaymentOrderInput[] = [];

  // 1. ARTISTA — usa distribution
  const artistDist = distRows.find((d) => d.tipo === "artista");
  if (artistDist && Number(artistDist.valor_liquido || artistDist.valor_bruto) > 0) {
    const valor = round2(Number(artistDist.valor_liquido ?? artistDist.valor_bruto ?? 0));
    ordens.push({
      closing_id: closingId,
      artist_id: closing.artist_id,
      tipo: "artista",
      beneficiario_nome: artistDist.beneficiario || artistName,
      beneficiario_id: artistUserId,
      descricao: `Cachê ${artistDist.beneficiario || artistName} ${Number(artistDist.percentual)}% — Semana ${periodo}`,
      valor,
      data_sugerida: dataSugerida,
    });
  }

  // 2. SÓCIOS — distribution.tipo = socio | parceiro
  for (const d of distRows.filter((r) => r.tipo === "socio" || r.tipo === "parceiro")) {
    const valor = round2(Number(d.valor_liquido ?? 0));
    if (valor <= 0) continue;
    let descricao = `${d.beneficiario} ${Number(d.percentual)}% — Semana ${periodo}`;
    if (Number(d.investimento_valor || 0) > 0) {
      descricao += ` (-) Investimento: ${fmtBRL(Number(d.investimento_valor))}`;
    }
    ordens.push({
      closing_id: closingId,
      artist_id: closing.artist_id,
      tipo: "socio",
      beneficiario_nome: d.beneficiario,
      beneficiario_id: null,
      descricao,
      valor,
      data_sugerida: dataSugerida,
    });
  }

  // 3. EQUIPE
  for (const c of crewRows) {
    const total = round2(Number(c.cache_por_show || 0) * Number(c.shows_participados || 0));
    if (total <= 0) continue;
    const userId = await findUserByName(c.nome);
    ordens.push({
      closing_id: closingId,
      artist_id: closing.artist_id,
      tipo: "equipe",
      beneficiario_nome: c.nome,
      beneficiario_id: userId,
      descricao: `${c.nome} — ${c.funcao || "Equipe"} — ${c.shows_participados} show${c.shows_participados === 1 ? "" : "s"}`,
      valor: total,
      data_sugerida: dataSugerida,
    });
  }

  // 4. VENDEDORES — agrupar shows por vendedor
  const byVendedor = new Map<string, { total: number; n: number }>();
  for (const s of showRows) {
    if (!s.incluido) continue;
    const v = (s.show?.vendedor as string | null) ?? "";
    const com = Number(s.comissao_vendedor || 0);
    if (!v || com <= 0) continue;
    const cur = byVendedor.get(v) ?? { total: 0, n: 0 };
    cur.total = round2(cur.total + com);
    cur.n += 1;
    byVendedor.set(v, cur);
  }
  for (const [vendedor, info] of byVendedor) {
    const userId = await findUserByName(vendedor);
    ordens.push({
      closing_id: closingId,
      artist_id: closing.artist_id,
      tipo: "vendedor",
      beneficiario_nome: vendedor,
      beneficiario_id: userId,
      descricao: `Comissão ${vendedor} — ${info.n} show${info.n === 1 ? "" : "s"} — Semana ${periodo}`,
      valor: round2(info.total),
      data_sugerida: dataSugerida,
    });
  }

  // 5. DESPESAS — responsável produtora + incluir_no_calculo
  for (const e of expenseRows) {
    if (e.responsavel !== "produtora") continue;
    if (e.incluir_no_calculo === false) continue;
    const valor = round2(Number(e.valor || 0));
    if (valor <= 0) continue;
    const fornecedorNome = (e as any).fornecedor?.nome as string | undefined;
    const beneficiario = fornecedorNome || e.descricao || e.categoria || "Despesa";
    ordens.push({
      closing_id: closingId,
      artist_id: closing.artist_id,
      tipo: "despesa",
      beneficiario_nome: beneficiario,
      beneficiario_id: null,
      descricao: `${e.categoria}${e.descricao ? ` — ${e.descricao}` : ""}`,
      valor,
      data_sugerida: dataSugerida,
    });
  }

  // 6. CLIPE
  for (const c of clipeRows) {
    const total = round2(Number(c.quantidade || 0) * Number(c.valor_por_clipe || 0));
    if (total <= 0) continue;
    const userId = await findUserByName(c.profissional);
    ordens.push({
      closing_id: closingId,
      artist_id: closing.artist_id,
      tipo: "clipe",
      beneficiario_nome: c.profissional,
      beneficiario_id: userId,
      descricao: `Clipe: ${c.clipe || "—"} — ${c.quantidade} clipe(s)`,
      valor: total,
      data_sugerida: dataSugerida,
    });
  }

  // 7. Conta ordens existentes pago/cancelado para preservar
  const { data: existing } = await supabase
    .from("payment_orders")
    .select("id, status")
    .eq("closing_id", closingId);
  const keptPaid = (existing ?? []).filter((o) => o.status === "pago").length;
  const keptCanceled = (existing ?? []).filter((o) => o.status === "cancelado").length;

  // Apaga apenas pendentes/agendadas
  await supabase
    .from("payment_orders")
    .delete()
    .eq("closing_id", closingId)
    .in("status", ["pendente", "agendado"]);

  if (ordens.length > 0) {
    const { error: errIns } = await supabase.from("payment_orders").insert(
      ordens.map((o) => ({ ...o, status: "pendente" })) as any,
    );
    if (errIns) throw errIns;
  }

  // Lembrete de votar pelo silêncio: ignored.
  void partnersData; void fornecedoresData;

  return { created: ordens.length, keptPaid, keptCanceled };
}

export const TIPO_LABEL: Record<string, string> = {
  artista: "Artista", socio: "Sócio", equipe: "Equipe",
  vendedor: "Vendedor", despesa: "Despesa", clipe: "Clipe",
};

export const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente", agendado: "Agendado", pago: "Pago", cancelado: "Cancelado",
};
