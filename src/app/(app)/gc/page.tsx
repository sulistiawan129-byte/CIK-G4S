"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardX, TrendingUp, CalendarDays, Filter, RotateCcw, Building2, UserRound, Trophy, ExternalLink } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { fetchReports, fetchCategories } from "@/lib/gc/data";
import { useLanguage } from "@/components/gc/LanguageProvider";
import { useRealtimeNcReports } from "@/lib/gc/useRealtimeNcReports";
import { PLANTS, CHART_COLORS } from "@/lib/gc/constants";
import type { NcReportRow, NcCategory, DashboardFilters } from "@/lib/gc/types";
import KpiCard from "@/components/gc/KpiCard";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MONTHS_FULL_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const defaultFilters: Pick<DashboardFilters, "plant" | "dateFrom" | "dateTo"> = {
  plant: "Semua",
  dateFrom: "2026-01-01",
  dateTo: "2026-12-31",
};

const TOP_N_STACK = 6; // jumlah kategori teratas yang ditampilkan terpisah di stacked chart, sisanya digabung "Lainnya"

export default function DashboardPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [reports, setReports] = useState<NcReportRow[]>([]);
  const [categories, setCategories] = useState<NcCategory[]>([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchReports({ plant: filters.plant, dateFrom: filters.dateFrom, dateTo: filters.dateTo })
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [filters]);

  useRealtimeNcReports(() => {
    fetchReports({ plant: filters.plant, dateFrom: filters.dateFrom, dateTo: filters.dateTo })
      .then(setReports)
      .catch(() => {});
  });

  // ---------------------------------------------------------------------
  // KPI: Total, Top Violation, This Month
  // ---------------------------------------------------------------------
  const totalNC = reports.length;

  const categoryTotals = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach((r) => r.temuan_list?.forEach((t) => (counts[t] = (counts[t] ?? 0) + 1)));
    return Object.entries(counts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [reports]);

  const topViolation = categoryTotals[0];

  const companyTotals = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach((r) => (counts[r.nama_supplier] = (counts[r.nama_supplier] ?? 0) + 1));
    return Object.entries(counts).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [reports]);
  const driverTotals = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach((r) => (counts[r.nama_petugas] = (counts[r.nama_petugas] ?? 0) + 1));
    return Object.entries(counts).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [reports]);
  const companyWithNC = companyTotals.length;
  const driverWithNC = driverTotals.length;
  const topCompany = companyTotals[0];
  const topDriver = driverTotals[0];

  function analysisLink(params: Record<string, string>) {
    const qs = new URLSearchParams(params).toString();
    return `/gc/laporan/analisa?${qs}`;
  }

  const now = new Date();
  const thisMonthCount = useMemo(
    () =>
      reports.filter((r) => {
        const d = new Date(r.tanggal);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
    [reports]
  );

  // ---------------------------------------------------------------------
  // Trend Violation (Line Chart) — total Pelanggaran per bulan
  // ---------------------------------------------------------------------
  const trendData = useMemo(() => {
    const counts = new Array(12).fill(0);
    reports.forEach((r) => {
      const m = new Date(r.tanggal).getMonth();
      if (!isNaN(m)) counts[m] += 1;
    });
    return MONTHS.map((label, i) => ({ label, total: counts[i] }));
  }, [reports]);

  // ---------------------------------------------------------------------
  // Top 10 Violation (Horizontal Bar)
  // ---------------------------------------------------------------------
  const top10Violation = categoryTotals.slice(0, 10).map((c) => ({
    name: c.name.length > 28 ? c.name.slice(0, 26) + "…" : c.name,
    fullName: c.name,
    total: c.total,
  }));

  // ---------------------------------------------------------------------
  // Violation by Month (Stacked Column) — Top N kategori + "Lainnya"
  // ---------------------------------------------------------------------
  const topCategoryNames = categoryTotals.slice(0, TOP_N_STACK).map((c) => c.name);

  const stackedByMonth = useMemo(() => {
    return MONTHS.map((label, i) => {
      const row: Record<string, string | number> = { label };
      let known = 0;
      topCategoryNames.forEach((cat) => {
        const count = reports.filter((r) => new Date(r.tanggal).getMonth() === i && r.temuan_list.includes(cat)).length;
        row[cat] = count;
        known += count;
      });
      const totalMonth = reports.filter((r) => new Date(r.tanggal).getMonth() === i).reduce((a, r) => a + r.total_temuan, 0);
      row["Lainnya"] = Math.max(0, totalMonth - known);
      return row;
    });
  }, [reports, topCategoryNames]);

  // ---------------------------------------------------------------------
  // Pareto Chart — kategori diurut desc + kumulatif %
  // ---------------------------------------------------------------------
  const paretoData = useMemo(() => {
    const totalAll = categoryTotals.reduce((a, c) => a + c.total, 0) || 1;
    let cumulative = 0;
    return categoryTotals.map((c) => {
      cumulative += c.total;
      return {
        name: c.name.length > 20 ? c.name.slice(0, 18) + "…" : c.name,
        fullName: c.name,
        total: c.total,
        cumPct: Math.round((cumulative / totalAll) * 1000) / 10,
      };
    });
  }, [categoryTotals]);

  const paretoThresholdIndex = paretoData.findIndex((d) => d.cumPct >= 80);
  const paretoVitalFewCount = paretoThresholdIndex >= 0 ? paretoThresholdIndex + 1 : paretoData.length;

  // ---------------------------------------------------------------------
  // Executive Summary — insight naratif otomatis
  // ---------------------------------------------------------------------
  const trendDirection = useMemo(() => {
    const nonZero = trendData.filter((t) => t.total > 0);
    if (nonZero.length < 2) return null;
    const last = nonZero[nonZero.length - 1];
    const prev = nonZero[nonZero.length - 2];
    return { last, prev, diff: last.total - prev.total };
  }, [trendData]);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-ink-900 tracking-tight">
          {t("dashboard.title")}
        </h1>
        <p className="text-xs text-steel-500 mt-1">{t("dashboard.subtitle")}</p>
      </div>

      {/* Filter minimal */}
      <div className="card p-4 sm:p-5 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 text-steel-500 text-xs font-semibold uppercase tracking-wide pr-1">
          <Filter className="w-3.5 h-3.5" /> {t("common.filter")}
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-clear-600 bg-clear-50 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-clear-500 animate-pulse" /> {t("common.live")}
        </span>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">{t("common.plant")}</label>
          <select
            value={filters.plant}
            onChange={(e) => setFilters((f) => ({ ...f, plant: e.target.value as any }))}
            className="text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white outline-none min-w-[140px]"
          >
            <option value="Semua">{t("common.allPlant")}</option>
            {PLANTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">{t("common.dateFrom")}</label>
          <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} className="text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white outline-none focus:border-brand-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">{t("common.dateTo")}</label>
          <input type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} className="text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white outline-none focus:border-brand-500" />
        </div>
        <button onClick={() => setFilters(defaultFilters)} className="flex items-center gap-1.5 text-xs font-semibold text-steel-500 hover:text-ink-900 border border-steel-100 rounded-lg px-3 py-2 ml-auto">
          <RotateCcw className="w-3.5 h-3.5" /> {t("common.reset")}
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard label={t("dashboard.totalNc")} value={loading ? "…" : totalNC} icon={ClipboardX} tone="alert" hint="" />
        <KpiCard label={t("dashboard.companyWithNc")} value={loading ? "…" : companyWithNC} icon={Building2} tone="ink" hint="" />
        <KpiCard label={t("dashboard.driverWithNc")} value={loading ? "…" : driverWithNC} icon={UserRound} tone="ink" hint="" />
        <KpiCard label={t("dashboard.thisMonth")} value={loading ? "…" : thisMonthCount} icon={CalendarDays} tone="brand" hint={(lang === "id" ? MONTHS_FULL : MONTHS_FULL_EN)[now.getMonth()] + " " + now.getFullYear()} />

        <Link href={topCompany ? analysisLink({ module: "company", supplier: topCompany.name }) : "#"} className="block">
          <KpiCard
            label={t("dashboard.topCompany")}
            value={loading ? "…" : topCompany ? topCompany.total : 0}
            icon={Trophy}
            tone="alert"
            hint={topCompany ? `${topCompany.name} · ${t("dashboard.clickToInvestigate")}` : "—"}
          />
        </Link>
        <Link href={topDriver ? analysisLink({ module: "driver", driver: topDriver.name }) : "#"} className="block">
          <KpiCard
            label={t("dashboard.topDriver")}
            value={loading ? "…" : topDriver ? topDriver.total : 0}
            icon={Trophy}
            tone="alert"
            hint={topDriver ? `${topDriver.name} · ${t("dashboard.clickToInvestigate")}` : "—"}
          />
        </Link>
        <Link href={topViolation ? analysisLink({ module: "category", category: topViolation.name }) : "#"} className="block">
          <KpiCard
            label={t("dashboard.topViolation")}
            value={loading ? "…" : topViolation ? topViolation.total : 0}
            icon={TrendingUp}
            tone="brand"
            hint={topViolation ? `${topViolation.name} · ${t("dashboard.clickToInvestigate")}` : "—"}
          />
        </Link>
      </div>

      <Link href="/gc/laporan/analisa" className="flex items-center justify-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700 -mt-2">
        {t("dashboard.openAnalysis")} <ExternalLink className="w-3.5 h-3.5" />
      </Link>

      {/* Trend Violation */}
      <div className="card p-5">
        <h3 className="font-display font-bold text-ink-900">{t("dashboard.trendViolation")}</h3>
        <p className="text-xs text-steel-500 mb-4">{t("dashboard.trendViolationDesc")}</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trendData} margin={{ left: -20, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E3E8EF" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E3E8EF", fontSize: 12 }} />
            <Line type="monotone" dataKey="total" stroke="#E4002B" strokeWidth={2.5} dot={{ r: 3.5, fill: "#E4002B" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top 10 Violation */}
      <div className="card p-5">
        <h3 className="font-display font-bold text-ink-900">{t("dashboard.top10")}</h3>
        <p className="text-xs text-steel-500 mb-4">{t("dashboard.top10Desc")}</p>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={top10Violation} layout="vertical" margin={{ left: 10, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E3E8EF" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11, fill: "#3D4C63" }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "#E4002B11" }}
              contentStyle={{ borderRadius: 10, border: "1px solid #E3E8EF", fontSize: 12 }}
              formatter={(v: number, _n, p: any) => [v, p?.payload?.fullName]}
            />
            <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={18} cursor="pointer" onClick={(d: any) => router.push(`/gc/laporan/analisa?module=category&category=${encodeURIComponent(d.fullName)}`)}>
              {top10Violation.map((_, i) => (
                <Cell key={i} fill={i === 0 ? "#C8102E" : "#E4002B"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Violation by Month — Stacked Column */}
      <div className="card p-5">
        <h3 className="font-display font-bold text-ink-900">{t("dashboard.byMonth")}</h3>
        <p className="text-xs text-steel-500 mb-4">{t("dashboard.byMonthDesc")} (Top {TOP_N_STACK} + {t("dashboard.other")})</p>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={stackedByMonth} margin={{ left: -20, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E3E8EF" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E3E8EF", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} formatter={(value) => (value === "Lainnya" ? t("dashboard.other") : value)} />
            {topCategoryNames.map((cat, i) => (
              <Bar key={cat} dataKey={cat} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} maxBarSize={32} />
            ))}
            <Bar dataKey="Lainnya" stackId="a" fill="#AAB4C4" maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pareto Chart */}
      <div className="card p-5">
        <h3 className="font-display font-bold text-ink-900">{t("dashboard.pareto")}</h3>
        <p className="text-xs text-steel-500 mb-4">
          {paretoVitalFewCount} / {paretoData.length} — ~80%
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={paretoData} margin={{ left: -10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E3E8EF" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748B" }} axisLine={false} tickLine={false} interval={0} angle={-35} textAnchor="end" height={90} />
            <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E3E8EF", fontSize: 12 }} formatter={(v: number, n) => [n === "cumPct" ? `${v}%` : v, n === "cumPct" ? "Kumulatif" : "Jumlah"]} />
            <Bar yAxisId="left" dataKey="total" fill="#6E6F75" radius={[3, 3, 0, 0]} maxBarSize={24} />
            <Line yAxisId="right" type="monotone" dataKey="cumPct" stroke="#E4002B" strokeWidth={2.5} dot={{ r: 3, fill: "#E4002B" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Executive Summary */}
      <div className="card p-5">
        <h3 className="font-display font-bold text-ink-900 mb-4">{t("dashboard.execSummary")}</h3>
        <ul className="space-y-2.5 text-sm text-ink-900">
          <li className="flex gap-2">
            <span className="text-brand-500 font-bold">•</span>
            {lang === "id" ? (
              <>Tercatat <b>{totalNC.toLocaleString("id-ID")}</b> pelanggaran sepanjang periode {filters.dateFrom} s/d {filters.dateTo}.</>
            ) : (
              <>A total of <b>{totalNC.toLocaleString("en-US")}</b> violations were recorded during {filters.dateFrom} to {filters.dateTo}.</>
            )}
          </li>
          {topViolation && (
            <li className="flex gap-2">
              <span className="text-brand-500 font-bold">•</span>
              {lang === "id" ? (
                <>Kategori pelanggaran tertinggi adalah <b>{topViolation.name}</b> dengan <b>{topViolation.total}</b> kejadian
                ({((topViolation.total / (categoryTotals.reduce((a, c) => a + c.total, 0) || 1)) * 100).toFixed(1)}% dari total temuan).</>
              ) : (
                <>The highest violation category is <b>{topViolation.name}</b> with <b>{topViolation.total}</b> occurrences
                ({((topViolation.total / (categoryTotals.reduce((a, c) => a + c.total, 0) || 1)) * 100).toFixed(1)}% of total findings).</>
              )}
            </li>
          )}
          <li className="flex gap-2">
            <span className="text-brand-500 font-bold">•</span>
            {lang === "id" ? (
              <>Bulan {MONTHS_FULL[now.getMonth()]} {now.getFullYear()} tercatat <b>{thisMonthCount}</b> pelanggaran baru.</>
            ) : (
              <>In {MONTHS_FULL_EN[now.getMonth()]} {now.getFullYear()}, <b>{thisMonthCount}</b> new violations were recorded.</>
            )}
          </li>
          {trendDirection && (
            <li className="flex gap-2">
              <span className="text-brand-500 font-bold">•</span>
              {lang === "id" ? (
                <>Tren bulan terakhir ({trendDirection.last.label}) {trendDirection.diff > 0 ? "naik" : trendDirection.diff < 0 ? "turun" : "stabil"}{" "}
                {trendDirection.diff !== 0 && `sebanyak ${Math.abs(trendDirection.diff)} kejadian`} dibanding bulan sebelumnya ({trendDirection.prev.label}).</>
              ) : (
                <>The latest month's trend ({trendDirection.last.label}) is {trendDirection.diff > 0 ? "up" : trendDirection.diff < 0 ? "down" : "stable"}{" "}
                {trendDirection.diff !== 0 && `by ${Math.abs(trendDirection.diff)} occurrences`} compared to the previous month ({trendDirection.prev.label}).</>
              )}
            </li>
          )}
          <li className="flex gap-2">
            <span className="text-brand-500 font-bold">•</span>
            {lang === "id" ? (
              <>Berdasarkan analisis Pareto, <b>{paretoVitalFewCount} dari {paretoData.length}</b> kategori pelanggaran ("vital few") sudah menyumbang sekitar 80% dari total kejadian — fokus perbaikan pada kategori-kategori ini akan memberi dampak terbesar.</>
            ) : (
              <>Based on Pareto analysis, <b>{paretoVitalFewCount} of {paretoData.length}</b> violation categories (the "vital few") already account for around 80% of total occurrences — focusing improvement efforts here will yield the biggest impact.</>
            )}
          </li>
          <li className="flex gap-2 text-steel-500">
            <span className="text-steel-400 font-bold">•</span>
            {lang === "id" ? (
              <>Untuk investigasi per perusahaan, per driver, atau per kategori secara rinci, buka menu <b className="text-ink-900">Laporan → Report &amp; Analysis</b>.</>
            ) : (
              <>For detailed investigation by company, driver, or category, open the <b className="text-ink-900">Reports → Report &amp; Analysis</b> menu.</>
            )}
          </li>
        </ul>
      </div>
    </div>
  );
}
