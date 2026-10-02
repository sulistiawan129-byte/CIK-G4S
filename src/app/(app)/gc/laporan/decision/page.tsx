"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Filter,
  RotateCcw,
  Repeat,
  TrendingUp,
  TrendingDown,
  AlertOctagon,
  Car,
  RefreshCw,
} from "lucide-react";
import { fetchReports, fetchSuppliers } from "@/lib/gc/data";
import { PLANTS } from "@/lib/gc/constants";
import type { NcReportRow, Supplier, DashboardFilters } from "@/lib/gc/types";
import SearchableSelect from "@/components/gc/SearchableSelect";
import ExportButtons from "@/components/gc/ExportButtons";
import { exportSummaryToExcel, exportSummaryToPDF } from "@/lib/gc/exportHelpers";

const defaultFilters: DashboardFilters = {
  plant: "Semua",
  supplierId: "Semua",
  status: "Semua",
  dateFrom: "2026-01-01",
  dateTo: "2026-12-31",
};

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

export default function DecisionSupportPage() {
  const [reports, setReports] = useState<NcReportRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuppliers().then(setSuppliers).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchReports(filters)
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.plant, filters.status, filters.dateFrom, filters.dateTo, filters.supplierId]);

  const data = useMemo(() => {
    if (filters.supplierId === "Semua") return reports;
    const s = suppliers.find((s) => s.id === filters.supplierId);
    return reports.filter((r) => r.nama_supplier === s?.name);
  }, [reports, filters.supplierId, suppliers]);

  // -----------------------------------------------------------------------
  // 1. Repeat Pelanggaran — Perusahaan & Driver yang melanggar di 2+ bulan berbeda
  // -----------------------------------------------------------------------
  const repeatCompanies = useMemo(() => {
    const months: Record<string, Set<string>> = {};
    const totals: Record<string, number> = {};
    data.forEach((r) => {
      months[r.nama_supplier] = months[r.nama_supplier] ?? new Set();
      months[r.nama_supplier].add(monthKey(r.tanggal));
      totals[r.nama_supplier] = (totals[r.nama_supplier] ?? 0) + 1;
    });
    return Object.entries(months)
      .filter(([, m]) => m.size >= 2)
      .map(([name, m]) => ({ name, months: m.size, total: totals[name] }))
      .sort((a, b) => b.months - a.months || b.total - a.total);
  }, [data]);

  const repeatDrivers = useMemo(() => {
    const months: Record<string, Set<string>> = {};
    const totals: Record<string, number> = {};
    const supplierOf: Record<string, string> = {};
    data.forEach((r) => {
      months[r.nama_petugas] = months[r.nama_petugas] ?? new Set();
      months[r.nama_petugas].add(monthKey(r.tanggal));
      totals[r.nama_petugas] = (totals[r.nama_petugas] ?? 0) + 1;
      supplierOf[r.nama_petugas] = r.nama_supplier;
    });
    return Object.entries(months)
      .filter(([, m]) => m.size >= 2)
      .map(([name, m]) => ({ name, months: m.size, total: totals[name], supplier: supplierOf[name] }))
      .sort((a, b) => b.months - a.months || b.total - a.total);
  }, [data]);

  // -----------------------------------------------------------------------
  // 2. Increasing / Decreasing Trend — bulan ini vs bulan lalu
  // -----------------------------------------------------------------------
  const trendAnalysis = useMemo(() => {
    const now = new Date();
    const thisM = monthKey(now.toISOString().slice(0, 10));
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevM = monthKey(prevDate.toISOString().slice(0, 10));

    const byCompanyMonth: Record<string, Record<string, number>> = {};
    data.forEach((r) => {
      const mk = monthKey(r.tanggal);
      byCompanyMonth[r.nama_supplier] = byCompanyMonth[r.nama_supplier] ?? {};
      byCompanyMonth[r.nama_supplier][mk] = (byCompanyMonth[r.nama_supplier][mk] ?? 0) + 1;
    });

    return Object.entries(byCompanyMonth)
      .map(([name, months]) => {
        const cur = months[thisM] ?? 0;
        const prev = months[prevM] ?? 0;
        return { name, cur, prev, diff: cur - prev };
      })
      .filter((x) => x.cur > 0 || x.prev > 0)
      .sort((a, b) => b.diff - a.diff);
  }, [data]);

  const increasing = trendAnalysis.filter((t) => t.diff > 0);
  const decreasing = trendAnalysis.filter((t) => t.diff < 0);

  // -----------------------------------------------------------------------
  // 3. Frequent Offender — driver dengan total Pelanggaran tinggi
  // -----------------------------------------------------------------------
  const frequentOffenders = useMemo(() => {
    const map: Record<string, { total: number; supplier: Set<string> }> = {};
    data.forEach((r) => {
      map[r.nama_petugas] = map[r.nama_petugas] ?? { total: 0, supplier: new Set() };
      map[r.nama_petugas].total += 1;
      map[r.nama_petugas].supplier.add(r.nama_supplier);
    });
    return Object.entries(map)
      .filter(([, v]) => v.total >= 5)
      .map(([name, v]) => ({ name, total: v.total, supplier: Array.from(v.supplier).join(", "), multiVendor: v.supplier.size > 1 }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  // -----------------------------------------------------------------------
  // 4. Recurring Vehicle — plat nomor dengan pelanggaran berulang
  // -----------------------------------------------------------------------
  const recurringVehicles = useMemo(() => {
    const map: Record<string, { total: number; driver: Set<string>; supplier: Set<string> }> = {};
    data.forEach((r) => {
      map[r.no_polisi] = map[r.no_polisi] ?? { total: 0, driver: new Set(), supplier: new Set() };
      map[r.no_polisi].total += 1;
      map[r.no_polisi].driver.add(r.nama_petugas);
      map[r.no_polisi].supplier.add(r.nama_supplier);
    });
    return Object.entries(map)
      .filter(([, v]) => v.total >= 3)
      .map(([plat, v]) => ({ plat, total: v.total, driver: Array.from(v.driver).join(", "), supplier: Array.from(v.supplier).join(", ") }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  // -----------------------------------------------------------------------
  // 5. Recurring Violation — kombinasi driver + kategori yang berulang
  // -----------------------------------------------------------------------
  const recurringViolations = useMemo(() => {
    const map: Record<string, { driver: string; supplier: string; category: string; total: number }> = {};
    data.forEach((r) => {
      r.temuan_list.forEach((cat) => {
        const key = `${r.nama_petugas}__${cat}`;
        if (!map[key]) map[key] = { driver: r.nama_petugas, supplier: r.nama_supplier, category: cat, total: 0 };
        map[key].total += 1;
      });
    });
    return Object.values(map)
      .filter((v) => v.total >= 3)
      .sort((a, b) => b.total - a.total);
  }, [data]);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="card p-4 sm:p-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="col-span-2 flex items-center gap-2 text-steel-500 text-xs font-semibold uppercase tracking-wide pr-1">
          <Filter className="w-3.5 h-3.5" /> Filter
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">Plant</label>
          <select value={filters.plant} onChange={(e) => setFilters((f) => ({ ...f, plant: e.target.value as any }))} className="w-full text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white outline-none sm:min-w-[140px]">
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
            className="w-full sm:min-w-[180px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">Dari Tanggal</label>
          <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} className="w-full text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white outline-none focus:border-brand-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">Sampai Tanggal</label>
          <input type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} className="w-full text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white outline-none focus:border-brand-500" />
        </div>
        <button onClick={() => setFilters(defaultFilters)} className="col-span-2 sm:col-auto flex items-center justify-center gap-1.5 text-xs font-semibold text-steel-500 hover:text-ink-900 border border-steel-100 rounded-lg px-3 py-2 sm:ml-auto">
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      {/* 1. Repeat Pelanggaran */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Section
          icon={Repeat}
          title="Repeat Pelanggaran — Perusahaan"
          subtitle="Melanggar di 2 bulan berbeda atau lebih"
          onExportExcel={() => exportSummaryToExcel(repeatCompanies.map((c) => ({ PERUSAHAAN: c.name, "JUMLAH BULAN": c.months, "TOTAL Pelanggaran": c.total })), "CIKOPS-GC_Repeat_NC_Perusahaan.xlsx", "Repeat Pelanggaran Perusahaan")}
          onExportPDF={() => exportSummaryToPDF(["Perusahaan", "Jumlah Bulan", "Total Pelanggaran"], repeatCompanies.map((c) => [c.name, c.months, c.total]), "REPEAT Pelanggaran — PERUSAHAAN", `Periode ${filters.dateFrom} s/d ${filters.dateTo}`, "CIKOPS-GC_Repeat_NC_Perusahaan.pdf")}
          empty={repeatCompanies.length === 0}
        >
          {repeatCompanies.map((c) => (
            <RowItem key={c.name} name={c.name} sub={`Total ${c.total} pelanggaran`} badge={`${c.months} bulan`} badgeColor="alert" />
          ))}
        </Section>

        <Section
          icon={Repeat}
          title="Repeat Pelanggaran — Driver"
          subtitle="Melanggar di 2 bulan berbeda atau lebih"
          onExportExcel={() => exportSummaryToExcel(repeatDrivers.map((c) => ({ DRIVER: c.name, PERUSAHAAN: c.supplier, "JUMLAH BULAN": c.months, "TOTAL Pelanggaran": c.total })), "CIKOPS-GC_Repeat_NC_Driver.xlsx", "Repeat Pelanggaran Driver")}
          onExportPDF={() => exportSummaryToPDF(["Driver", "Perusahaan", "Jumlah Bulan", "Total Pelanggaran"], repeatDrivers.map((c) => [c.name, c.supplier, c.months, c.total]), "REPEAT Pelanggaran — DRIVER", `Periode ${filters.dateFrom} s/d ${filters.dateTo}`, "CIKOPS-GC_Repeat_NC_Driver.pdf")}
          empty={repeatDrivers.length === 0}
        >
          {repeatDrivers.map((c) => (
            <RowItem key={c.name} name={c.name} sub={`${c.supplier} · Total ${c.total} pelanggaran`} badge={`${c.months} bulan`} badgeColor="alert" />
          ))}
        </Section>
      </div>

      {/* 2. Trend */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Section
          icon={TrendingUp}
          title="Trend Memburuk — Bulan Ini"
          subtitle="Perusahaan dengan Pelanggaran naik dibanding bulan lalu"
          onExportExcel={() => exportSummaryToExcel(increasing.map((c) => ({ PERUSAHAAN: c.name, "BULAN LALU": c.prev, "BULAN INI": c.cur, SELISIH: `+${c.diff}` })), "CIKOPS-GC_Trend_Memburuk.xlsx", "Trend Memburuk")}
          onExportPDF={() => exportSummaryToPDF(["Perusahaan", "Bulan Lalu", "Bulan Ini", "Selisih"], increasing.map((c) => [c.name, c.prev, c.cur, `+${c.diff}`]), "TREND MEMBURUK — BULAN INI", "Perbandingan bulan berjalan vs bulan lalu", "CIKOPS-GC_Trend_Memburuk.pdf")}
          empty={increasing.length === 0}
        >
          {increasing.map((c) => (
            <RowItem key={c.name} name={c.name} sub={`${c.prev} → ${c.cur} kejadian`} badge={`+${c.diff}`} badgeColor="alert" icon={TrendingUp} />
          ))}
        </Section>

        <Section
          icon={TrendingDown}
          title="Trend Membaik — Bulan Ini"
          subtitle="Perusahaan dengan Pelanggaran turun dibanding bulan lalu"
          onExportExcel={() => exportSummaryToExcel(decreasing.map((c) => ({ PERUSAHAAN: c.name, "BULAN LALU": c.prev, "BULAN INI": c.cur, SELISIH: c.diff })), "CIKOPS-GC_Trend_Membaik.xlsx", "Trend Membaik")}
          onExportPDF={() => exportSummaryToPDF(["Perusahaan", "Bulan Lalu", "Bulan Ini", "Selisih"], decreasing.map((c) => [c.name, c.prev, c.cur, c.diff]), "TREND MEMBAIK — BULAN INI", "Perbandingan bulan berjalan vs bulan lalu", "CIKOPS-GC_Trend_Membaik.pdf")}
          empty={decreasing.length === 0}
        >
          {decreasing.map((c) => (
            <RowItem key={c.name} name={c.name} sub={`${c.prev} → ${c.cur} kejadian`} badge={`${c.diff}`} badgeColor="clear" icon={TrendingDown} />
          ))}
        </Section>
      </div>

      {/* 3. Frequent Offender */}
      <Section
        icon={AlertOctagon}
        title="Frequent Offender"
        subtitle="Driver dengan total Pelanggaran ≥5 kali — kandidat pembinaan langsung"
        onExportExcel={() => exportSummaryToExcel(frequentOffenders.map((c) => ({ DRIVER: c.name, "TOTAL Pelanggaran": c.total, "MULTI-VENDOR": c.multiVendor ? "YA" : "TIDAK", PERUSAHAAN: c.supplier })), "CIKOPS-GC_Frequent_Offender.xlsx", "Frequent Offender")}
        onExportPDF={() => exportSummaryToPDF(["Driver", "Total Pelanggaran", "Multi-Vendor", "Perusahaan"], frequentOffenders.map((c) => [c.name, c.total, c.multiVendor ? "Ya" : "Tidak", c.supplier]), "FREQUENT OFFENDER", `Periode ${filters.dateFrom} s/d ${filters.dateTo}`, "CIKOPS-GC_Frequent_Offender.pdf")}
        empty={frequentOffenders.length === 0}
        grid
      >
        {frequentOffenders.map((c) => (
          <RowItem key={c.name} name={c.name} sub={c.supplier} badge={`${c.total}x`} badgeColor="alert" extraBadge={c.multiVendor ? "Multi-Vendor" : undefined} />
        ))}
      </Section>

      {/* 4. Recurring Vehicle */}
      <Section
        icon={Car}
        title="Recurring Vehicle"
        subtitle="Kendaraan dengan pelanggaran berulang ≥3 kali"
        onExportExcel={() => exportSummaryToExcel(recurringVehicles.map((c) => ({ "PLAT NOMOR": c.plat, "TOTAL Pelanggaran": c.total, DRIVER: c.driver, PERUSAHAAN: c.supplier })), "CIKOPS-GC_Recurring_Vehicle.xlsx", "Recurring Vehicle")}
        onExportPDF={() => exportSummaryToPDF(["Plat Nomor", "Total Pelanggaran", "Driver", "Perusahaan"], recurringVehicles.map((c) => [c.plat, c.total, c.driver, c.supplier]), "RECURRING VEHICLE", `Periode ${filters.dateFrom} s/d ${filters.dateTo}`, "CIKOPS-GC_Recurring_Vehicle.pdf")}
        empty={recurringVehicles.length === 0}
        grid
      >
        {recurringVehicles.map((c) => (
          <RowItem key={c.plat} name={c.plat} sub={`${c.driver} · ${c.supplier}`} badge={`${c.total}x`} badgeColor="alert" mono />
        ))}
      </Section>

      {/* 5. Recurring Violation */}
      <Section
        icon={RefreshCw}
        title="Recurring Violation"
        subtitle="Driver yang mengulang jenis pelanggaran yang sama ≥3 kali"
        onExportExcel={() => exportSummaryToExcel(recurringViolations.map((c) => ({ DRIVER: c.driver, PERUSAHAAN: c.supplier, KATEGORI: c.category, "TOTAL Pelanggaran": c.total })), "CIKOPS-GC_Recurring_Violation.xlsx", "Recurring Violation")}
        onExportPDF={() => exportSummaryToPDF(["Driver", "Perusahaan", "Kategori", "Total"], recurringViolations.map((c) => [c.driver, c.supplier, c.category, c.total]), "RECURRING VIOLATION", `Periode ${filters.dateFrom} s/d ${filters.dateTo}`, "CIKOPS-GC_Recurring_Violation.pdf")}
        empty={recurringViolations.length === 0}
      >
        {recurringViolations.map((c, i) => (
          <RowItem key={c.driver + c.category + i} name={c.driver} sub={`${c.supplier} · ${c.category}`} badge={`${c.total}x`} badgeColor="alert" />
        ))}
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
  onExportExcel,
  onExportPDF,
  empty,
  grid,
}: {
  icon: any;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onExportExcel: () => Promise<void>;
  onExportPDF: () => Promise<void>;
  empty: boolean;
  grid?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-brand-500" />
          <h3 className="font-display font-bold text-ink-900">{title}</h3>
        </div>
        <ExportButtons onExportExcel={onExportExcel} onExportPDF={onExportPDF} disabled={empty} />
      </div>
      <p className="text-xs text-steel-500 mb-4">{subtitle}</p>
      {empty ? (
        <p className="text-sm text-steel-400 py-6 text-center">Tidak ada data yang memenuhi kriteria ini.</p>
      ) : (
        <div className={grid ? "grid sm:grid-cols-2 gap-2" : "space-y-2"}>{children}</div>
      )}
    </div>
  );
}

function RowItem({
  name,
  sub,
  badge,
  badgeColor,
  icon: Icon,
  extraBadge,
  mono,
}: {
  name: string;
  sub: string;
  badge: string;
  badgeColor: "alert" | "clear";
  icon?: any;
  extraBadge?: string;
  mono?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${badgeColor === "alert" ? "border-alert-500/15 bg-alert-50" : "border-clear-500/15 bg-clear-50"}`}>
      <div className="min-w-0">
        <p className={`text-sm font-semibold text-ink-900 truncate ${mono ? "font-mono" : ""}`}>{name}</p>
        <p className="text-[11px] text-steel-500 truncate">{sub}</p>
        {extraBadge && <span className="inline-block text-[9px] font-bold text-white bg-alert-600 px-1.5 py-0.5 rounded-full mt-1">{extraBadge}</span>}
      </div>
      <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${badgeColor === "alert" ? "text-alert-600 bg-white border-alert-500/20" : "text-clear-600 bg-white border-clear-500/20"}`}>
        {Icon && <Icon className="w-3 h-3" />} {badge}
      </span>
    </div>
  );
}
