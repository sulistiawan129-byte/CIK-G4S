import { CATS, INC_CATS, KPI_OBJ, MONTH_ID, fmt, dec, type Cat, type CatKey } from "./constants";
import { addMonths, monthsBetween, parseMonth } from "./dates";
import type { MonthData } from "./types";

export interface Agg { wd: number[]; we: number[]; tWD: number; tWE: number; total: number; aWD: number; aWE: number; nWD: number; nWE: number }

export function agg(D: MonthData, k: CatKey): Agg {
  const a = D.daily[k], wd = [0, 0, 0, 0, 0], we = [0, 0, 0, 0, 0];
  D.days.forEach((x) => { (x.we ? we : wd)[x.wk - 1] += a[x.d - 1] || 0; });
  const nWD = D.days.filter((x) => !x.we).length, nWE = D.days.length - nWD;
  const tWD = wd.reduce((p, q) => p + q, 0), tWE = we.reduce((p, q) => p + q, 0);
  return { wd, we, tWD, tWE, total: tWD + tWE, aWD: nWD ? Math.round(tWD / nWD) : 0, aWE: nWE ? Math.round(tWE / nWE) : 0, nWD, nWE };
}

export const prevTotal = (D: MonthData, k: CatKey) => D.totals13[k][11] ?? 0;
export function vsPrev(D: MonthData, k: CatKey) {
  const t = agg(D, k).total, p = prevTotal(D, k), d = t - p;
  return { t, p, d, pct: p ? (d / p) * 100 : 0 };
}
export const r4Day = (D: MonthData, i: number) => CATS.filter((c) => c.r4).reduce((a, c) => a + (D.daily[c.k][i] || 0), 0);
export const monthName = (key: string) => { const { y, m0 } = parseMonth(key); return { name: MONTH_ID[m0], year: y, prevName: MONTH_ID[(m0 + 11) % 12] }; };

export function kpiCalc(D: MonthData) {
  const rows = KPI_OBJ.map((o, i) => {
    const v = D.kpi[i].filter((x): x is number => x !== null);
    const avg = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    return { avg, w: (avg * o[1]) / 100, n: v.length };
  });
  const monthly = Array.from({ length: 12 }, (_, mi) => {
    let s = 0, has = false;
    KPI_OBJ.forEach((o, i) => { const x = D.kpi[i][mi]; if (x !== null) { has = true; s += (x * o[1]) / 100; } });
    return has ? s : null;
  });
  return { rows, final: rows.reduce((a, r) => a + r.w, 0), monthly };
}

export interface Check { lv: "bad" | "warn"; title: string; sub: string; go: string; fix?: { type: "backup" | "note"; id: string; label: string }[] }

export function checks(D: MonthData): Check[] {
  const o: Check[] = [];
  const sick = D.leaves.filter((l) => /sakit/i.test(l.type) && !l.backup.trim());
  if (sick.length) o.push({ lv: "bad", title: `${sick.length} personel sakit tanpa backup`, sub: `${sick.map((s) => s.name || "(tanpa nama)").join(" dan ")}. Isi siapa yang menggantikan.`, go: "/personel", fix: sick.map((l) => ({ type: "backup", id: l.id, label: `Backup untuk ${l.name}` })) });
  const st = D.improvements.filter((n) => n.status !== "Selesai" && !n.progress.trim());
  if (st.length) o.push({ lv: "bad", title: `${st.length} need improvement belum ada progres`, sub: `Yang tertua sudah ${Math.max(...st.map((n) => monthsBetween(n.opened_month, D.month)))} bulan.`, go: "/personel" });
  const ke = D.inc.find((i) => i.category === "Komplain Eksternal");
  if (ke && ke.value && !ke.note.trim()) o.push({ lv: "warn", title: "Komplain eksternal belum ada keterangan", sub: "Tambahkan satu kalimat sebelum laporan dikirim.", go: "/kejadian", fix: [{ type: "note", id: ke.category, label: "Keterangan komplain eksternal" }] });
  const noNote = D.inc.filter((i) => i.value > 0 && !i.note.trim() && i.category !== "Komplain Eksternal");
  if (noNote.length) o.push({ lv: "warn", title: `${noNote.length} kategori kejadian tanpa keterangan`, sub: noNote.map((i) => i.category).join(", "), go: "/kejadian" });
  const kr = D.inc.find((i) => i.category === "Kerusakan Fasilitas");
  if (kr && kr.value) o.push({ lv: "warn", title: `${kr.value} kerusakan fasilitas`, sub: kr.note || "Cek status open/close.", go: "/kejadian" });
  const today = new Date();
  const lastDay = D.days.filter((d) => new Date(d.iso + "T23:59:59") < today).length;
  const empty = D.days.slice(0, lastDay).filter((d) => !D.filled[d.d - 1]).length;
  if (empty) o.push({ lv: "warn", title: `${empty} hari belum diisi`, sub: "Data kendaraan dan visitor harian.", go: "/harian" });
  if (!D.patrol.target_checkpoint) o.push({ lv: "warn", title: "Data patroli belum diisi", sub: "Salin dari rekap guard tour.", go: "/kejadian" });
  return o;
}

