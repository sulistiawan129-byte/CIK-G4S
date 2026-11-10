"use client";
/* Gate KENDARAAN perusahaan — data tersimpan di CIKOPS-FM (armada, driver, tugas ada di sana); petugas menginputnya dari Security Desk.
   Semua lewat RPC publik CIKOPS (security definer); tabelnya tidak pernah disentuh langsung. */
import { cikopsClient } from "./client";

export type KPlant = "CIK" | "PRB";
export type KKategori = "asset_ga" | "non_asset";

export interface KVehicle { id: string; nopol: string; jenis: string; plant: KPlant; color: string; kategori: KKategori }
export interface KDriver { id: string; nama: string }
export interface KLog {
  id: string; vehicleId: string; nopol: string; jenis: string; color: string; plant: KPlant; kategori: KKategori;
  driverName: string; tujuan: string; keterangan: string; timeOut: string | null; timeIn: string | null;
  status: "OUT" | "IN" | "DONE"; createdAt: string;
}

const plantOf = (p: unknown): KPlant => (p === "PRB" ? "PRB" : "CIK");
const katOf = (k: unknown): KKategori => (k === "non_asset" ? "non_asset" : "asset_ga");

/** Pesan galat yang ramah untuk petugas (fungsi CIKOPS melempar teks Indonesia yang sudah jelas). */
export function gateErr(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Tidak ada sinyal / tidak bisa terhubung ke server. Coba lagi.";
  return m;
}

export async function listVehicles(): Promise<KVehicle[]> {
  const { data, error } = await cikopsClient().rpc("get_active_vehicles_for_gate");
  if (error) throw error;
  // kolom di database boleh kosong (mis. plat yang dicatat manual tanpa jenis) → normalkan
  return ((data ?? []) as Record<string, unknown>[]).map((v) => ({
    id: String(v.id), nopol: String(v.nopol ?? ""), jenis: String(v.jenis ?? ""), color: String(v.color ?? ""),
    plant: plantOf(v.plant), kategori: katOf(v.kategori),
  }));
}

export async function listDrivers(): Promise<KDriver[]> {
  const { data, error } = await cikopsClient().rpc("get_active_drivers_for_gate");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((d) => ({ id: String(d.id), nama: String(d.nama ?? "") }));
}

async function notesFor(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await cikopsClient().rpc("get_gate_keterangan", { p_ids: ids.slice(i, i + 300) });
    if (error) return map;   // fungsi keterangan belum ada → abaikan
    for (const r of (data ?? []) as { id: string; keterangan: string | null }[]) if (r.keterangan?.trim()) map.set(r.id, r.keterangan.trim());
  }
  return map;
}

/** Log hari `date` (WIB) + SEMUA kendaraan yang masih aktif dari hari sebelumnya.
 *  Memakai get_gate_logs_pos (SQL 09 CIKOPS); bila belum dijalankan, jatuh ke get_gate_logs_public. */
export async function listLogs(date: string): Promise<KLog[]> {
  const sb = cikopsClient();
  let res = await sb.rpc("get_gate_logs_pos", { p_date: date });
  if (res.error && (res.error.code === "PGRST202" || res.error.code === "42883" || /get_gate_logs_pos/i.test(res.error.message))) {
    res = await sb.rpc("get_gate_logs_public", { p_date: date });
  }
  if (res.error) throw res.error;
  const rows = (res.data ?? []) as Record<string, unknown>[];
  const notes = await notesFor(rows.map((r) => String(r.log_id)));
  return rows.map((r) => ({
    id: String(r.log_id), vehicleId: String(r.vehicle_id), nopol: String(r.nopol ?? "-"), jenis: String(r.jenis ?? "-"), color: String(r.color ?? ""),
    plant: plantOf(r.plant), kategori: katOf(r.kategori), driverName: String(r.driver_name ?? "-"), tujuan: String(r.tujuan ?? ""),
    keterangan: notes.get(String(r.log_id)) ?? "", timeOut: (r.time_out as string) ?? null, timeIn: (r.time_in as string) ?? null,
    status: r.status as KLog["status"], createdAt: String(r.created_at),
  }));
}

