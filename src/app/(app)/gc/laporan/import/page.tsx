"use client";

import { useMemo, useRef, useState } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { fetchSuppliers, fetchDestinations, fetchCategories, createSupplier, createDestination, createReport } from "@/lib/gc/data";
import { NC_CATEGORIES, PLANTS, IDENTITAS_OPTIONS, STATUS_OPTIONS } from "@/lib/gc/constants";
import type { Supplier, Destination, NcCategory } from "@/lib/gc/types";

interface ParsedRow {
  rowNumber: number;
  plant: string;
  tanggal: string;
  nama_supplier: string;
  no_polisi: string;
  nama_petugas: string;
  jenis_identitas: string;
  nomor_identitas: string;
  status: string;
  catatan: string;
  tujuan: string;
  temuan_names: string[];
  errors: string[];
  supplierExists: boolean;
  destinationExists: boolean;
}

function normalizeKey(s: string) {
  return s.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

const FIELD_KEYS: Record<string, string> = {
  plant: "plant",
  tanggal: "tanggal",
  namasupplier: "nama_supplier",
  supplier: "nama_supplier",
  nopolisi: "no_polisi",
  nomorpolisi: "no_polisi",
  platnomor: "no_polisi",
  namasupirkernet: "nama_petugas",
  namasupir: "nama_petugas",
  namakernet: "nama_petugas",
  namapetugas: "nama_petugas",
  jenisidentitas: "jenis_identitas",
  nomoridentitas: "nomor_identitas",
  status: "status",
  catatan: "catatan",
  keterangan: "catatan",
  tujuan: "tujuan",
};

// Kolom yang sengaja diabaikan dari format laporan lama (belum didukung sistem baru)
const IGNORED_KEYS = new Set(["foto", "foto2", "foto3", "foto4"]);

function parseExcelDate(value: any): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    // Excel serial date
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const str = value.toString().trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) return str;
  return str;
}

function matchCategory(raw: string, categories: NcCategory[]): NcCategory | null {
  const norm = normalizeKey(raw);
  return categories.find((c) => normalizeKey(c.name) === norm) ?? null;
}

