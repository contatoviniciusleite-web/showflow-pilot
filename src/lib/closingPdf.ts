// PDF de fechamento semanal — layout próximo ao da planilha original.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtBRL, fmtDateBR } from "@/lib/exporters";
import type { ClosingTotals, DistributionRow } from "@/lib/closingCalc";

export type ClosingPdfInput = {
  artistName: string;
  semanaInicio: string;
  semanaFim: string;
  observacoes?: string | null;
  impostoPercentual: number;
  shows: {
    data_show: string;
    vendedor?: string | null;
    local?: string | null;
    cidade?: string | null;
    cache_total: number;
    comissao_vendedor: number;
    custo_equipe: number;
    van: number;
    despesas_show: number;
    despesas_detalhe: { categoria: string; descricao: string | null; valor: number }[];
    incluido: boolean;
  }[];
  crew: {
    nome: string;
    funcao?: string | null;
    cache_por_show: number;
    shows_participados: number;
    total_receber: number;
  }[];
  expenses: {
    categoria: string;
    descricao: string | null;
    show_label: string;
    responsavel: "produtora" | "contratante";
    incluir_no_calculo: boolean;
    valor: number;
  }[];
  investments: {
    descricao: string;
    categoria: string;
    valor_total: number;
    total_parcelas: number;
    numero_parcela: number;
    valor_descontado: number;
  }[];
  clipes: {
    profissional: string;
    funcao: string;
    clipe: string;
    quantidade: number;
    valor_por_clipe: number;
    total: number;
  }[];
  totals: ClosingTotals;
};

const APP_NAME = "ShowFlow — Stage";
const HEAD_FILL: [number, number, number] = [40, 40, 40];
const TOTAL_FILL: [number, number, number] = [220, 220, 220];
const ALT_FILL: [number, number, number] = [248, 248, 248];
const CARD_FILL: [number, number, number] = [249, 249, 249];
const CARD_BORDER: [number, number, number] = [180, 180, 180];

