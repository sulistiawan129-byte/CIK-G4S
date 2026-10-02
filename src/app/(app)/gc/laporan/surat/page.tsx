"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Download, Loader2, CalendarRange, Info } from "lucide-react";
import { fetchReports, fetchSuppliers } from "@/lib/gc/data";
import { PLANTS } from "@/lib/gc/constants";
import type { NcReportRow, Supplier, DashboardFilters } from "@/lib/gc/types";
import SearchableSelect from "@/components/gc/SearchableSelect";

const defaultFilters: DashboardFilters = {
  plant: "Semua",
  supplierId: "Semua",
  status: "Semua",
  dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  dateTo: new Date().toISOString().slice(0, 10),
};

const MONTH_LABELS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatTanggalIndo(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_LABELS[m - 1]} ${y}`;
}

export default function SuratResmiPage() {
  const [reports, setReports] = useState<NcReportRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchSuppliers().then(setSuppliers).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchReports({ plant: filters.plant, dateFrom: filters.dateFrom, dateTo: filters.dateTo })
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.plant, filters.dateFrom, filters.dateTo]);

  const selectedSupplierName = suppliers.find((s) => s.id === filters.supplierId)?.name ?? null;

  const data = useMemo(() => {
    if (!selectedSupplierName) return reports;
    return reports.filter((r) => r.nama_supplier === selectedSupplierName);
  }, [reports, selectedSupplierName]);

  // Rekap: Nama Perusahaan | Nama Driver | Jenis Pelanggaran | Frekuensi
  const rekap = useMemo(() => {
    const map: Record<string, { supplier: string; driver: string; kategori: string; freq: number }> = {};
    data.forEach((r) => {
      r.temuan_list.forEach((kategori) => {
        const key = `${r.nama_supplier}__${r.nama_petugas}__${kategori}`;
        if (!map[key]) map[key] = { supplier: r.nama_supplier, driver: r.nama_petugas, kategori, freq: 0 };
        map[key].freq += 1;
      });
    });
    return Object.values(map).sort(
      (a, b) => a.supplier.localeCompare(b.supplier) || b.freq - a.freq || a.driver.localeCompare(b.driver)
    );
  }, [data]);

  const uniqueDrivers = new Set(data.map((r) => r.nama_petugas)).size;
  const uniqueSuppliers = new Set(data.map((r) => r.nama_supplier)).size;

  async function handleGeneratePDF() {
    setGenerating(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;

      // ---- Kop surat ----
      doc.setFillColor(11, 18, 32); // ink-900
      doc.rect(0, 0, pageWidth, 22, "F");
      doc.setFillColor(228, 0, 43); // brand-500
      doc.rect(0, 22, pageWidth, 1.5, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("CIKOPS-G&C", margin, 13);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Security & Cleaning Service Operations — Modul Pelanggaran Supplier", margin, 18);

      // ---- Judul ----
      doc.setTextColor(11, 18, 32);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("LAPORAN DATA NON-CONFORMANCE (Pelanggaran) SUPPLIER", pageWidth / 2, 34, { align: "center" });

      // ---- Info periode & scope ----
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      let y = 44;
      doc.text(
        `Berikut kami lampirkan data Pelanggaran periode ${formatTanggalIndo(filters.dateFrom)} s/d ${formatTanggalIndo(filters.dateTo)}${
          filters.plant !== "Semua" ? `, Plant ${filters.plant}` : ""
        }${selectedSupplierName ? `, untuk Supplier: ${selectedSupplierName}` : ", seluruh supplier"}.`,
        margin,
        y,
        { maxWidth: pageWidth - margin * 2 }
      );
      y += 10;

      // ---- Ringkasan singkat ----
      doc.setFont("helvetica", "bold");
      doc.text(`Total Kejadian: ${data.length}`, margin, y);
      doc.text(`Supplier Terlibat: ${uniqueSuppliers}`, margin + 60, y);
      doc.text(`Driver Terlibat: ${uniqueDrivers}`, margin + 120, y);
      y += 6;
      doc.setFont("helvetica", "normal");

      // ---- Tabel ----
      autoTable(doc, {
        startY: y + 2,
        head: [["No", "Nama Perusahaan", "Nama Driver", "Jenis Pelanggaran", "Frekuensi"]],
        body: rekap.map((r, i) => [i + 1, r.supplier, r.driver, r.kategori, r.freq]),
        styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.2 },
        headStyles: { fillColor: [11, 18, 32], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [247, 248, 250] },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 45 },
          2: { cellWidth: 40 },
          3: { cellWidth: "auto" },
          4: { cellWidth: 22, halign: "center" },
        },
        margin: { left: margin, right: margin },
        didDrawPage: () => {
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(
            `CIKOPS-G&C — Halaman ${doc.getCurrentPageInfo().pageNumber} dari ${pageCount}`,
            pageWidth - margin,
            doc.internal.pageSize.getHeight() - 8,
            { align: "right" }
          );
        },
      });

      // ---- Blok tanda tangan ----
      const finalY = (doc as any).lastAutoTable.finalY + 16;
      const today = new Date();
      doc.setTextColor(11, 18, 32);
      doc.setFontSize(10);
      doc.text(
        `Cikarang, ${formatTanggalIndo(today.toISOString().slice(0, 10))}`,
        pageWidth - margin - 55,
        finalY,
        { maxWidth: 55 }
      );

      doc.text("Dibuat oleh,", margin, finalY);
      doc.text("Mengetahui,", pageWidth - margin - 55, finalY + 6);

      doc.text("(_____________________)", margin, finalY + 22);
      doc.text("(_____________________)", pageWidth - margin - 55, finalY + 28);
      doc.setFontSize(8.5);
      doc.text("Petugas Security", margin, finalY + 27);
      doc.text("Admin GA / Security", pageWidth - margin - 55, finalY + 33);

      const scopeLabel = selectedSupplierName ? selectedSupplierName.replace(/[^a-zA-Z0-9]/g, "_") : "Semua_Supplier";
      doc.save(`CIKOPS-GC_Surat_NC_${scopeLabel}_${filters.dateFrom}_sd_${filters.dateTo}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-start gap-3 rounded-xl border border-brand-500/20 bg-brand-50 px-4 py-3">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-brand-600" />
        <p className="text-xs text-ink-900 leading-relaxed">
          Cocok untuk kebutuhan spesifik, mis. <b>"list driver dari Supplier X beserta pelanggarannya"</b> — pilih
          supplier tertentu untuk fokus ke satu perusahaan, atau biarkan "Semua Supplier" untuk rekap menyeluruh.
          Catatan: daftar ini hanya mencakup driver yang <b>tercatat Pelanggaran</b> — sistem belum mencatat driver yang lolos
          tanpa pelanggaran sama sekali (lihat menu Total Pemeriksaan untuk angka agregat kendaraan bersih).
        </p>
      </div>

      <div className="card p-4 sm:p-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="col-span-2 flex items-center gap-2 text-steel-500 text-xs font-semibold uppercase tracking-wide pr-1">
          <CalendarRange className="w-3.5 h-3.5" /> Parameter Surat
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">Dari Tanggal</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            className="w-full text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">Sampai Tanggal</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            className="w-full text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">Plant</label>
          <select
            value={filters.plant}
            onChange={(e) => setFilters((f) => ({ ...f, plant: e.target.value as any }))}
            className="w-full text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white outline-none sm:min-w-[140px]"
          >
            <option value="Semua">Semua Plant</option>
            {PLANTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-auto flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">Supplier</label>
          <SearchableSelect
            value={filters.supplierId === "Semua" ? "" : filters.supplierId}
            onChange={(v) => setFilters((f) => ({ ...f, supplierId: v || "Semua" }))}
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            allOptionLabel="Semua Supplier"
            className="w-full sm:min-w-[200px]"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-steel-100 flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-ink-900">Pratinjau Data</h3>
            <p className="text-xs text-steel-500">{rekap.length} baris rekap akan masuk ke PDF</p>
          </div>
          <button
            onClick={handleGeneratePDF}
            disabled={generating || loading || rekap.length === 0}
            className="inline-flex items-center gap-2 bg-ink-900 hover:bg-ink-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {generating ? "Membuat PDF..." : "Generate Surat PDF"}
          </button>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-steel-50/90 backdrop-blur">
              <tr className="text-left text-[11px] uppercase tracking-wide text-steel-500 border-b border-steel-100">
                <th className="py-3 px-4 font-semibold">Nama Perusahaan</th>
                <th className="py-3 px-4 font-semibold">Nama Driver</th>
                <th className="py-3 px-4 font-semibold">Jenis Pelanggaran</th>
                <th className="py-3 px-4 font-semibold text-center">Frekuensi</th>
              </tr>
            </thead>
            <tbody>
              {rekap.map((r, i) => (
                <tr key={i} className="border-b border-steel-50 table-row-hover">
                  <td className="py-2.5 px-4 font-medium text-ink-900">{r.supplier}</td>
                  <td className="py-2.5 px-4">{r.driver}</td>
                  <td className="py-2.5 px-4 text-steel-600">{r.kategori}</td>
                  <td className="py-2.5 px-4 text-center font-mono font-semibold">{r.freq}</td>
                </tr>
              ))}
              {rekap.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="py-14 text-center text-steel-400 text-sm">
                    Tidak ada data untuk filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
