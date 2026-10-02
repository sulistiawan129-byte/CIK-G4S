"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  UserRound,
  AlertOctagon,
  AlertTriangle,
  Download,
  Search,
  Building2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { fetchReports, fetchSuppliers, fetchCategories } from "@/lib/gc/data";
import { CHART_COLORS } from "@/lib/gc/constants";
import type { NcReportRow, Supplier, NcCategory } from "@/lib/gc/types";
import SearchableSelect from "@/components/gc/SearchableSelect";

const MONTH_LABELS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7); // "2026-04"
}
function monthLabelFromKey(mk: string) {
  const m = parseInt(mk.slice(5, 7), 10);
  return MONTH_SHORT[m - 1];
}

export default function RekapBulananPage() {
  const [reports, setReports] = useState<NcReportRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<NcCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [supplierFilter, setSupplierFilter] = useState(""); // "" = Semua
  const [driverSearch, setDriverSearch] = useState("");

  useEffect(() => {
    Promise.all([fetchReports({}), fetchSuppliers(), fetchCategories()])
      .then(([r, s, c]) => {
        setReports(r);
        setSuppliers(s);
        setCategories(c);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const monthsPresent = useMemo(() => {
    const set = new Set(reports.map((r) => monthKey(r.tanggal)));
    return Array.from(set).sort();
  }, [reports]);

  const availableMonths = useMemo(() => [...monthsPresent].reverse(), [monthsPresent]);

  const prevMonth = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return d.toISOString().slice(0, 7);
  }, [selectedMonth]);

  // -----------------------------------------------------------------------
  // 1. Top Supplier x Bulan (pivot + grouped bar chart)
  // -----------------------------------------------------------------------
  const supplierPivot = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    reports.forEach((r) => {
      const mk = monthKey(r.tanggal);
      map[r.nama_supplier] = map[r.nama_supplier] || {};
      map[r.nama_supplier][mk] = (map[r.nama_supplier][mk] ?? 0) + 1;
    });
    return Object.entries(map)
      .map(([name, byMonth]) => ({
        name,
        byMonth,
        total: monthsPresent.reduce((a, mk) => a + (byMonth[mk] ?? 0), 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [reports, monthsPresent]);

  const supplierChartData = useMemo(
    () =>
      supplierPivot.map((s) => {
        const row: Record<string, string | number> = { name: s.name.length > 18 ? s.name.slice(0, 16) + "…" : s.name };
        monthsPresent.forEach((mk) => (row[monthLabelFromKey(mk)] = s.byMonth[mk] ?? 0));
        return row;
      }),
    [supplierPivot, monthsPresent]
  );

  // -----------------------------------------------------------------------
  // 2. Kategori Pelanggaran x Bulan — bisa difilter per Nama Perusahaan
  // -----------------------------------------------------------------------
  const filteredReports = useMemo(() => {
    if (!supplierFilter) return reports;
    return reports.filter((r) => r.nama_supplier === supplierFilter);
  }, [reports, supplierFilter]);

  const categoryPivot = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    filteredReports.forEach((r) => {
      const mk = monthKey(r.tanggal);
      r.temuan_list.forEach((cat) => {
        map[cat] = map[cat] || {};
        map[cat][mk] = (map[cat][mk] ?? 0) + 1;
      });
    });
    return categories
      .map((c) => {
        const byMonth = map[c.name] ?? {};
        return {
          name: c.name,
          byMonth,
          total: monthsPresent.reduce((a, mk) => a + (byMonth[mk] ?? 0), 0),
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredReports, categories, monthsPresent]);

  const categoryChartData = useMemo(
    () =>
      categoryPivot.map((c) => {
        const row: Record<string, string | number> = { name: c.name.length > 20 ? c.name.slice(0, 18) + "…" : c.name };
        monthsPresent.forEach((mk) => (row[monthLabelFromKey(mk)] = c.byMonth[mk] ?? 0));
        return row;
      }),
    [categoryPivot, monthsPresent]
  );

  // -----------------------------------------------------------------------
  // 3. Detail Driver per Kategori Pelanggaran — dengan tanda warning
  // -----------------------------------------------------------------------
  const driverCategoryDetail = useMemo(() => {
    const map: Record<
      string,
      { name: string; supplier: string; categories: Record<string, number>; total: number }
    > = {};
    filteredReports.forEach((r) => {
      const key = `${r.nama_petugas}__${r.nama_supplier}`;
      if (!map[key]) map[key] = { name: r.nama_petugas, supplier: r.nama_supplier, categories: {}, total: 0 };
      r.temuan_list.forEach((cat) => {
        map[key].categories[cat] = (map[key].categories[cat] ?? 0) + 1;
      });
      map[key].total += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredReports]);

  const driverDetailFiltered = useMemo(() => {
    if (!driverSearch.trim()) return driverCategoryDetail;
    const q = driverSearch.toLowerCase();
    return driverCategoryDetail.filter(
      (d) => d.name.toLowerCase().includes(q) || d.supplier.toLowerCase().includes(q)
    );
  }, [driverCategoryDetail, driverSearch]);

  function warningLevel(categoriesMap: Record<string, number>, total: number) {
    const maxCategoryCount = Math.max(0, ...Object.values(categoriesMap));
    if (maxCategoryCount >= 3 || total >= 8) return "kritis";
    if (total >= 5 || maxCategoryCount >= 2) return "perhatian";
    return "normal";
  }

  // -----------------------------------------------------------------------
  // Pelanggar Kronis (lintas bulan)
  // -----------------------------------------------------------------------
  const chronicSuppliers = useMemo(() => {
    const monthsByEntity: Record<string, Set<string>> = {};
    const totalByEntity: Record<string, number> = {};
    reports.forEach((r) => {
      const mk = monthKey(r.tanggal);
      monthsByEntity[r.nama_supplier] = monthsByEntity[r.nama_supplier] ?? new Set();
      monthsByEntity[r.nama_supplier].add(mk);
      totalByEntity[r.nama_supplier] = (totalByEntity[r.nama_supplier] ?? 0) + 1;
    });
    return Object.entries(monthsByEntity)
      .filter(([, months]) => months.size >= 2)
      .map(([name, months]) => ({ name, monthCount: months.size, total: totalByEntity[name] }))
      .sort((a, b) => b.monthCount - a.monthCount || b.total - a.total)
      .slice(0, 8);
  }, [reports]);

  async function handleExport() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const supplierRows = Object.entries(
      reports.reduce((acc: Record<string, Record<string, number>>, r) => {
        const mk = monthKey(r.tanggal);
        acc[r.nama_supplier] = acc[r.nama_supplier] || {};
        acc[r.nama_supplier][mk] = (acc[r.nama_supplier][mk] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([name, byMonth]) => {
      const row: Record<string, string | number> = { SUPPLIER: name };
      monthsPresent.forEach((mk) => (row[monthLabelFromKey(mk)] = byMonth[mk] ?? 0));
      row["TOTAL"] = monthsPresent.reduce((a, mk) => a + (byMonth[mk] ?? 0), 0);
      return row;
    });
    const wsSupplier = XLSX.utils.json_to_sheet(supplierRows.sort((a: any, b: any) => b.TOTAL - a.TOTAL));
    XLSX.utils.book_append_sheet(wb, wsSupplier, "Supplier x Bulan");

    const catRows = categories.map((c) => {
      const byMonth: Record<string, number> = {};
      reports.forEach((r) => {
        if (r.temuan_list.includes(c.name)) {
          const mk = monthKey(r.tanggal);
          byMonth[mk] = (byMonth[mk] ?? 0) + 1;
        }
      });
      const row: Record<string, string | number> = { KATEGORI: c.name };
      monthsPresent.forEach((mk) => (row[monthLabelFromKey(mk)] = byMonth[mk] ?? 0));
      row["TOTAL"] = monthsPresent.reduce((a, mk) => a + (byMonth[mk] ?? 0), 0);
      return row;
    });
    const wsCat = XLSX.utils.json_to_sheet(catRows.sort((a: any, b: any) => b.TOTAL - a.TOTAL));
    XLSX.utils.book_append_sheet(wb, wsCat, "Kategori x Bulan");

    const driverRows = driverCategoryDetail.map((d) => {
      const row: Record<string, string | number> = { "NAMA DRIVER": d.name, PERUSAHAAN: d.supplier };
      categories.forEach((c) => (row[c.name] = d.categories[c.name] ?? 0));
      row["TOTAL"] = d.total;
      row["LEVEL"] =
        warningLevel(d.categories, d.total) === "kritis"
          ? "KRITIS"
          : warningLevel(d.categories, d.total) === "perhatian"
          ? "PERLU PERHATIAN"
          : "NORMAL";
      return row;
    });
    const wsDriver = XLSX.utils.json_to_sheet(driverRows);
    XLSX.utils.book_append_sheet(wb, wsDriver, "Detail Driver x Kategori");

    XLSX.writeFile(wb, `CIKOPS-GC_Rekap_Bulanan_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const monthColors = CHART_COLORS;

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="card p-4 sm:p-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="col-span-2 flex items-center gap-2 text-steel-500 text-xs font-semibold uppercase tracking-wide pr-1">
          <CalendarRange className="w-3.5 h-3.5" /> Filter Rekap
        </div>
        <div className="col-span-2 sm:col-auto flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">Nama Perusahaan</label>
          <SearchableSelect
            value={supplierFilter}
            onChange={setSupplierFilter}
            options={suppliers.map((s) => ({ value: s.name, label: s.name }))}
            allOptionLabel="Semua Perusahaan"
            className="w-full sm:min-w-[220px]"
          />
        </div>
        <button
          onClick={handleExport}
          className="col-span-2 sm:col-auto flex items-center justify-center gap-2 text-sm font-semibold text-ink-900 border border-steel-100 rounded-lg px-4 py-2.5 sm:ml-auto"
        >
          <Download className="w-4 h-4" /> Export Excel
        </button>
      </div>

      {/* 1. Top Supplier x Bulan */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-4 h-4 text-brand-500" />
          <h3 className="font-display font-bold text-ink-900">Top 10 Supplier — Kontribusi Pelanggaran per Bulan</h3>
        </div>
        <p className="text-xs text-steel-500 mb-4">Diurutkan berdasarkan total pelanggaran sepanjang periode data</p>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={supplierChartData} margin={{ left: -20, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E3E8EF" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={70} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E3E8EF", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {monthsPresent.map((mk, i) => (
              <Bar key={mk} dataKey={monthLabelFromKey(mk)} fill={monthColors[i % monthColors.length]} radius={[3, 3, 0, 0]} maxBarSize={16} />
            ))}
          </BarChart>
        </ResponsiveContainer>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-steel-500 bg-steel-50/60 border-b border-steel-100">
                <th className="py-2 px-3 font-semibold">Supplier</th>
                {monthsPresent.map((mk) => (
                  <th key={mk} className="py-2 px-3 font-semibold text-center">{monthLabelFromKey(mk)}</th>
                ))}
                <th className="py-2 px-3 font-semibold text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {supplierPivot.map((s) => (
                <tr key={s.name} className="border-b border-steel-50 table-row-hover">
                  <td className="py-2 px-3 font-medium text-ink-900">{s.name}</td>
                  {monthsPresent.map((mk) => (
                    <td key={mk} className="py-2 px-3 text-center font-mono">{s.byMonth[mk] ?? "—"}</td>
                  ))}
                  <td className="py-2 px-3 text-center font-mono font-bold">{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Kategori Pelanggaran x Bulan */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-brand-500" />
          <h3 className="font-display font-bold text-ink-900">
            Kategori Pelanggaran per Bulan {supplierFilter ? `— ${supplierFilter}` : "— Semua Perusahaan"}
          </h3>
        </div>
        <p className="text-xs text-steel-500 mb-4">Ganti filter "Nama Perusahaan" di atas untuk fokus ke satu perusahaan</p>
        <ResponsiveContainer width="100%" height={Math.max(320, categoryPivot.length * 26)}>
          <BarChart data={categoryChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E3E8EF" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 10, fill: "#3D4C63" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E3E8EF", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {monthsPresent.map((mk, i) => (
              <Bar key={mk} dataKey={monthLabelFromKey(mk)} fill={monthColors[i % monthColors.length]} radius={[0, 3, 3, 0]} maxBarSize={14} />
            ))}
          </BarChart>
        </ResponsiveContainer>

        {categoryPivot.length === 0 && (
          <p className="text-sm text-steel-400 py-6 text-center">Tidak ada data untuk perusahaan ini.</p>
        )}
      </div>

      {/* 3. Detail Driver per Kategori Pelanggaran — dengan warning */}
      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-steel-100 flex flex-wrap items-center gap-3">
          <div>
            <h3 className="font-display font-bold text-ink-900 flex items-center gap-2">
              <UserRound className="w-4 h-4 text-brand-500" /> Detail Driver per Kategori Pelanggaran
            </h3>
            <p className="text-xs text-steel-500 mt-0.5">
              Rincian jumlah tiap jenis pelanggaran per driver — otomatis ditandai kalau pola pelanggarannya berulang
            </p>
          </div>
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs sm:ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-steel-300" />
            <input
              value={driverSearch}
              onChange={(e) => setDriverSearch(e.target.value)}
              placeholder="Cari driver atau perusahaan..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-steel-100 bg-white text-xs focus:border-brand-500 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 px-4 sm:px-5 py-3 border-b border-steel-100 bg-steel-50/40 text-[11px]">
          <span className="flex items-center gap-1.5 font-semibold text-alert-600">
            <AlertOctagon className="w-3.5 h-3.5" /> Kritis: 1 kategori ≥3x atau total ≥8x
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-brand-600">
            <AlertTriangle className="w-3.5 h-3.5" /> Perlu Perhatian: 1 kategori ≥2x atau total ≥5x
          </span>
        </div>

        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="sticky top-0 bg-steel-50/95 backdrop-blur z-10">
              <tr className="text-left text-[11px] uppercase tracking-wide text-steel-500 border-b border-steel-100">
                <th className="py-3 px-4 font-semibold">Nama Driver</th>
                <th className="py-3 px-4 font-semibold">Perusahaan</th>
                <th className="py-3 px-4 font-semibold">Rincian Jenis Pelanggaran</th>
                <th className="py-3 px-4 font-semibold text-center">Total</th>
                <th className="py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {driverDetailFiltered.map((d, i) => {
                const level = warningLevel(d.categories, d.total);
                return (
                  <tr
                    key={d.name + d.supplier + i}
                    className={`border-b border-steel-50 table-row-hover ${
                      level === "kritis" ? "bg-alert-50/40" : level === "perhatian" ? "bg-brand-50/30" : ""
                    }`}
                  >
                    <td className="py-3 px-4 font-semibold text-ink-900 whitespace-nowrap">{d.name}</td>
                    <td className="py-3 px-4 text-steel-700">{d.supplier}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5 max-w-md">
                        {Object.entries(d.categories)
                          .sort((a, b) => b[1] - a[1])
                          .map(([cat, count]) => (
                            <span
                              key={cat}
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                                count >= 3
                                  ? "bg-alert-50 text-alert-600 border-alert-500/20"
                                  : count >= 2
                                  ? "bg-brand-50 text-brand-600 border-brand-500/20"
                                  : "bg-ink-900/[0.04] text-ink-700 border-ink-900/[0.06]"
                              }`}
                            >
                              {cat} ×{count}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-ink-900">{d.total}</td>
                    <td className="py-3 px-4">
                      {level === "kritis" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-alert-600 px-2.5 py-1 rounded-full">
                          <AlertOctagon className="w-3 h-3" /> Kritis
                        </span>
                      )}
                      {level === "perhatian" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-brand-500 px-2.5 py-1 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> Perlu Perhatian
                        </span>
                      )}
                      {level === "normal" && (
                        <span className="text-[11px] font-medium text-steel-400">Normal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {driverDetailFiltered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-steel-400 text-sm">
                    Tidak ada driver yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 text-xs text-steel-500 border-t border-steel-100">
          Menampilkan {driverDetailFiltered.length} dari {driverCategoryDetail.length} driver
        </div>
      </div>

      {/* Pelanggar Kronis lintas bulan */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <AlertOctagon className="w-4 h-4 text-alert-600" />
          <h3 className="font-display font-bold text-ink-900">Supplier Pelanggar Kronis</h3>
        </div>
        <p className="text-xs text-steel-500 mb-4">Melanggar di 2 bulan berbeda atau lebih (sepanjang data tercatat)</p>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {chronicSuppliers.length === 0 && <p className="text-sm text-steel-400 py-4 text-center sm:col-span-2">Belum ada pelanggar berulang.</p>}
          {chronicSuppliers.map((s) => (
            <div key={s.name} className="flex items-center justify-between rounded-lg border border-alert-500/15 bg-alert-50 px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-ink-900">{s.name}</p>
                <p className="text-[11px] text-steel-500">Total {s.total} pelanggaran</p>
              </div>
              <span className="text-xs font-bold text-alert-600 bg-white px-2.5 py-1 rounded-full border border-alert-500/20">
                {s.monthCount} bulan
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
