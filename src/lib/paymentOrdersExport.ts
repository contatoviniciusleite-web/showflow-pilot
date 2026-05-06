// Exportação (PDF e CSV) da lista de Ordens de Pagamento agrupadas por fechamento.
import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { fmtBRL, fmtDateBR } from "@/lib/exporters";
import { TIPO_LABEL, STATUS_LABEL } from "@/lib/paymentOrders";

export type PaymentOrderExport = {
  id: string;
  closing_id: string;
  artist_id: string;
  tipo: string;
  beneficiario_nome: string;
  descricao: string;
  valor: number;
  valor_pago: number | null;
  data_sugerida: string;
  data_pagamento: string | null;
  status: string;
  forma_pagamento: string | null;
  pago_em: string | null;
  closing?: {
    semana_inicio: string;
    semana_fim: string;
    artists?: { nome: string } | null;
  } | null;
};

export type ExportFilters = {
  periodo: string;
  artista: string;
  status: string;
};

const STATUS_COLOR: Record<string, [number, number, number]> = {
  pendente: [217, 119, 6],   // #d97706
  agendado: [37, 99, 235],   // #2563eb
  pago: [22, 163, 74],       // #16a34a
  cancelado: [220, 38, 38],  // #dc2626
};

const STATUS_SUFFIX: Record<string, string> = {
  pago: " ✓",
};

const TIPO_BADGE: Record<string, { bg: [number, number, number]; fg: [number, number, number] }> = {
  artista:       { bg: [220, 252, 231], fg: [22, 101, 52] },
  socio:         { bg: [237, 233, 254], fg: [76, 29, 149] },
  equipe:        { bg: [219, 234, 254], fg: [30, 64, 175] },
  vendedor:      { bg: [255, 237, 213], fg: [154, 52, 18] },
  despesa:       { bg: [243, 244, 246], fg: [55, 65, 81] },
  clipe:         { bg: [252, 231, 243], fg: [131, 24, 67] },
  investimento:  { bg: [254, 243, 199], fg: [146, 64, 14] },
};

