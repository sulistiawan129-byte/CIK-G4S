"use client";
import MasterTabs from "@/components/gc/MasterTabs";

import { useEffect, useMemo, useState } from "react";
import { Plus, Truck, Search, Power, Package, Check, Pencil } from "lucide-react";
import { fetchSuppliers, createSupplier, toggleSupplierActive, updateSupplierMaterial, fetchReports } from "@/lib/gc/data";
import type { Supplier, NcReportRow } from "@/lib/gc/types";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [reports, setReports] = useState<NcReportRow[]>([]);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newMaterial, setNewMaterial] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([fetchSuppliers(), fetchReports()]);
      setSuppliers(s);
      setReports(r);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const ncCountBySupplier = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach((r) => (counts[r.nama_supplier] = (counts[r.nama_supplier] ?? 0) + 1));
    return counts;
  }, [reports]);

  const filtered = suppliers.filter(
    (s) => s.name.toLowerCase().includes(search.toLowerCase()) || (s.jenis_material ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await createSupplier(newName.trim(), newMaterial.trim());
      setNewName("");
      setNewMaterial("");
      load();
    } catch (err) {
      alert("Gagal menambahkan supplier. Nama mungkin sudah ada.");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(s: Supplier) {
    setSuppliers((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: !x.is_active } : x)));
    try {
      await toggleSupplierActive(s.id, !s.is_active);
    } catch {
      load();
    }
  }

  function startEdit(s: Supplier) {
    setEditingId(s.id);
    setEditValue(s.jenis_material ?? "");
  }

  async function saveMaterial(id: string) {
    setSaving(true);
    try {
      await updateSupplierMaterial(id, editValue.trim());
      setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, jenis_material: editValue.trim() || null } : s)));
      setEditingId(null);
    } catch {
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <MasterTabs />
      <div className="card p-5 sm:p-6">
        <h3 className="font-display font-bold text-ink-900 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-brand-500" /> Tambah Supplier Baru
        </h3>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nama PT / supplier transporter..."
            className="flex-1 border border-steel-100 rounded-lg px-4 py-2.5 text-sm focus:border-brand-500 outline-none"
          />
          <input
            value={newMaterial}
            onChange={(e) => setNewMaterial(e.target.value)}
            placeholder="Jenis material yang biasa dibawa (opsional)..."
            className="flex-1 border border-steel-100 rounded-lg px-4 py-2.5 text-sm focus:border-brand-500 outline-none"
          />
          <button
            type="submit"
            disabled={adding}
            className="flex items-center justify-center gap-2 bg-ink-900 hover:bg-ink-800 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> {adding ? "Menyimpan..." : "Tambah Supplier"}
          </button>
        </form>
        <p className="text-[11px] text-steel-500 mt-2 ml-1">
          Nama yang diawali "PT" akan otomatis dirapikan jadi "PT." (bertitik) oleh sistem.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-steel-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari supplier atau jenis material..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-steel-100 bg-white text-sm focus:border-brand-500 outline-none"
            />
          </div>
          <span className="text-xs text-steel-500 ml-auto">{filtered.length} supplier</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-steel-500 bg-steel-50/60 border-b border-steel-100">
                <th className="py-3 px-4 font-semibold">Nama Supplier</th>
                <th className="py-3 px-4 font-semibold">Jenis Material (Default)</th>
                <th className="py-3 px-4 font-semibold text-center">Total Pelanggaran</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-steel-50 table-row-hover">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-ink-900/[0.05] flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4 text-ink-700" />
                      </div>
                      <span className="font-medium text-ink-900">{s.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {editingId === s.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveMaterial(s.id)}
                          placeholder="mis. Bahan Kimia Cair"
                          className="text-xs border border-brand-500 rounded-md px-2 py-1.5 outline-none w-full max-w-[200px]"
                        />
                        <button onClick={() => saveMaterial(s.id)} disabled={saving} className="text-clear-600 hover:text-clear-700 shrink-0">
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(s)} className="group flex items-center gap-1.5 text-left">
                        {s.jenis_material ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-brand-50 text-brand-600 border border-brand-500/20">
                            <Package className="w-3 h-3" /> {s.jenis_material}
                          </span>
                        ) : (
                          <span className="text-xs text-steel-400 italic">Belum diisi</span>
                        )}
                        <Pencil className="w-3 h-3 text-steel-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-semibold">
                    {ncCountBySupplier[s.name] ?? 0}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        s.is_active ? "bg-clear-50 text-clear-600" : "bg-steel-100 text-steel-500"
                      }`}
                    >
                      {s.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleToggle(s)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-steel-500 hover:text-ink-900 border border-steel-100 rounded-lg px-3 py-1.5"
                    >
                      <Power className="w-3.5 h-3.5" /> {s.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-steel-400 text-sm">
                    Belum ada supplier terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
