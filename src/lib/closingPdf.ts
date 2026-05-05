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
  shows: {
    data_show: string;
    vendedor?: string | null;
    local?: string | null;
    cidade?: string | null;
    cache_total: number;
    comissao_vendedor: number;
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
    descricao?: string | null;
    valor: number;
    responsavel: string;
    incluir_no_calculo: boolean;
  }[];
  totals: ClosingTotals;
};

const APP_NAME = "ShowFlow — Stage";

function semanaNumero(start: string): number {
  const d = new Date(start + "T00:00:00");
  const onejan = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - onejan.getTime()) / 86400000);
  return Math.ceil((days + onejan.getDay() + 1) / 7);
}

export function exportClosingPDF(input: ClosingPdfInput) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const start = new Date(input.semanaInicio + "T00:00:00");
  const mesNome = start.toLocaleDateString("pt-BR", { month: "long" });
  const ano = start.getFullYear();
  const semana = semanaNumero(input.semanaInicio);

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(APP_NAME, 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString("pt-BR"), pageWidth - 14, 12, { align: "right" });
  doc.setDrawColor(220);
  doc.line(14, 14, pageWidth - 14, 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(
    `Fechamento de ${fmtDateBR(input.semanaInicio)} a ${fmtDateBR(input.semanaFim)}`,
    14,
    20,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Artista: ${input.artistName}   |   Mês: ${mesNome}   |   Semana ${semana}/${ano}`, 14, 25);

  // Tabela de shows
  const showsRows = input.shows.map((s) => [
    fmtDateBR(s.data_show),
    s.vendedor ?? "—",
    [s.local, s.cidade].filter(Boolean).join(" — ") || "—",
    fmtBRL(s.cache_total),
    fmtBRL(s.comissao_vendedor),
    s.incluido ? "Sim" : "Não",
  ]);
  showsRows.push([
    "",
    "",
    "TOTAIS",
    fmtBRL(input.totals.totalBruto),
    fmtBRL(input.totals.totalComissoes),
    "",
  ]);

  autoTable(doc, {
    head: [["Data", "Vendedor", "Local", "Cachê", "Comissão", "Incluído"]],
    body: showsRows,
    startY: 30,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "center" },
    },
    didParseCell: (data) => {
      if (data.row.index === showsRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [240, 240, 240];
      }
    },
  });

  let y = (doc as any).lastAutoTable.finalY + 6;

  // Equipe
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("EQUIPE", 14, y);
  y += 2;
  autoTable(doc, {
    head: [["Nome", "Função", "Cachê/show", "Shows", "Total"]],
    body: [
      ...input.crew.map((c) => [
        c.nome,
        c.funcao ?? "—",
        fmtBRL(c.cache_por_show),
        String(c.shows_participados),
        fmtBRL(c.total_receber),
      ]),
      ["", "TOTAL EQUIPE", "", "", fmtBRL(input.totals.totalEquipe)],
    ],
    startY: y,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold" },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "center" }, 4: { halign: "right" } },
    didParseCell: (data) => {
      if (data.row.index === input.crew.length) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [240, 240, 240];
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Despesas
  if (input.expenses.length > 0) {
    if (y > pageHeight - 50) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("DESPESAS", 14, y);
    y += 2;
    autoTable(doc, {
      head: [["Categoria", "Descrição", "Responsável", "Incluído", "Valor"]],
      body: [
        ...input.expenses.map((e) => [
          e.categoria,
          e.descricao ?? "—",
          e.responsavel,
          e.incluir_no_calculo ? "Sim" : "Não",
          fmtBRL(e.valor),
        ]),
        ["", "", "", "TOTAL DESPESAS (no cálculo)", fmtBRL(input.totals.totalDespesas)],
      ],
      startY: y,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold" },
      columnStyles: { 4: { halign: "right" } },
      didParseCell: (data) => {
        if (data.row.index === input.expenses.length) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Distribuição
  if (y > pageHeight - 60) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`DISTRIBUIÇÃO DA SOBRA — ${fmtBRL(input.totals.sobra)}`, 14, y);
  y += 2;
  autoTable(doc, {
    head: [["Beneficiário", "%", "Bruto", "Imposto", "Líquido"]],
    body: [
      ...input.totals.distribution.map((d: DistributionRow) => [
        d.beneficiario,
        `${d.percentual.toFixed(2)}%`,
        fmtBRL(d.valor_bruto),
        fmtBRL(d.imposto_valor),
        fmtBRL(d.valor_liquido),
      ]),
      [
        "TOTAL",
        "",
        fmtBRL(input.totals.distribution.reduce((a, d) => a + d.valor_bruto, 0)),
        fmtBRL(input.totals.totalImpostos),
        fmtBRL(input.totals.totalLiquido),
      ],
    ],
    startY: y,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    didParseCell: (data) => {
      if (data.row.index === input.totals.distribution.length) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [220, 235, 220];
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Resumo final
  if (y > pageHeight - 40) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("RESUMO", 14, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const linhas = [
    `Total bruto dos shows: ${fmtBRL(input.totals.totalBruto)}`,
    `(-) Comissão vendedores: ${fmtBRL(input.totals.totalComissoes)}`,
    `(-) Equipe: ${fmtBRL(input.totals.totalEquipe)}`,
    `(-) Despesas (produtora): ${fmtBRL(input.totals.totalDespesas)}`,
    `(=) Sobra para distribuir: ${fmtBRL(input.totals.sobra)}`,
    `Total impostos: ${fmtBRL(input.totals.totalImpostos)}`,
    `Total líquido distribuído: ${fmtBRL(input.totals.totalLiquido)}`,
  ];
  for (const l of linhas) {
    doc.text(l, 14, y);
    y += 4;
  }

  if (input.observacoes) {
    y += 4;
    if (y > pageHeight - 20) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVAÇÕES", 14, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(input.observacoes, pageWidth - 28);
    doc.text(wrapped, 14, y);
  }

  const filename = `fechamento_${input.artistName}_${input.semanaInicio}.pdf`
    .replace(/\s+/g, "_")
    .toLowerCase();
  doc.save(filename);
}
