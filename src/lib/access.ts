/**
 * Aturan akses gabungan Security Desk + G-C.
 * Satu tempat untuk: daftar peran, menu per peran, halaman awal, dan izin halaman.
 * Aturan yang sama dijaga di database (supabase/merger_gc.sql).
 */
export const ROLES = ["admin_g4s", "admin_ga", "ga_dept", "she_dept", "management", "gate", "display"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin_g4s: "Admin G4S",
  admin_ga: "Admin GA",
  ga_dept: "GA Department",
  she_dept: "SHE Department",
  management: "Management",
  gate: "Petugas Gate",
  display: "Layar ruang Security",
};
export const ROLE_DESC: Record<Role, string> = {
  admin_g4s: "Semua menu & data, semua site, kelola pengguna",
  admin_ga: "Semua menu & data, semua site, kelola pengguna",
  ga_dept: "Semua menu & data, semua site (tanpa kelola pengguna)",
  she_dept: "Modul G-C saja: lihat, unduh & cetak",
  management: "Dashboard (security + transporter), lihat saja",
  gate: "Aplikasi pos: gate in/out, input NC, total pemeriksaan",
  display: "Layar ruang Security",
};

/** Peran lama (sebelum merger_gc.sql dijalankan) dibaca sebagai peran baru. */
export function normRole(r?: string | null): Role | null {
  if (!r) return null;
  if (r === "master_admin" || r === "admin") return "admin_g4s";
  if (r === "viewer") return "management";
  return (ROLES as readonly string[]).includes(r) ? (r as Role) : null;
}

export const isUserAdmin = (r?: string | null) => r === "admin_g4s" || r === "admin_ga";
export const isFull = (r?: string | null) => r === "admin_g4s" || r === "admin_ga" || r === "ga_dept";
/** Peran yang melihat semua site tanpa perlu dicentang. */
export const allSites = (r?: string | null) => isFull(r) || r === "management";

/* ───────── Menu ───────── */
export type Group = "utama" | "security" | "transporter";
export interface Mod { key: string; href: string; label: string; group: Group; icon: string; roles: readonly Role[] }
const FULL = ["admin_g4s", "admin_ga", "ga_dept"] as const;
export const MODULES: readonly Mod[] = [
  { key: "ringkasan", href: "/", label: "Dashboard", group: "utama", icon: "ringkasan", roles: [...FULL, "management"] },
  { key: "harian", href: "/harian", label: "Data harian", group: "security", icon: "harian", roles: FULL },
  { key: "kejadian", href: "/kejadian", label: "Kejadian & patroli", group: "security", icon: "kejadian", roles: FULL },
  { key: "personel", href: "/personel", label: "Personel & temuan", group: "security", icon: "personel", roles: FULL },
  { key: "kpi", href: "/kpi", label: "KPI", group: "security", icon: "kpi", roles: FULL },
  { key: "laporan", href: "/laporan", label: "Laporan bulanan", group: "security", icon: "laporan", roles: FULL },
  { key: "gc", href: "/gc", label: "Dashboard NC", group: "transporter", icon: "nc", roles: [...FULL, "she_dept"] },
  { key: "gate", href: "/gate", label: "Gate in / out", group: "transporter", icon: "gate", roles: [...FULL, "she_dept"] },
  { key: "gc_laporan", href: "/gc/laporan", label: "Laporan NC", group: "transporter", icon: "laporan", roles: [...FULL, "she_dept"] },
  { key: "gc_input", href: "/gc/nc/baru", label: "Input NC", group: "transporter", icon: "input", roles: FULL },
  { key: "gc_pemeriksaan", href: "/gc/pemeriksaan", label: "Total pemeriksaan", group: "transporter", icon: "harian", roles: FULL },
  { key: "gc_master", href: "/gc/supplier", label: "Supplier & tujuan", group: "transporter", icon: "supplier", roles: FULL },
];
export type ModuleKey = string;

/** Modul yang cocok dengan path (prefix terpanjang). */
export function moduleOf(path: string): Mod | undefined {
  if (path.startsWith("/gc/tujuan")) return MODULES.find((m) => m.key === "gc_master");
  let best: Mod | undefined;
  for (const m of MODULES) {
    const hit = m.href === "/" ? path === "/" : path === m.href || path.startsWith(m.href + "/");
    if (hit && (!best || m.href.length > best.href.length)) best = m;
  }
  return best;
}

/** Halaman awal setelah login. */
export function homeOf(role?: string | null): string {
  if (role === "display") return "/display";
  if (role === "gate") return "/pos";
  if (role === "she_dept") return "/gc";
  return "/";
}

/** Boleh membuka path ini? (dipakai middleware & Shell) */
export function canPath(role: string | null | undefined, path: string): boolean {
  if (!role) return false;
  if (path.startsWith("/api") || path.startsWith("/auth") || path.startsWith("/login")) return true;
  if (path.startsWith("/display")) return role !== "she_dept";
  if (path === "/pos" || path.startsWith("/pos/")) return role === "gate" || isFull(role);
  if (path.startsWith("/pengguna")) return isUserAdmin(role);
  if (path.startsWith("/gate-cetak")) return isFull(role) || role === "she_dept" || role === "gate";
  if (role === "gate") return false;
  if (role === "she_dept") {
    if (path.startsWith("/gc/laporan/import") || path.startsWith("/gate/baru")) return false;
    if (path === "/gc/harian") return false;
  }
  if (path === "/gc/harian") return isFull(role);
  const m = moduleOf(path);
  return m ? (m.roles as readonly string[]).includes(role) : isFull(role);
}

/* ───────── Izin tindakan di modul G-C ───────── */
export const gcCanEdit = (r?: string | null) => isFull(r);
export const gcCanInput = (r?: string | null) => isFull(r) || r === "gate";
