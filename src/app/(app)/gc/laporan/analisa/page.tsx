"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ClipboardX,
  Truck,
  Percent,
  Layers,
  Filter,
  RotateCcw,
  Search,
  Building2,
  UserRound,
  Tag,
  AlertTriangle,
  AlertOctagon,
  ChevronRight,
  ChevronLeft,
  Car,
  Calendar,
  Gauge,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { fetchReports, fetchSuppliers, fetchCategories, fetchPemeriksaan } from "@/lib/gc/data";
import { useRealtimeNcReports } from "@/lib/gc/useRealtimeNcReports";
import { PLANTS } from "@/lib/gc/constants";
import type { NcReportRow, Supplier, NcCategory, DashboardFilters } from "@/lib/gc/types";
import KpiCard from "@/components/gc/KpiCard";
import SearchableSelect from "@/components/gc/SearchableSelect";
import FindingTags from "@/components/gc/FindingTags";
import StatusBadge from "@/components/gc/StatusBadge";
import ExportButtons from "@/components/gc/ExportButtons";
import { exportRowsToExcel, exportRowsToPDF, exportSummaryToExcel, exportSummaryToPDF } from "@/lib/gc/exportHelpers";
import { useLanguage } from "@/components/gc/LanguageProvider";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const defaultFilters: DashboardFilters = {
  plant: "Semua",
  supplierId: "Semua",
  status: "Semua",
  dateFrom: "2026-01-01",
  dateTo: "2026-12-31",
};

type Module = "company" | "category" | "driver";
type ViewState =
  | { module: "company"; level: "list" }
  | { module: "company"; level: "supplier"; supplier: string }
  | { module: "company"; level: "driver"; supplier: string; driver: string }
  | { module: "company"; level: "vehicle"; supplier: string; driver: string; vehicle: string }
  | { module: "company"; level: "violation"; supplier: string; driver: string; vehicle: string; violation: string }
  | { module: "category"; level: "list" }
  | { module: "category"; level: "detail"; category: string }
  | { module: "driver"; level: "list" }
  | { module: "driver"; level: "detail"; driver: string };

function warningLevel(total: number) {
  if (total >= 8) return "kritis";
  if (total >= 4) return "perhatian";
  return "normal";
}

function monthlyTrend(rows: NcReportRow[]) {
  const counts = new Array(12).fill(0);
  rows.forEach((r) => {
    const m = new Date(r.tanggal).getMonth();
    if (!isNaN(m)) counts[m] += 1;
  });
  return MONTHS.map((label, i) => ({ label, total: counts[i] }));
}

function trendDirectionText(rows: NcReportRow[]): { label: string; icon: any; color: string } {
  const trend = monthlyTrend(rows).filter((t) => t.total > 0);
  if (trend.length < 2) return { label: "Data belum cukup untuk tren", icon: Minus, color: "text-steel-500" };
  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  if (last.total > prev.total) return { label: `Tren meningkat (${prev.label} ${prev.total} → ${last.label} ${last.total})`, icon: TrendingUp, color: "text-alert-600" };
  if (last.total < prev.total) return { label: `Tren menurun (${prev.label} ${prev.total} → ${last.label} ${last.total})`, icon: TrendingDown, color: "text-clear-600" };
  return { label: `Tren stabil (${last.label}: ${last.total})`, icon: Minus, color: "text-steel-500" };
}