function brDateTime(d = new Date()) {
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function closingTitle(c: PaymentOrderExport["closing"]) {
  const nome = c?.artists?.nome ?? "—";
  return `${nome} · ${fmtDateBR(c?.semana_inicio ?? "")} a ${fmtDateBR(c?.semana_fim ?? "")}`;
}

// ===== PDF =====
export function exportPaymentOrdersPDF(
  groups: { closingId: string; closing: PaymentOrderExport["closing"]; orders: PaymentOrderExport[] }[],
  filters: ExportFilters,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Cabeçalho preto
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, pw, 24, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Stage — ShowFlow", 10, 9);
  doc.setFontSize(13);
  doc.text("Lista de Ordens de Pagamento", 10, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Gerado em: ${brDateTime()}`, pw - 10, 9, { align: "right" });
  doc.text(`Período: ${filters.periodo}`, pw - 10, 14, { align: "right" });
  doc.text(`Artista: ${filters.artista}  ·  Status: ${filters.status}`, pw - 10, 19, { align: "right" });
  doc.setTextColor(0);

  let y = 30;

  let totalGeral = 0;
  let totalPago = 0;
  let totalAgendado = 0;
  let totalCancelado = 0;
  let totalPendente = 0;
  let totalOrdens = 0;
  let counter = 0;

  for (const g of groups) {
    if (y > ph - 40) { doc.addPage(); y = 15; }
    // Header do fechamento
    doc.setFillColor(55, 65, 81);
    doc.rect(10, y, pw - 20, 7, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(closingTitle(g.closing), 12, y + 5);
    doc.setTextColor(0);
    y += 7;

    const head = [["Nº", "Tipo", "Beneficiário", "Descrição", "Valor", "Vencimento", "Status"]];
    const body: RowInput[] = g.orders.map((o) => {
      counter++;
      totalOrdens++;
      const v = Number(o.valor_pago ?? o.valor ?? 0);
      totalGeral += v;
      if (o.status === "pago") totalPago += v;
      else if (o.status === "agendado") totalAgendado += v;
      else if (o.status === "cancelado") totalCancelado += v;
      else if (o.status === "pendente") totalPendente += v;
      return [
        String(counter).padStart(3, "0"),
        TIPO_LABEL[o.tipo] ?? o.tipo,
        o.beneficiario_nome,
        o.descricao,
        fmtBRL(v),
        fmtDateBR(o.data_pagamento ?? o.data_sugerida),
        (STATUS_LABEL[o.status] ?? o.status) + (STATUS_SUFFIX[o.status] ?? ""),
      ];
    });

    const subtotal = g.orders.reduce((a, o) => a + Number(o.valor_pago ?? o.valor ?? 0), 0);
    const pagas = g.orders.filter((o) => o.status === "pago").length;
    const pendentes = g.orders.filter((o) => o.status === "pendente" || o.status === "agendado").length;

    autoTable(doc, {
      head,
      body,
      startY: y,
      styles: { fontSize: 9, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: [243, 244, 246], textColor: 0, fontStyle: "bold", fontSize: 9 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 22 },
        2: { cellWidth: 45 },
        3: { cellWidth: "auto" },
        4: { cellWidth: 28, halign: "right" },
        5: { cellWidth: 25, halign: "center" },
        6: { cellWidth: 28 },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 6) {
          const status = g.orders[data.row.index]?.status;
          const c = STATUS_COLOR[status];
          if (c) {
            data.cell.styles.textColor = c;
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      margin: { left: 10, right: 10 },
      didDrawPage: () => {
        const pn = doc.getCurrentPageInfo().pageNumber;
        const tot = doc.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(120);
        doc.text(`Página ${pn}/${tot}`, pw - 10, ph - 5, { align: "right" });
        doc.text("ShowFlow", 10, ph - 5);
        doc.setTextColor(0);
      },
    });

    let fy = (doc as any).lastAutoTable?.finalY ?? y;
    // Subtotal
    doc.setFillColor(243, 244, 246);
    doc.rect(10, fy, pw - 20, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(
      `Subtotal: ${fmtBRL(subtotal)}  ·  ${pagas} pagas  ·  ${pendentes} pendentes`,
      12, fy + 4,
    );
    y = fy + 10;
  }

  // Resumo final
  if (y > ph - 55) { doc.addPage(); y = 15; }
  doc.setFillColor(26, 26, 26);
  doc.rect(10, y, pw - 20, 8, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RESUMO GERAL", 12, y + 5.5);
  doc.setTextColor(0);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = [
    [`Total de ordens:`, String(totalOrdens)],
    [`Total a pagar (pendente):`, fmtBRL(totalPendente)],
    [`Total agendado:`, fmtBRL(totalAgendado)],
    [`Total pago:`, fmtBRL(totalPago)],
    [`Total cancelado:`, fmtBRL(totalCancelado)],
  ];
  for (const [l, v] of lines) {
    doc.text(l, 12, y);
    doc.text(v, pw - 12, y, { align: "right" });
    y += 5;
  }
  y += 1;
  doc.setDrawColor(0);
  doc.line(10, y, pw - 10, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TOTAL GERAL:", 12, y);
  doc.text(fmtBRL(totalGeral), pw - 12, y, { align: "right" });

  doc.save(`ordens-pagamento-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ===== CSV =====
function csvEscape(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportPaymentOrdersCSV(
  groups: { closingId: string; closing: PaymentOrderExport["closing"]; orders: PaymentOrderExport[] }[],
  filters: ExportFilters,
) {
  const lines: string[] = [];
  lines.push(`# Stage - ShowFlow - Lista de Ordens de Pagamento`);
  lines.push(`# Gerado em ${brDateTime()}`);
  lines.push(`# Período: ${filters.periodo}`);
  lines.push(`# Artista: ${filters.artista} | Status: ${filters.status}`);
  lines.push("");
  const header = [
    "Fechamento", "Artista", "Nº Ordem", "Tipo", "Beneficiário", "Descrição",
    "Valor", "Data vencimento", "Status", "Forma pagamento", "Data pagamento", "Pago em",
  ];
  lines.push(header.map(csvEscape).join(";"));

  let counter = 0;
  for (const g of groups) {
    const fech = `${fmtDateBR(g.closing?.semana_inicio ?? "")} a ${fmtDateBR(g.closing?.semana_fim ?? "")}`;
    const artista = g.closing?.artists?.nome ?? "";
    for (const o of g.orders) {
      counter++;
      lines.push([
        fech,
        artista,
        String(counter).padStart(3, "0"),
        TIPO_LABEL[o.tipo] ?? o.tipo,
        o.beneficiario_nome,
        o.descricao,
        Number(o.valor_pago ?? o.valor ?? 0).toFixed(2).replace(".", ","),
        fmtDateBR(o.data_sugerida),
        STATUS_LABEL[o.status] ?? o.status,
        o.forma_pagamento ?? "",
        fmtDateBR(o.data_pagamento),
        o.pago_em ? new Date(o.pago_em).toLocaleString("pt-BR") : "",
      ].map(csvEscape).join(";"));
    }
  }

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ordens-pagamento-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
