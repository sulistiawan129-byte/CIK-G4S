import { createClient } from "@/lib/gc/client";
import type {
  NcReportRow,
  Supplier,
  Destination,
  NcCategory,
  NcByCategory,
  NcBySupplier,
  NcByDriver,
  DashboardFilters,
  PemeriksaanHarian,
  Profile,
} from "@/lib/gc/types";

function applyFilters(query: any, f: Partial<DashboardFilters>) {
  if (f.plant && f.plant !== "Semua") query = query.eq("plant", f.plant);
  if (f.status && f.status !== "Semua") query = query.eq("status", f.status);
  if (f.dateFrom) query = query.gte("tanggal", f.dateFrom);
  if (f.dateTo) query = query.lte("tanggal", f.dateTo);
  return query;
}

export async function fetchReports(filters: Partial<DashboardFilters> = {}) {
  const supabase = createClient();
  let query = supabase.from("v_nc_reports").select("*").order("tanggal", { ascending: false });
  query = applyFilters(query, filters);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as NcReportRow[];
}

export async function fetchSuppliers() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Supplier[];
}

export async function fetchCategories() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("nc_categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as NcCategory[];
}

export async function fetchNcByCategory() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_nc_by_category")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as NcByCategory[];
}

export async function fetchNcBySupplier() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_nc_by_supplier")
    .select("*")
    .order("total_nc", { ascending: false });
  if (error) throw error;
  return (data ?? []) as NcBySupplier[];
}

export async function fetchNcByDriver() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_nc_by_driver")
    .select("*")
    .order("total_nc", { ascending: false });
  if (error) throw error;
  return (data ?? []) as NcByDriver[];
}

export async function findSupplierIdByName(name: string, existing: Supplier[]) {
  const match = existing.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());
  return match?.id ?? null;
}

export async function fetchDestinations() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Destination[];
}

export async function createDestination(name: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("destinations")
    .insert({ name })
    .select()
    .single();
  if (error) throw error;
  return data as Destination;
}

export async function toggleDestinationActive(id: string, is_active: boolean) {
  const supabase = createClient();
  const { error } = await supabase.from("destinations").update({ is_active }).eq("id", id);
  if (error) throw error;
}

export async function createSupplier(name: string, jenis_material?: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ name, jenis_material: jenis_material || null })
    .select()
    .single();
  if (error) throw error;
  return data as Supplier;
}

export async function updateSupplierMaterial(id: string, jenis_material: string) {
  const supabase = createClient();
  const { error } = await supabase.from("suppliers").update({ jenis_material: jenis_material || null }).eq("id", id);
  if (error) throw error;
}

export async function toggleSupplierActive(id: string, is_active: boolean) {
  const supabase = createClient();
  const { error } = await supabase.from("suppliers").update({ is_active }).eq("id", id);
  if (error) throw error;
}

export interface NewReportInput {
  plant: string;
  tanggal: string;
  supplier_id: string;
  no_polisi: string;
  nama_petugas: string;
  jenis_identitas: string;
  nomor_identitas: string;
  status: string;
  tujuan_id?: string | null;
  catatan?: string;
  category_ids: number[];
}

export async function createReport(input: NewReportInput) {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  const { data: report, error } = await supabase
    .from("nc_reports")
    .insert({
      plant: input.plant,
      tanggal: input.tanggal,
      supplier_id: input.supplier_id,
      no_polisi: input.no_polisi.toUpperCase(),
      nama_petugas: input.nama_petugas,
      jenis_identitas: input.jenis_identitas,
      nomor_identitas: input.nomor_identitas,
      status: input.status,
      tujuan_id: input.tujuan_id || null,
      catatan: input.catatan || null,
      reported_by: user?.user?.id ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  if (input.category_ids.length > 0) {
    const rows = input.category_ids.map((category_id) => ({
      report_id: report.id,
      category_id,
    }));
    const { error: fErr } = await supabase.from("nc_report_findings").insert(rows);
    if (fErr) throw fErr;
  }

  return report;
}

export async function updateReportStatus(id: string, status: string) {
  const supabase = createClient();
  const { error } = await supabase.from("nc_reports").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteReport(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("nc_reports").delete().eq("id", id);
  if (error) throw error;
}

// -----------------------------------------------------------------------
// Pemeriksaan Harian — total kendaraan diperiksa (untuk True Pelanggaran Rate)
// -----------------------------------------------------------------------

export interface PemeriksaanFilters {
  plant?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function fetchPemeriksaan(filters: PemeriksaanFilters = {}) {
  const supabase = createClient();
  let query = supabase
    .from("pemeriksaan_harian")
    .select("*")
    .order("tanggal", { ascending: false });
  if (filters.plant && filters.plant !== "Semua") query = query.eq("plant", filters.plant);
  if (filters.dateFrom) query = query.gte("tanggal", filters.dateFrom);
  if (filters.dateTo) query = query.lte("tanggal", filters.dateTo);
  const { data, error } = await query;
  if (error) throw error;
  const manual = (data ?? []) as PemeriksaanHarian[];
  // Hari yang belum diisi manual dihitung otomatis dari Gate In (modul gate Security Desk).
  const from = filters.dateFrom ?? "2000-01-01", to = filters.dateTo ?? new Date().toISOString().slice(0, 10);
  const g = await supabase.schema("security").rpc("gate_daily", { p_from: from, p_to: to });
  if (g.error || !g.data) return manual;
  const has = new Set(manual.map((m) => `${m.plant}|${m.tanggal}`));
  const auto = (g.data as { plant: string; tanggal: string; jumlah: number }[])
    .filter((x) => (!filters.plant || filters.plant === "Semua" || x.plant === filters.plant) && !has.has(`${x.plant}|${x.tanggal}`))
    .map((x) => ({ id: `gate-${x.plant}-${x.tanggal}`, plant: x.plant, tanggal: x.tanggal, jumlah_kendaraan: x.jumlah, catatan: "Otomatis dari Gate In", created_at: "", updated_at: "", auto: true }) as unknown as PemeriksaanHarian);
  return [...manual, ...auto].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

export async function createPemeriksaan(input: {
  plant: string;
  tanggal: string;
  jumlah_kendaraan: number;
  catatan?: string;
}) {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("pemeriksaan_harian")
    .insert({ ...input, reported_by: user?.user?.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as PemeriksaanHarian;
}

export async function deletePemeriksaan(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("pemeriksaan_harian").delete().eq("id", id);
  if (error) throw error;
}

// -----------------------------------------------------------------------
// Profil & Peran (Role-Based Access)
// -----------------------------------------------------------------------

export async function fetchMyProfile() {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.user.id)
    .single();
  if (error) return null;
  return data as Profile;
}

export async function fetchAllProfiles() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function updateProfileRole(id: string, role: string) {
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) throw error;
}

export async function updateProfileDetails(id: string, updates: { full_name?: string; plant?: string | null }) {
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update(updates).eq("id", id);
  if (error) throw error;
}
