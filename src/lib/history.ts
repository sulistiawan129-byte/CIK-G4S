"use client";
/* Riwayat 12 bulan: total bulanan untuk bulan yang belum/tidak punya data harian (dasar grafik tren & laporan).
   Disimpan di security.monthly_baseline. Kategori tambahan (timbang, biomas, pelanggaran, kejadian) butuh supabase/lengkapi_security.sql. */
import { supabaseBrowser } from "./supabase/client";
import { L } from "./lang";

export const HIST_CATS = [
  { k: "karyawan", n: "Mobil karyawan" },
  { k: "tamu", n: "Mobil tamu" },
  { k: "kontraktor", n: "Mobil kontraktor" },
  { k: "motor", n: "Motor" },
  { k: "visitor", n: "Visitor" },
  { k: "timbang", n: "Transporter timbang" },
  { k: "non_timbang", n: "Transporter non-timbang" },
  { k: "biomas", n: "Biomas (kendaraan)" },
  { k: "pelanggaran", n: "Pelanggaran transporter" },
  { k: "kejadian", n: "Kejadian" },
] as const;
export type HistKey = (typeof HIST_CATS)[number]["k"];
const HIST_EN: Record<HistKey, string> = { karyawan: "Employee cars", tamu: "Guest cars", kontraktor: "Contractor cars", motor: "Motorcycles", visitor: "Visitors", timbang: "Weighed transporters", non_timbang: "Non-weighed transporters", biomas: "Biomass (vehicles)", pelanggaran: "Transporter violations", kejadian: "Incidents" };
export const histName = (c: { k: HistKey; n: string }) => L(c.n, HIST_EN[c.k]);
/** Lima kategori pertama bisa berasal dari data harian (monthly_totals). */
export const FROM_DAILY: HistKey[] = ["karyawan", "tamu", "kontraktor", "motor", "visitor"];

export type HistMap = Record<string, Partial<Record<HistKey, number>>>;

/** Total tersimpan (baseline) + bulan yang sudah berisi data harian (tidak boleh ditimpa dari sini). */
export async function loadHistory(siteId: string, months: string[]): Promise<{ base: HistMap; daily: HistMap }> {
  const sb = supabaseBrowser();
  const [b, t] = await Promise.all([
    sb.from("monthly_baseline").select("month,category,total").eq("site_id", siteId).in("month", months),
    sb.from("monthly_totals").select("month,category,total").eq("site_id", siteId).in("month", months),
  ]);
  if (b.error) throw new Error(b.error.message);
  const fill = (rows: { month: string; category: string; total: number }[] | null) => {
    const m: HistMap = {};
    (rows ?? []).forEach((r) => { (m[r.month.slice(0, 10)] ??= {})[r.category as HistKey] = r.total; });
    return m;
  };
  return { base: fill(b.data as never), daily: t.error ? {} : fill(t.data as never) };
}

/** value null/kosong = hapus baris. */
export async function saveHistory(siteId: string, month: string, cat: HistKey, value: number | null): Promise<void> {
  const sb = supabaseBrowser();
  if (value === null) {
    const { error } = await sb.from("monthly_baseline").delete().eq("site_id", siteId).eq("month", month).eq("category", cat);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await sb.from("monthly_baseline").upsert({ site_id: siteId, month, category: cat, total: Math.max(0, Math.round(value)) }, { onConflict: "site_id,month,category" });
  if (error) {
    if (/check constraint|monthly_baseline_category_check/i.test(error.message)) throw new Error(L("Kategori ini belum aktif di database — jalankan supabase/lengkapi_security.sql di Supabase SQL Editor.", "This category is not active in the database yet — run supabase/lengkapi_security.sql in the Supabase SQL Editor."));
    throw new Error(error.message);
  }
}
