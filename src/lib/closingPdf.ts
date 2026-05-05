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
    custo_equipe: number;
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
  investments: {
    descricao: string;
    categoria: string;
    valor_total: number;
    total_parcelas: number;
    numero_parcela: number;
    valor_descontado: number;
  }[];
  totals: ClosingTotals;
};

const APP_NAME = "ShowFlow — Stage";

export function exportClosingPDF(input: ClosingPdfInput) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

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
  doc.text(`Fechamento de ${fmtDateBR(input.semanaInicio)} a ${fmtDateBR(input.semanaFim)}`, 14, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Artista: ${input.artistName}`, 14, 25);

  // Tabela shows com sub-linhas de despesas
  const showsRows: any[] = [];
  for (const s of input.shows) {
    showsRows.push([
      fmtDateBR(s.data_show),
      s.vendedor ?? "—",
      [s.local, s.cidade].filter(Boolean).join(" — ") || "—",
      fmtBRL(s.cache_total),
      fmtBRL(s.comissao_vendedor),
      fmtBRL(s.custo_equipe),
      fmtBRL(s.despesas_show),
      s.incluido ? "Sim" : "Não",
    ]);
    for (const d of s.despesas_detalhe) {
      showsRows.push([
        "",
        { content: `↳ ${d.categoria}: ${d.descricao || "—"}`, colSpan: 5, styles: { fontStyle: "italic", textColor: 100 } },
        fmtBRL(d.valor),
        "",
      ]);
    }
  }
  showsRows.push([
    "", "", "TOTAIS",
    fmtBRL(input.totals.totalBruto),
    fmtBRL(input.totals.totalComissoes),
    fmtBRL(input.totals.totalCustoEquipeShows),
    fmtBRL(input.totals.totalDespesasShows),
    "",
  ]);

  autoTable(doc, {
    head: [["Data", "Vendedor", "Local", "Cachê", "Comissão", "Equipe", "Despesas", "Incl."]],
    body: showsRows,
    startY: 30,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      3: { halign: "right" }, 4: { halign: "right" },
      5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "center" },
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
  doc.text("EQUIPE", 14, y); y += 2;
  autoTable(doc, {
    head: [["Nome", "Função", "Cachê/show", "Shows", "Total"]],
    body: [
      ...input.crew.map((c) => [c.nome, c.funcao ?? "—", fmtBRL(c.cache_por_show), String(c.shows_participados), fmtBRL(c.total_receber)]),
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

  // Investimentos
  if (input.investments.length > 0) {
    if (y > pageHeight - 50) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("INVESTIMENTOS (descontados apenas dos sócios)", 14, y); y += 2;
    autoTable(doc, {
      head: [["Descrição", "Categoria", "Valor total", "Parcela", "A descontar"]],
      body: [
        ...input.investments.map((i) => [
          i.descricao, i.categoria, fmtBRL(i.valor_total),
          `${i.numero_parcela}/${i.total_parcelas}`, fmtBRL(i.valor_descontado),
        ]),
        ["", "", "", "TOTAL", fmtBRL(input.totals.totalInvestimentos)],
      ],
      startY: y,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold" },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "center" }, 4: { halign: "right" } },
      didParseCell: (data) => {
        if (data.row.index === input.investments.length) {
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
  doc.text(`DISTRIBUIÇÃO DA SOBRA — ${fmtBRL(input.totals.sobra)}`, 14, y); y += 2;
  autoTable(doc, {
    head: [["Beneficiário", "%", "Bruto", "Imposto", "Investimentos", "Líquido"]],
    body: [
      ...input.totals.distribution.map((d: DistributionRow) => [
        d.beneficiario, `${d.percentual.toFixed(2)}%`,
        fmtBRL(d.valor_bruto), fmtBRL(d.imposto_valor),
        d.investimento_valor > 0 ? fmtBRL(d.investimento_valor) : "—",
        fmtBRL(d.valor_liquido),
      ]),
      [
        "TOTAL", "",
        fmtBRL(input.totals.distribution.reduce((a, d) => a + d.valor_bruto, 0)),
        fmtBRL(input.totals.totalImpostos),
        fmtBRL(input.totals.totalInvestimentos),
        fmtBRL(input.totals.totalLiquido),
      ],
    ],
    startY: y,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    didParseCell: (data) => {
      if (data.row.index === input.totals.distribution.length) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [220, 235, 220];
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Resumo
  if (y > pageHeight - 50) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("RESUMO", 14, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const linhas = [
    `Total cachê bruto: ${fmtBRL(input.totals.totalBruto)}`,
    `(-) Comissão vendedores: ${fmtBRL(input.totals.totalComissoes)}`,
    `(-) Custo equipe: ${fmtBRL(input.totals.totalCustoEquipeShows)}`,
    `(-) Despesas dos shows: ${fmtBRL(input.totals.totalDespesasShows)}`,
    `(=) Sobra para distribuir: ${fmtBRL(input.totals.sobra)}`,
    `Total impostos (sobre bruto): ${fmtBRL(input.totals.totalImpostos)}`,
    `Total investimentos descontados: ${fmtBRL(input.totals.totalInvestimentos)}`,
    `Total líquido distribuído: ${fmtBRL(input.totals.totalLiquido)}`,
  ];
  for (const l of linhas) { doc.text(l, 14, y); y += 4; }

  if (input.observacoes) {
    y += 4;
    if (y > pageHeight - 20) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVAÇÕES", 14, y); y += 4;
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(input.observacoes, pageWidth - 28);
    doc.text(wrapped, 14, y);
  }

  const filename = `fechamento_${input.artistName}_${input.semanaInicio}.pdf`.replace(/\s+/g, "_").toLowerCase();
  doc.save(filename);
}