export interface OpenInput { driverId?: string | null; driverName?: string | null; tujuan: string; keterangan?: string; timestamp: string }

export async function openForVehicle(vehicleId: string, i: OpenInput): Promise<void> {
  const sb = cikopsClient();
  const { error } = await sb.rpc("open_gate_checkpoint", {
    p_vehicle_id: vehicleId, p_driver_id: i.driverId || null, p_driver_name_manual: i.driverName || null, p_tujuan: i.tujuan || "", p_timestamp: i.timestamp,
  });
  if (error) throw error;
  if (i.keterangan?.trim()) await sb.rpc("set_gate_keterangan", { p_vehicle_id: vehicleId, p_keterangan: i.keterangan.trim() });
}

/** Plat yang TIDAK terdaftar di Aset GA (mis. mobil sales): didaftarkan otomatis sebagai mobil perusahaan non-aset (SQL 08 CIKOPS). */
export async function openManual(i: OpenInput & { nopol: string; jenis?: string; plant: KPlant }): Promise<string> {
  const sb = cikopsClient();
  const { data, error } = await sb.rpc("open_gate_checkpoint_manual", {
    p_nopol: i.nopol, p_jenis: i.jenis || null, p_plant: i.plant, p_driver_id: i.driverId || null, p_driver_name_manual: i.driverName || null,
    p_tujuan: i.tujuan || "", p_timestamp: i.timestamp,
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883" || /open_gate_checkpoint_manual/i.test(error.message)) {
      throw new Error("Input manual belum aktif di CIKOPS — minta GA menjalankan SQL 08 (supabase/08_kategori_kendaraan_gate_manual.sql).");
    }
    throw error;
  }
  const vid = String(data);
  if (i.keterangan?.trim()) await sb.rpc("set_gate_keterangan", { p_vehicle_id: vid, p_keterangan: i.keterangan.trim() });
  return vid;
}

export async function closeLog(vehicleId: string, timestamp?: string): Promise<void> {
  const { error } = await cikopsClient().rpc("close_gate_checkpoint", { p_vehicle_id: vehicleId, ...(timestamp ? { p_timestamp: timestamp } : {}) });
  if (error) throw error;
}

/* ── util waktu (WIB, tidak tergantung zona perangkat) ── */
const TZ = "Asia/Jakarta";
export const wibDate = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: TZ });
export const wibHHMM = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("id-ID", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).replace(".", ":") : "–");
export const wibClock = (d = new Date()) => d.toLocaleTimeString("en-GB", { timeZone: TZ, hour12: false });
/** ISO untuk "tanggal yang dipilih + jam sekarang (WIB)" — dipakai bila petugas mengisi data hari lain. */
export function stampFor(day: string): string {
  if (day === wibDate()) return new Date().toISOString();
  return new Date(`${day}T${wibClock()}+07:00`).toISOString();
}
export const minsSince = (a: string | null, b: number | string = Date.now()) => (a ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)) : 0);
export const fmtDur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}j ${String(m % 60).padStart(2, "0")}m` : `${m}m`);

/** Kejadian pertama/kedua sesuai asal kendaraan: CIK = keluar plant → kembali; PRB (dari luar) = masuk CIK → keluar. */
export function evOf(l: KLog) {
  return l.plant === "CIK"
    ? { first: l.timeOut, second: l.timeIn, firstLbl: "Keluar", secondLbl: "Kembali", act: "Catat Kembali", running: "Di luar", done: "Sudah kembali" }
    : { first: l.timeIn, second: l.timeOut, firstLbl: "Masuk CIK", secondLbl: "Keluar CIK", act: "Catat Keluar CIK", running: "Di dalam", done: "Sudah keluar CIK" };
}
