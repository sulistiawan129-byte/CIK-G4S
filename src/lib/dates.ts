import { MON_EN } from "./constants";

/** "YYYY-MM-01" untuk bulan tertentu. */
export const monthKey = (y: number, m0: number) => `${y}-${String(m0 + 1).padStart(2, "0")}-01`;
export const parseMonth = (key: string) => { const [y, m] = key.split("-").map(Number); return { y, m0: m - 1 }; };
export const addMonths = (key: string, n: number) => { const { y, m0 } = parseMonth(key); const d = new Date(y, m0 + n, 1); return monthKey(d.getFullYear(), d.getMonth()); };
export const isoDay = (y: number, m0: number, d: number) => `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
export const monthEnd = (key: string) => { const { y, m0 } = parseMonth(key); return isoDay(y, m0, new Date(y, m0 + 1, 0).getDate()); };
export const monthLabelEn = (key: string) => { const { y, m0 } = parseMonth(key); return `${MON_EN[m0]}-${String(y).slice(2)}`; };

export interface DayInfo { d: number; iso: string; dow: number; we: boolean; wk: number }

/** Hari dalam bulan. Minggu dihitung Senin–Minggu; sisa hari setelah minggu ke-5 digabung ke minggu ke-5 (konvensi laporan). */
export function monthDays(key: string): DayInfo[] {
  const { y, m0 } = parseMonth(key);
  const n = new Date(y, m0 + 1, 0).getDate();
  const firstMon = (new Date(y, m0, 1).getDay() + 6) % 7;
  return Array.from({ length: n }, (_, i) => {
    const d = i + 1, dow = new Date(y, m0, d).getDay();
    return { d, iso: isoDay(y, m0, d), dow, we: dow === 0 || dow === 6, wk: Math.min(5, Math.floor((i + firstMon) / 7) + 1) };
  });
}
export const firstMonOffset = (key: string) => { const { y, m0 } = parseMonth(key); return (new Date(y, m0, 1).getDay() + 6) % 7; };

/** Bulan-bulan (13) yang dipakai grafik tahunan, dari 12 bulan lalu sampai bulan ini. */
export const last13 = (key: string) => Array.from({ length: 13 }, (_, i) => addMonths(key, i - 12));

export function monthsBetween(fromKey: string, toKey: string) {
  const a = parseMonth(fromKey), b = parseMonth(toKey);
  return (b.y - a.y) * 12 + (b.m0 - a.m0);
}

export function shiftNow(h: number): [string, string] {
  if (h >= 7 && h < 15) return ["Pagi", "07.00–15.00"];
  if (h >= 15 && h < 23) return ["Siang", "15.00–23.00"];
  return ["Malam", "23.00–07.00"];
}
