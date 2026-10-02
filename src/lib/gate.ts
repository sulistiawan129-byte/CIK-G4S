"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "./supabase/client";

/** Alamat dasar halaman gate: "/gate" di aplikasi utama, "/pos" di aplikasi petugas. */
export const GateBaseCtx = createContext("/gate");
export const useGateBase = () => useContext(GateBaseCtx);

/* ───────── Definisi checklist (mengikuti form "Ceklist Pemeriksaan Kelengkapan Transporter") ───────── */
export const ADM_ITEMS = [
  { k: "ktp_sim", n: "KTP dan SIM" },
  { k: "stnk_kir", n: "STNK dan KIR" },
] as const;

export const SAFETY_ITEMS = [
  { k: "ganjal", n: "Ganjal ban" },
  { k: "p3k_apar", n: "Kotak P3K & APAR" },
  { k: "fitting", n: "Fitting steam 1 inch" },
  { k: "sepatu_vest", n: "Sepatu & safety vest" },
] as const;

export const PHYS_AREAS = [
  { k: "kabin", n: "Kabin dalam", hint: "Dashboard, kompartemen kanan-kiri pintu, langit-langit, lantai, belakang jok" },
  { k: "kompartemen", n: "Kompartemen luar", hint: "" },
  { k: "body", n: "Bagian luar body", hint: "" },
  { k: "kolong", n: "Kolong mobil", hint: "Kebocoran oli, bensin dan limbah" },
  { k: "lain", n: "Lain-lain", hint: "" },
] as const;

export const VEHICLE_TYPES = ["Tronton", "Wingbox", "Fuso", "CDD", "CDE / Engkel", "Trailer", "Iso tank", "Box", "Pick up", "Lainnya"];

export type Tri = boolean | null;
export interface Adm { ktp_sim?: Tri; stnk_kir?: Tri; note?: string }
export interface Safety { ganjal?: Tri; p3k_apar?: Tri; fitting?: Tri; sepatu_vest?: Tri; b3?: "ya" | "tidak" | "na" | null; hama?: Tri; note?: string }
export type Phys = Record<string, { ok: Tri; note?: string }>;

export interface GateRow {
  id: string; site_id: string; doc_no: string | null; status: "in" | "out";
  nopol: string; company_id: string | null; company_name: string; vehicle_type: string; kir: string;
  driver_name: string; driver_id_type: string; driver_id_no: string; driver_phone: string; helper_name: string; helper_id_no: string;
  in_at: string; in_by_name: string; in_sj: string; in_dept_id: string | null; in_dept_name: string; in_seal: string; in_material: string;
  adm_in: Adm; safety: Safety; phys_in: Phys; driver_ack_in: boolean;
  out_at: string | null; out_by_name: string; out_sj: string; out_dest: string; out_seal: string; out_material: string;
  adm_out: Adm; phys_out: Phys; driver_ack_out: boolean;
  finding_count: number; sl_name: string | null; sl_at: string | null; spv_name: string | null; spv_at: string | null;
  nc_report_id: string | null; created_at: string; updated_at: string;
}

export interface Option { id: string; name: string; sub?: string | null }
export interface NcMeta { available: boolean; plants: string[]; identitas: string[]; status: string[]; categories: { id: number; name: string }[] }

/* ───────── Temuan ───────── */
export interface Finding { t: string; stage: "in" | "out"; kind: "adm" | "safety" | "phys" }
export function findings(g: Pick<GateRow, "adm_in" | "safety" | "phys_in" | "adm_out" | "phys_out" | "status">): Finding[] {
  const f: Finding[] = [];
  ADM_ITEMS.forEach((a) => { if (g.adm_in?.[a.k] === false) f.push({ t: `${a.n} tidak lengkap`, stage: "in", kind: "adm" }); });
  SAFETY_ITEMS.forEach((s) => { if (g.safety?.[s.k] === false) f.push({ t: `${s.n} tidak ada`, stage: "in", kind: "safety" }); });
  if (g.safety?.b3 === "tidak") f.push({ t: "Surat izin B3 tidak ada", stage: "in", kind: "safety" });
  if (g.safety?.hama === true) f.push({ t: "Infestasi hama (info QA)", stage: "in", kind: "safety" });
  PHYS_AREAS.forEach((p) => { const v = g.phys_in?.[p.k]; if (v?.ok === false) f.push({ t: `${p.n}${v.note ? `: ${v.note}` : ""}`, stage: "in", kind: "phys" }); });
  if (g.status === "out") {
    ADM_ITEMS.forEach((a) => { if (g.adm_out?.[a.k] === false) f.push({ t: `${a.n} tidak lengkap`, stage: "out", kind: "adm" }); });
    PHYS_AREAS.forEach((p) => { const v = g.phys_out?.[p.k]; if (v?.ok === false) f.push({ t: `${p.n}${v.note ? `: ${v.note}` : ""}`, stage: "out", kind: "phys" }); });
  }
  return f;
}

