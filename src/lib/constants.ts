import { L, getUiLang } from "./lang";
export type CatKey = "karyawan" | "tamu" | "kontraktor" | "motor" | "visitor";
export interface Cat { k: CatKey; n: string; u: string; t: string; c: string; r4?: boolean }

export const CATS: Cat[] = [
  { k: "karyawan", n: "Mobil karyawan", u: "unit", t: "REKAPITULASI MOBIL KARYAWAN", c: "MOBIL KARYAWAN", r4: true },
  { k: "tamu", n: "Mobil tamu", u: "unit", t: "REKAPITULASI MOBIL TAMU", c: "MOBIL TAMU", r4: true },
  { k: "kontraktor", n: "Mobil kontraktor", u: "unit", t: "REKAPITULASI MOBIL KONTRAKTOR", c: "MOBIL KONTRAKTOR", r4: true },
  { k: "motor", n: "Motor", u: "unit", t: "REKAPITULASI MOTOR KARYAWAN, OUTSOURCE, KONTRAKTOR & TAMU", c: "MOTOR" },
  { k: "visitor", n: "Visitor", u: "orang", t: "REKAPITULASI VISITOR", c: "VISITOR" },
];

export const INC_CATS = [
  "Lingkungan", "Komplain Internal", "Komplain Eksternal", "Security Issue", "Lost & Found",
  "Kerusakan Fasilitas", "Kecelakaan/Sakit", "Kerusakan Khusus", "External Threat",
  "Kejadian Lain-lain", "Kegiatan Khusus", "Pelanggaran KDM",
];

/** Data harian tambahan (tabel daily_extra) — ikut laporan & sinkron CIKOPS. */
export type ExtraKey = "timbang" | "non_timbang" | "sekam" | "abu";
export const EXTRA_CATS: { k: ExtraKey; n: string; u: string }[] = [
  { k: "timbang", n: "Transporter timbang", u: "unit" },
  { k: "non_timbang", n: "Transporter non-timbang", u: "unit" },
  { k: "sekam", n: "Suplai sekam (PT Becis)", u: "unit" },
  { k: "abu", n: "Buang abu (PT Becis)", u: "unit" },
];
/** Kelompok kunjungan team support pengamanan (tabel monthly_extra). */
export const TEAM_KEYS = ["Team G", "External", "Lingkungan", "G4S"];

export const KPI_OBJ: [string, number][] = [
  ["Internal audit finding", 15], ["Follow up internal audit", 15], ["External audit finding", 15],
  ["Follow up external audit", 15], ["Kepuasan klien", 15], ["NC & komplain", 15], ["Follow up NC & komplain", 10],
];

export const EVENT_KINDS = ["Temuan", "Security", "Personel", "Patroli", "Kegiatan", "Lainnya"] as const;
export const LEAVE_TYPES = ["Annual Leave", "Sakit", "Extra Day Off", "Izin"] as const;
export const NI_STATUS = ["Open", "Proses", "Selesai"] as const;

export const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const MONTH_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DOW = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
export const DOWL = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export { MODULES, ROLE_LABEL } from "./access";
export type { ModuleKey } from "./access";

export const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString(getUiLang() === "en" ? "en-US" : "id-ID");
export const dec = (n: number, d = 2) => (getUiLang() === "en" ? Number(n).toFixed(d) : Number(n).toFixed(d).replace(".", ","));
export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/* ───────── Padanan Inggris untuk teks yang tersimpan di database / konstanta ───────── */
const CAT_EN: Record<CatKey, { n: string; u: string }> = {
  karyawan: { n: "Employee cars", u: "units" }, tamu: { n: "Guest cars", u: "units" }, kontraktor: { n: "Contractor cars", u: "units" },
  motor: { n: "Motorcycles", u: "units" }, visitor: { n: "Visitors", u: "people" },
};
export const catName = (c: Cat) => L(c.n, CAT_EN[c.k].n);
export const catUnit = (c: Cat) => L(c.u, CAT_EN[c.k].u);
const EXTRA_EN: Record<string, string> = { timbang: "Weighed transporters", non_timbang: "Non-weighed transporters", sekam: "Husk supply (PT Becis)", abu: "Ash removal (PT Becis)" };
export const extraName = (x: { k: string; n: string }) => L(x.n, EXTRA_EN[x.k] ?? x.n);
const INC_EN: Record<string, string> = {
  "Lingkungan": "Environment", "Komplain Internal": "Internal complaint", "Komplain Eksternal": "External complaint", "Security Issue": "Security issue",
  "Lost & Found": "Lost & found", "Kerusakan Fasilitas": "Facility damage", "Kecelakaan/Sakit": "Accident / illness", "Kerusakan Khusus": "Special damage",
  "External Threat": "External threat", "Kejadian Lain-lain": "Other incidents", "Kegiatan Khusus": "Special activity", "Pelanggaran KDM": "KDM violation",
};
export const incLabel = (c: string) => L(c, INC_EN[c] ?? c);
const KPI_EN = ["Internal audit finding", "Follow up internal audit", "External audit finding", "Follow up external audit", "Client satisfaction", "NC & complaints", "Follow up NC & complaints"];
export const kpiLabel = (i: number) => L(KPI_OBJ[i][0], KPI_EN[i] ?? KPI_OBJ[i][0]);
const KIND_EN: Record<string, string> = { Temuan: "Finding", Security: "Security", Personel: "Personnel", Patroli: "Patrol", Kegiatan: "Activity", Lainnya: "Other" };
export const kindLabel = (k: string) => L(k, KIND_EN[k] ?? k);
const LEAVE_EN: Record<string, string> = { "Annual Leave": "Annual leave", Sakit: "Sick", "Extra Day Off": "Extra day off", Izin: "Permission" };
export const leaveLabel = (k: string) => L(k, LEAVE_EN[k] ?? k);
const STATUS_EN: Record<string, string> = { Open: "Open", Proses: "In progress", Selesai: "Done", Close: "Closed" };
export const statusLabel = (k: string) => L(k, STATUS_EN[k] ?? k);
export const monLabel = (i: number) => (getUiLang() === "en" ? MON_EN : MON)[i];
export const monthLong = (i: number) => (getUiLang() === "en" ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] : MONTH_ID)[i];
const DOW_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], DOWL_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const dowShort = (i: number) => (getUiLang() === "en" ? DOW_EN : DOW)[i];
export const dowLong = (i: number) => (getUiLang() === "en" ? DOWL_EN : DOWL)[i];
