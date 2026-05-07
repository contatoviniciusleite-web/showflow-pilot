// Componente dedicado de impressão A4 do fechamento semanal.
// Renderizado fora da tela e capturado por html2canvas para gerar o PDF.
// Todos os estilos são inline para evitar dependências do tema da app.

import { forwardRef } from "react";
import { fmtBRL, fmtDateBR } from "@/lib/exporters";
import type { ClosingTotals } from "@/lib/closingCalc";

export type PdfShow = {
  data_show: string;
  vendedor?: string | null;
  local?: string | null;
  cidade?: string | null;
  cache_total: number;
  comissao_vendedor: number;
  custo_equipe: number;
  van: number;
  despesas_show: number;
  sobra: number;
  incluido: boolean;
};

export type PdfCrew = {
  nome: string;
  funcao?: string | null;
  cache_por_show: number;
  shows_label: string;
  shows_participados: number;
  total_receber: number;
};

export type PdfExpense = {
  categoria: string;
  descricao: string | null;
  show_label: string;
  responsavel: "produtora" | "contratante";
  incluir_no_calculo: boolean;
  valor: number;
};

export type PdfInvestment = {
  descricao: string;
  categoria: string;
  valor_total: number;
  total_parcelas: number;
  numero_parcela: number;
  valor_descontado: number;
};

export type PdfClipe = {
  profissional: string;
  funcao: string;
  clipe: string;
  quantidade: number;
  valor_por_clipe: number;
  total: number;
};

export type ClosingPdfDocumentProps = {
  artistName: string;
  semanaInicio: string;
  semanaFim: string;
  status: "rascunho" | "finalizado";
  observacoes?: string | null;
  impostoPercentual: number;
  shows: PdfShow[];
  crew: PdfCrew[];
  expenses: PdfExpense[];
  investments: PdfInvestment[];
  clipes: PdfClipe[];
  totals: ClosingTotals;
};

// Cores
const C = {
  black: "#1a1a1a",
  green: "#00C853",
  blue: "#0C447C",
  orange: "#92400E",
  purple: "#3C3489",
  pink: "#9D174D",
  border: "#e5e7eb",
  zebra: "#f9fafb",
  muted: "#6b7280",
  totalBg: "#374151",
};

const FONT = "Arial, Helvetica, sans-serif";

const S = {
  page: {
    width: "794px", // 210mm @ 96dpi
    minHeight: "auto",
    padding: "24px",
    background: "#fff",
    color: "#111",
    fontFamily: FONT,
    fontSize: "10px",
    lineHeight: 1.35,
    boxSizing: "border-box" as const,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "9px",
    border: `1px solid ${C.border}`,
  },
  th: {
    padding: "6px 6px",
    textAlign: "left" as const,
    fontWeight: 700 as const,
    color: "#fff",
    fontSize: "9px",
    border: `1px solid ${C.border}`,
  },
  td: {
    padding: "5px 6px",
    border: `1px solid ${C.border}`,
    fontSize: "9px",
    verticalAlign: "top" as const,
  },
  sectionWrap: { marginTop: "16px" },
  sectionHeader: (bg: string) => ({
    background: bg,
    color: "#fff",
    padding: "8px 12px",
    fontWeight: 700 as const,
    fontSize: "11px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: "4px 4px 0 0",
  }),
  badge: (bg: string, color = "#fff") => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "10px",
    background: bg,
    color,
    fontSize: "9px",
    fontWeight: 700 as const,
  }),
  totalRow: { background: C.totalBg, color: "#fff", fontWeight: 700 as const },
  num: { textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const, whiteSpace: "nowrap" as const },
  center: { textAlign: "center" as const },
};

function categoriaCor(cat: string): { bg: string; fg: string } {
  const c = (cat || "").toLowerCase();
  if (c.includes("van")) return { bg: "#dbeafe", fg: "#1e40af" };
  if (c.includes("efeito")) return { bg: "#ede9fe", fg: "#5b21b6" };
  if (c.includes("equipa")) return { bg: "#fee2e2", fg: "#991b1b" };
  if (c.includes("figur")) return { bg: "#fce7f3", fg: "#9d174d" };
  if (c.includes("alimenta")) return { bg: "#fef3c7", fg: "#92400e" };
  if (c.includes("combust")) return { bg: "#fef9c3", fg: "#854d0e" };
  return { bg: "#f3f4f6", fg: "#374151" };
}

