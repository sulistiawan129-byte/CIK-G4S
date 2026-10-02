import type { NcReportRow } from "@/lib/gc/types";
import { REPORT_LABELS, type Lang } from "@/lib/gc/i18n";

export async function exportRowsToExcel(rows: NcReportRow[], filename: string, sheetName = "Data", lang: Lang = "id") {
  const L = REPORT_LABELS[lang];
  const XLSX = await import("xlsx");
  const data = rows.map((r) => ({
    [L.date]: r.tanggal,
    [L.plant]: r.plant,
    [L.company]: r.nama_supplier,
    [L.driver]: r.nama_petugas,
    [L.plate]: r.no_polisi,
    [L.violation]: r.temuan_list.join(", "),
    [L.notes]: r.catatan ?? "",
    [L.status]: r.status,
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

export async function exportSummaryToExcel(
  rows: Record<string, string | number>[],
  filename: string,
  sheetName = "Ringkasan"
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

export async function exportRowsToPDF(rows: NcReportRow[], title: string, subtitle: string, filename: string, lang: Lang = "id") {
  const L = REPORT_LABELS[lang];
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  doc.setFillColor(11, 18, 32);
  doc.rect(0, 0, pageWidth, 20, "F");
  doc.setFillColor(228, 0, 43);
  doc.rect(0, 20, pageWidth, 1.3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CIKOPS-G&C", margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Security & Cleaning Service Operations", margin, 17);

  doc.setTextColor(11, 18, 32);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, pageWidth / 2, 30, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(subtitle, margin, 38, { maxWidth: pageWidth - margin * 2 });
  doc.text(`${L.createdAt}: ${new Date().toLocaleString(lang === "id" ? "id-ID" : "en-US")}`, margin, 43);

  autoTable(doc, {
    startY: 48,
    head: [[L.date, L.plant, L.company, L.driver, L.plate, L.violation, L.status]],
    body: rows.map((r) => [r.tanggal, r.plant, r.nama_supplier, r.nama_petugas, r.no_polisi, r.temuan_list.join(", "), r.status]),
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [11, 18, 32], textColor: 255, fontStyle: "bold" },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `CIKOPS-G&C — ${L.page} ${doc.getCurrentPageInfo().pageNumber} ${L.of} ${doc.getNumberOfPages()}`,
        pageWidth - margin,
        doc.internal.pageSize.getHeight() - 8,
        { align: "right" }
      );
    },
  });

  doc.save(filename);
}

export async function exportSummaryToPDF(
  headers: string[],
  rows: (string | number)[][],
  title: string,
  subtitle: string,
  filename: string
) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  doc.setFillColor(11, 18, 32);
  doc.rect(0, 0, pageWidth, 20, "F");
  doc.setFillColor(228, 0, 43);
  doc.rect(0, 20, pageWidth, 1.3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CIKOPS-G&C", margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Security & Cleaning Service Operations", margin, 17);

  doc.setTextColor(11, 18, 32);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, pageWidth / 2, 30, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(subtitle, margin, 38, { maxWidth: pageWidth - margin * 2 });
  doc.text(`Dibuat: ${new Date().toLocaleString("id-ID")}`, margin, 43);

  autoTable(doc, {
    startY: 48,
    head: [headers],
    body: rows,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [11, 18, 32], textColor: 255, fontStyle: "bold" },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `CIKOPS-G&C — Halaman ${doc.getCurrentPageInfo().pageNumber} dari ${doc.getNumberOfPages()}`,
        pageWidth - margin,
        doc.internal.pageSize.getHeight() - 8,
        { align: "right" }
      );
    },
  });

  doc.save(filename);
}