export function catHighlights(D: MonthData, c: Cat) {
  const a = agg(D, c.k), v = vsPrev(D, c.k), { name, year, prevName } = monthName(D.month);
  const wk = a.wd.map((x, i) => x + a.we[i]);
  const full = [1, 2, 3, 4];
  const hi = full.reduce((b, i) => (wk[i] > wk[b] ? i : b), 1), lo = full.reduce((b, i) => (wk[i] < wk[b] ? i : b), 1);
  const wh = a.we.reduce((b, x, i) => (x > a.we[b] ? i : b), 0);
  const n = D.notes[c.k] ?? { note: "", weekly_note: "" };
  return {
    left: [
      `Total ${c.n.toLowerCase()} ${name} ${year} sebanyak ${fmt(a.total)} ${c.u}, ${v.d < 0 ? "penurunan" : "kenaikan"} ${fmt(Math.abs(v.d))} ${c.u} (${dec(Math.abs(v.pct), 1)}%) dibanding ${prevName} (${fmt(v.p)}).`,
      `Rata-rata per hari kerja ±${fmt(a.aWD)} ${c.u} dan ±${fmt(a.aWE)} ${c.u} per hari libur.`,
      n.note,
    ].filter(Boolean),
    right: [
      `Tertinggi di minggu ke-${hi + 1} (${fmt(wk[hi])} ${c.u}), terendah di minggu ke-${lo + 1} (${fmt(wk[lo])} ${c.u}).`,
      a.tWE ? `Weekend tertinggi di minggu ke-${wh + 1} (${fmt(a.we[wh])} ${c.u}).` : "Tidak ada aktivitas di weekend.",
      n.weekly_note,
    ].filter(Boolean),
    short: [
      `${v.d < 0 ? "Turun" : "Naik"} ${fmt(Math.abs(v.d))} ${c.u} (${dec(Math.abs(v.pct), 1)}%) dibanding ${prevName}.`,
      `Rata-rata ±${fmt(a.aWD)} per hari kerja, ±${fmt(a.aWE)} per hari libur.`,
      `Minggu tersibuk: ke-${hi + 1} (${fmt(wk[hi])}). Paling sepi: ke-${lo + 1} (${fmt(wk[lo])}).`,
      n.note,
    ].filter(Boolean),
  };
}

export const incTotal = (D: MonthData) => D.inc.reduce((a, b) => a + (b.value || 0), 0);
export const incOrdered = (D: MonthData) => INC_CATS.map((n) => D.inc.find((i) => i.category === n)!).filter(Boolean);
export const patrolPct = (D: MonthData) => (D.patrol.target_checkpoint ? (D.patrol.actual_checkpoint / D.patrol.target_checkpoint) * 100 : 0);
export const monthsOpen = (opened: string, month: string) => Math.max(0, monthsBetween(opened, month));
export { addMonths };
