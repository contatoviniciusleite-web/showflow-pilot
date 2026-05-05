// Renderiza <ClosingPDFDocument/> em um container offscreen, captura com
// html2canvas e empacota num PDF A4 retrato com quebras de página automáticas.

import { createRoot } from "react-dom/client";
import { createElement } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import ClosingPDFDocument, { type ClosingPdfDocumentProps } from "@/components/fechamento/ClosingPDFDocument";

export async function exportClosingDocumentPDF(
  data: ClosingPdfDocumentProps,
  filename: string,
) {
  // Container offscreen — fora da viewport mas renderizado no DOM
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "794px"; // 210mm
  host.style.background = "#ffffff";
  host.style.zIndex = "-1";
  document.body.appendChild(host);

  const root = createRoot(host);

  try {
    await new Promise<void>((resolve) => {
      root.render(createElement(ClosingPDFDocument, data));
      // Espera ciclo de render
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    if ((document as any).fonts?.ready) {
      try { await (document as any).fonts.ready; } catch { /* ignore */ }
    }

    const target = host.firstElementChild as HTMLElement;
    if (!target) throw new Error("Falha ao renderizar documento PDF");

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: 794,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();   // 210
    const pageH = pdf.internal.pageSize.getHeight();  // 297
    const imgWmm = pageW;
    const imgHmm = (canvas.height * imgWmm) / canvas.width;

    if (imgHmm <= pageH) {
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, imgWmm, imgHmm);
    } else {
      // Fatia verticalmente em páginas A4
      const pagePxHeight = (pageH * canvas.width) / imgWmm;
      let renderedPx = 0;
      while (renderedPx < canvas.height) {
        const sliceHeight = Math.min(pagePxHeight, canvas.height - renderedPx);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        const sliceHmm = (sliceHeight * imgWmm) / canvas.width;
        if (renderedPx > 0) pdf.addPage();
        pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, imgWmm, sliceHmm);
        renderedPx += sliceHeight;
      }
    }

    pdf.save(filename);
  } finally {
    root.unmount();
    host.remove();
  }
}
