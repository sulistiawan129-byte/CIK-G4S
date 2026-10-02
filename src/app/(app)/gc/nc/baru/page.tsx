"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, TriangleAlert, Loader2, Package } from "lucide-react";
import { fetchSuppliers, fetchDestinations, fetchCategories, createReport } from "@/lib/gc/data";
import { PLANTS, IDENTITAS_OPTIONS } from "@/lib/gc/constants";
import type { Supplier, Destination, NcCategory } from "@/lib/gc/types";
import SearchableSelect from "@/components/gc/SearchableSelect";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function NewNcPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [categories, setCategories] = useState<NcCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    plant: "Cikarang",
    tanggal: todayISO(),
    supplier_id: "",
    no_polisi: "",
    nama_petugas: "",
    jenis_identitas: "SIM",
    nomor_identitas: "",
    status: "Reject",
    tujuan_id: "",
    catatan: "",
  });
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

  useEffect(() => {
    fetchSuppliers().then(setSuppliers).catch(() => {});
    fetchDestinations().then(setDestinations).catch(() => {});
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  function toggleCategory(id: number) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.supplier_id) return setError("Pilih nama supplier terlebih dahulu.");
    if (!form.no_polisi.trim()) return setError("Nomor polisi wajib diisi.");
    if (!form.nama_petugas.trim()) return setError("Nama supir/kernet wajib diisi.");
    if (!form.nomor_identitas.trim()) return setError("Nomor identitas wajib diisi.");
    if (selectedCategories.length === 0)
      return setError("Pilih minimal satu jenis pelanggaran (temuan).");

    setSubmitting(true);
    try {
      await createReport({ ...form, tujuan_id: form.tujuan_id || null, category_ids: selectedCategories });
      setSuccess(true);
      setTimeout(() => router.push(window.location.pathname.startsWith("/pos") ? "/pos/nc-hari-ini" : "/gc/laporan"), 1200);
    } catch (err: any) {
      setError(err.message ?? "Gagal menyimpan laporan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-up">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Plant & tanggal */}
        <div className="card p-5 sm:p-6">
          <h3 className="font-display font-bold text-ink-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-brand-500 text-ink-900 text-xs font-bold flex items-center justify-center">1</span>
            Lokasi &amp; Waktu Pemeriksaan
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Plant" required>
              <select
                value={form.plant}
                onChange={(e) => setForm((f) => ({ ...f, plant: e.target.value }))}
                className="input"
              >
                {PLANTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Tanggal Pemeriksaan" required>
              <input
                type="date"
                value={form.tanggal}
                onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
                className="input"
              />
            </Field>
          </div>
        </div>

        {/* Supplier & kendaraan */}
        <div className="card p-5 sm:p-6">
          <h3 className="font-display font-bold text-ink-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-brand-500 text-ink-900 text-xs font-bold flex items-center justify-center">2</span>
            Data Supplier &amp; Kendaraan
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nama Supplier" required>
              <SearchableSelect
                value={form.supplier_id}
                onChange={(v) => setForm((f) => ({ ...f, supplier_id: v }))}
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Ketik untuk cari supplier..."
              />
              {(() => {
                const selectedSupplier = suppliers.find((s) => s.id === form.supplier_id);
                return selectedSupplier?.jenis_material ? (
                  <p className="text-[11px] text-steel-500 mt-1.5 flex items-center gap-1">
                    <Package className="w-3 h-3 text-brand-500" /> Jenis material biasanya: <b>{selectedSupplier.jenis_material}</b>
                  </p>
                ) : null;
              })()}
            </Field>
            <Field label="Nomor Polisi" required>
              <input
                value={form.no_polisi}
                onChange={(e) => setForm((f) => ({ ...f, no_polisi: e.target.value }))}
                placeholder="B 1234 XYZ"
                className="input font-mono uppercase"
              />
            </Field>
          </div>
        </div>

        {/* Petugas */}
        <div className="card p-5 sm:p-6">
          <h3 className="font-display font-bold text-ink-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-brand-500 text-ink-900 text-xs font-bold flex items-center justify-center">3</span>
            Identitas Supir / Kernet
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Nama Supir / Kernet" required className="sm:col-span-1">
              <input
                value={form.nama_petugas}
                onChange={(e) => setForm((f) => ({ ...f, nama_petugas: e.target.value }))}
                placeholder="Nama lengkap"
                className="input"
              />
            </Field>
            <Field label="Jenis Identitas" required>
              <select
                value={form.jenis_identitas}
                onChange={(e) => setForm((f) => ({ ...f, jenis_identitas: e.target.value }))}
                className="input"
              >
                {IDENTITAS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Nomor Identitas" required>
              <input
                value={form.nomor_identitas}
                onChange={(e) => setForm((f) => ({ ...f, nomor_identitas: e.target.value }))}
                placeholder="Nomor SIM / KTP"
                className="input font-mono"
              />
            </Field>
          </div>
        </div>

        {/* Temuan */}
        <div className="card p-5 sm:p-6">
          <h3 className="font-display font-bold text-ink-900 mb-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-brand-500 text-ink-900 text-xs font-bold flex items-center justify-center">4</span>
            Jenis Pelanggaran (Temuan)
          </h3>
          <p className="text-xs text-steel-500 mb-4 ml-8">Pilih satu atau lebih temuan yang ditemukan di lapangan.</p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {categories.map((c) => {
              const checked = selectedCategories.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                    checked ? "border-brand-500 bg-brand-50" : "border-steel-100 hover:bg-steel-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(c.id)}
                    className="w-4 h-4 accent-brand-500"
                  />
                  <span className="text-sm font-medium text-ink-900">{c.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Status & catatan */}
        <div className="card p-5 sm:p-6">
          <h3 className="font-display font-bold text-ink-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-brand-500 text-ink-900 text-xs font-bold flex items-center justify-center">5</span>
            Keputusan, Tujuan &amp; Keterangan
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Status" required>
              <div className="flex gap-2">
                {["Accept", "Reject"].map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setForm((f) => ({ ...f, status: s }))}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition ${
                      form.status === s
                        ? s === "Accept"
                          ? "bg-clear-500 border-clear-500 text-white"
                          : "bg-alert-500 border-alert-500 text-white"
                        : "border-steel-100 text-steel-600 hover:bg-steel-50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-steel-500 mt-1.5 leading-relaxed">
                <b>Accept</b>: tetap ada temuan, tapi kendaraan diizinkan masuk. <b>Reject</b>: kendaraan tidak
                diizinkan masuk sama sekali.
              </p>
            </Field>
            <Field label="Tujuan">
              <SearchableSelect
                value={form.tujuan_id}
                onChange={(v) => setForm((f) => ({ ...f, tujuan_id: v }))}
                options={destinations.map((d) => ({ value: d.id, label: d.name }))}
                placeholder="Ketik untuk cari tujuan..."
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Keterangan (opsional)">
              <input
                value={form.catatan}
                onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))}
                placeholder="Keterangan tambahan..."
                className="input"
              />
            </Field>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-alert-600 text-sm font-medium bg-alert-50 border border-alert-500/20 rounded-xl px-4 py-3">
            <TriangleAlert className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-clear-600 text-sm font-medium bg-clear-50 border border-clear-500/20 rounded-xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Laporan Pelanggaran berhasil disimpan. Mengalihkan...
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-ink-900 hover:bg-ink-800 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? "Menyimpan..." : "Simpan Laporan Pelanggaran"}
        </button>
      </form>

    </div>
  );
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-steel-700 mb-1.5">
        {label} {required && <span className="text-alert-500">*</span>}
      </label>
      {children}
    </div>
  );
}
