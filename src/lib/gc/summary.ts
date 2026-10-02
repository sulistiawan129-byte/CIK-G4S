"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./client";
import type { NcReportRow } from "./types";

/** Ringkasan pelanggaran transporter (G-C) untuk satu bulan + tren 12 bulan, realtime. */
export interface NcSummary {
  month: string;
  total: number;
  prev: number;
  accept: number;
  reject: number;
  inspected: number;
  rate: number | null; // % NC dari kendaraan diperiksa
  byCat: [string, number][];
  bySupplier: [string, number][];
  repeat: number; // supplier dengan NC di 2+ bulan dalam 3 bulan terakhir
  trend: { month: string; nc: number }[];
  latest: NcReportRow[];
}

const ym = (d: string) => d.slice(0, 7);
function addM(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
const endOf = (key: string) => { const [y, m] = key.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };

export function useNcSummary(month: string | null) {
  const [data, setData] = useState<NcSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    if (!month) return;
    const key = month.slice(0, 7), from = `${addM(key, -11)}-01`, to = endOf(key);
    const sb = createClient();
    const [r, p, g] = await Promise.all([
      sb.from("v_nc_reports").select("*").gte("tanggal", from).lte("tanggal", to).order("tanggal", { ascending: false }),
      sb.from("pemeriksaan_harian").select("plant,tanggal,jumlah_kendaraan").gte("tanggal", `${key}-01`).lte("tanggal", to),
      sb.schema("security").rpc("gate_daily", { p_from: `${key}-01`, p_to: to }),
    ]);
    if (r.error) { setError(r.error.message); return; }
    setError(null);
    const all = (r.data ?? []) as NcReportRow[];
    const cur = all.filter((x) => ym(x.tanggal) === key), prevKey = addM(key, -1);
    const count = <T,>(arr: T[], f: (x: T) => string[]) => {
      const m: Record<string, number> = {};
      arr.forEach((x) => f(x).forEach((k) => { if (k) m[k] = (m[k] ?? 0) + 1; }));
      return Object.entries(m).sort((a, b) => b[1] - a[1]);
    };
    // diperiksa: manual per plant/tanggal, selain itu dari Gate In
    const man = (p.data ?? []) as { plant: string; tanggal: string; jumlah_kendaraan: number }[];
    const has = new Set(man.map((m) => `${m.plant}|${m.tanggal}`));
    const inspected = man.reduce((a, m) => a + m.jumlah_kendaraan, 0) +
      ((g.data ?? []) as { plant: string; tanggal: string; jumlah: number }[]).filter((x) => !has.has(`${x.plant}|${x.tanggal}`)).reduce((a, x) => a + x.jumlah, 0);
    const last3 = [key, addM(key, -1), addM(key, -2)];
    const supMonths: Record<string, Set<string>> = {};
    all.filter((x) => last3.includes(ym(x.tanggal))).forEach((x) => { (supMonths[x.nama_supplier] ??= new Set()).add(ym(x.tanggal)); });
    setData({
      month: key,
      total: cur.length,
      prev: all.filter((x) => ym(x.tanggal) === prevKey).length,
      accept: cur.filter((x) => x.status === "Accept").length,
      reject: cur.filter((x) => x.status === "Reject").length,
      inspected,
      rate: inspected ? (cur.length / inspected) * 100 : null,
      byCat: count(cur, (x) => x.temuan_list ?? []),
      bySupplier: count(cur, (x) => [x.nama_supplier]),
      repeat: Object.values(supMonths).filter((s) => s.size >= 2).length,
      trend: Array.from({ length: 12 }, (_, i) => { const k = addM(key, i - 11); return { month: k, nc: all.filter((x) => ym(x.tanggal) === k).length }; }),
      latest: cur.slice(0, 6),
    });
  }, [month]);

  useEffect(() => {
    load();
    const sb = createClient();
    const kick = () => { clearTimeout(t.current); t.current = setTimeout(load, 400); };
    const ch = sb.channel(`nc-sum-${Math.random().toString(36).slice(2, 7)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "nc_reports" }, kick)
      .on("postgres_changes", { event: "*", schema: "public", table: "nc_report_findings" }, kick)
      .subscribe();
    const poll = setInterval(load, 120000);
    return () => { sb.removeChannel(ch); clearInterval(poll); clearTimeout(t.current); };
  }, [load]);

  return { data, error, reload: load };
}
