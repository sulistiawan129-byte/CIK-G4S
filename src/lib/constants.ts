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

export const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString("id-ID");
export const dec = (n: number, d = 2) => Number(n).toFixed(d).replace(".", ",");
export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