/* ───────── Format waktu (WIB) ───────── */
const TZ = "Asia/Jakarta";
export const fTime = (s: string | null) => (s ? new Date(s).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "–");
export const fDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TZ }) : "–");
export const fDateLong = (s: string | null) => (s ? new Date(s).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }) : "–");
export function fDur(from: string, to?: string | null) {
  const ms = Math.max(0, (to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime());
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60);
  return h ? `${h} jam ${m % 60} mnt` : `${m} mnt`;
}
export const todayWIB = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
export const normNopol = (s: string) => s.toUpperCase().replace(/\s+/g, " ").trim();

/* ───────── Akses data ───────── */
const sb = () => supabaseBrowser();
async function run<T extends { error: { message: string } | null }>(q: PromiseLike<T>): Promise<T> { const r = await q; if (r.error) throw new Error(r.error.message); return r; }

let optCache: { suppliers: Option[]; destinations: Option[]; meta: NcMeta | null } | null = null;
export async function loadOptions(force = false) {
  if (optCache && !force) return optCache;
  const [s, d, m] = await Promise.all([sb().rpc("gate_suppliers"), sb().rpc("gate_destinations"), sb().rpc("gate_nc_meta")]);
  optCache = {
    suppliers: ((s.data ?? []) as { id: string; name: string; jenis_material: string | null }[]).map((x) => ({ id: x.id, name: x.name, sub: x.jenis_material })),
    destinations: ((d.data ?? []) as { id: string; name: string }[]).map((x) => ({ id: x.id, name: x.name })),
    meta: (m.data as NcMeta) ?? null,
  };
  return optCache;
}

export const gateApi = {
  get: async (id: string) => (await run(sb().from("gate_inspections").select("*").eq("id", id).maybeSingle())).data as GateRow | null,
  lastByNopol: async (siteId: string, nopol: string) => {
    const r = await sb().from("gate_inspections").select("*").eq("site_id", siteId).ilike("nopol", normNopol(nopol)).order("in_at", { ascending: false }).limit(1);
    return ((r.data ?? [])[0] as GateRow) ?? null;
  },
  findInside: async (siteId: string, q: string) => {
    const r = await sb().from("gate_inspections").select("*").eq("site_id", siteId).eq("status", "in").ilike("nopol", `%${normNopol(q)}%`).order("in_at").limit(10);
    return (r.data ?? []) as GateRow[];
  },
  create: async (row: Partial<GateRow>) => (await run(sb().from("gate_inspections").insert(row).select("id").single())).data as { id: string },
  update: (id: string, patch: Partial<GateRow>) => run(sb().from("gate_inspections").update(patch).eq("id", id)),
  remove: (id: string) => run(sb().from("gate_inspections").delete().eq("id", id)),
  acknowledge: (ids: string[], who: "sl" | "spv") => run(sb().from("gate_inspections").update(who === "sl" ? { sl_at: new Date().toISOString() } : { spv_at: new Date().toISOString() }).in("id", ids)),
  createNc: async (p: { id: string; plant: string; identitas: string; status: string; categories: number[]; catatan: string }) =>
    (await run(sb().rpc("gate_create_nc", { p_inspection: p.id, p_plant: p.plant, p_identitas: p.identitas, p_status: p.status, p_categories: p.categories, p_catatan: p.catatan }))).data as string,
};