export function exportClosingPDF(input: ClosingPdfInput) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const usableW = pageWidth - marginX * 2;

  // ===== Cabeçalho =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(APP_NAME, marginX, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString("pt-BR"), pageWidth - marginX, 12, { align: "right" });
  doc.setDrawColor(220);
  doc.line(marginX, 14, pageWidth - marginX, 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Fechamento de ${fmtDateBR(input.semanaInicio)} a ${fmtDateBR(input.semanaFim)}`, marginX, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Artista: ${input.artistName}`, marginX, 25);

  // ===== Tabela A — SHOWS =====
  // Larguras fixas (9 colunas) somando usableW (≈269mm)
  const showsCols = {
    0: { cellWidth: 20, halign: "left" as const },    // Data
    1: { cellWidth: 32, halign: "left" as const },    // Vendedor
    2: { cellWidth: 60, halign: "left" as const },    // Local
    3: { cellWidth: 28, halign: "right" as const },   // Cachê
    4: { cellWidth: 26, halign: "right" as const },   // Comissão
    5: { cellWidth: 26, halign: "right" as const },   // Equipe
    6: { cellWidth: 22, halign: "right" as const },   // Van
    7: { cellWidth: 22, halign: "right" as const },   // Despesas
    8: { cellWidth: 16, halign: "center" as const },  // Incl.
  };

  const showsBody: any[] = [];
  for (const s of input.shows) {
    showsBody.push([
      fmtDateBR(s.data_show),
      s.vendedor ?? "—",
      [s.local, s.cidade].filter(Boolean).join(" — ") || "—",
      fmtBRL(s.cache_total),
      fmtBRL(s.comissao_vendedor),
      fmtBRL(s.custo_equipe),
      fmtBRL(s.van),
      fmtBRL(s.despesas_show),
      s.incluido ? "Sim" : "Não",
    ]);
    for (const d of s.despesas_detalhe) {
      showsBody.push([
        "",
        { content: `↳ ${d.categoria}: ${d.descricao || "—"}`, colSpan: 6, styles: { fontStyle: "italic" as const, textColor: 110, halign: "left" as const } },
        { content: fmtBRL(d.valor), styles: { halign: "right" as const, textColor: 110 } },
        "",
      ]);
    }
  }
  showsBody.push([
    { content: "TOTAIS", colSpan: 3, styles: { halign: "right" as const, fontStyle: "bold" as const } },
    { content: fmtBRL(input.totals.totalBruto), styles: { halign: "right" as const, fontStyle: "bold" as const } },
    { content: fmtBRL(input.totals.totalComissoes), styles: { halign: "right" as const, fontStyle: "bold" as const } },
    { content: fmtBRL(input.totals.totalCustoEquipeShows), styles: { halign: "right" as const, fontStyle: "bold" as const } },
    { content: fmtBRL(input.totals.totalVan), styles: { halign: "right" as const, fontStyle: "bold" as const } },
    { content: fmtBRL(input.totals.totalDespesasShows), styles: { halign: "right" as const, fontStyle: "bold" as const } },
    "",
  ]);

  autoTable(doc, {
    head: [["Data", "Vendedor", "Local", "Cachê", "Comissão", "Equipe", "Van", "Despesas", "Incl."]],
    body: showsBody,
    startY: 30,
    margin: { left: marginX, right: marginX },
    tableWidth: usableW,
    styles: { fontSize: 8, cellPadding: 1.8, overflow: "linebreak" },
    headStyles: { fillColor: HEAD_FILL, textColor: 255, fontStyle: "bold", halign: "left" },
    columnStyles: showsCols,
    alternateRowStyles: { fillColor: ALT_FILL },
    didParseCell: (data) => {
      if (data.section === "head") {
        const col = (showsCols as any)[data.column.index];
        if (col?.halign) data.cell.styles.halign = col.halign;
      }
      if (data.section === "body" && data.row.index === showsBody.length - 1) {
        data.cell.styles.fillColor = TOTAL_FILL;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  let y = (doc as any).lastAutoTable.finalY + 6;

  // ===== EQUIPE =====
  ensureSpace(40);
  sectionTitle("EQUIPE");
  const crewCols = {
    0: { cellWidth: 70, halign: "left" as const },    // Nome
    1: { cellWidth: 70, halign: "left" as const },    // Função
    2: { cellWidth: 50, halign: "right" as const },   // Cachê/show
    3: { cellWidth: 30, halign: "center" as const },  // Shows
    4: { cellWidth: 49, halign: "right" as const },   // Total
  };
  const crewBody: any[] = [
    ...input.crew.map((c) => [c.nome, c.funcao ?? "—", fmtBRL(c.cache_por_show), String(c.shows_participados), fmtBRL(c.total_receber)]),
    [
      { content: "TOTAL EQUIPE", colSpan: 4, styles: { halign: "right" as const, fontStyle: "bold" as const } },
      { content: fmtBRL(input.totals.totalEquipe), styles: { halign: "right" as const, fontStyle: "bold" as const } },
    ],
  ];
  autoTable(doc, {
    head: [["Nome", "Função", "Cachê/show", "Shows", "Total"]],
    body: crewBody,
    startY: y,
    margin: { left: marginX, right: marginX },
    tableWidth: usableW,
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: HEAD_FILL, textColor: 255, fontStyle: "bold" },
    columnStyles: crewCols,
    alternateRowStyles: { fillColor: ALT_FILL },
    didParseCell: (data) => {
      if (data.section === "head") {
        const col = (crewCols as any)[data.column.index];
        if (col?.halign) data.cell.styles.halign = col.halign;
      }
      if (data.section === "body" && data.row.index === input.crew.length) {
        data.cell.styles.fillColor = TOTAL_FILL;
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ===== DESPESAS =====
  ensureSpace(40);
  sectionTitle("DESPESAS");
  if (input.expenses.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text("Nenhuma despesa lançada neste fechamento.", marginX, y + 2);
    doc.setTextColor(0);
    y += 8;
  } else {
    const expCols = {
      0: { cellWidth: 35, halign: "left" as const },    // Categoria
      1: { cellWidth: 75, halign: "left" as const },    // Descrição
      2: { cellWidth: 60, halign: "left" as const },    // Show vinculado
      3: { cellWidth: 30, halign: "center" as const },  // Responsável
      4: { cellWidth: 24, halign: "center" as const },  // Incluído
      5: { cellWidth: 45, halign: "right" as const },   // Valor
    };
    const totalDespesasCalc = input.expenses
      .filter((e) => e.incluir_no_calculo && e.responsavel === "produtora")
      .reduce((a, e) => a + Number(e.valor || 0), 0);

    const expBody: any[] = [
      ...input.expenses.map((e) => [
        e.categoria,
        e.descricao || "—",
        e.show_label,
        e.responsavel === "produtora" ? "Produtora" : "Contratante",
        e.incluir_no_calculo ? "Sim" : "Não",
        fmtBRL(e.valor),
      ]),
      [
        { content: "TOTAL DESPESAS (no cálculo)", colSpan: 5, styles: { halign: "right" as const, fontStyle: "bold" as const } },
        { content: fmtBRL(totalDespesasCalc), styles: { halign: "right" as const, fontStyle: "bold" as const } },
      ],
    ];
    autoTable(doc, {
      head: [["Categoria", "Descrição", "Show vinculado", "Responsável", "Incluído", "Valor"]],
      body: expBody,
      startY: y,
      margin: { left: marginX, right: marginX },
      tableWidth: usableW,
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: HEAD_FILL, textColor: 255, fontStyle: "bold" },
      columnStyles: expCols,
      alternateRowStyles: { fillColor: ALT_FILL },
      didParseCell: (data) => {
        if (data.section === "head") {
          const col = (expCols as any)[data.column.index];
          if (col?.halign) data.cell.styles.halign = col.halign;
        }
        if (data.section === "body" && data.row.index === input.expenses.length) {
          data.cell.styles.fillColor = TOTAL_FILL;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ===== INVESTIMENTOS =====
  if (input.investments.length > 0) {
    ensureSpace(40);
    sectionTitle("INVESTIMENTOS (descontados apenas dos sócios)");
    const invCols = {
      0: { cellWidth: 90, halign: "left" as const },    // Descrição
      1: { cellWidth: 50, halign: "left" as const },    // Categoria
      2: { cellWidth: 45, halign: "right" as const },   // Valor total
      3: { cellWidth: 35, halign: "center" as const },  // Parcela
      4: { cellWidth: 49, halign: "right" as const },   // A descontar
    };
    const invBody: any[] = [
      ...input.investments.map((i) => [
        i.descricao, i.categoria, fmtBRL(i.valor_total),
        `${i.numero_parcela}/${i.total_parcelas}`, fmtBRL(i.valor_descontado),
      ]),
      [
        { content: "TOTAL", colSpan: 4, styles: { halign: "right" as const, fontStyle: "bold" as const } },
        { content: fmtBRL(input.totals.totalInvestimentos), styles: { halign: "right" as const, fontStyle: "bold" as const } },
      ],
    ];
    autoTable(doc, {
      head: [["Descrição", "Categoria", "Valor total", "Parcela", "A descontar"]],
      body: invBody,
      startY: y,
      margin: { left: marginX, right: marginX },
      tableWidth: usableW,
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: HEAD_FILL, textColor: 255, fontStyle: "bold" },
      columnStyles: invCols,
      alternateRowStyles: { fillColor: ALT_FILL },
      didParseCell: (data) => {
        if (data.section === "head") {
          const col = (invCols as any)[data.column.index];
          if (col?.halign) data.cell.styles.halign = col.halign;
        }
        if (data.section === "body" && data.row.index === input.investments.length) {
          data.cell.styles.fillColor = TOTAL_FILL;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ===== CLIPE =====
  ensureSpace(40);
  sectionTitle("CLIPE");
  if (input.clipes.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text("Nenhum lançamento de clipe nesta semana.", marginX, y + 2);
    doc.setTextColor(0);
    y += 8;
  } else {
    const clipeCols = {
      0: { cellWidth: 60, halign: "left" as const },
      1: { cellWidth: 45, halign: "left" as const },
      2: { cellWidth: 60, halign: "left" as const },
      3: { cellWidth: 20, halign: "center" as const },
      4: { cellWidth: 40, halign: "right" as const },
      5: { cellWidth: 44, halign: "right" as const },
    };
    const clipeBody: any[] = [
      ...input.clipes.map((c) => [
        c.profissional || "—", c.funcao || "—", c.clipe || "—",
        String(c.quantidade), fmtBRL(c.valor_por_clipe), fmtBRL(c.total),
      ]),
      [
        { content: "TOTAL CLIPE", colSpan: 5, styles: { halign: "right" as const, fontStyle: "bold" as const } },
        { content: fmtBRL(input.totals.totalClipe), styles: { halign: "right" as const, fontStyle: "bold" as const } },
      ],
    ];
    autoTable(doc, {
      head: [["Profissional", "Função", "Clipe", "Qtd", "Valor/clipe", "Total"]],
      body: clipeBody,
      startY: y,
      margin: { left: marginX, right: marginX },
      tableWidth: usableW,
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: HEAD_FILL, textColor: 255, fontStyle: "bold" },
      columnStyles: clipeCols,
      alternateRowStyles: { fillColor: ALT_FILL },
      didParseCell: (data) => {
        if (data.section === "head") {
          const col = (clipeCols as any)[data.column.index];
          if (col?.halign) data.cell.styles.halign = col.halign;
        }
        if (data.section === "body" && data.row.index === input.clipes.length) {
          data.cell.styles.fillColor = TOTAL_FILL;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ===== DISTRIBUIÇÃO — layout em 2 painéis =====
  const dist = input.totals.distribution;
  // Estimar altura dos cards
  const cols = dist.length <= 4 ? 2 : 1;
  const rowsCount = Math.ceil(dist.length / cols);
  const cardH = 24; // mm cada card
  const distHeaderH = 8;
  const footerH = 20;
  const panelH = Math.max(70, distHeaderH + rowsCount * (cardH + 3) + footerH);
  ensureSpace(panelH + 6);

  const leftW = usableW * 0.4 - 2;
  const rightW = usableW * 0.6 - 2;
  const leftX = marginX;
  const rightX = marginX + leftW + 4;
  const panelTop = y;

  // PAINEL ESQUERDO — Resumo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("RESUMO DO FECHAMENTO", leftX, panelTop + 5);
  doc.setDrawColor(...CARD_BORDER);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(leftX, panelTop + 7, leftW, panelH - 7, 1.5, 1.5, "S");

  let ly = panelTop + 13;
  const lineH = 5;
  const drawResumo = (label: string, valor: string, opts: { negativo?: boolean; bold?: boolean; bigger?: boolean; sep?: boolean } = {}) => {
    if (opts.sep) {
      doc.setDrawColor(200);
      doc.line(leftX + 3, ly - 2, leftX + leftW - 3, ly - 2);
    }
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.bigger ? 11 : 9);
    doc.setTextColor(0);
    doc.text(label, leftX + 3, ly + 2);
    doc.text(valor, leftX + leftW - 3, ly + 2, { align: "right" });
    ly += opts.bigger ? lineH + 2 : lineH;
  };

  drawResumo("Total cachê bruto:", fmtBRL(input.totals.totalBruto));
  drawResumo(`Imposto (${input.impostoPercentual}% sobre bruto):`, `-${fmtBRL(input.totals.totalImpostos)}`);
  drawResumo("(-) Comissão vendedores:", `-${fmtBRL(input.totals.totalComissoes)}`);
  drawResumo("(-) Custo equipe:", `-${fmtBRL(input.totals.totalCustoEquipeShows + input.totals.totalEquipe)}`);
  drawResumo("(-) Van:", `-${fmtBRL(input.totals.totalVan)}`);
  drawResumo("(-) Despesas dos shows:", `-${fmtBRL(input.totals.totalDespesasShows)}`);
  drawResumo("(-) Custo clipe:", `-${fmtBRL(input.totals.totalClipe)}`);
  drawResumo("(-) Investimentos sócios:", `-${fmtBRL(input.totals.totalInvestimentos)}`);
  ly += 1;
  drawResumo("SOBRA PARA DISTRIBUIR:", fmtBRL(input.totals.sobra), { bold: true, bigger: true, sep: true });

  // PAINEL DIREITO — Cards
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DISTRIBUIÇÃO FINAL POR PARTICIPANTE", rightX, panelTop + 5);

  const cardW = (rightW - (cols - 1) * 3) / cols;
  let cardY = panelTop + 8;
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i];
    const ci = i % cols;
    const ri = Math.floor(i / cols);
    const cx = rightX + ci * (cardW + 3);
    const cy = cardY + ri * (cardH + 3);

    doc.setDrawColor(...CARD_BORDER);
    doc.setFillColor(...CARD_FILL);
    doc.roundedRect(cx, cy, cardW, cardH, 1.5, 1.5, "FD");

    // Header card
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(`${d.beneficiario.toUpperCase()} (${d.percentual.toFixed(2)}%)`, cx + 2, cy + 5);
    doc.setFontSize(11);
    doc.text(fmtBRL(d.valor_liquido), cx + cardW - 2, cy + 5, { align: "right" });

    doc.setDrawColor(210);
    doc.line(cx + 2, cy + 7, cx + cardW - 2, cy + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    let cyText = cy + 11;
    doc.text(`Bruto (${d.percentual.toFixed(2)}% da sobra):`, cx + 2, cyText);
    doc.text(fmtBRL(d.valor_bruto), cx + cardW - 2, cyText, { align: "right" });
    cyText += 4;
    doc.text("(-) Imposto:", cx + 2, cyText);
    doc.text(`-${fmtBRL(d.imposto_valor)}`, cx + cardW - 2, cyText, { align: "right" });
    if (d.tipo === "socio" || d.tipo === "parceiro") {
      cyText += 4;
      doc.text("(-) Investimentos:", cx + 2, cyText);
      doc.text(`-${fmtBRL(d.investimento_valor)}`, cx + cardW - 2, cyText, { align: "right" });
    }
  }

  // Footer panel direito
  const footerY = panelTop + 7 + Math.max(rowsCount * (cardH + 3) + 4, 0) + 8;
  let fy = Math.max(footerY, ly + 4);
  // Garantir dentro da página
  if (fy > pageHeight - 20) { doc.addPage(); fy = 20; }

  doc.setDrawColor(180);
  doc.line(rightX, fy, rightX + rightW, fy);
  fy += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Total impostos:", rightX, fy);
  doc.text(fmtBRL(input.totals.totalImpostos), rightX + rightW, fy, { align: "right" });
  fy += 4;
  doc.text("Total investimentos:", rightX, fy);
  doc.text(fmtBRL(input.totals.totalInvestimentos), rightX + rightW, fy, { align: "right" });
  fy += 2;
  doc.setDrawColor(180);
  doc.line(rightX, fy, rightX + rightW, fy);
  fy += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL LÍQUIDO DISTRIBUÍDO:", rightX, fy);
  doc.text(fmtBRL(input.totals.totalLiquido), rightX + rightW, fy, { align: "right" });

  y = fy + 6;

  // ===== Observações =====
  if (input.observacoes) {
    if (y > pageHeight - 25) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("OBSERVAÇÕES", marginX, y); y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(input.observacoes, usableW);
    doc.text(wrapped, marginX, y);
  }

  const filename = `fechamento_${input.artistName}_${input.semanaInicio}.pdf`.replace(/\s+/g, "_").toLowerCase();
  doc.save(filename);

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - 10) {
      doc.addPage();
      y = 20;
    }
  }
  function sectionTitle(t: string) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(t, marginX, y);
    y += 2;
  }
}
