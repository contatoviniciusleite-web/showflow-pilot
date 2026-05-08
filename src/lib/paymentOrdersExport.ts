// Exportação (PDF e CSV) da lista de Ordens de Pagamento agrupadas por fechamento.
import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { fmtBRL, fmtDateBR } from "@/lib/formatters";
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
  const M = 15;

  // Pré-cálculo de totais
  let totalGeral = 0, totalPago = 0, totalAgendado = 0, totalCancelado = 0, totalPendente = 0;
  let totalOrdens = 0, qtdPagas = 0, qtdPendentes = 0, qtdAgendadas = 0;
  for (const g of groups) {
    for (const o of g.orders) {
      totalOrdens++;
      const v = Number(o.valor_pago ?? o.valor ?? 0);
      totalGeral += v;
      if (o.status === "pago") { totalPago += v; qtdPagas++; }
      else if (o.status === "agendado") { totalAgendado += v; qtdAgendadas++; }
      else if (o.status === "cancelado") { totalCancelado += v; }
      else if (o.status === "pendente") { totalPendente += v; qtdPendentes++; }
    }
  }

  // Cabeçalho do documento
  const headerH = 28;
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, pw, headerH, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("\u266B Stage \u2014 ShowFlow", M, 10);
  doc.setFontSize(15);
  doc.text("ORDENS DE PAGAMENTO", M, 19);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200);
  doc.text(
    `Período: ${filters.periodo}  ·  Artista: ${filters.artista}  ·  Status: ${filters.status}  ·  Total: ${totalOrdens} ordens`,
    M, 25,
  );
  doc.setTextColor(180);
  doc.text(`Gerado em ${brDateTime()}`, pw - M, 10, { align: "right" });
  // Linha verde no rodapé do header
  doc.setFillColor(0, 200, 83);
  doc.rect(0, headerH, pw, 1, "F");
  doc.setTextColor(0);

  let y = headerH + 6;

  // Cards de resumo
  const cardGap = 4;
  const cardW = (pw - M * 2 - cardGap * 3) / 4;
  const cardH = 18;
  const cards: { label: string; value: string; sub: string; color: [number, number, number] }[] = [
    { label: "TOTAL ORDENS", value: String(totalOrdens), sub: `${totalOrdens === 1 ? "ordem" : "ordens"}`, color: [55, 65, 81] },
    { label: "A PAGAR", value: fmtBRL(totalPendente), sub: `${qtdPendentes} pendente${qtdPendentes === 1 ? "" : "s"}`, color: [217, 119, 6] },
    { label: "PAGO", value: fmtBRL(totalPago), sub: `${qtdPagas} ${qtdPagas === 1 ? "ordem" : "ordens"}`, color: [22, 163, 74] },
    { label: "AGENDADO", value: fmtBRL(totalAgendado), sub: `${qtdAgendadas} ${qtdAgendadas === 1 ? "ordem" : "ordens"}`, color: [37, 99, 235] },
  ];
  cards.forEach((c, i) => {
    const x = M + i * (cardW + cardGap);
    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text(c.label, x + 3, y + 4.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.value, x + 3, y + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text(c.sub, x + 3, y + 15.5);
  });
  doc.setTextColor(0);
  y += cardH + 6;

  let counter = 0;

  for (const g of groups) {
    if (y > ph - 50) { doc.addPage(); y = M; }
    const subtotalGroup = g.orders.reduce((a, o) => a + Number(o.valor_pago ?? o.valor ?? 0), 0);

    // Header do fechamento
    doc.setFillColor(55, 65, 81);
    doc.rect(M, y, pw - M * 2, 8, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(closingTitle(g.closing), M + 2, y + 5.4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const totalText = `${fmtBRL(subtotalGroup)} total`;
    const totalW = doc.getTextWidth(totalText);
    doc.setTextColor(229, 231, 235);
    doc.text(totalText, pw - M - 2, y + 5.4, { align: "right" });
    const badgeText = "Finalizado";
    const badgeW = doc.getTextWidth(badgeText) + 4;
    const badgeX = pw - M - 2 - totalW - 4 - badgeW;
    doc.setFillColor(22, 163, 74);
    doc.roundedRect(badgeX, y + 2, badgeW, 4, 1, 1, "F");
    doc.setTextColor(255);
    doc.text(badgeText, badgeX + badgeW / 2, y + 5, { align: "center" });
    doc.setTextColor(0);
    y += 8;

    const head = [["Nº", "Tipo", "Beneficiário", "Descrição", "Valor", "Vencimento", "Status"]];
    const body: RowInput[] = g.orders.map((o) => {
      counter++;
      const v = Number(o.valor_pago ?? o.valor ?? 0);
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

    const pagas = g.orders.filter((o) => o.status === "pago").length;
    const pendentes = g.orders.filter((o) => o.status === "pendente" || o.status === "agendado").length;

    autoTable(doc, {
      head,
      body,
      startY: y,
      styles: { fontSize: 8, cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 }, overflow: "linebreak", textColor: [31, 41, 55] },
      headStyles: { fillColor: [75, 85, 99], textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 11, halign: "center" },
        1: { cellWidth: 22, halign: "center" },
        2: { cellWidth: 45 },
        3: { cellWidth: "auto" },
        4: { cellWidth: 26, halign: "right", fontStyle: "bold" },
        5: { cellWidth: 24, halign: "center" },
        6: { cellWidth: 26, halign: "left" },
      },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const o = g.orders[data.row.index];
        if (!o) return;
        if (data.column.index === 1) {
          const t = TIPO_BADGE[o.tipo];
          if (t) {
            data.cell.styles.fillColor = t.bg;
            data.cell.styles.textColor = t.fg;
            data.cell.styles.fontStyle = "bold";
          }
        }
        if (data.column.index === 6) {
          const c = STATUS_COLOR[o.status];
          if (c) {
            data.cell.styles.textColor = c;
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      margin: { left: M, right: M },
      didDrawPage: () => {
        const pn = doc.getCurrentPageInfo().pageNumber;
        const tot = doc.getNumberOfPages();
        doc.setDrawColor(229, 231, 235);
        doc.line(M, ph - 9, pw - M, ph - 9);
        doc.setFontSize(7);
        doc.setTextColor(120);
        doc.setFont("helvetica", "normal");
        doc.text(
          `ShowFlow \u2014 Stage  ·  Confidencial  ·  Gerado em ${brDateTime()}`,
          pw / 2, ph - 5, { align: "center" },
        );
        doc.text(`Página ${pn}/${tot}`, pw - M, ph - 5, { align: "right" });
        doc.setTextColor(0);
      },
    });

    let fy = (doc as any).lastAutoTable?.finalY ?? y;
    doc.setFillColor(229, 231, 235);
    doc.rect(M, fy, pw - M * 2, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(31, 41, 55);
    doc.text(
      `Subtotal: ${fmtBRL(subtotalGroup)}  ·  ${pagas} paga${pagas === 1 ? "" : "s"}  ·  ${pendentes} pendente${pendentes === 1 ? "" : "s"}`,
      pw - M - 2, fy + 4, { align: "right" },
    );
    doc.setTextColor(0);
    y = fy + 10;
  }

  // Resumo geral
  const resumoH = 56;
  if (y > ph - resumoH - 12) { doc.addPage(); y = M; }
  doc.setFillColor(26, 26, 26);
  doc.rect(M, y, pw - M * 2, resumoH, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RESUMO GERAL", M + 4, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const summaryLines: { l: string; v: string; color?: [number, number, number] }[] = [
    { l: "Total de ordens:", v: String(totalOrdens) },
    { l: "Total a pagar (pendente):", v: fmtBRL(totalPendente), color: [217, 119, 6] },
    { l: "Total agendado:", v: fmtBRL(totalAgendado), color: [37, 99, 235] },
    { l: "Total pago:", v: fmtBRL(totalPago), color: [22, 163, 74] },
    { l: "Total cancelado:", v: fmtBRL(totalCancelado), color: [220, 38, 38] },
  ];
  let ly = y + 16;
  for (const ln of summaryLines) {
    doc.setTextColor(229, 231, 235);
    doc.setFont("helvetica", "normal");
    doc.text(ln.l, M + 4, ly);
    if (ln.color) doc.setTextColor(ln.color[0], ln.color[1], ln.color[2]);
    else doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.text(ln.v, pw - M - 4, ly, { align: "right" });
    ly += 5.5;
  }
  doc.setDrawColor(75, 85, 99);
  doc.line(M + 4, ly - 1, pw - M - 4, ly - 1);
  ly += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255);
  doc.text("TOTAL GERAL:", M + 4, ly);
  doc.setTextColor(0, 200, 83);
  doc.text(fmtBRL(totalGeral), pw - M - 4, ly, { align: "right" });
  doc.setTextColor(0);

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
