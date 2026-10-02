"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Download, Loader2, CalendarRange, FileText } from "lucide-react";
import { fetchReports, fetchSuppliers, fetchCategories, fetchPemeriksaan } from "@/lib/gc/data";
import { PLANTS } from "@/lib/gc/constants";
import type { NcReportRow, Supplier, NcCategory, DashboardFilters } from "@/lib/gc/types";
import SearchableSelect from "@/components/gc/SearchableSelect";
import KpiCard from "@/components/gc/KpiCard";
import { ClipboardX, Truck, Percent, Layers } from "lucide-react";

const defaultFilters: DashboardFilters = {
  plant: "Semua",
  supplierId: "Semua",
  status: "Semua",
  dateFrom: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
  dateTo: new Date().toISOString().slice(0, 10),
};

export default function CetakLaporanPage() {
  const [reports, setReports] = useState<NcReportRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<NcCategory[]>([]);
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [totalPemeriksaan, setTotalPemeriksaan] = useState<number | null>(null);

  useEffect(() => {
    fetchSuppliers().then(setSuppliers).catch(() => {});
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchReports(filters)
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.plant, filters.status, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    fetchPemeriksaan({ plant: filters.plant, dateFrom: filters.dateFrom, dateTo: filters.dateTo })
      .then((rows) => setTotalPemeriksaan(rows.reduce((a, r) => a + r.jumlah_kendaraan, 0)))
      .catch(() => setTotalPemeriksaan(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.plant, filters.dateFrom, filters.dateTo]);

  const data = useMemo(() => {
    if (filters.supplierId === "Semua") return reports;
    const s = suppliers.find((s) => s.id === filters.supplierId);
    return reports.filter((r) => r.nama_supplier === s?.name);
  }, [reports, filters.supplierId, suppliers]);

  const totalNC = data.length;
  const rejectCount = data.filter((r) => r.status === "Reject").length;
  const ncRateAvailable = filters.supplierId === "Semua" && totalPemeriksaan !== null && totalPemeriksaan > 0;
  const ncRate = ncRateAvailable ? ((totalNC / (totalPemeriksaan as number)) * 100).toFixed(1) : null;
  const supplierInvolved = new Set(data.map((r) => r.nama_supplier)).size;

  async function handleGenerate() {
    setGenerating(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // Sheet 1: Ringkasan / Summary
      const perCategoryCounts: Record<string, number> = {};
      categories.forEach((c) => (perCategoryCounts[c.name] = 0));
      data.forEach((r) => r.temuan_list?.forEach((t) => (perCategoryCounts[t] = (perCategoryCounts[t] ?? 0) + 1)));

      const supplierCounts: Record<string, number> = {};
      data.forEach((r) => (supplierCounts[r.nama_supplier] = (supplierCounts[r.nama_supplier] ?? 0) + 1));
      const topSuppliers = Object.entries(supplierCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

      const driverCounts: Record<string, number> = {};
      data.forEach((r) => (driverCounts[r.nama_petugas] = (driverCounts[r.nama_petugas] ?? 0) + 1));
      const topDrivers = Object.entries(driverCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

      const summaryRows: (string | number)[][] = [
        ["LAPORAN CIKOPS-G&C — Pelanggaran SUPPLIER"],
        [`Periode`, `${filters.dateFrom} s/d ${filters.dateTo}`],
        [`Plant`, filters.plant],
        [`Status`, filters.status],
        [`Dibuat`, new Date().toLocaleString("id-ID")],
        [],
        ["RINGKASAN"],
        ["Total Pelanggaran", totalNC],
        ["Total Kendaraan Diperiksa", totalPemeriksaan ?? "Belum diinput"],
        ["Tingkat Pelanggaran (%) — Total Pelanggaran ÷ Total Kendaraan Diperiksa", ncRateAvailable ? ncRate! : "N/A"],
        ["Total Supplier Terlibat", supplierInvolved],
        ["Total Accept", totalNC - rejectCount],
        ["Total Reject", rejectCount],
        [],
        ["TOTAL Pelanggaran PER KATEGORI"],
        ["Kategori", "Jumlah"],
        ...Object.entries(perCategoryCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]),
        [],
        ["TOP 10 SUPPLIER (Pelanggaran TERBANYAK)"],
        ["Nama Supplier", "Jumlah Pelanggaran"],
        ...topSuppliers.map(([k, v]) => [k, v]),
        [],
        ["TOP 10 DRIVER / KERNET (Pelanggaran TERBANYAK)"],
        ["Nama", "Jumlah Pelanggaran"],
        ...topDrivers.map(([k, v]) => [k, v]),
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSummary["!cols"] = [{ wch: 38 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

      // Sheet 2: Detail laporan
      const detailRows = data.map((r) => ({
        PLANT: r.plant,
        TANGGAL: r.tanggal,
        "NAMA SUPPLIER": r.nama_supplier,
        "NO POLISI": r.no_polisi,
        "NAMA SUPIR / KERNET": r.nama_petugas,
        "JENIS IDENTITAS": r.jenis_identitas,
        "NOMOR IDENTITAS": r.nomor_identitas,
        TEMUAN: r.temuan_list.join(", "),
        "TOTAL TEMUAN": r.total_temuan,
        TUJUAN: r.nama_tujuan ?? "",
        KETERANGAN: r.catatan ?? "",
        STATUS: r.status,
      }));
      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, wsDetail, "Detail Laporan");

      // Sheet 3: Per kategori pivot (jumlah per plant)
      const perCatByPlant: Record<string, Record<string, number>> = {};
      categories.forEach((c) => (perCatByPlant[c.name] = { Cikarang: 0, PRB: 0 }));
      data.forEach((r) => {
        r.temuan_list?.forEach((t) => {
          if (!perCatByPlant[t]) perCatByPlant[t] = { Cikarang: 0, PRB: 0 };
          perCatByPlant[t][r.plant] = (perCatByPlant[t][r.plant] ?? 0) + 1;
        });
      });
      const pivotRows = Object.entries(perCatByPlant).map(([kategori, byPlant]) => ({
        KATEGORI: kategori,
        CIKARANG: byPlant["Cikarang"] ?? 0,
        PRB: byPlant["PRB"] ?? 0,
        TOTAL: (byPlant["Cikarang"] ?? 0) + (byPlant["PRB"] ?? 0),
      }));
      const wsPivot = XLSX.utils.json_to_sheet(pivotRows.sort((a, b) => b.TOTAL - a.TOTAL));
      XLSX.utils.book_append_sheet(wb, wsPivot, "Per Kategori x Plant");

      // Sheet 4: Tren Bulanan per Supplier
      const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
      const allSuppliersInData = Array.from(new Set(data.map((r) => r.nama_supplier))).sort();
      const trendRows = allSuppliersInData.map((name) => {
        const row: Record<string, string | number> = { SUPPLIER: name };
        MONTHS_ID.forEach((m, i) => {
          row[m] = data.filter((r) => r.nama_supplier === name && new Date(r.tanggal).getMonth() === i).length;
        });
        row["TOTAL"] = data.filter((r) => r.nama_supplier === name).length;
        return row;
      });
      const wsTrend = XLSX.utils.json_to_sheet(trendRows.sort((a: any, b: any) => b.TOTAL - a.TOTAL));
      XLSX.utils.book_append_sheet(wb, wsTrend, "Tren Bulanan Supplier");

      // Sheet 5: Detail Driver (perusahaan, plat, jenis pelanggaran, frekuensi)
      const driverMap: Record<string, { supplier: Set<string>; plat: Set<string>; kategori: Set<string>; total: number }> = {};
      data.forEach((r) => {
        const key = r.nama_petugas;
        if (!driverMap[key]) driverMap[key] = { supplier: new Set(), plat: new Set(), kategori: new Set(), total: 0 };
        driverMap[key].supplier.add(r.nama_supplier);
        driverMap[key].plat.add(r.no_polisi);
        r.temuan_list.forEach((t) => driverMap[key].kategori.add(t));
        driverMap[key].total += 1;
      });
      const driverRows = Object.entries(driverMap)
        .map(([name, v]) => ({
          "NAMA DRIVER": name,
          PERUSAHAAN: Array.from(v.supplier).join(", "),
          "PLAT NOMOR": Array.from(v.plat).join(", "),
          "JENIS PELANGGARAN": Array.from(v.kategori).join(", "),
          "TOTAL Pelanggaran": v.total,
        }))
        .sort((a, b) => b["TOTAL Pelanggaran"] - a["TOTAL Pelanggaran"]);
      const wsDriverDetail = XLSX.utils.json_to_sheet(driverRows);
      XLSX.utils.book_append_sheet(wb, wsDriverDetail, "Detail Driver");

      const filename = `CIKOPS-GC_Laporan_${filters.dateFrom}_sd_${filters.dateTo}.xlsx`;
      XLSX.writeFile(wb, filename);
    } finally {
      setGenerating(false);
    }
  }

  async function handleGeneratePDF() {
    setGeneratingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const perCategoryCounts: Record<string, number> = {};
      categories.forEach((c) => (perCategoryCounts[c.name] = 0));
      data.forEach((r) => r.temuan_list?.forEach((t) => (perCategoryCounts[t] = (perCategoryCounts[t] ?? 0) + 1)));
      const perCategorySorted = Object.entries(perCategoryCounts)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]);

      const supplierCounts: Record<string, number> = {};
      data.forEach((r) => (supplierCounts[r.nama_supplier] = (supplierCounts[r.nama_supplier] ?? 0) + 1));
      const topSuppliers10 = Object.entries(supplierCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

      const driverCounts: Record<string, number> = {};
      data.forEach((r) => (driverCounts[r.nama_petugas] = (driverCounts[r.nama_petugas] ?? 0) + 1));
      const topDrivers10 = Object.entries(driverCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;

      function drawHeader(title: string) {
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
      }

      drawHeader("LAPORAN KOMPREHENSIF Pelanggaran SUPPLIER");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(
        `Periode: ${filters.dateFrom} s/d ${filters.dateTo}  |  Plant: ${filters.plant}  |  Status: ${filters.status}`,
        margin,
        38
      );
      doc.text(`Dibuat: ${new Date().toLocaleString("id-ID")}`, margin, 43);

      autoTable(doc, {
        startY: 48,
        head: [["Ringkasan", "Nilai"]],
        body: [
          ["Total Pelanggaran", String(totalNC)],
          ["Total Kendaraan Diperiksa", totalPemeriksaan !== null ? String(totalPemeriksaan) : "Belum diinput"],
          ["Tingkat Pelanggaran", ncRateAvailable ? `${ncRate}%` : "N/A"],
          ["Total Supplier Terlibat", String(supplierInvolved)],
          ["Total Accept", String(totalNC - rejectCount)],
          ["Total Reject", String(rejectCount)],
        ],
        styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [11, 18, 32], textColor: 255, fontStyle: "bold" },
        margin: { left: margin, right: margin },
        tableWidth: 100,
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [["Kategori Pelanggaran", "Jumlah"]],
        body: perCategorySorted.map(([k, v]) => [k, v]),
        styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2 },
        headStyles: { fillColor: [11, 18, 32], textColor: 255, fontStyle: "bold" },
        margin: { left: margin, right: margin },
      });

      doc.addPage();
      drawHeader("TOP SUPPLIER & TOP DRIVER");

      autoTable(doc, {
        startY: 36,
        head: [["#", "Nama Supplier", "Jumlah Pelanggaran"]],
        body: topSuppliers10.map(([k, v], i) => [i + 1, k, v]),
        styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.2 },
        headStyles: { fillColor: [11, 18, 32], textColor: 255, fontStyle: "bold" },
        margin: { left: margin, right: margin },
        tableWidth: 130,
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [["#", "Nama Driver / Kernet", "Jumlah Pelanggaran"]],
        body: topDrivers10.map(([k, v], i) => [i + 1, k, v]),
        styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.2 },
        headStyles: { fillColor: [11, 18, 32], textColor: 255, fontStyle: "bold" },
        margin: { left: margin, right: margin },
        tableWidth: 130,
      });

      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`CIKOPS-G&C — Halaman ${p} dari ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 8, {
          align: "right",
        });
      }

      doc.save(`CIKOPS-GC_Laporan_${filters.dateFrom}_sd_${filters.dateTo}.pdf`);
    } finally {
      setGeneratingPdf(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="card p-4 sm:p-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="col-span-2 flex items-center gap-2 text-steel-500 text-xs font-semibold uppercase tracking-wide pr-1">
          <CalendarRange className="w-3.5 h-3.5" /> Parameter Laporan
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">Dari Tanggal</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            className="w-full text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white focus:border-brand-500 outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">Sampai Tanggal</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            className="w-full text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white focus:border-brand-500 outline-none"
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
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as any }))}
            className="w-full text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white outline-none"
          >
            <option value="Semua">Semua Status</option>
            <option value="Accept">Accept</option>
            <option value="Reject">Reject</option>
          </select>
        </div>
        <div className="col-span-2 sm:col-auto flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">Supplier</label>
          <SearchableSelect
            value={filters.supplierId === "Semua" ? "" : filters.supplierId}
            onChange={(v) => setFilters((f) => ({ ...f, supplierId: v || "Semua" }))}
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            allOptionLabel="Semua Supplier"
            className="w-full sm:min-w-[180px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Pelanggaran" value={loading ? "…" : totalNC} icon={ClipboardX} tone="alert" />
        <KpiCard label="Supplier Terlibat" value={loading ? "…" : supplierInvolved} icon={Truck} tone="ink" />
        <KpiCard
          label="Tingkat Pelanggaran"
          value={loading ? "…" : ncRateAvailable ? `${ncRate}%` : "—"}
          icon={Percent}
          tone="brand"
          hint={ncRateAvailable ? `dari ${totalPemeriksaan} kendaraan diperiksa` : "Data Total Pemeriksaan belum ada"}
        />
        <KpiCard label="Kategori Terpantau" value={categories.length} icon={Layers} tone="clear" />
      </div>

      <div className="card p-6 sm:p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-ink-900 flex items-center justify-center mx-auto mb-4">
          <FileSpreadsheet className="w-7 h-7 text-brand-500" />
        </div>
        <h3 className="font-display font-bold text-lg text-ink-900 mb-1.5">Cetak Laporan Lengkap</h3>
        <p className="text-sm text-steel-500 max-w-md mx-auto mb-6">
          Menghasilkan file Excel berisi 5 sheet: <b>Ringkasan</b>, <b>Detail Laporan</b>, <b>Per Kategori x Plant</b>,{" "}
          <b>Tren Bulanan Supplier</b>, dan <b>Detail Driver</b> (perusahaan, plat, jenis pelanggaran) — atau unduh
          versi ringkas siap cetak dalam <b>PDF</b>.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating || loading || data.length === 0}
            className="inline-flex items-center gap-2 bg-ink-900 hover:bg-ink-800 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {generating ? "Membuat Excel..." : `Download Excel (${data.length} baris)`}
          </button>
          <button
            onClick={handleGeneratePDF}
            disabled={generatingPdf || loading || data.length === 0}
            className="inline-flex items-center gap-2 bg-white border border-steel-100 hover:bg-steel-50 disabled:opacity-50 text-ink-900 font-semibold px-6 py-3 rounded-xl transition"
          >
            {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generatingPdf ? "Membuat PDF..." : "Download PDF"}
          </button>
        </div>
        {data.length === 0 && !loading && (
          <p className="text-xs text-steel-400 mt-3">Tidak ada data pada rentang filter ini.</p>
        )}
      </div>
    </div>
  );
}