export default function ImportNcPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [categories, setCategories] = useState<NcCategory[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [autoCreateSupplier, setAutoCreateSupplier] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<{ success: number; failed: number } | null>(null);
  const [fileName, setFileName] = useState("");

  const validCount = useMemo(() => rows.filter((r) => r.errors.length === 0).length, [rows]);
  const errorCount = rows.length - validCount;

  async function ensureMasterData() {
    const [s, c, d] = await Promise.all([fetchSuppliers(), fetchCategories(), fetchDestinations()]);
    setSuppliers(s);
    setCategories(c);
    setDestinations(d);
    return { s, c, d };
  }

  async function handleDownloadTemplate() {
    const XLSX = await import("xlsx");
    const header = [
      "PLANT",
      "TANGGAL",
      "NAMA SUPPLIER",
      "NO POLISI",
      "NAMA SUPIR / KERNET",
      "JENIS IDENTITAS",
      "TEMUAN",
      "TEMUAN2",
      "TEMUAN 3",
      "TEMUAN 4",
      "TOTAL TEMUAN",
      "FOTO",
      "FOTO2",
      "FOTO3",
      "FOTO4",
      "TUJUAN",
      "KETERANGAN",
      "STATUS ( Accept / Reject )",
    ];
    const example = [
      "Cikarang",
      "2026-01-15",
      "PT Trans Jaya Logistik",
      "B 1234 XYZ",
      "Budi Santoso",
      "SIM",
      "Tidak Pakai Sepatu Safety",
      "Tidak Pakai Rompi",
      "",
      "",
      2,
      "",
      "",
      "",
      "",
      "Gudang B",
      "Contoh baris — silakan hapus",
      "Reject",
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Import Pelanggaran");
    XLSX.writeFile(wb, "CIKOPS-GC_Template_Import_NC.xlsx");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setDone(null);
    setParsing(true);
    try {
      const { s: supplierList, c: categoryList, d: destinationList } = await ensureMasterData();
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const parsed: ParsedRow[] = json.map((raw, idx) => {
        const fields: Record<string, string> = {};
        const temuanValues: string[] = [];

        Object.entries(raw).forEach(([key, val]) => {
          const norm = normalizeKey(key);
          if (norm === "totaltemuan") return;
          if (IGNORED_KEYS.has(norm)) return;
          if (norm.startsWith("temuan")) {
            String(val)
              .split(/[,;/]/)
              .map((x) => x.trim())
              .filter(Boolean)
              .forEach((t) => temuanValues.push(t));
            return;
          }
          if (norm === "tanggal") {
            fields["tanggal"] = parseExcelDate(val);
            return;
          }
          if (norm.startsWith("status")) {
            fields["status"] = String(val).trim();
            return;
          }
          const mapped = FIELD_KEYS[norm];
          if (mapped) fields[mapped] = String(val).trim();
        });

        const errors: string[] = [];
        if (!fields.plant || !PLANTS.includes(fields.plant as any))
          errors.push(`Plant tidak valid ("${fields.plant || "-"}"). Harus: ${PLANTS.join(" / ")}`);
        if (!fields.tanggal) errors.push("Tanggal kosong / format tidak dikenali");
        if (!fields.nama_supplier) errors.push("Nama supplier kosong");
        if (!fields.no_polisi) errors.push("No. Polisi kosong");
        if (!fields.nama_petugas) errors.push("Nama supir/kernet kosong");
        if (!fields.jenis_identitas || !IDENTITAS_OPTIONS.includes(fields.jenis_identitas as any))
          errors.push(`Jenis identitas harus SIM/KTP`);
        // Nomor Identitas bersifat opsional — laporan lama umumnya tidak mencatatnya.
        if (!fields.status || !STATUS_OPTIONS.includes(fields.status as any))
          errors.push(`Status harus Accept/Reject`);

        const matchedNames: string[] = [];
        temuanValues.forEach((t) => {
          const m = matchCategory(t, categoryList);
          if (m) matchedNames.push(m.name);
          else errors.push(`Temuan tidak dikenali: "${t}"`);
        });
        if (matchedNames.length === 0) errors.push("Minimal harus ada 1 temuan yang valid");

        const supplierExists = supplierList.some(
          (s) => normalizeKey(s.name) === normalizeKey(fields.nama_supplier || "")
        );
        const destinationExists = fields.tujuan
          ? destinationList.some((d) => normalizeKey(d.name) === normalizeKey(fields.tujuan))
          : true;

        return {
          rowNumber: idx + 2, // +2 = header row + 1-index
          plant: fields.plant || "",
          tanggal: fields.tanggal || "",
          nama_supplier: fields.nama_supplier || "",
          no_polisi: fields.no_polisi || "",
          nama_petugas: fields.nama_petugas || "",
          jenis_identitas: fields.jenis_identitas || "",
          nomor_identitas: fields.nomor_identitas || "",
          status: fields.status || "",
          catatan: fields.catatan || "",
          tujuan: fields.tujuan || "",
          temuan_names: matchedNames,
          errors,
          supplierExists,
          destinationExists,
        };
      });

      setRows(parsed);
    } catch (err) {
      alert("Gagal membaca file. Pastikan format .xlsx / .csv sesuai template.");
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleImport() {
    setImporting(true);
    setProgress(0);
    let success = 0;
    let failed = 0;

    const supplierMap = new Map(suppliers.map((s) => [normalizeKey(s.name), s.id]));
    const destinationMap = new Map(destinations.map((d) => [normalizeKey(d.name), d.id]));
    const categoryMap = new Map(categories.map((c) => [c.name, c.id]));
    const validRows = rows.filter((r) => r.errors.length === 0);

    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      try {
        let supplierId = supplierMap.get(normalizeKey(r.nama_supplier));
        if (!supplierId) {
          if (!autoCreateSupplier) throw new Error("Supplier belum terdaftar");
          const created = await createSupplier(r.nama_supplier.trim());
          supplierId = created.id;
          supplierMap.set(normalizeKey(r.nama_supplier), created.id);
        }

        let destinationId: string | null = null;
        if (r.tujuan.trim()) {
          destinationId = destinationMap.get(normalizeKey(r.tujuan)) ?? null;
          if (!destinationId) {
            const createdDest = await createDestination(r.tujuan.trim());
            destinationId = createdDest.id;
            destinationMap.set(normalizeKey(r.tujuan), createdDest.id);
          }
        }

        const categoryIds = r.temuan_names
          .map((n) => categoryMap.get(n))
          .filter((x): x is number => !!x);

        await createReport({
          plant: r.plant,
          tanggal: r.tanggal,
          supplier_id: supplierId,
          no_polisi: r.no_polisi,
          nama_petugas: r.nama_petugas,
          jenis_identitas: r.jenis_identitas,
          nomor_identitas: r.nomor_identitas,
          status: r.status,
          tujuan_id: destinationId,
          catatan: r.catatan,
          category_ids: categoryIds,
        });
        success++;
      } catch {
        failed++;
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setDone({ success, failed });
    setImporting(false);
  }

  return (
    <div className="space-y-5 animate-fade-up max-w-5xl mx-auto">
      {/* Step 1 */}
      <div className="card p-5 sm:p-6">
        <h3 className="font-display font-bold text-ink-900 mb-2 flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-brand-500 text-ink-900 text-xs font-bold flex items-center justify-center">1</span>
          Unduh Template
        </h3>
        <p className="text-sm text-steel-500 mb-4 ml-8">
          Gunakan template ini agar kolom terbaca otomatis oleh sistem. Kolom TEMUAN boleh lebih dari satu
          (TEMUAN, TEMUAN2, TEMUAN3, TEMUAN4) — sesuai format laporan lama Anda.
        </p>
        <button
          onClick={handleDownloadTemplate}
          className="ml-8 flex items-center gap-2 text-sm font-semibold text-ink-900 border border-steel-100 rounded-lg px-4 py-2.5 hover:bg-steel-50"
        >
          <Download className="w-4 h-4" /> Download Template Excel
        </button>
      </div>

      {/* Step 2 */}
      <div className="card p-5 sm:p-6">
        <h3 className="font-display font-bold text-ink-900 mb-2 flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-brand-500 text-ink-900 text-xs font-bold flex items-center justify-center">2</span>
          Upload Data Laporan Lama
        </h3>
        <p className="text-sm text-steel-500 mb-4 ml-8">
          Format .xlsx, .xls, atau .csv. File Anda tidak harus memakai template — sistem akan mencoba
          mengenali nama kolom yang mirip (mis. "No Polisi", "Nomor Polisi", "Plat Nomor").
        </p>

        <label className="ml-8 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-steel-100 hover:border-brand-400 rounded-xl py-10 cursor-pointer transition-colors bg-steel-50/40">
          <UploadCloud className="w-8 h-8 text-steel-400" />
          <span className="text-sm font-semibold text-ink-900">
            {parsing ? "Membaca file..." : "Klik untuk pilih file, atau seret ke sini"}
          </span>
          {fileName && <span className="text-xs text-steel-500">{fileName}</span>}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
        </label>

        <label className="ml-8 mt-4 flex items-center gap-2 text-sm text-steel-700">
          <input
            type="checkbox"
            checked={autoCreateSupplier}
            onChange={(e) => setAutoCreateSupplier(e.target.checked)}
            className="w-4 h-4 accent-brand-500"
          />
          Buat otomatis supplier baru yang belum terdaftar
        </label>
      </div>

      {/* Step 3: preview */}
      {rows.length > 0 && (
        <div className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-display font-bold text-ink-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-brand-500 text-ink-900 text-xs font-bold flex items-center justify-center">3</span>
              Pratinjau ({rows.length} baris)
            </h3>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-clear-600"><CheckCircle2 className="w-4 h-4" /> {validCount} valid</span>
              <span className="flex items-center gap-1.5 text-alert-600"><XCircle className="w-4 h-4" /> {errorCount} error</span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-steel-100 rounded-lg">
            <table className="w-full text-xs min-w-[900px]">
              <thead className="sticky top-0 bg-steel-50">
                <tr className="text-left uppercase tracking-wide text-steel-500">
                  <th className="py-2 px-3 font-semibold">#</th>
                  <th className="py-2 px-3 font-semibold">Supplier</th>
                  <th className="py-2 px-3 font-semibold">No Polisi</th>
                  <th className="py-2 px-3 font-semibold">Petugas</th>
                  <th className="py-2 px-3 font-semibold">Tujuan</th>
                  <th className="py-2 px-3 font-semibold">Temuan</th>
                  <th className="py-2 px-3 font-semibold">Status</th>
                  <th className="py-2 px-3 font-semibold">Ket.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowNumber} className={`border-t border-steel-50 ${r.errors.length ? "bg-alert-50/40" : ""}`}>
                    <td className="py-2 px-3 font-mono text-steel-400">{r.rowNumber}</td>
                    <td className="py-2 px-3">
                      {r.nama_supplier || "-"}
                      {r.nama_supplier && !r.supplierExists && (
                        <span className="ml-1.5 text-[10px] font-semibold text-brand-600">(baru)</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono">{r.no_polisi || "-"}</td>
                    <td className="py-2 px-3">{r.nama_petugas || "-"}</td>
                    <td className="py-2 px-3">
                      {r.tujuan || "—"}
                      {r.tujuan && !r.destinationExists && (
                        <span className="ml-1.5 text-[10px] font-semibold text-brand-600">(baru)</span>
                      )}
                    </td>
                    <td className="py-2 px-3">{r.temuan_names.join(", ") || "-"}</td>
                    <td className="py-2 px-3">{r.status || "-"}</td>
                    <td className="py-2 px-3">
                      {r.errors.length > 0 ? (
                        <span className="flex items-start gap-1 text-alert-600">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          {r.errors.join("; ")}
                        </span>
                      ) : (
                        <span className="text-clear-600">Siap diimpor</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {done ? (
            <div className="mt-5 flex items-center gap-2 text-sm font-medium bg-clear-50 text-clear-600 border border-clear-500/20 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Selesai: {done.success} laporan berhasil disimpan, {done.failed} gagal.{" "}
              <a href="/gc/laporan" className="underline font-semibold">Lihat di Laporan Pelanggaran →</a>
            </div>
          ) : (
            <button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="mt-5 w-full flex items-center justify-center gap-2 bg-ink-900 hover:bg-ink-800 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition"
            >
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              {importing
                ? `Mengimpor... ${progress}%`
                : `Impor ${validCount} Laporan Valid`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
