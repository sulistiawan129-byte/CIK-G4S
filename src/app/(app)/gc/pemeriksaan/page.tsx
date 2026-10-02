"use client";
import { useGcPerm } from "@/components/gc/GcPerm";

import { useEffect, useState } from "react";
import { CalendarCheck, Plus, Trash2, Info } from "lucide-react";
import { fetchPemeriksaan, createPemeriksaan, deletePemeriksaan } from "@/lib/gc/data";
import { PLANTS } from "@/lib/gc/constants";
import type { PemeriksaanHarian } from "@/lib/gc/types";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function PemeriksaanPage() {
  const perm = useGcPerm();
  const [rows, setRows] = useState<PemeriksaanHarian[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    plant: "Cikarang",
    tanggal: todayISO(),
    jumlah_kendaraan: "",
    catatan: "",
  });

  async function load() {
    setLoading(true);
    try {
      setRows(await fetchPemeriksaan());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const jumlah = parseInt(form.jumlah_kendaraan, 10);
    if (!form.jumlah_kendaraan || isNaN(jumlah) || jumlah < 0) {
      setError("Jumlah kendaraan harus diisi dengan angka valid.");
      return;
    }
    setSubmitting(true);
    try {
      await createPemeriksaan({
        plant: form.plant,
        tanggal: form.tanggal,
        jumlah_kendaraan: jumlah,
        catatan: form.catatan || undefined,
      });
      setForm((f) => ({ ...f, jumlah_kendaraan: "", catatan: "" }));
      load();
    } catch (err: any) {
      setError(err.message ?? "Gagal menyimpan data.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus data pemeriksaan ini?")) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    try {
      await deletePemeriksaan(id);
    } catch {
      load();
    }
  }

  const totalKendaraan = rows.reduce((a, r) => a + r.jumlah_kendaraan, 0);
  const totalHari = new Set(rows.map((r) => r.tanggal)).size;

  return (
    <div className="space-y-5 animate-fade-up max-w-3xl mx-auto">
      <div className="flex items-start gap-3 rounded-xl border border-brand-500/20 bg-brand-50 px-4 py-3">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-brand-600" />
        <p className="text-xs text-ink-900 leading-relaxed">
          Data ini dipakai untuk menghitung <b>Tingkat Pelanggaran Sebenarnya</b> (Total Pelanggaran ÷ Total Kendaraan Diperiksa) di
          Dashboard. Hari yang ada data <b>Gate In</b> dihitung otomatis (ditandai "Otomatis dari Gate In").
          Input manual di sini hanya untuk hari tanpa data gate, atau untuk mengoreksi; kalau tanggal itu diisi manual, angka manual yang dipakai.
        </p>
      </div>

      <div className="card p-5 sm:p-6">
        <h3 className="font-display font-bold text-ink-900 mb-4 flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-brand-500" /> Input Rekap Harian
        </h3>
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-4 gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-steel-700">Plant</label>
            <select
              value={form.plant}
              onChange={(e) => setForm((f) => ({ ...f, plant: e.target.value }))}
              className="input"
            >
              {PLANTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-steel-700">Tanggal</label>
            <input
              type="date"
              value={form.tanggal}
              onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
              className="input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-steel-700">Jumlah Kendaraan Diperiksa</label>
            <input
              type="number"
              min={0}
              value={form.jumlah_kendaraan}
              onChange={(e) => setForm((f) => ({ ...f, jumlah_kendaraan: e.target.value }))}
              placeholder="mis. 85"
              className="input"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 bg-ink-900 hover:bg-ink-800 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl h-[42px]"
          >
            <Plus className="w-4 h-4" /> {submitting ? "Menyimpan..." : "Simpan"}
          </button>
        </form>
        {error && <p className="text-alert-600 text-xs font-medium mt-3">{error}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide">Total Kendaraan Diperiksa</p>
          <p className="font-display font-bold text-3xl text-ink-900 mt-2">{totalKendaraan.toLocaleString("id-ID")}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold text-steel-500 uppercase tracking-wide">Jumlah Hari Tercatat</p>
          <p className="font-display font-bold text-3xl text-ink-900 mt-2">{totalHari}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-steel-100">
          <h3 className="font-display font-bold text-ink-900">Riwayat Input</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-steel-500 bg-steel-50/60 border-b border-steel-100">
                <th className="py-3 px-4 font-semibold">Tanggal</th>
                <th className="py-3 px-4 font-semibold">Plant</th>
                <th className="py-3 px-4 font-semibold text-center">Jumlah Kendaraan</th>
                <th className="py-3 px-4 font-semibold">Catatan</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-steel-50 table-row-hover">
                  <td className="py-3 px-4 font-mono text-xs text-steel-700">{r.tanggal}</td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-ink-900 text-white">{r.plant}</span>
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-semibold">{r.jumlah_kendaraan}</td>
                  <td className="py-3 px-4 text-xs text-steel-500">{r.catatan ?? "—"}</td>
                  <td className="py-3 px-4 text-right">
                    {perm.edit && !r.auto && <button
                      onClick={() => handleDelete(r.id)}
                      className="text-steel-400 hover:text-alert-600 p-1.5 rounded-md hover:bg-alert-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-steel-400 text-sm">
                    Belum ada data pemeriksaan.
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