/** Daftar pemeriksaan untuk satu site + langganan realtime. */
export function useGateList(siteId: string | null, day: string) {
  const [inside, setInside] = useState<GateRow[] | null>(null);
  const [history, setHistory] = useState<GateRow[] | null>(null);
  const [live, setLive] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    if (!siteId) return;
    const start = new Date(`${day}T00:00:00+07:00`).toISOString(), end = new Date(`${day}T23:59:59.999+07:00`).toISOString();
    const [a, b] = await Promise.all([
      sb().from("gate_inspections").select("*").eq("site_id", siteId).eq("status", "in").order("in_at"),
      sb().from("gate_inspections").select("*").eq("site_id", siteId).gte("in_at", start).lte("in_at", end).order("in_at", { ascending: false }),
    ]);
    if (!a.error) setInside(a.data as GateRow[]);
    if (!b.error) setHistory(b.data as GateRow[]);
  }, [siteId, day]);

  useEffect(() => {
    load();
    if (!siteId) return;
    const c = sb().channel(`gate-${siteId}-${Math.random().toString(36).slice(2, 7)}`)
      .on("postgres_changes", { event: "*", schema: "security", table: "gate_inspections", filter: `site_id=eq.${siteId}` }, () => { clearTimeout(t.current); t.current = setTimeout(load, 200); })
      .subscribe((s) => setLive(s === "SUBSCRIBED"));
    const vis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", vis);
    const poll = setInterval(load, 60000);
    return () => { sb().removeChannel(c); document.removeEventListener("visibilitychange", vis); clearInterval(poll); clearTimeout(t.current); };
  }, [siteId, load]);

  return { inside, history, live, reload: load };
}

/** Satu pemeriksaan + realtime (untuk halaman detail). */
export function useGateRow(id: string) {
  const [row, setRow] = useState<GateRow | null | undefined>(undefined);
  const load = useCallback(async () => { try { setRow(await gateApi.get(id)); } catch { setRow(null); } }, [id]);
  useEffect(() => {
    load();
    const c = sb().channel(`gate-row-${id}`).on("postgres_changes", { event: "*", schema: "security", table: "gate_inspections", filter: `id=eq.${id}` }, load).subscribe();
    return () => { sb().removeChannel(c); };
  }, [id, load]);
  return { row, reload: load };
}

/** Jam yang berdetak (untuk durasi "sudah di dalam"). */
export function useTick(ms = 30000) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(t); }, [ms]);
}

/* ───────── Ringkasan gate untuk dashboard & layar eksekutif ───────── */
export const LONG_MS = 4 * 3600000;
export interface GateStats { masuk: number; keluar: number; dalam: number; temuan: number; lama: number; avgMs: number; top: [string, number][] }
export function gateStats(today: GateRow[], inside: GateRow[]): GateStats {
  const done = today.filter((g) => g.status === "out" && g.out_at);
  const avgMs = done.length ? done.reduce((a, g) => a + (new Date(g.out_at!).getTime() - new Date(g.in_at).getTime()), 0) / done.length : 0;
  const by: Record<string, number> = {};
  today.forEach((g) => { const k = g.company_name || "–"; by[k] = (by[k] || 0) + 1; });
  return {
    masuk: today.length,
    keluar: done.length,
    dalam: inside.length,
    temuan: today.filter((g) => g.finding_count > 0).length,
    lama: inside.filter((g) => Date.now() - new Date(g.in_at).getTime() > LONG_MS).length,
    avgMs,
    top: Object.entries(by).sort((a, b) => b[1] - a[1]),
  };
}
/** Jumlah masuk & keluar per jam (WIB) untuk satu hari. */
export function hourlyFlow(today: GateRow[], day: string) {
  const hin = Array(24).fill(0), hout = Array(24).fill(0);
  const h = (iso: string) => Number(new Date(iso).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })) % 24;
  const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  today.forEach((g) => {
    hin[h(g.in_at)]++;
    if (g.out_at && dayOf(g.out_at) === day) hout[h(g.out_at)]++;
  });
  return { hin, hout };
}
export const fDurMs = (ms: number) => { const m = Math.floor(ms / 60000), h = Math.floor(m / 60); return h ? `${h}j ${m % 60}m` : `${m}m`; };
export const fDurShort = (from: string, to?: string | null) => fDurMs(Math.max(0, (to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime()));
