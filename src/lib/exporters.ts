// Utilitários de exportação (CSV e PDF) reutilizáveis em todo o sistema.
// PDF gerado com jsPDF + autotable, com cabeçalho padrão "ShowFlow".

import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";

export type Column = {
  header: string;
  /** chave do objeto OU função que extrai o valor */
  key: string | ((row: any) => string | number | null | undefined);
  /** alinhamento da coluna no PDF */
  align?: "left" | "right" | "center";
  /** largura desejada (mm) opcional */
  width?: number;
};

export type ExportMeta = {
  /** Título exibido no PDF */
  title: string;
  /** Subtítulo ou descrição do filtro aplicado (opcional) */
  subtitle?: string;
  /** Linhas extras de filtros (ex.: "Período: 01/05/2026–31/05/2026") */
  filters?: string[];
  /** Linha-resumo final (ex.: totais) */
  summary?: { label: string; value: string }[];
  /** Nome do arquivo (sem extensão) */
  filename: string;
};

const APP_NAME = "ShowFlow";

function brDateTime(d = new Date()) {
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function valueOf(row: any, key: Column["key"]): string {
  const v = typeof key === "function" ? key(row) : row?.[key];
  if (v === null || v === undefined) return "";
  return String(v);
}

// ===== CSV =====

function csvEscape(v: string) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportCSV(rows: any[], columns: Column[], meta: ExportMeta) {
  const lines: string[] = [];
  // Cabeçalho informativo (linhas comentadas com #)
  lines.push(`# ${APP_NAME} - ${meta.title}`);
  if (meta.subtitle) lines.push(`# ${meta.subtitle}`);
  if (meta.filters?.length) for (const f of meta.filters) lines.push(`# ${f}`);
  lines.push(`# Gerado em ${brDateTime()}`);
  lines.push("");
  // Cabeçalho de colunas
  lines.push(columns.map((c) => csvEscape(c.header)).join(";"));
  // Dados
  for (const r of rows) {
    lines.push(columns.map((c) => csvEscape(valueOf(r, c.key))).join(";"));
  }
  // Resumo
  if (meta.summary?.length) {
    lines.push("");
    for (const s of meta.summary) lines.push(`${csvEscape(s.label)};${csvEscape(s.value)}`);
  }

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${meta.filename}.csv`);
}

// ===== PDF =====

export function exportPDF(rows: any[], columns: Column[], meta: ExportMeta) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(APP_NAME, 14, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Gerado em ${brDateTime()}`, pageWidth - 14, 14, { align: "right" });

  doc.setDrawColor(220);
  doc.line(14, 17, pageWidth - 14, 17);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(meta.title, 14, 24);

  let y = 28;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (meta.subtitle) {
    doc.text(meta.subtitle, 14, y);
    y += 4;
  }
  if (meta.filters?.length) {
    for (const f of meta.filters) {
      doc.text(f, 14, y);
      y += 4;
    }
  }

  // Tabela
  const head = [columns.map((c) => c.header)];
  const body: RowInput[] = rows.map((r) => columns.map((c) => valueOf(r, c.key)));

  autoTable(doc, {
    head,
    body,
    startY: y + 2,
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: columns.reduce((acc, c, i) => {
      acc[i] = {
        halign: c.align ?? "left",
        ...(c.width ? { cellWidth: c.width } : {}),
      };
      return acc;
    }, {} as Record<number, any>),
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const current = doc.getCurrentPageInfo().pageNumber;
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Página ${current}/${pageCount}`, pageWidth - 14, pageHeight - 8, { align: "right" });
      doc.text(APP_NAME, 14, pageHeight - 8);
      doc.setTextColor(0);
    },
  });

  // Resumo no final
  if (meta.summary?.length) {
    const finalY = (doc as any).lastAutoTable?.finalY ?? y + 2;
    let sy = finalY + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Resumo", 14, sy);
    sy += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const s of meta.summary) {
      doc.text(`${s.label}: ${s.value}`, 14, sy);
      sy += 4;
    }
  }

  doc.save(`${meta.filename}.pdf`);
}

// ===== PDF documento (livre, para minutas) =====

export type DocSection = { title: string; lines: { label: string; value: string }[] };

export function exportDocumentPDF(opts: {
  title: string;
  filename: string;
  subtitle?: string;
  sections: DocSection[];
  footer?: string;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(APP_NAME, 14, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(brDateTime(), pageWidth - 14, 14, { align: "right" });
  doc.setDrawColor(220);
  doc.line(14, 17, pageWidth - 14, 17);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(opts.title, 14, 25);
  let y = 30;
  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(opts.subtitle, 14, y);
    y += 6;
  }

  for (const sec of opts.sections) {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setFillColor(240, 240, 240);
    doc.rect(14, y - 4, pageWidth - 28, 6, "F");
    doc.text(sec.title, 16, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const ln of sec.lines) {
      const text = `${ln.label}: ${ln.value || "—"}`;
      const wrapped = doc.splitTextToSize(text, pageWidth - 28) as string[];
      if (y + wrapped.length * 5 > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      doc.text(wrapped, 14, y);
      y += wrapped.length * 5 + 1;
    }
    y += 3;
  }

  if (opts.footer) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(opts.footer, 14, pageHeight - 10);
    doc.setTextColor(0);
  }

  doc.save(`${opts.filename}.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===== Helpers de formatação =====

export function fmtBRL(n: number | string | null | undefined) {
  return Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtDateBR(iso: string | null | undefined) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
