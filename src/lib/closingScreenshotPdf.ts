// Exporta a tela de fechamento como PDF preservando 100% do layout visual.
// Usa html2canvas para capturar o DOM e jsPDF para empacotar em A4 paisagem.

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function exportClosingScreenshotPDF(
  element: HTMLElement,
  filename: string,
) {
  // Espera fonts carregarem para evitar reflow no canvas
  if ((document as any).fonts?.ready) {
    try { await (document as any).fonts.ready; } catch { /* ignore */ }
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: Math.max(element.scrollWidth, 1280),
    scrollX: 0,
    scrollY: -window.scrollY,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableW = pageWidth - margin * 2;
  const usableH = pageHeight - margin * 2;

  // Dimensões da imagem em mm preservando proporção
  const imgWmm = usableW;
  const imgHmm = (canvas.height * imgWmm) / canvas.width;

  if (imgHmm <= usableH) {
    pdf.addImage(imgData, "JPEG", margin, margin, imgWmm, imgHmm);
  } else {
    // Quebra em múltiplas páginas
    const pagePxHeight = (usableH * canvas.width) / usableW;
    let renderedPx = 0;
    while (renderedPx < canvas.height) {
      const sliceHeight = Math.min(pagePxHeight, canvas.height - renderedPx);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const ctx = pageCanvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0, renderedPx, canvas.width, sliceHeight,
        0, 0, canvas.width, sliceHeight,
      );
      const sliceData = pageCanvas.toDataURL("image/jpeg", 0.92);
      const sliceHmm = (sliceHeight * imgWmm) / canvas.width;
      if (renderedPx > 0) pdf.addPage();
      pdf.addImage(sliceData, "JPEG", margin, margin, imgWmm, sliceHmm);
      renderedPx += sliceHeight;
    }
  }

  pdf.save(filename);
}
