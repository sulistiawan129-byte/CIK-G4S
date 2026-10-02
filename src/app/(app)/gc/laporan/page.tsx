"use client";

import { useGcPerm } from "@/components/gc/GcPerm";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Download, Trash2, PlusCircle, ChevronDown } from "lucide-react";
import { fetchReports, fetchSuppliers, updateReportStatus, deleteReport } from "@/lib/gc/data";
import { useRealtimeNcReports } from "@/lib/gc/useRealtimeNcReports";
import { PLANTS } from "@/lib/gc/constants";
import type { NcReportRow, Supplier } from "@/lib/gc/types";
import StatusBadge from "@/components/gc/StatusBadge";
import FindingTags from "@/components/gc/FindingTags";

export default function NcListPage() {
  const perm = useGcPerm();
  const [reports, setReports] = useState<NcReportRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [plant, setPlant] = useState("Semua");
  const [status, setStatus] = useState("Semua");

  async function load() {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([fetchReports(), fetchSuppliers()]);
      setReports(r);
      setSuppliers(s);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useRealtimeNcReports(() => {
    fetchReports().then(setReports).catch(() => {});
  });

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (plant !== "Semua" && r.plant !== plant) return false;
      if (status !== "Semua" && r.status !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.nama_supplier} ${r.no_polisi} ${r.nama_petugas} ${r.nomor_identitas}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, plant, status, search]);

  async function handleStatusChange(id: string, newStatus: "Accept" | "Reject") {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    try {
      await updateReportStatus(id, newStatus);
    } catch {
      load();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus laporan Pelanggaran ini? Tindakan tidak dapat dibatalkan.")) return;
    setReports((prev) => prev.filter((r) => r.id !== id));
    try {
      await deleteReport(id);
    } catch {
      load();
    }
  }

  async function handleExport() {
    const XLSX = await import("xlsx");
    const rows = filtered.map((r) => ({
      PLANT: r.plant,
      TANGGAL: r.tanggal,
      "NAMA SUPPLIER": r.nama_supplier,
      "NO POLISI": r.no_polisi,
      "NAMA SUPIR / KERNET": r.nama_petugas,
      "JENIS IDENTITAS": r.jenis_identitas,
      "NOMOR IDENTITAS": r.nomor_identitas,
      TEMUAN: r.temuan_list.join(", "),
      "TOTAL TEMUAN": r.total_temuan,
      TUJUAN: r.nama_tujuan ?? "",
      KETERANGAN: r.catatan ?? "",
      STATUS: r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pelanggaran Supplier");
    XLSX.writeFile(wb, `CIKOPS-GC_NC_Supplier_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="card p-4 sm:p-5 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-clear-600 bg-clear-50 px-2.5 py-1.5 rounded-full shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-clear-500 animate-pulse" /> Live
        </span>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari supplier, no. polisi, nama petugas..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-steel-100 bg-white text-sm focus:border-brand-500 outline-none"
          />
        </div>

        <select
          value={plant}
          onChange={(e) => setPlant(e.target.value)}
          className="text-sm border border-steel-100 rounded-lg px-3 py-2.5 bg-white outline-none"
        >
          <option value="Semua">Semua Plant</option>
          {PLANTS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm border border-steel-100 rounded-lg px-3 py-2.5 bg-white outline-none"
        >
          <option value="Semua">Semua Status</option>
          <option value="Accept">Accept</option>
          <option value="Reject">Reject</option>
        </select>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 text-sm font-semibold text-ink-900 border border-steel-100 rounded-lg px-4 py-2.5 hover:bg-steel-50"
        >
          <Download className="w-4 h-4" /> Export Excel
        </button>

        {perm.input && <Link
          href="/gc/nc/baru"
          className="flex items-center gap-2 text-sm font-semibold text-white bg-ink-900 hover:bg-ink-800 rounded-lg px-4 py-2.5"
        >
          <PlusCircle className="w-4 h-4" /> Input Pelanggaran
        </Link>}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1250px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-steel-500 bg-steel-50/60 border-b border-steel-100">
                <th className="py-3 px-4 font-semibold">Plant</th>
                <th className="py-3 px-4 font-semibold">Tanggal</th>
                <th className="py-3 px-4 font-semibold">Nama Supplier</th>
                <th className="py-3 px-4 font-semibold">No. Polisi</th>
                <th className="py-3 px-4 font-semibold">Nama Supir / Kernet</th>
                <th className="py-3 px-4 font-semibold">Identitas</th>
                <th className="py-3 px-4 font-semibold">Temuan</th>
                <th className="py-3 px-4 font-semibold text-center">Total</th>
                <th className="py-3 px-4 font-semibold">Tujuan</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-steel-50 table-row-hover">
                  <td className="py-3 px-4">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-ink-900 text-white">
                      {r.plant}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-steel-700 whitespace-nowrap">{r.tanggal}</td>
                  <td className="py-3 px-4 font-medium text-ink-900">{r.nama_supplier}</td>
                  <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">{r.no_polisi}</td>
                  <td className="py-3 px-4">{r.nama_petugas}</td>
                  <td className="py-3 px-4 text-xs text-steel-600 whitespace-nowrap">
                    {r.jenis_identitas}: <span className="font-mono">{r.nomor_identitas}</span>
                  </td>
                  <td className="py-3 px-4"><FindingTags items={r.temuan_list} /></td>
                  <td className="py-3 px-4 text-center font-mono font-semibold">{r.total_temuan}</td>
                  <td className="py-3 px-4 text-xs text-steel-600 max-w-[140px]">
                    <span className="truncate block" title={r.catatan ?? undefined}>
                      {r.nama_tujuan ?? "—"}
                    </span>
                    {r.catatan && (
                      <span className="text-[10px] text-steel-400 truncate block" title={r.catatan}>
                        {r.catatan}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {!perm.edit ? <StatusBadge status={r.status} /> : <div className="relative inline-block">
                      <select
                        value={r.status}
                        onChange={(e) => handleStatusChange(r.id, e.target.value as "Accept" | "Reject")}
                        className="appearance-none text-xs font-semibold pl-2.5 pr-6 py-1 rounded-full border-none outline-none cursor-pointer"
                        style={{
                          backgroundColor: r.status === "Accept" ? "#EAFBF1" : "#FCE9EA",
                          color: r.status === "Accept" ? "#128A3E" : "#A20D25",
                        }}
                      >
                        <option value="Accept">Accept</option>
                        <option value="Reject">Reject</option>
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {perm.edit && <button
                      onClick={() => handleDelete(r.id)}
                      className="text-steel-400 hover:text-alert-600 p-1.5 rounded-md hover:bg-alert-50"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={11} className="py-14 text-center text-steel-400 text-sm">
                    Tidak ada laporan yang cocok dengan filter/pencarian.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={11} className="py-14 text-center text-steel-400 text-sm">
                    Memuat data...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 text-xs text-steel-500 border-t border-steel-100">
          Menampilkan {filtered.length} dari {reports.length} laporan
        </div>
      </div>
    </div>
  );
}