function AnalisaContent() {
  const searchParams = useSearchParams();
  const { lang } = useLanguage();
  const [reports, setReports] = useState<NcReportRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<NcCategory[]>([]);
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [totalPemeriksaan, setTotalPemeriksaan] = useState<number | null>(null);
  const [view, setView] = useState<ViewState>({ module: "company", level: "list" });
  const [listSearch, setListSearch] = useState("");
  const [initializedFromUrl, setInitializedFromUrl] = useState(false);

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

  useRealtimeNcReports(() => {
    fetchReports(filters).then(setReports).catch(() => {});
  });

  // Cross-link dari Dashboard: baca query string sekali di awal (?module=company&supplier=..&driver=..)
  useEffect(() => {
    if (initializedFromUrl) return;
    const mod = searchParams.get("module");
    const supplier = searchParams.get("supplier");
    const driver = searchParams.get("driver");
    const category = searchParams.get("category");
    if (mod === "company") {
      if (supplier && driver) setView({ module: "company", level: "driver", supplier, driver });
      else if (supplier) setView({ module: "company", level: "supplier", supplier });
      else setView({ module: "company", level: "list" });
    } else if (mod === "category") {
      if (category) setView({ module: "category", level: "detail", category });
      else setView({ module: "category", level: "list" });
    } else if (mod === "driver") {
      if (driver) setView({ module: "driver", level: "detail", driver });
      else setView({ module: "driver", level: "list" });
    }
    setInitializedFromUrl(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!initializedFromUrl) return;
    setView((v) => ({ module: v.module, level: "list" } as ViewState));
    setListSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.plant, filters.status, filters.dateFrom, filters.dateTo, filters.supplierId]);

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
  const totalTemuanCount = data.reduce((acc, r) => acc + r.total_temuan, 0);

  const driverCompanyMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    data.forEach((r) => {
      map[r.nama_petugas] = map[r.nama_petugas] ?? new Set();
      map[r.nama_petugas].add(r.nama_supplier);
    });
    return map;
  }, [data]);

  function mostFrequent(rows: NcReportRow[]): string {
    const counts: Record<string, number> = {};
    rows.forEach((r) => r.temuan_list.forEach((t) => (counts[t] = (counts[t] ?? 0) + 1)));
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? "—";
  }
  function lastDate(rows: NcReportRow[]): string {
    return rows.reduce((max, r) => (r.tanggal > max ? r.tanggal : max), "");
  }

  // =======================================================================
  // MODULE A — COMPANY -> SUPPLIER -> DRIVER -> VEHICLE -> VIOLATION
  // =======================================================================
  const companyList = useMemo(() => {
    const map: Record<string, NcReportRow[]> = {};
    data.forEach((r) => {
      map[r.nama_supplier] = map[r.nama_supplier] ?? [];
      map[r.nama_supplier].push(r);
    });
    return Object.entries(map)
      .map(([name, rows]) => ({
        name,
        total: rows.length,
        totalDrivers: new Set(rows.map((r) => r.nama_petugas)).size,
        totalVehicles: new Set(rows.map((r) => r.no_polisi)).size,
        mostFrequentCategory: mostFrequent(rows),
        lastNcDate: lastDate(rows),
      }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const supplierRows = view.module === "company" && view.level !== "list" ? data.filter((r) => r.nama_supplier === (view as any).supplier) : [];

  const driverListUnderSupplier = useMemo(() => {
    if (view.module !== "company" || view.level === "list") return [];
    const map: Record<string, NcReportRow[]> = {};
    supplierRows.forEach((r) => {
      map[r.nama_petugas] = map[r.nama_petugas] ?? [];
      map[r.nama_petugas].push(r);
    });
    return Object.entries(map)
      .map(([name, rows]) => ({
        name,
        total: rows.length,
        vehicles: Array.from(new Set(rows.map((r) => r.no_polisi))),
        mostFrequentViolation: mostFrequent(rows),
        lastNcDate: lastDate(rows),
        multiVendor: (driverCompanyMap[name]?.size ?? 0) > 1,
      }))
      .sort((a, b) => b.total - a.total);
  }, [supplierRows, view, driverCompanyMap]);

  const driverRowsInSupplier =
    view.module === "company" && (view.level === "driver" || view.level === "vehicle" || view.level === "violation")
      ? supplierRows.filter((r) => r.nama_petugas === (view as any).driver)
      : [];

  const vehiclesUnderDriver = useMemo(() => {
    if (view.module !== "company" || (view.level !== "driver" && view.level !== "vehicle" && view.level !== "violation")) return [];
    const map: Record<string, NcReportRow[]> = {};
    driverRowsInSupplier.forEach((r) => {
      map[r.no_polisi] = map[r.no_polisi] ?? [];
      map[r.no_polisi].push(r);
    });
    return Object.entries(map)
      .map(([plat, rows]) => ({ plat, total: rows.length, mostFrequentViolation: mostFrequent(rows), lastNcDate: lastDate(rows) }))
      .sort((a, b) => b.total - a.total);
  }, [driverRowsInSupplier, view]);

  const vehicleRows = view.module === "company" && (view.level === "vehicle" || view.level === "violation")
    ? driverRowsInSupplier.filter((r) => r.no_polisi === (view as any).vehicle)
    : [];

  const violationsUnderVehicle = useMemo(() => {
    if (view.module !== "company" || (view.level !== "vehicle" && view.level !== "violation")) return [];
    const map: Record<string, NcReportRow[]> = {};
    vehicleRows.forEach((r) => {
      r.temuan_list.forEach((cat) => {
        map[cat] = map[cat] ?? [];
        map[cat].push(r);
      });
    });
    return Object.entries(map)
      .map(([cat, rows]) => ({ name: cat, total: rows.length, lastNcDate: lastDate(rows) }))
      .sort((a, b) => b.total - a.total);
  }, [vehicleRows, view]);

  const violationRows = view.module === "company" && view.level === "violation"
    ? vehicleRows.filter((r) => r.temuan_list.includes((view as any).violation))
    : [];

  const driverOtherCompanies = useMemo(() => {
    if (view.module !== "company" || view.level === "list" || view.level === "supplier") return [];
    const driverName = (view as any).driver as string;
    const rows = data.filter((r) => r.nama_petugas === driverName && r.nama_supplier !== (view as any).supplier);
    const map: Record<string, number> = {};
    rows.forEach((r) => (map[r.nama_supplier] = (map[r.nama_supplier] ?? 0) + 1));
    return Object.entries(map).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [data, view]);

  // =======================================================================
  // MODULE B — Pelanggaran CATEGORY ANALYSIS
  // =======================================================================
  const categoryList = useMemo(() => {
    const map: Record<string, NcReportRow[]> = {};
    data.forEach((r) => {
      r.temuan_list.forEach((cat) => {
        map[cat] = map[cat] ?? [];
        map[cat].push(r);
      });
    });
    return Object.entries(map)
      .map(([name, rows]) => ({
        name,
        total: rows.length,
        affectedSuppliers: new Set(rows.map((r) => r.nama_supplier)).size,
        affectedDrivers: new Set(rows.map((r) => r.nama_petugas)).size,
        lastNcDate: lastDate(rows),
      }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const categoryRows = view.module === "category" && view.level === "detail" ? data.filter((r) => r.temuan_list.includes(view.category)) : [];

  // =======================================================================
  // MODULE C — DRIVER ANALYSIS (global)
  // =======================================================================
  const globalDriverList = useMemo(() => {
    const map: Record<string, NcReportRow[]> = {};
    data.forEach((r) => {
      map[r.nama_petugas] = map[r.nama_petugas] ?? [];
      map[r.nama_petugas].push(r);
    });
    return Object.entries(map)
      .map(([name, rows]) => ({
        name,
        total: rows.length,
        companies: Array.from(new Set(rows.map((r) => r.nama_supplier))),
        vehicles: Array.from(new Set(rows.map((r) => r.no_polisi))),
        mostFrequentViolation: mostFrequent(rows),
        lastNcDate: lastDate(rows),
        multiVendor: new Set(rows.map((r) => r.nama_supplier)).size > 1,
      }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const driverDetailRows = view.module === "driver" && view.level === "detail" ? data.filter((r) => r.nama_petugas === view.driver) : [];

  const driverDetailByCompany = useMemo(() => {
    if (view.module !== "driver" || view.level !== "detail") return [];
    const map: Record<string, number> = {};
    driverDetailRows.forEach((r) => (map[r.nama_supplier] = (map[r.nama_supplier] ?? 0) + 1));
    return Object.entries(map).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [driverDetailRows, view]);

  const driverDetailByCategory = useMemo(() => {
    if (view.module !== "driver" || view.level !== "detail") return [];
    const map: Record<string, number> = {};
    driverDetailRows.forEach((r) => r.temuan_list.forEach((cat) => (map[cat] = (map[cat] ?? 0) + 1)));
    return Object.entries(map).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [driverDetailRows, view]);

  // =======================================================================
  const activeList: { key: string; total: number; extra?: any }[] =
    view.module === "company"
      ? view.level === "list"
        ? companyList.map((c) => ({ key: c.name, total: c.total, extra: c }))
        : view.level === "supplier"
        ? driverListUnderSupplier.map((d) => ({ key: d.name, total: d.total, extra: d }))
        : []
      : view.module === "category"
      ? view.level === "list"
        ? categoryList.map((c) => ({ key: c.name, total: c.total, extra: c }))
        : []
      : view.level === "list"
      ? globalDriverList.map((d) => ({ key: d.name, total: d.total, extra: d }))
      : [];

  const activeListFiltered = useMemo(() => {
    if (!listSearch.trim()) return activeList;
    const q = listSearch.toLowerCase();
    return activeList.filter((x) => x.key.toLowerCase().includes(q));
  }, [activeList, listSearch]);

  const breadcrumb: { label: string; onClick?: () => void }[] =
    view.module === "company"
      ? view.level === "list"
        ? [{ label: "Company Pelanggaran Analysis" }]
        : view.level === "supplier"
        ? [{ label: "Company Pelanggaran Analysis", onClick: () => setView({ module: "company", level: "list" }) }, { label: view.supplier }]
        : view.level === "driver"
        ? [
            { label: "Company Pelanggaran Analysis", onClick: () => setView({ module: "company", level: "list" }) },
            { label: view.supplier, onClick: () => setView({ module: "company", level: "supplier", supplier: view.supplier }) },
            { label: view.driver },
          ]
        : view.level === "vehicle"
        ? [
            { label: "Company Pelanggaran Analysis", onClick: () => setView({ module: "company", level: "list" }) },
            { label: view.supplier, onClick: () => setView({ module: "company", level: "supplier", supplier: view.supplier }) },
            { label: view.driver, onClick: () => setView({ module: "company", level: "driver", supplier: view.supplier, driver: view.driver }) },
            { label: view.vehicle },
          ]
        : [
            { label: "Company Pelanggaran Analysis", onClick: () => setView({ module: "company", level: "list" }) },
            { label: view.supplier, onClick: () => setView({ module: "company", level: "supplier", supplier: view.supplier }) },
            { label: view.driver, onClick: () => setView({ module: "company", level: "driver", supplier: view.supplier, driver: view.driver }) },
            { label: view.vehicle, onClick: () => setView({ module: "company", level: "vehicle", supplier: view.supplier, driver: view.driver, vehicle: view.vehicle }) },
            { label: view.violation },
          ]
      : view.module === "category"
      ? view.level === "list"
        ? [{ label: "Pelanggaran Category Analysis" }]
        : [{ label: "Pelanggaran Category Analysis", onClick: () => setView({ module: "category", level: "list" }) }, { label: view.category }]
      : view.level === "list"
      ? [{ label: "Driver Pelanggaran Analysis" }]
      : [{ label: "Driver Pelanggaran Analysis", onClick: () => setView({ module: "driver", level: "list" }) }, { label: view.driver }];

  // =======================================================================
  // Export helpers per konteks
  // =======================================================================
  const dateSuffix = `${filters.dateFrom}_sd_${filters.dateTo}`;

  async function exportCompanyListExcel() {
    await exportSummaryToExcel(
      companyList.map((c) => ({ SUPPLIER: c.name, "TOTAL Pelanggaran": c.total, "TOTAL DRIVER": c.totalDrivers, "TOTAL KENDARAAN": c.totalVehicles, "KATEGORI TERSERING": c.mostFrequentCategory, "Pelanggaran TERAKHIR": c.lastNcDate })),
      `CIKOPS-GC_Company_NC_Analysis_${dateSuffix}.xlsx`,
      "Company Pelanggaran Analysis"
    );
  }
  async function exportCompanyListPDF() {
    await exportSummaryToPDF(
      ["Supplier", "Total Pelanggaran", "Driver", "Kendaraan", "Kategori Tersering", "Pelanggaran Terakhir"],
      companyList.map((c) => [c.name, c.total, c.totalDrivers, c.totalVehicles, c.mostFrequentCategory, c.lastNcDate]),
      "COMPANY Pelanggaran ANALYSIS",
      `Periode ${filters.dateFrom} s/d ${filters.dateTo}`,
      `CIKOPS-GC_Company_NC_Analysis_${dateSuffix}.pdf`
    );
  }
  async function exportCategoryListExcel() {
    await exportSummaryToExcel(
      categoryList.map((c) => ({ KATEGORI: c.name, "TOTAL Pelanggaran": c.total, "SUPPLIER TERDAMPAK": c.affectedSuppliers, "DRIVER TERDAMPAK": c.affectedDrivers, "Pelanggaran TERAKHIR": c.lastNcDate })),
      `CIKOPS-GC_NC_Category_Analysis_${dateSuffix}.xlsx`,
      "Pelanggaran Category Analysis"
    );
  }
  async function exportCategoryListPDF() {
    await exportSummaryToPDF(
      ["Kategori", "Total Pelanggaran", "Supplier Terdampak", "Driver Terdampak", "Pelanggaran Terakhir"],
      categoryList.map((c) => [c.name, c.total, c.affectedSuppliers, c.affectedDrivers, c.lastNcDate]),
      "Pelanggaran CATEGORY ANALYSIS",
      `Periode ${filters.dateFrom} s/d ${filters.dateTo}`,
      `CIKOPS-GC_NC_Category_Analysis_${dateSuffix}.pdf`
    );
  }
  async function exportDriverListExcel() {
    await exportSummaryToExcel(
      globalDriverList.map((d) => ({ "NAMA DRIVER": d.name, "TOTAL Pelanggaran": d.total, "MULTI-VENDOR": d.multiVendor ? "YA" : "TIDAK", PERUSAHAAN: d.companies.join(", "), "PELANGGARAN TERSERING": d.mostFrequentViolation, "Pelanggaran TERAKHIR": d.lastNcDate })),
      `CIKOPS-GC_Driver_NC_Analysis_${dateSuffix}.xlsx`,
      "Driver Pelanggaran Analysis"
    );
  }
  async function exportDriverListPDF() {
    await exportSummaryToPDF(
      ["Driver", "Total Pelanggaran", "Multi-Vendor", "Perusahaan", "Pelanggaran Tersering", "Pelanggaran Terakhir"],
      globalDriverList.map((d) => [d.name, d.total, d.multiVendor ? "Ya" : "Tidak", d.companies.join(", "), d.mostFrequentViolation, d.lastNcDate]),
      "DRIVER Pelanggaran ANALYSIS",
      `Periode ${filters.dateFrom} s/d ${filters.dateTo}`,
      `CIKOPS-GC_Driver_NC_Analysis_${dateSuffix}.pdf`
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Filters */}
      <div className="card p-4 sm:p-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="col-span-2 flex items-center gap-3 sm:contents">
          <div className="flex items-center gap-2 text-steel-500 text-xs font-semibold uppercase tracking-wide pr-1">
            <Filter className="w-3.5 h-3.5" /> Filter
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-clear-600 bg-clear-50 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-clear-500 animate-pulse" /> Live
          </span>
        </div>
        <FilterSelect label="Plant" value={filters.plant} onChange={(v) => setFilters((f) => ({ ...f, plant: v as any }))} options={["Semua", ...PLANTS]} />
        <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v as any }))} options={["Semua", "Accept", "Reject"]} />
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
          <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} className="w-full text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white focus:border-brand-500 outline-none" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">Sampai Tanggal</label>
          <input type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} className="w-full text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white focus:border-brand-500 outline-none" />
        </div>
        <button onClick={() => setFilters(defaultFilters)} className="col-span-2 sm:col-auto flex items-center justify-center gap-1.5 text-xs font-semibold text-steel-500 hover:text-ink-900 border border-steel-100 rounded-lg px-3 py-2 sm:ml-auto">
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      {/* KPI ringkas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Pelanggaran" value={loading ? "…" : totalNC} icon={ClipboardX} tone="alert" hint={`${rejectCount} Reject · ${totalNC - rejectCount} Accept`} />
        <KpiCard label="Supplier Terlibat" value={loading ? "…" : supplierInvolved} icon={Truck} tone="ink" hint={`dari ${suppliers.length} supplier terdaftar`} />
        <KpiCard
          label="Tingkat Pelanggaran"
          value={loading ? "…" : ncRateAvailable ? `${ncRate}%` : "—"}
          icon={Percent}
          tone="brand"
          hint={!ncRateAvailable && filters.supplierId !== "Semua" ? "Tidak tersedia saat filter Supplier aktif" : !ncRateAvailable ? "Input Total Pemeriksaan dulu" : `${totalNC} Pelanggaran dari ${totalPemeriksaan} kendaraan`}
        />
        <KpiCard label="Total Temuan" value={loading ? "…" : totalTemuanCount} icon={Layers} tone="clear" hint="Akumulasi item pelanggaran" />
      </div>

      {/* Module selector */}
      <div className="flex gap-1 flex-wrap">
        <button onClick={() => setView({ module: "company", level: "list" })} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${view.module === "company" ? "bg-ink-900 text-white" : "bg-white text-steel-600 border border-steel-100 hover:bg-steel-50"}`}>
          <Building2 className="w-4 h-4" /> Company Pelanggaran Analysis
        </button>
        <button onClick={() => setView({ module: "category", level: "list" })} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${view.module === "category" ? "bg-ink-900 text-white" : "bg-white text-steel-600 border border-steel-100 hover:bg-steel-50"}`}>
          <Tag className="w-4 h-4" /> Pelanggaran Category Analysis
        </button>
        <button onClick={() => setView({ module: "driver", level: "list" })} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${view.module === "driver" ? "bg-ink-900 text-white" : "bg-white text-steel-600 border border-steel-100 hover:bg-steel-50"}`}>
          <UserRound className="w-4 h-4" /> Driver Pelanggaran Analysis
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="w-3 h-3 text-steel-300" />}
              {b.onClick ? (
                <button onClick={b.onClick} className="text-brand-600 hover:text-brand-700 font-semibold">{b.label}</button>
              ) : (
                <span className="text-ink-900 font-bold">{b.label}</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* ===== MODULE A: COMPANY LIST ===== */}
      {view.module === "company" && view.level === "list" && (
        <ListPanel
          title="Semua Perusahaan dengan Pelanggaran"
          subtitle="Diurutkan dari total pelanggaran terbanyak. Klik untuk investigasi lebih lanjut."
          searchPlaceholder="Cari perusahaan..."
          search={listSearch}
          onSearch={setListSearch}
          rows={activeListFiltered}
          loading={loading}
          exportSlot={<ExportButtons onExportExcel={exportCompanyListExcel} onExportPDF={exportCompanyListPDF} disabled={companyList.length === 0} />}
          renderRow={(item: any) => {
            const c = item.extra;
            return (
              <button key={c.name} onClick={() => setView({ module: "company", level: "supplier", supplier: c.name })} className="w-full grid grid-cols-[1fr_auto_auto_auto_1fr_auto_auto] gap-3 items-center px-4 py-3 text-left hover:bg-steel-50 border-b border-steel-50 last:border-0">
                <span className="text-sm font-semibold text-ink-900 truncate">{c.name}</span>
                <span className="text-sm font-mono font-bold text-alert-600">{c.total}</span>
                <span className="text-xs font-mono text-steel-600">{c.totalDrivers} driver</span>
                <span className="text-xs font-mono text-steel-600">{c.totalVehicles} unit</span>
                <span className="text-xs text-steel-500 truncate">{c.mostFrequentCategory}</span>
                <span className="text-xs font-mono text-steel-400 whitespace-nowrap">{c.lastNcDate}</span>
                <ChevronRight className="w-4 h-4 text-steel-300" />
              </button>
            );
          }}
        />
      )}

      {/* ===== MODULE A: SUPPLIER DETAIL ===== */}
      {view.module === "company" && view.level === "supplier" && (
        <div className="card p-5">
          <button onClick={() => setView({ module: "company", level: "list" })} className="flex items-center gap-1.5 text-xs font-semibold text-steel-500 hover:text-ink-900 mb-4">
            <ChevronLeft className="w-3.5 h-3.5" /> Kembali
          </button>
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="font-display font-bold text-lg text-ink-900">{view.supplier}</h3>
            <ExportButtons
              onExportExcel={() => exportRowsToExcel(supplierRows, `CIKOPS-GC_${view.supplier.replace(/[^a-zA-Z0-9]/g, "_")}_${dateSuffix}.xlsx`, view.supplier, lang)}
              onExportPDF={() => exportRowsToPDF(supplierRows, `SUPPLIER INVESTIGATION — ${view.supplier}`, `Periode ${filters.dateFrom} s/d ${filters.dateTo}`, `CIKOPS-GC_${view.supplier.replace(/[^a-zA-Z0-9]/g, "_")}_${dateSuffix}.pdf`, lang)}
              disabled={supplierRows.length === 0}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <MiniStat label="Total Pelanggaran" value={supplierRows.length} icon={ClipboardX} />
            <MiniStat label="Total Driver" value={new Set(supplierRows.map((r) => r.nama_petugas)).size} icon={UserRound} />
            <MiniStat label="Total Kendaraan" value={new Set(supplierRows.map((r) => r.no_polisi)).size} icon={Car} />
            <MiniStat label="Pelanggaran Terakhir" value={lastDate(supplierRows) || "—"} icon={Calendar} small />
          </div>
          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-2">Tren Bulanan — {view.supplier}</p>
          <TrendChart rows={supplierRows} />
          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide mt-6 mb-2">Driver di Bawah Perusahaan Ini</p>
          <ListPanel title="" subtitle="" searchPlaceholder="Cari driver..." search={listSearch} onSearch={setListSearch} rows={activeListFiltered} loading={loading} compact
            renderRow={(item: any) => {
              const d = item.extra;
              return (
                <button key={d.name} onClick={() => setView({ module: "company", level: "driver", supplier: view.supplier, driver: d.name })} className="w-full grid grid-cols-[1fr_auto_auto_1fr_auto_auto] gap-3 items-center px-4 py-3 text-left hover:bg-steel-50 border-b border-steel-50 last:border-0">
                  <span className="text-sm font-semibold text-ink-900 truncate flex items-center gap-1.5">
                    {d.name}
                    {d.multiVendor && <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-white bg-alert-600 px-1.5 py-0.5 rounded-full"><AlertTriangle className="w-2.5 h-2.5" /> Multi-Vendor</span>}
                  </span>
                  <span className="text-sm font-mono font-bold text-alert-600">{d.total}</span>
                  <span className="text-xs font-mono text-steel-600 whitespace-nowrap">{d.vehicles.join(", ")}</span>
                  <span className="text-xs text-steel-500 truncate">{d.mostFrequentViolation}</span>
                  <span className="text-xs font-mono text-steel-400 whitespace-nowrap">{d.lastNcDate}</span>
                  <ChevronRight className="w-4 h-4 text-steel-300" />
                </button>
              );
            }}
          />
        </div>
      )}

      {/* ===== MODULE A: DRIVER DETAIL (dalam konteks supplier) ===== */}
      {view.module === "company" && view.level === "driver" && (
        <div className="card p-5">
          <button onClick={() => setView({ module: "company", level: "supplier", supplier: view.supplier })} className="flex items-center gap-1.5 text-xs font-semibold text-steel-500 hover:text-ink-900 mb-4">
            <ChevronLeft className="w-3.5 h-3.5" /> Kembali
          </button>
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-lg text-ink-900">{view.driver}</h3>
              {warningLevel(driverRowsInSupplier.length) !== "normal" && (
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold text-white px-2.5 py-1 rounded-full shrink-0 ${warningLevel(driverRowsInSupplier.length) === "kritis" ? "bg-alert-600" : "bg-brand-500"}`}>
                  <AlertOctagon className="w-3 h-3" /> {warningLevel(driverRowsInSupplier.length) === "kritis" ? "Indikasi Kritis" : "Perlu Perhatian"}
                </span>
              )}
            </div>
            <ExportButtons
              onExportExcel={() => exportRowsToExcel(driverRowsInSupplier, `CIKOPS-GC_${view.driver.replace(/[^a-zA-Z0-9]/g, "_")}_${dateSuffix}.xlsx`, view.driver, lang)}
              onExportPDF={() => exportRowsToPDF(driverRowsInSupplier, `DRIVER INVESTIGATION — ${view.driver}`, `${view.supplier} · Periode ${filters.dateFrom} s/d ${filters.dateTo}`, `CIKOPS-GC_${view.driver.replace(/[^a-zA-Z0-9]/g, "_")}_${dateSuffix}.pdf`, lang)}
              disabled={driverRowsInSupplier.length === 0}
            />
          </div>
          <p className="text-xs text-steel-500 mb-4">Transporter untuk: {view.supplier}</p>

          {driverOtherCompanies.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-alert-500/20 bg-alert-50 px-3 py-2.5 mb-4">
              <AlertTriangle className="w-4 h-4 text-alert-600 mt-0.5 shrink-0" />
              <p className="text-xs text-ink-900">
                Driver ini juga tercatat Pelanggaran di perusahaan lain:{" "}
                {driverOtherCompanies.map((c, i) => (
                  <span key={c.name}>
                    <button onClick={() => setView({ module: "company", level: "driver", supplier: c.name, driver: view.driver })} className="font-semibold text-alert-600 underline">{c.name} ({c.total})</button>
                    {i < driverOtherCompanies.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <MiniStat label="Total Pelanggaran (perusahaan ini)" value={driverRowsInSupplier.length} icon={ClipboardX} />
            <MiniStat label="Kendaraan Dipakai" value={vehiclesUnderDriver.length} icon={Car} />
            <MiniStat label="Pelanggaran Terakhir" value={lastDate(driverRowsInSupplier) || "—"} icon={Calendar} small />
          </div>

          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-2">Tren Bulanan — {view.driver} ({view.supplier})</p>
          <TrendChart rows={driverRowsInSupplier} />

          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide mt-6 mb-2">Kendaraan yang Dipakai — klik untuk investigasi per unit</p>
          <div className="space-y-1 border border-steel-100 rounded-lg overflow-hidden">
            {vehiclesUnderDriver.map((v) => (
              <button key={v.plat} onClick={() => setView({ module: "company", level: "vehicle", supplier: view.supplier, driver: view.driver, vehicle: v.plat })} className="w-full grid grid-cols-[1fr_auto_1fr_auto_auto] gap-3 items-center px-4 py-3 text-left hover:bg-steel-50 border-b border-steel-50 last:border-0">
                <span className="text-sm font-mono font-semibold text-ink-900 flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-steel-400" /> {v.plat}</span>
                <span className="text-sm font-mono font-bold text-alert-600">{v.total}</span>
                <span className="text-xs text-steel-500 truncate">{v.mostFrequentViolation}</span>
                <span className="text-xs font-mono text-steel-400 whitespace-nowrap">{v.lastNcDate}</span>
                <ChevronRight className="w-4 h-4 text-steel-300" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== MODULE A: VEHICLE DETAIL ===== */}
      {view.module === "company" && view.level === "vehicle" && (
        <div className="card p-5">
          <button onClick={() => setView({ module: "company", level: "driver", supplier: view.supplier, driver: view.driver })} className="flex items-center gap-1.5 text-xs font-semibold text-steel-500 hover:text-ink-900 mb-4">
            <ChevronLeft className="w-3.5 h-3.5" /> Kembali
          </button>
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="font-display font-bold text-lg text-ink-900 flex items-center gap-2"><Gauge className="w-5 h-5 text-brand-500" /> {view.vehicle}</h3>
            <ExportButtons
              onExportExcel={() => exportRowsToExcel(vehicleRows, `CIKOPS-GC_${view.vehicle.replace(/[^a-zA-Z0-9]/g, "_")}_${dateSuffix}.xlsx`, view.vehicle, lang)}
              onExportPDF={() => exportRowsToPDF(vehicleRows, `VEHICLE INVESTIGATION — ${view.vehicle}`, `Driver: ${view.driver} · ${view.supplier}`, `CIKOPS-GC_${view.vehicle.replace(/[^a-zA-Z0-9]/g, "_")}_${dateSuffix}.pdf`, lang)}
              disabled={vehicleRows.length === 0}
            />
          </div>
          <p className="text-xs text-steel-500 mb-4">Driver: {view.driver} · Perusahaan: {view.supplier}</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <MiniStat label="Total Pelanggaran" value={vehicleRows.length} icon={ClipboardX} />
            <MiniStat label="Jenis Pelanggaran" value={violationsUnderVehicle.length} icon={Tag} />
            <MiniStat label="Pelanggaran Terakhir" value={lastDate(vehicleRows) || "—"} icon={Calendar} small />
          </div>

          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-2">Tren Bulanan — {view.vehicle}</p>
          <TrendChart rows={vehicleRows} />

          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide mt-6 mb-2">Jenis Pelanggaran — klik untuk lihat riwayat lengkap</p>
          <div className="space-y-1 border border-steel-100 rounded-lg overflow-hidden">
            {violationsUnderVehicle.map((v) => (
              <button key={v.name} onClick={() => setView({ module: "company", level: "violation", supplier: view.supplier, driver: view.driver, vehicle: view.vehicle, violation: v.name })} className="w-full grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-3 text-left hover:bg-steel-50 border-b border-steel-50 last:border-0">
                <span className="text-sm font-semibold text-ink-900 truncate">{v.name}</span>
                <span className={`text-sm font-mono font-bold ${v.total >= 3 ? "text-alert-600" : "text-ink-900"}`}>{v.total}x</span>
                <span className="text-xs font-mono text-steel-400 whitespace-nowrap">{v.lastNcDate}</span>
                <ChevronRight className="w-4 h-4 text-steel-300" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== MODULE A: VIOLATION DETAIL (History) ===== */}
      {view.module === "company" && view.level === "violation" && (
        <div className="card p-5">
          <button onClick={() => setView({ module: "company", level: "vehicle", supplier: view.supplier, driver: view.driver, vehicle: view.vehicle })} className="flex items-center gap-1.5 text-xs font-semibold text-steel-500 hover:text-ink-900 mb-4">
            <ChevronLeft className="w-3.5 h-3.5" /> Kembali
          </button>
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="font-display font-bold text-lg text-ink-900">{view.violation}</h3>
            <ExportButtons
              onExportExcel={() => exportRowsToExcel(violationRows, `CIKOPS-GC_History_${view.violation.replace(/[^a-zA-Z0-9]/g, "_")}_${dateSuffix}.xlsx`, view.violation.slice(0, 28), lang)}
              onExportPDF={() => exportRowsToPDF(violationRows, `VIOLATION HISTORY — ${view.violation}`, `${view.vehicle} · ${view.driver} · ${view.supplier}`, `CIKOPS-GC_History_${view.violation.replace(/[^a-zA-Z0-9]/g, "_")}_${dateSuffix}.pdf`, lang)}
              disabled={violationRows.length === 0}
            />
          </div>
          <p className="text-xs text-steel-500 mb-4">
            {view.vehicle} · {view.driver} · {view.supplier}
          </p>

          <div className="rounded-xl border border-alert-500/20 bg-alert-50 px-4 py-3 mb-5">
            <p className="text-sm font-bold text-ink-900">
              {view.supplier} → {view.driver} → {view.vehicle} → {view.violation} → terjadi <span className="text-alert-600">{violationRows.length} kali</span>
            </p>
            <div className={`flex items-center gap-1.5 text-xs font-semibold mt-1 ${trendDirectionText(violationRows).color}`}>
              {(() => {
                const t = trendDirectionText(violationRows);
                const Icon = t.icon;
                return (
                  <>
                    <Icon className="w-3.5 h-3.5" /> {t.label}
                  </>
                );
              })()}
            </div>
          </div>

          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-2">Tren Bulanan</p>
          <TrendChart rows={violationRows} />

          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide mt-6 mb-2">Inspection History</p>
          <IncidentTable rows={violationRows} showDriver={false} showSupplier={false} />
        </div>
      )}

      {/* ===== MODULE B: CATEGORY LIST ===== */}
      {view.module === "category" && view.level === "list" && (
        <ListPanel
          title="Semua Kategori Pelanggaran"
          subtitle="Diurutkan dari total pelanggaran terbanyak. Klik untuk lihat siapa saja yang melakukannya."
          searchPlaceholder="Cari kategori..."
          search={listSearch}
          onSearch={setListSearch}
          rows={activeListFiltered}
          loading={loading}
          exportSlot={<ExportButtons onExportExcel={exportCategoryListExcel} onExportPDF={exportCategoryListPDF} disabled={categoryList.length === 0} />}
          renderRow={(item: any) => {
            const c = item.extra;
            return (
              <button key={c.name} onClick={() => setView({ module: "category", level: "detail", category: c.name })} className="w-full grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center px-4 py-3 text-left hover:bg-steel-50 border-b border-steel-50 last:border-0">
                <span className="text-sm font-semibold text-ink-900 truncate">{c.name}</span>
                <span className="text-sm font-mono font-bold text-alert-600">{c.total}</span>
                <span className="text-xs font-mono text-steel-600">{c.affectedSuppliers} supplier</span>
                <span className="text-xs font-mono text-steel-600">{c.affectedDrivers} driver</span>
                <span className="text-xs font-mono text-steel-400 whitespace-nowrap">{c.lastNcDate}</span>
                <ChevronRight className="w-4 h-4 text-steel-300" />
              </button>
            );
          }}
        />
      )}

      {view.module === "category" && view.level === "detail" && (
        <div className="card p-5">
          <button onClick={() => setView({ module: "category", level: "list" })} className="flex items-center gap-1.5 text-xs font-semibold text-steel-500 hover:text-ink-900 mb-4">
            <ChevronLeft className="w-3.5 h-3.5" /> Kembali
          </button>
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="font-display font-bold text-lg text-ink-900">{view.category}</h3>
            <ExportButtons
              onExportExcel={() => exportRowsToExcel(categoryRows, `CIKOPS-GC_Kategori_${view.category.replace(/[^a-zA-Z0-9]/g, "_")}_${dateSuffix}.xlsx`, view.category.slice(0, 28), lang)}
              onExportPDF={() => exportRowsToPDF(categoryRows, `CATEGORY INVESTIGATION — ${view.category}`, `Periode ${filters.dateFrom} s/d ${filters.dateTo}`, `CIKOPS-GC_Kategori_${view.category.replace(/[^a-zA-Z0-9]/g, "_")}_${dateSuffix}.pdf`, lang)}
              disabled={categoryRows.length === 0}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <MiniStat label="Total Pelanggaran" value={categoryRows.length} icon={ClipboardX} />
            <MiniStat label="Supplier Terdampak" value={new Set(categoryRows.map((r) => r.nama_supplier)).size} icon={Building2} />
            <MiniStat label="Driver Terdampak" value={new Set(categoryRows.map((r) => r.nama_petugas)).size} icon={UserRound} />
          </div>
          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-2">Tren Bulanan — {view.category}</p>
          <TrendChart rows={categoryRows} />
          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide mt-6 mb-2">Supplier &amp; Driver Terkait</p>
          <IncidentTable rows={categoryRows} showDriver showSupplier driverCompanyMap={driverCompanyMap} />
        </div>
      )}

      {/* ===== MODULE C: DRIVER LIST (global) ===== */}
      {view.module === "driver" && view.level === "list" && (
        <ListPanel
          title="Semua Driver dengan Pelanggaran"
          subtitle="Ketik nama driver untuk cari langsung. Diurutkan dari total pelanggaran terbanyak."
          searchPlaceholder="Cari nama driver..."
          search={listSearch}
          onSearch={setListSearch}
          rows={activeListFiltered}
          loading={loading}
          exportSlot={<ExportButtons onExportExcel={exportDriverListExcel} onExportPDF={exportDriverListPDF} disabled={globalDriverList.length === 0} />}
          renderRow={(item: any) => {
            const d = item.extra;
            return (
              <button key={d.name} onClick={() => setView({ module: "driver", level: "detail", driver: d.name })} className="w-full grid grid-cols-[1fr_auto_1fr_1fr_auto_auto] gap-3 items-center px-4 py-3 text-left hover:bg-steel-50 border-b border-steel-50 last:border-0">
                <span className="text-sm font-semibold text-ink-900 truncate flex items-center gap-1.5">
                  {d.name}
                  {d.multiVendor && <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-white bg-alert-600 px-1.5 py-0.5 rounded-full"><AlertTriangle className="w-2.5 h-2.5" /> Multi-Vendor</span>}
                </span>
                <span className="text-sm font-mono font-bold text-alert-600">{d.total}</span>
                <span className="text-xs text-steel-600 truncate">{d.companies.join(", ")}</span>
                <span className="text-xs text-steel-500 truncate">{d.mostFrequentViolation}</span>
                <span className="text-xs font-mono text-steel-400 whitespace-nowrap">{d.lastNcDate}</span>
                <ChevronRight className="w-4 h-4 text-steel-300" />
              </button>
            );
          }}
        />
      )}

      {view.module === "driver" && view.level === "detail" && (
        <div className="card p-5">
          <button onClick={() => setView({ module: "driver", level: "list" })} className="flex items-center gap-1.5 text-xs font-semibold text-steel-500 hover:text-ink-900 mb-4">
            <ChevronLeft className="w-3.5 h-3.5" /> Kembali
          </button>
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-lg text-ink-900">{view.driver}</h3>
              {warningLevel(driverDetailRows.length) !== "normal" && (
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold text-white px-2.5 py-1 rounded-full shrink-0 ${warningLevel(driverDetailRows.length) === "kritis" ? "bg-alert-600" : "bg-brand-500"}`}>
                  <AlertOctagon className="w-3 h-3" /> {warningLevel(driverDetailRows.length) === "kritis" ? "Indikasi Kritis" : "Perlu Perhatian"}
                </span>
              )}
            </div>
            <ExportButtons
              onExportExcel={() => exportRowsToExcel(driverDetailRows, `CIKOPS-GC_${view.driver.replace(/[^a-zA-Z0-9]/g, "_")}_Global_${dateSuffix}.xlsx`, view.driver, lang)}
              onExportPDF={() => exportRowsToPDF(driverDetailRows, `DRIVER INVESTIGATION — ${view.driver}`, `Seluruh perusahaan · Periode ${filters.dateFrom} s/d ${filters.dateTo}`, `CIKOPS-GC_${view.driver.replace(/[^a-zA-Z0-9]/g, "_")}_Global_${dateSuffix}.pdf`, lang)}
              disabled={driverDetailRows.length === 0}
            />
          </div>
          <p className="text-xs text-steel-500 mb-4">{driverDetailByCompany.length > 1 ? `Transporter untuk ${driverDetailByCompany.length} perusahaan berbeda — perlu dikoordinasikan ke semua` : `Transporter untuk: ${driverDetailByCompany[0]?.name ?? "—"}`}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <MiniStat label="Total Pelanggaran" value={driverDetailRows.length} icon={ClipboardX} />
            <MiniStat label="Total Perusahaan" value={driverDetailByCompany.length} icon={Building2} />
            <MiniStat label="Total Kendaraan" value={new Set(driverDetailRows.map((r) => r.no_polisi)).size} icon={Car} />
            <MiniStat label="Pelanggaran Terakhir" value={lastDate(driverDetailRows) || "—"} icon={Calendar} small />
          </div>

          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-2">Pelanggaran per Perusahaan</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {driverDetailByCompany.map((c) => (
              <button key={c.name} onClick={() => setView({ module: "company", level: "driver", supplier: c.name, driver: view.driver })} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-steel-100 hover:border-brand-500 hover:bg-brand-50 transition-colors">
                <Building2 className="w-3.5 h-3.5 text-steel-400" /> {c.name} <span className="font-mono font-bold text-alert-600">{c.total}</span>
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-2">Jenis Pelanggaran yang Sering Dilakukan</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {driverDetailByCategory.map((c) => (
              <span key={c.name} className={`text-xs font-medium px-2.5 py-1 rounded-md border ${c.total >= 3 ? "bg-alert-50 text-alert-600 border-alert-500/20" : "bg-ink-900/[0.04] text-ink-700 border-ink-900/[0.06]"}`}>{c.name} ×{c.total}</span>
            ))}
          </div>

          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-2">Kendaraan yang Dipakai</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {Array.from(new Set(driverDetailRows.map((r) => r.no_polisi))).map((plat) => (
              <span key={plat} className="flex items-center gap-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-steel-50 border border-steel-100 text-ink-900"><Car className="w-3 h-3 text-steel-400" /> {plat}</span>
            ))}
          </div>

          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-2">Tren Bulanan — {view.driver}</p>
          <TrendChart rows={driverDetailRows} />

          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide mt-6 mb-2">Riwayat Inspeksi (Evidence)</p>
          <IncidentTable rows={driverDetailRows} showDriver={false} showSupplier />
        </div>
      )}
    </div>
  );
}

export default function AnalisaPage() {
  return (
    <Suspense fallback={<div className="text-sm text-steel-400 py-10 text-center">Memuat...</div>}>
      <AnalisaContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------
// Sub-komponen
// ---------------------------------------------------------------------

function FilterSelect({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-steel-500">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white focus:border-brand-500 outline-none sm:min-w-[140px]">
        {options.map((o) => (
          <option key={o} value={o}>{labels?.[o] ?? o}</option>
        ))}
      </select>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon, small }: { label: string; value: string | number; icon: any; small?: boolean }) {
  return (
    <div className="rounded-lg border border-steel-100 bg-steel-50/50 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-steel-500 uppercase tracking-wide mb-1"><Icon className="w-3 h-3" /> {label}</div>
      <p className={`font-display font-bold text-ink-900 ${small ? "text-sm font-mono" : "text-xl"}`}>{value}</p>
    </div>
  );
}

function TrendChart({ rows }: { rows: NcReportRow[] }) {
  const chartData = monthlyTrend(rows);
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ left: -20, right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E3E8EF" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E3E8EF", fontSize: 12 }} />
        <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={22} fill="#E4002B" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function IncidentTable({ rows, showDriver, showSupplier, driverCompanyMap }: { rows: NcReportRow[]; showDriver: boolean; showSupplier: boolean; driverCompanyMap?: Record<string, Set<string>> }) {
  const sorted = [...rows].sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
  return (
    <div className="overflow-x-auto max-h-[400px] overflow-y-auto border border-steel-100 rounded-lg">
      <table className="w-full text-sm min-w-[600px]">
        <thead className="sticky top-0 bg-steel-50/95 backdrop-blur z-10">
          <tr className="text-left text-[11px] uppercase tracking-wide text-steel-500 border-b border-steel-100">
            {showDriver && <th className="py-2.5 px-3 font-semibold">Driver</th>}
            {showSupplier && <th className="py-2.5 px-3 font-semibold">Perusahaan</th>}
            <th className="py-2.5 px-3 font-semibold">Jenis Pelanggaran</th>
            <th className="py-2.5 px-3 font-semibold">Plat Kendaraan</th>
            <th className="py-2.5 px-3 font-semibold">Tanggal</th>
            <th className="py-2.5 px-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-steel-50 table-row-hover">
              {showDriver && (
                <td className="py-2.5 px-3 font-medium text-ink-900 whitespace-nowrap">
                  {r.nama_petugas}
                  {driverCompanyMap && (driverCompanyMap[r.nama_petugas]?.size ?? 0) > 1 && <AlertTriangle className="inline w-3 h-3 text-alert-600 ml-1" />}
                </td>
              )}
              {showSupplier && <td className="py-2.5 px-3 text-steel-700 whitespace-nowrap">{r.nama_supplier}</td>}
              <td className="py-2.5 px-3"><FindingTags items={r.temuan_list} /></td>
              <td className="py-2.5 px-3 font-mono text-xs whitespace-nowrap">{r.no_polisi}</td>
              <td className="py-2.5 px-3 font-mono text-xs text-steel-500 whitespace-nowrap">{r.tanggal}</td>
              <td className="py-2.5 px-3"><StatusBadge status={r.status} /></td>
            </tr>
          ))}
          {sorted.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-steel-400 text-sm">Tidak ada data.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ListPanel({ title, subtitle, searchPlaceholder, search, onSearch, rows, loading, renderRow, compact, exportSlot }: { title: string; subtitle: string; searchPlaceholder: string; search: string; onSearch: (v: string) => void; rows: { key: string; total: number; extra?: any }[]; loading: boolean; renderRow: (item: any) => React.ReactNode; compact?: boolean; exportSlot?: React.ReactNode }) {
  return (
    <div className={compact ? "" : "card overflow-hidden"}>
      {title && (
        <div className="p-4 sm:p-5 border-b border-steel-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-ink-900">{title}</h3>
            <p className="text-xs text-steel-500 mt-0.5">{subtitle}</p>
          </div>
          {exportSlot}
        </div>
      )}
      <div className={compact ? "p-3 border border-steel-100 rounded-lg" : "p-4 border-b border-steel-100"}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-steel-300" />
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder} className="w-full pl-9 pr-3 py-2 rounded-lg border border-steel-100 bg-white text-sm focus:border-brand-500 outline-none" />
        </div>
      </div>
      <div className={`divide-y divide-steel-50 ${compact ? "" : "max-h-[560px] overflow-y-auto"}`}>
        {rows.map((item) => renderRow(item))}
        {rows.length === 0 && !loading && <p className="text-sm text-steel-400 py-10 text-center">Tidak ada data.</p>}
      </div>
    </div>
  );
}
