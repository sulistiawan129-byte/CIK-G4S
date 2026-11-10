import { CATS, INC_CATS, KPI_OBJ, catName, catUnit, fmt, dec, incLabel, monthLong, type Cat, type CatKey } from "./constants";
import { L } from "./lang";
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
export const monthName = (key: string) => { const { y, m0 } = parseMonth(key); return { name: monthLong(m0), year: y, prevName: monthLong((m0 + 11) % 12) }; };

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

export interface Check { id?: string; lv: "bad" | "warn"; title: string; sub: string; go: string; fix?: { type: "backup" | "note"; id: string; label: string }[] }

export function checks(D: MonthData): Check[] {
  const o: Check[] = [];
  const sick = D.leaves.filter((l) => /sakit|sick/i.test(l.type) && !l.backup.trim());
  if (sick.length) o.push({ lv: "bad", title: L(`${sick.length} personel sakit tanpa backup`, `${sick.length} sick personnel without a backup`), sub: L(`${sick.map((s) => s.name || "(tanpa nama)").join(" dan ")}. Isi siapa yang menggantikan.`, `${sick.map((s) => s.name || "(no name)").join(" and ")}. Fill in who is covering.`), go: "/personel", fix: sick.map((l) => ({ type: "backup", id: l.id, label: L(`Backup untuk ${l.name}`, `Backup for ${l.name}`) })) });
  const st = D.improvements.filter((n) => n.status !== "Selesai" && !n.progress.trim());
  if (st.length) { const mo = Math.max(...st.map((n) => monthsBetween(n.opened_month, D.month))); o.push({ lv: "bad", title: L(`${st.length} need improvement belum ada progres`, `${st.length} need-improvement items without progress`), sub: L(`Yang tertua sudah ${mo} bulan.`, `The oldest is ${mo} months old.`), go: "/personel" }); }
  const ke = D.inc.find((i) => i.category === "Komplain Eksternal");
  if (ke && ke.value && !ke.note.trim()) o.push({ lv: "warn", title: L("Komplain eksternal belum ada keterangan", "External complaint has no explanation"), sub: L("Tambahkan satu kalimat sebelum laporan dikirim.", "Add one sentence before the report is sent."), go: "/kejadian", fix: [{ type: "note", id: ke.category, label: L("Keterangan komplain eksternal", "External complaint note") }] });
  const noNote = D.inc.filter((i) => i.value > 0 && !i.note.trim() && i.category !== "Komplain Eksternal");
  if (noNote.length) o.push({ lv: "warn", title: L(`${noNote.length} kategori kejadian tanpa keterangan`, `${noNote.length} incident categories without a note`), sub: noNote.map((i) => incLabel(i.category)).join(", "), go: "/kejadian" });
  const kr = D.inc.find((i) => i.category === "Kerusakan Fasilitas");
  if (kr && kr.value) o.push({ lv: "warn", title: L(`${kr.value} kerusakan fasilitas`, `${kr.value} facility damage case(s)`), sub: kr.note || L("Cek status open/close.", "Check open/closed status."), go: "/kejadian" });
  const today = new Date();
  const lastDay = D.days.filter((d) => new Date(d.iso + "T23:59:59") < today).length;
  const empty = D.days.slice(0, lastDay).filter((d) => !D.filled[d.d - 1]).length;
  if (empty) o.push({ lv: "warn", title: L(`${empty} hari belum diisi`, `${empty} day(s) not filled in`), sub: L("Data kendaraan dan visitor harian.", "Daily vehicle and visitor data."), go: "/harian" });
  if (!D.patrol.target_checkpoint) o.push({ id: "patrol", lv: "warn", title: L("Data patroli belum diisi", "Patrol data not filled in"), sub: L("Salin dari rekap guard tour.", "Copy from the guard tour recap."), go: "/kejadian" });
  return o;
}

export function catHighlights(D: MonthData, c: Cat) {
  const a = agg(D, c.k), v = vsPrev(D, c.k), { name, year, prevName } = monthName(D.month);
  const wk = a.wd.map((x, i) => x + a.we[i]);
  const full = [1, 2, 3, 4];
  const hi = full.reduce((b, i) => (wk[i] > wk[b] ? i : b), 1), lo = full.reduce((b, i) => (wk[i] < wk[b] ? i : b), 1);
  const wh = a.we.reduce((b, x, i) => (x > a.we[b] ? i : b), 0);
  const n = D.notes[c.k] ?? { note: "", weekly_note: "" };
  const u = catUnit(c), cn = catName(c).toLowerCase(), pc = dec(Math.abs(v.pct), 1), ad = fmt(Math.abs(v.d));
  return {
    left: [
      L(`Total ${cn} ${name} ${year} sebanyak ${fmt(a.total)} ${u}, ${v.d < 0 ? "penurunan" : "kenaikan"} ${ad} ${u} (${pc}%) dibanding ${prevName} (${fmt(v.p)}).`,
        `Total ${cn} in ${name} ${year}: ${fmt(a.total)} ${u}, ${v.d < 0 ? "down" : "up"} ${ad} ${u} (${pc}%) vs ${prevName} (${fmt(v.p)}).`),
      L(`Rata-rata per hari kerja ±${fmt(a.aWD)} ${u} dan ±${fmt(a.aWE)} ${u} per hari libur.`, `Average ±${fmt(a.aWD)} ${u} per weekday and ±${fmt(a.aWE)} ${u} per weekend day.`),
      n.note,
    ].filter(Boolean),
    right: [
      L(`Tertinggi di minggu ke-${hi + 1} (${fmt(wk[hi])} ${u}), terendah di minggu ke-${lo + 1} (${fmt(wk[lo])} ${u}).`, `Highest in week ${hi + 1} (${fmt(wk[hi])} ${u}), lowest in week ${lo + 1} (${fmt(wk[lo])} ${u}).`),
      a.tWE ? L(`Weekend tertinggi di minggu ke-${wh + 1} (${fmt(a.we[wh])} ${u}).`, `Busiest weekend in week ${wh + 1} (${fmt(a.we[wh])} ${u}).`) : L("Tidak ada aktivitas di weekend.", "No weekend activity."),
      n.weekly_note,
    ].filter(Boolean),
    short: [
      L(`${v.d < 0 ? "Turun" : "Naik"} ${ad} ${u} (${pc}%) dibanding ${prevName}.`, `${v.d < 0 ? "Down" : "Up"} ${ad} ${u} (${pc}%) vs ${prevName}.`),
      L(`Rata-rata ±${fmt(a.aWD)} per hari kerja, ±${fmt(a.aWE)} per hari libur.`, `Average ±${fmt(a.aWD)} per weekday, ±${fmt(a.aWE)} per weekend day.`),
      L(`Minggu tersibuk: ke-${hi + 1} (${fmt(wk[hi])}). Paling sepi: ke-${lo + 1} (${fmt(wk[lo])}).`, `Busiest week: ${hi + 1} (${fmt(wk[hi])}). Quietest: ${lo + 1} (${fmt(wk[lo])}).`),
      n.note,
    ].filter(Boolean),
  };
}

export const incTotal = (D: MonthData) => D.inc.reduce((a, b) => a + (b.value || 0), 0);
export const incOrdered = (D: MonthData) => INC_CATS.map((n) => D.inc.find((i) => i.category === n)!).filter(Boolean);
export const patrolPct = (D: MonthData) => (D.patrol.target_checkpoint ? (D.patrol.actual_checkpoint / D.patrol.target_checkpoint) * 100 : 0);
export const monthsOpen = (opened: string, month: string) => Math.max(0, monthsBetween(opened, month));
export { addMonths };
