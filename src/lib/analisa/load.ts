"use client";
/* Analisa otomatis Security Desk — memakai logika yang sama dengan Laporan Manajemen CIKOPS (computeSecurity).
   Sumber: RPC security.cikops_report (13 bulan), riwayat bulanan (monthly_baseline), laporan NC G-C, perusahaan khusus. */
import { createClient } from "@/lib/gc/client";
import type { NcReportRow } from "@/lib/gc/types";
import { loadHistory, type HistKey } from "@/lib/history";
import { supabaseBrowser } from "@/lib/supabase/client";
import { computeSecurity } from "./security";
import { sdToSecData, type SdReport } from "./secdesk";
import { DEFAULT_KHUSUS, addMonthsKey, monthEnd, type DriverNames, type GcCase, type SecData, type TotalKey } from "./secmodel";
import { trendMonths, withLang, type ModuleReport, type ReportLang } from "./report";

const HIST_TO_TOTAL: Record<HistKey, TotalKey> = {
  karyawan: "kary", tamu: "tamu", kontraktor: "kontr", motor: "motor", visitor: "vis",
  timbang: "timbang", non_timbang: "non", biomas: "biomas", pelanggaran: "pel", kejadian: "kej",
};

export interface SecurityAnalysis {
  reports: ModuleReport[];
  /** Bulan yang gagal dibaca (misalnya SQL laporan_cikops.sql belum dijalankan). */
  warnings: string[];
}

const emptyReport = (key: string, siteCode: string): SdReport => ({
  version: 1, site: { code: siteCode, name: siteCode, plant: siteCode }, month: key, generated_at: "",
  daily: [], incidents: [], patrol: null, extra: null, issues: [], leaves: [], improvements: [], kpi: [],
  gate: { days: [], total_in: 0, total_out: 0, with_findings: 0, avg_minutes: null, inside_now: 0, over_4h: 0, top_companies: [] },
});

/** month = "YYYY-MM" atau "YYYY-MM-01". Hasil: laporan Security (ringkasan + rincian) untuk bulan itu, tren 13 bulan. */
export async function loadSecurityAnalysis(opts: { siteId: string; siteCode: string; month: string; lang: ReportLang }): Promise<SecurityAnalysis> {
  const { siteId, siteCode, lang } = opts;
  const lastKey = opts.month.slice(0, 7);
  const keys = Array.from({ length: 13 }, (_, i) => addMonthsKey(lastKey, i - 12));
  const warnings: string[] = [];
  const sb = supabaseBrowser();

  const [reps, hist, nc, sp] = await Promise.all([
    Promise.all(keys.map((k) => sb.rpc("cikops_report", { p_month: `${k}-01`, p_site: siteCode }).then((r) => ({ k, r })))),
    loadHistory(siteId, keys.map((k) => `${k}-01`)),
    createClient().from("v_nc_reports").select("*").gte("tanggal", `${keys[0]}-01`).lte("tanggal", monthEnd(lastKey)).order("tanggal", { ascending: false }),
    sb.from("special_companies").select("name").eq("site_id", siteId).order("name"),
  ]);

  const rows: Record<string, SecData> = {};
  let failed = 0;
  for (const { k, r } of reps) {
    if (r.error) failed++;
    const rep = (r.error || !r.data ? emptyReport(k, siteCode) : (r.data as SdReport));
    const totals: Partial<Record<TotalKey, number>> = {};
    const h = hist.base[`${k}-01`] || {};
    (Object.keys(h) as HistKey[]).forEach((c) => { const v = h[c]; if (v !== undefined && HIST_TO_TOTAL[c]) totals[HIST_TO_TOTAL[c]] = v; });
    const hasRep = rep.daily.length > 0 || rep.incidents.some((i) => i.value > 0) || !!rep.patrol || !!rep.extra || rep.issues.length > 0;
    if (!hasRep && Object.keys(totals).length === 0) continue;
    rows[k] = sdToSecData(k, rep, { totals } as SecData);
  }
  if (failed === keys.length) warnings.push(lang === "en" ? "Monthly data could not be read from the database. Make sure supabase/laporan_cikops.sql has been run." : "Data bulanan belum bisa dibaca dari database. Pastikan supabase/laporan_cikops.sql sudah dijalankan.");
  else if (failed > 0) warnings.push(lang === "en" ? `${failed} month(s) could not be read; the trend chart may have gaps.` : `${failed} bulan gagal dibaca; grafik tren mungkin bolong.`);

  const ncRows = nc.error ? [] : ((nc.data ?? []) as NcReportRow[]);
  if (nc.error) warnings.push(lang === "en" ? "Violation (NC) reports could not be read; violation figures use the monthly history." : "Laporan pelanggaran (NC) belum bisa dibaca; angka pelanggaran memakai riwayat bulanan.");
  const cases: GcCase[] = ncRows.map((x) => ({
    id: x.id, tanggal: x.tanggal, supplier: x.nama_supplier, nopol: x.no_polisi,
    simHash: x.nomor_identitas || "", simLast4: (x.nomor_identitas || "").slice(-4), jenis: x.temuan_list ?? [],
  }));
  const driverNames: DriverNames = {};
  ncRows.forEach((x) => { if (x.nomor_identitas && x.nama_petugas) driverNames[x.nomor_identitas] = { name: x.nama_petugas, co: x.nama_supplier }; });
  const khusus = sp.error || !sp.data?.length ? DEFAULT_KHUSUS : (sp.data as { name: string }[]).map((r) => r.name);

  const to = monthEnd(lastKey);
  const reports = withLang(lang, () => computeSecurity({
    from: `${lastKey}-01`, to, months: trendMonths(to, 13), rows,
    gc: nc.error ? null : { ok: true, cases }, khusus, driverNames,
  }));
  return { reports, warnings };
}