const ClosingPDFDocument = forwardRef<HTMLDivElement, ClosingPdfDocumentProps>(function ClosingPDFDocument(
  props,
  ref,
) {
  const {
    artistName, semanaInicio, semanaFim, status, observacoes, impostoPercentual,
    shows, crew, expenses, investments, clipes, totals,
  } = props;

  const incluidos = shows.filter((s) => s.incluido).length;
  const today = new Date().toLocaleString("pt-BR");

  const totalDespesasCalc = expenses
    .filter((e) => e.incluir_no_calculo && e.responsavel === "produtora")
    .reduce((a, e) => a + Number(e.valor || 0), 0);

  return (
    <div ref={ref} style={S.page}>
      {/* HEADER */}
      <div style={{ background: C.black, color: "#fff", padding: "16px 18px", borderRadius: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", opacity: 0.85 }}>
          <span>🎵 Stage — ShowFlow</span>
          <span>{today}</span>
        </div>
        <div style={{ marginTop: "10px", fontSize: "10px", color: "#a3a3a3", letterSpacing: "1px", fontWeight: 700 }}>
          FECHAMENTO SEMANAL
        </div>
        <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "2px" }}>
          {fmtDateBR(semanaInicio)} a {fmtDateBR(semanaFim)}
        </div>
        <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ fontSize: "11px" }}>
            Artista: <strong style={{ color: "#fff" }}>{artistName || "—"}</strong>
            <span style={{ margin: "0 8px", color: "#525252" }}>·</span>
            {incluidos} {incluidos === 1 ? "show" : "shows"}
            <span style={{ margin: "0 8px", color: "#525252" }}>·</span>
            <span style={{ color: C.green, fontWeight: 700 }}>{fmtBRL(totals.totalBruto)}</span>
          </div>
          <span
            style={{
              ...S.badge(status === "finalizado" ? C.green : "#f59e0b", "#000"),
              padding: "4px 10px",
              borderRadius: "4px",
              fontSize: "10px",
            }}
          >
            {status === "finalizado" ? "✓ FINALIZADO" : "● RASCUNHO"}
          </span>
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginTop: "16px" }}>
        <SummaryCard icon="💰" iconBg="#dcfce7" iconFg={C.green} label="Cachê Bruto" value={fmtBRL(totals.totalBruto)} sub={`${incluidos} ${incluidos === 1 ? "show" : "shows"}`} />
        <SummaryCard icon="📉" iconBg="#fee2e2" iconFg="#dc2626" label="Total Custos" value={fmtBRL(totals.totalCustos)} sub="Comissão + Equipe + Van + Despesas + Clipe" />
        <SummaryCard icon="🏛️" iconBg="#fef3c7" iconFg="#92400e" label="Total Impostos" value={fmtBRL(totals.totalImpostos)} sub={`${impostoPercentual}% sobre bruto`} />
        <SummaryCard icon="✅" iconBg="#dcfce7" iconFg={C.green} label="Sobra" value={fmtBRL(totals.sobra)} sub="A distribuir" highlight />
      </div>

      {/* SEÇÃO A — SHOWS */}
      {shows.length > 0 && (
        <Section bg={C.black} title="🎤 A. Shows da semana" badge={`${shows.length} ${shows.length === 1 ? "show" : "shows"}`} badgeBg="#fff" badgeFg={C.black}>
          <table style={S.table}>
            <thead>
              <tr style={{ background: C.totalBg }}>
                <th style={S.th}>Data</th>
                <th style={S.th}>Vendedor</th>
                <th style={S.th}>Local</th>
                <th style={{ ...S.th, ...S.num }}>Cachê</th>
                <th style={{ ...S.th, ...S.num }}>Comissão</th>
                <th style={{ ...S.th, ...S.num }}>Equipe</th>
                <th style={{ ...S.th, ...S.num }}>Van</th>
                <th style={{ ...S.th, ...S.num }}>Despesas</th>
                <th style={{ ...S.th, ...S.num }}>Sobra</th>
                <th style={{ ...S.th, ...S.center }}>Incl.</th>
              </tr>
            </thead>
            <tbody>
              {shows.map((s, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : C.zebra }}>
                  <td style={S.td}>{fmtDateBR(s.data_show)}</td>
                  <td style={S.td}>{s.vendedor ?? "—"}</td>
                  <td style={S.td}>{[s.local, s.cidade].filter(Boolean).join(" — ") || "—"}</td>
                  <td style={{ ...S.td, ...S.num }}>{fmtBRL(s.cache_total)}</td>
                  <td style={{ ...S.td, ...S.num }}>{fmtBRL(s.comissao_vendedor)}</td>
                  <td style={{ ...S.td, ...S.num }}>{fmtBRL(s.custo_equipe)}</td>
                  <td style={{ ...S.td, ...S.num }}>{fmtBRL(s.van)}</td>
                  <td style={{ ...S.td, ...S.num }}>{fmtBRL(s.despesas_show)}</td>
                  <td style={{ ...S.td, ...S.num, fontWeight: 700 }}>{fmtBRL(s.sobra)}</td>
                  <td style={{ ...S.td, ...S.center }}>{s.incluido ? "✓" : "—"}</td>
                </tr>
              ))}
              <tr style={S.totalRow}>
                <td style={{ ...S.td, color: "#fff", textAlign: "right" }} colSpan={3}>TOTAIS</td>
                <td style={{ ...S.td, ...S.num, color: "#fff" }}>{fmtBRL(totals.totalBruto)}</td>
                <td style={{ ...S.td, ...S.num, color: "#fff" }}>{fmtBRL(totals.totalComissoes)}</td>
                <td style={{ ...S.td, ...S.num, color: "#fff" }}>{fmtBRL(totals.totalEquipe)}</td>
                <td style={{ ...S.td, ...S.num, color: "#fff" }}>{fmtBRL(totals.totalVan)}</td>
                <td style={{ ...S.td, ...S.num, color: "#fff" }}>{fmtBRL(totals.totalDespesasShows)}</td>
                <td style={{ ...S.td, ...S.num, color: "#fff" }}>{fmtBRL(totals.totalBruto - totals.totalComissoes - totals.totalEquipe - totals.totalVan - totals.totalDespesasShows)}</td>
                <td style={{ ...S.td, ...S.center, color: "#fff" }}>—</td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}

      {/* SEÇÃO B — EQUIPE */}
      {crew.length > 0 && (
        <Section bg={C.black} title="👥 B. Equipe" badge={`${crew.length} ${crew.length === 1 ? "membro" : "membros"}`} badgeBg="#fff" badgeFg={C.black}>
          <table style={S.table}>
            <thead>
              <tr style={{ background: C.totalBg }}>
                <th style={S.th}>Nome</th>
                <th style={S.th}>Função</th>
                <th style={{ ...S.th, ...S.num }}>Cachê / show</th>
                <th style={S.th}>Shows participados</th>
                <th style={{ ...S.th, ...S.num }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {crew.map((c, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : C.zebra }}>
                  <td style={S.td}>{c.nome || "—"}</td>
                  <td style={S.td}>{c.funcao || "—"}</td>
                  <td style={{ ...S.td, ...S.num }}>{fmtBRL(c.cache_por_show)}</td>
                  <td style={S.td}>{c.shows_label || `${c.shows_participados} shows`}</td>
                  <td style={{ ...S.td, ...S.num, fontWeight: 700 }}>{fmtBRL(c.total_receber)}</td>
                </tr>
              ))}
              <tr style={S.totalRow}>
                <td style={{ ...S.td, color: "#fff", textAlign: "right" }} colSpan={4}>TOTAL EQUIPE</td>
                <td style={{ ...S.td, ...S.num, color: "#fff" }}>{fmtBRL(totals.totalEquipe)}</td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}

      {/* SEÇÃO C — DESPESAS */}
      {expenses.length > 0 && (
        <Section bg={C.black} title="🧾 C. Despesas" badge={`${expenses.length} ${expenses.length === 1 ? "lançamento" : "lançamentos"}`} badgeBg="#fff" badgeFg={C.black}>
          <table style={S.table}>
            <thead>
              <tr style={{ background: C.totalBg }}>
                <th style={S.th}>Categoria</th>
                <th style={S.th}>Descrição</th>
                <th style={S.th}>Show vinculado</th>
                <th style={{ ...S.th, ...S.center }}>Responsável</th>
                <th style={{ ...S.th, ...S.center }}>Calcular</th>
                <th style={{ ...S.th, ...S.num }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : C.zebra }}>
                  <td style={S.td}>{e.categoria}</td>
                  <td style={S.td}>{e.descricao || "—"}</td>
                  <td style={S.td}>{e.show_label || "—"}</td>
                  <td style={{ ...S.td, ...S.center }}>{e.responsavel === "produtora" ? "Produtora" : "Contratante"}</td>
                  <td style={{ ...S.td, ...S.center }}>{e.incluir_no_calculo ? "Sim" : "Não"}</td>
                  <td style={{ ...S.td, ...S.num }}>{fmtBRL(e.valor)}</td>
                </tr>
              ))}
              <tr style={S.totalRow}>
                <td style={{ ...S.td, color: "#fff", textAlign: "right" }} colSpan={5}>TOTAL DESPESAS (no cálculo)</td>
                <td style={{ ...S.td, ...S.num, color: "#fff" }}>{fmtBRL(totalDespesasCalc)}</td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}

      {/* SEÇÃO D — INVESTIMENTOS */}
      {investments.length > 0 && (
        <Section bg={C.black} title="📦 D. Investimentos" badge={`${investments.length} ${investments.length === 1 ? "item" : "itens"}`} badgeBg="#fff" badgeFg={C.black}>
          <table style={S.table}>
            <thead>
              <tr style={{ background: C.totalBg }}>
                <th style={S.th}>Descrição</th>
                <th style={S.th}>Categoria</th>
                <th style={{ ...S.th, ...S.num }}>Valor total</th>
                <th style={{ ...S.th, ...S.center }}>Parcela</th>
                <th style={{ ...S.th, ...S.num }}>A descontar</th>
              </tr>
            </thead>
            <tbody>
              {investments.map((i, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : C.zebra }}>
                  <td style={S.td}>{i.descricao}</td>
                  <td style={S.td}>{i.categoria}</td>
                  <td style={{ ...S.td, ...S.num }}>{fmtBRL(i.valor_total)}</td>
                  <td style={{ ...S.td, ...S.center }}>{i.numero_parcela}/{i.total_parcelas}</td>
                  <td style={{ ...S.td, ...S.num, fontWeight: 700 }}>{fmtBRL(i.valor_descontado)}</td>
                </tr>
              ))}
              <tr style={S.totalRow}>
                <td style={{ ...S.td, color: "#fff", textAlign: "right" }} colSpan={4}>TOTAL</td>
                <td style={{ ...S.td, ...S.num, color: "#fff" }}>{fmtBRL(totals.totalInvestimentos)}</td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}

      {/* SEÇÃO E — CLIPE */}
      {clipes.length > 0 && (
        <Section bg={C.black} title="🎬 E. Despesas Semanais" badge={`${clipes.length} ${clipes.length === 1 ? "lançamento" : "lançamentos"}`} badgeBg="#fff" badgeFg={C.black}>
          <table style={S.table}>
            <thead>
              <tr style={{ background: C.totalBg }}>
                <th style={S.th}>Profissional</th>
                <th style={S.th}>Função</th>
                <th style={S.th}>Clipe</th>
                <th style={{ ...S.th, ...S.center }}>Qtd</th>
                <th style={{ ...S.th, ...S.num }}>Valor / clipe</th>
                <th style={{ ...S.th, ...S.num }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {clipes.map((c, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : C.zebra }}>
                  <td style={S.td}>{c.profissional || "—"}</td>
                  <td style={S.td}>{c.funcao || "—"}</td>
                  <td style={S.td}>{c.clipe || "—"}</td>
                  <td style={{ ...S.td, ...S.center }}>{c.quantidade}</td>
                  <td style={{ ...S.td, ...S.num }}>{fmtBRL(c.valor_por_clipe)}</td>
                  <td style={{ ...S.td, ...S.num, fontWeight: 700 }}>{fmtBRL(c.total)}</td>
                </tr>
              ))}
              <tr style={S.totalRow}>
                <td style={{ ...S.td, color: "#fff", textAlign: "right" }} colSpan={5}>TOTAL CLIPE</td>
                <td style={{ ...S.td, ...S.num, color: "#fff" }}>{fmtBRL(totals.totalClipe)}</td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}
      <div style={{ marginTop: "20px", pageBreakBefore: "auto" }}>
        <div style={S.sectionHeader(C.black)}>
          <span>📊 F. Cálculo e Distribuição</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "40% 60%", gap: "12px", marginTop: "10px" }}>
          {/* Painel esquerdo */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: "6px", padding: "12px", background: "#fff" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: C.black, marginBottom: "8px", letterSpacing: "0.5px" }}>
              RESUMO DO FECHAMENTO
            </div>
            <ResumoLine label="Total cachê bruto" value={fmtBRL(totals.totalBruto)} />
            <ResumoLine label={`(-) Imposto (${impostoPercentual}%)`} value={`-${fmtBRL(totals.totalImpostos)}`} negativo />
            <ResumoLine label="(-) Comissão vendedores" value={`-${fmtBRL(totals.totalComissoes)}`} negativo />
            <ResumoLine label="(-) Custo equipe" value={`-${fmtBRL(totals.totalEquipe)}`} negativo />
            <ResumoLine label="(-) Van" value={`-${fmtBRL(totals.totalVan)}`} negativo />
            <ResumoLine label="(-) Despesas dos shows" value={`-${fmtBRL(totals.totalDespesasShows)}`} negativo />
            <ResumoLine label="(-) Despesas semanais" value={`-${fmtBRL(totals.totalClipe)}`} negativo />
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: "8px", paddingTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "11px" }}>SOBRA PARA DISTRIBUIR</strong>
              <strong style={{ fontSize: "13px" }}>{fmtBRL(totals.sobraDistribuir)}</strong>
            </div>
          </div>

          {/* Painel direito */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: "6px", padding: "12px", background: "#fff" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: C.black, marginBottom: "8px", letterSpacing: "0.5px" }}>
              DISTRIBUIÇÃO FINAL
            </div>
            <div style={{ display: "grid", gridTemplateColumns: totals.distribution.length > 4 ? "1fr" : "1fr 1fr", gap: "8px" }}>
              {totals.distribution.map((d, i) => (
                <div key={i} style={{ border: `1px solid ${C.border}`, background: C.zebra, borderRadius: "4px", padding: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `1px solid ${C.border}`, paddingBottom: "4px", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "10px" }}>{d.beneficiario.toUpperCase()} ({d.percentual.toFixed(2)}%)</strong>
                    <strong style={{ fontSize: "12px" }}>{fmtBRL(d.valor_liquido)}</strong>
                  </div>
                  <Row label={`Bruto (${d.percentual.toFixed(2)}%)`} value={fmtBRL(d.valor_bruto)} />
                  {(d.tipo === "socio" || d.tipo === "parceiro") && d.investimento_valor > 0 && (
                    <Row label="(-) Investimentos" value={`-${fmtBRL(d.investimento_valor)}`} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: "10px", paddingTop: "8px" }}>
              <Row label="Total investimentos" value={fmtBRL(totals.totalInvestimentos)} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${C.border}`, marginTop: "6px", paddingTop: "6px" }}>
                <strong style={{ fontSize: "11px" }}>TOTAL LÍQUIDO</strong>
                <strong style={{ fontSize: "13px" }}>{fmtBRL(totals.totalLiquido)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OBSERVAÇÕES */}
      <div style={{ marginTop: "16px", border: `1px solid ${C.border}`, borderRadius: "6px", padding: "10px 12px", background: "#fff" }}>
        <div style={{ fontWeight: 700, fontSize: "10px", marginBottom: "4px" }}>Observações</div>
        <div style={{ fontSize: "10px", color: observacoes ? "#111" : C.muted, whiteSpace: "pre-wrap" as const }}>
          {observacoes || "—"}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: `1px solid ${C.border}`, marginTop: "20px", paddingTop: "8px", textAlign: "center" as const, fontSize: "9px", color: C.muted }}>
        ShowFlow — Stage · Gerado em {today} · Confidencial
      </div>
    </div>
  );
});

export default ClosingPDFDocument;

function Section({
  bg, title, badge, badgeBg, badgeFg, children,
}: {
  bg: string; title: string; badge?: string; badgeBg?: string; badgeFg?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={S.sectionWrap}>
      <div style={S.sectionHeader(bg)}>
        <span>{title}</span>
        {badge && <span style={S.badge(badgeBg || "#fff", badgeFg || bg)}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function SummaryCard({
  icon, iconBg, iconFg, label, value, sub, highlight,
}: {
  icon: string; iconBg: string; iconFg: string; label: string; value: string; sub?: string; highlight?: boolean;
}) {
  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: "8px",
      padding: "10px 12px",
      background: "#fff",
      display: "flex",
      gap: "8px",
      alignItems: "flex-start",
    }}>
      <div style={{
        width: "28px", height: "28px", borderRadius: "999px", background: iconBg, color: iconFg,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "9px", color: C.muted, textTransform: "uppercase", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: "13px", fontWeight: 700, color: highlight ? C.green : "#111", marginTop: "1px" }}>{value}</div>
        {sub && <div style={{ fontSize: "8px", color: C.muted, marginTop: "1px" }}>{sub}</div>}
      </div>
    </div>
  );
}

function ResumoLine({ label, value, negativo }: { label: string; value: string; negativo?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "10px" }}>
      <span style={{ color: "#111" }}>{label}</span>
      <span style={{ color: negativo ? "#dc2626" : "#111", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", padding: "2px 0" }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
