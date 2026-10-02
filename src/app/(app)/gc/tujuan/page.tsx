"use client";
import MasterTabs from "@/components/gc/MasterTabs";

import { useEffect, useState } from "react";
import { Plus, MapPin, Search, Power } from "lucide-react";
import { fetchDestinations, createDestination, toggleDestinationActive } from "@/lib/gc/data";
import type { Destination } from "@/lib/gc/types";

export default function TujuanPage() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setDestinations(await fetchDestinations());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = destinations.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await createDestination(newName.trim());
      setNewName("");
      load();
    } catch {
      alert("Gagal menambahkan tujuan. Nama mungkin sudah ada.");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(d: Destination) {
    setDestinations((prev) => prev.map((x) => (x.id === d.id ? { ...x, is_active: !x.is_active } : x)));
    try {
      await toggleDestinationActive(d.id, !d.is_active);
    } catch {
      load();
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <MasterTabs />
      <div className="card p-5 sm:p-6">
        <h3 className="font-display font-bold text-ink-900 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-brand-500" /> Tambah Tujuan Baru
        </h3>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nama tujuan / lokasi, mis. Gudang A, Loading Dock 2..."
            className="flex-1 border border-steel-100 rounded-lg px-4 py-2.5 text-sm focus:border-brand-500 outline-none"
          />
          <button
            type="submit"
            disabled={adding}
            className="flex items-center justify-center gap-2 bg-ink-900 hover:bg-ink-800 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg"
          >
            <Plus className="w-4 h-4" /> {adding ? "Menyimpan..." : "Tambah Tujuan"}
          </button>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-steel-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari tujuan..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-steel-100 bg-white text-sm focus:border-brand-500 outline-none"
            />
          </div>
          <span className="text-xs text-steel-500 ml-auto">{filtered.length} tujuan</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-steel-500 bg-steel-50/60 border-b border-steel-100">
                <th className="py-3 px-4 font-semibold">Nama Tujuan</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-steel-50 table-row-hover">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-ink-900/[0.05] flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-ink-700" />
                      </div>
                      <span className="font-medium text-ink-900">{d.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        d.is_active ? "bg-clear-50 text-clear-600" : "bg-steel-100 text-steel-500"
                      }`}
                    >
                      {d.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleToggle(d)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-steel-500 hover:text-ink-900 border border-steel-100 rounded-lg px-3 py-1.5"
                    >
                      <Power className="w-3.5 h-3.5" /> {d.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="py-14 text-center text-steel-400 text-sm">
                    Belum ada tujuan terdaftar.
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
