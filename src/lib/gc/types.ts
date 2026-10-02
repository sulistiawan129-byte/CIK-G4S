export type Plant = "Cikarang" | "PRB";
export type Identitas = "SIM" | "KTP";
export type NcStatus = "Accept" | "Reject";
export type UserRole = "admin_ga" | "admin_security" | "petugas_gate";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  plant: Plant | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  is_active: boolean;
  jenis_material: string | null;
  created_at: string;
}

export interface Destination {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface PemeriksaanHarian {
  id: string;
  plant: Plant;
  tanggal: string;
  jumlah_kendaraan: number;
  catatan: string | null;
  /** true = dihitung otomatis dari Gate In, bukan input manual */
  auto?: boolean;
  created_at: string;
  updated_at: string;
}

export interface NcCategory {
  id: number;
  name: string;
  sort_order: number;
}

export interface NcReportRow {
  id: string;
  plant: Plant;
  tanggal: string;
  nama_supplier: string;
  no_polisi: string;
  nama_petugas: string;
  jenis_identitas: Identitas;
  nomor_identitas: string;
  status: NcStatus;
  nama_tujuan: string | null;
  catatan: string | null;
  temuan_list: string[];
  total_temuan: number;
  created_at: string;
  updated_at: string;
}

export interface NcByCategory {
  category_id: number;
  category_name: string;
  sort_order: number;
  total: number;
}

export interface NcBySupplier {
  supplier_id: string;
  supplier_name: string;
  total_nc: number;
  total_reject: number;
  total_accept: number;
}

export interface NcByDriver {
  nama_petugas: string;
  jenis_identitas: Identitas;
  nomor_identitas: string;
  total_nc: number;
}

export interface DashboardFilters {
  plant: Plant | "Semua";
  supplierId: string | "Semua";
  status: NcStatus | "Semua";
  dateFrom: string;
  dateTo: string;
}
