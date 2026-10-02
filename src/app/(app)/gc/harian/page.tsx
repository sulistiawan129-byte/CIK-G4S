"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Car,
  ClipboardX,
  CheckCircle2,
  XCircle,
  PlusCircle,
  AlertTriangle,
  Trophy,
  CalendarDays,
} from "lucide-react";
import { fetchReports, fetchPemeriksaan } from "@/lib/gc/data";
import { PLANTS } from "@/lib/gc/constants";
import type { NcReportRow } from "@/lib/gc/types";
import KpiCard from "@/components/gc/KpiCard";
import StatusBadge from "@/components/gc/StatusBadge";
import FindingTags from "@/components/gc/FindingTags";
import { useRealtimeNcReports } from "@/lib/gc/useRealtimeNcReports";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function GateDashboardPage() {
  const [tanggal, setTanggal] = useState(todayISO());
  const [plant, setPlant] = useState<string>("Semua");
  const [reports, setReports] = useState<NcReportRow[]>([]);
  const [totalKendaraan, setTotalKendaraan] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        fetchReports({ plant: plant as any, dateFrom: tanggal, dateTo: tanggal }),
        fetchPemeriksaan({ plant, dateFrom: tanggal, dateTo: tanggal }),
      ]);
      setReports(r);
      setTotalKendaraan(p.reduce((a, x) => a + x.jumlah_kendaraan, 0));
    } catch {
      setReports([]);
      setTotalKendaraan(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal, plant]);

  useRealtimeNcReports(() => load());

  const totalNC = reports.length;
  const rejectCount = reports.filter((r) => r.status === "Reject").length;
  const acceptCount = totalNC - rejectCount;

  const topCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach((r) => r.temuan_list?.forEach((t) => (counts[t] = (counts[t] ?? 0) + 1)));
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 3);
  }, [reports]);

  const isToday = tanggal === todayISO();

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header controls */}
      <div className="card p-4 sm:p-5 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 text-steel-500 text-xs font-semibold uppercase tracking-wide pr-1">
          <CalendarDays className="w-3.5 h-3.5" /> Ringkasan
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">Tanggal</label>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            max={todayISO()}
            className="text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-steel-500">Plant</label>
          <select
            value={plant}
            onChange={(e) => setPlant(e.target.value)}
            className="text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white outline-none min-w-[140px]"
          >
            <option value="Semua">Semua Plant</option>
            {PLANTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        {isToday && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-clear-600 bg-clear-50 px-2.5 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-clear-500 animate-pulse" /> Hari Ini
          </span>
        )}
        <Link
          href="/gc/nc/baru"
          className="flex items-center gap-2 text-sm font-semibold text-white bg-ink-900 hover:bg-ink-800 rounded-lg px-4 py-2.5 ml-auto"
        >
          <PlusCircle className="w-4 h-4" /> Input Pelanggaran Baru
        </Link>
      </div>

      {totalKendaraan === null && !loading && (
        <div className="flex items-start gap-3 rounded-xl border border-brand-500/20 bg-brand-50 px-4 py-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-brand-600" />
          <p className="text-xs text-ink-900 leading-relaxed">
            Total kendaraan diperiksa untuk tanggal ini <b>belum diinput</b>.{" "}
            <Link href="/gc/pemeriksaan" className="underline font-semibold">
              Input sekarang
            </Link>{" "}
            supaya rekap harian lengkap.
          </p>
        </div>
      )}

      {/* KPI utama — ini yang dijawab kalau ditanya atasan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Kendaraan Masuk"
          value={loading ? "…" : totalKendaraan ?? "—"}
          icon={Car}
          tone="ink"
          hint="Termasuk yang lolos tanpa pelanggaran"
        />
        <KpiCard
          label="Total Pelanggaran"
          value={loading ? "…" : totalNC}
          icon={ClipboardX}
          tone="alert"
          hint={`${rejectCount} Reject · ${acceptCount} Accept`}
        />
        <KpiCard
          label="Ditolak (Reject)"
          value={loading ? "…" : rejectCount}
          icon={XCircle}
          tone="alert"
          hint="Tidak diizinkan masuk"
        />
        <KpiCard
          label="Diizinkan (Accept)"
          value={loading ? "…" : acceptCount}
          icon={CheckCircle2}
          tone="clear"
          hint="Ada temuan, tapi diizinkan masuk"
        />
      </div>

      {/* Top kategori hari ini — quick-answer sheet */}
      {topCategory.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-brand-500" />
            <h3 className="font-display font-bold text-ink-900">Pelanggaran Paling Sering Hari Ini</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {topCategory.map(([name, count], i) => (
              <span
                key={name}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                  i === 0 ? "bg-ink-900 text-brand-500" : "bg-steel-50 text-steel-700"
                }`}
              >
                {name} · {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Detail perusahaan & driver yang Pelanggaran */}
      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-steel-100">
          <h3 className="font-display font-bold text-ink-900">Data Perusahaan &amp; Driver yang Pelanggaran</h3>
          <p className="text-xs text-steel-500 mt-0.5">
            Siap dijawab kalau ditanya atasan — siapa, dari perusahaan mana, dan pelanggaran apa.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-steel-500 bg-steel-50/60 border-b border-steel-100">
                <th className="py-3 px-4 font-semibold">No. Polisi</th>
                <th className="py-3 px-4 font-semibold">Nama Supplier</th>
                <th className="py-3 px-4 font-semibold">Nama Supir/Kernet</th>
                <th className="py-3 px-4 font-semibold">Temuan</th>
                <th className="py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-steel-50 table-row-hover">
                  <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">{r.no_polisi}</td>
                  <td className="py-3 px-4 font-medium text-ink-900">{r.nama_supplier}</td>
                  <td className="py-3 px-4">{r.nama_petugas}</td>
                  <td className="py-3 px-4"><FindingTags items={r.temuan_list} /></td>
                  <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
              {reports.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-steel-400 text-sm">
                    Belum ada laporan Pelanggaran pada tanggal ini.
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
