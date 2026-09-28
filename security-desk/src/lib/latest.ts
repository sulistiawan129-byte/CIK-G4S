"use client";
import { supabaseBrowser } from "./supabase/client";
import { monthKey } from "./dates";

/** Bulan terakhir yang punya data harian; kalau belum ada, bulan berjalan. */
export async function latestMonthFor(siteId: string): Promise<string> {
  const { data } = await supabaseBrowser().from("monthly_totals").select("month").eq("site_id", siteId).order("month", { ascending: false }).limit(1);
  const now = new Date();
  return (data?.[0]?.month as string) ?? monthKey(now.getFullYear(), now.getMonth());
}
