"use client";
/* RIWAYAT 12 BULAN — isi total bulanan untuk bulan-bulan lama (sebelum data harian dipakai).
   Dipakai grafik tren 13 bulan di dashboard, laporan bulanan, dan Laporan Manajemen CIKOPS. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppContext";
import { Loading } from "@/components/ui";
import { MON_EN, fmt } from "@/lib/constants";
import { addMonths, parseMonth } from "@/lib/dates";
import { debounced } from "@/lib/data";
import { FROM_DAILY, HIST_CATS, loadHistory, saveHistory, type HistKey, type HistMap } from "@/lib/history";
import "./riwayat.css";

const MON_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const label = (m: string) => { const { y, m0 } = parseMonth(m); return `${MON_ID[m0]} ${y}`; };

/** Tempel dari Excel: "2026-03<TAB>angka<TAB>angka…" sesuai urutan kolom tabel. Mengembalikan baris yang dikenali. */
function parsePaste(text: string): { month: string; vals: (number | null)[] }[] {
  return text.split(/\r?\n/).map((ln) => ln.trim()).filter(Boolean).flatMap((ln) => {
    const cells = ln.split(/\t|;|,(?=\s*\d|\s*$)/).map((c) => c.trim());
    const m = cells[0].match(/^(\d{4})[-/](\d{1,2})$/) ?? cells[0].match(/^(\d{1,2})[-/](\d{4})$/);
    if (!m) return [];
    const [y, mo] = m[1].length === 4 ? [m[1], m[2]] : [m[2], m[1]];
    const vals = HIST_CATS.map((_, i) => { const raw = (cells[i + 1] ?? "").replace(/[.\s]/g, ""); return raw === "" ? null : Number.isFinite(Number(raw)) ? Number(raw) : null; });
    return [{ month: `${y}-${String(Number(mo)).padStart(2, "0")}-01`, vals }];
  });
}

export default function Riwayat() {
  const { D, siteId, canWrite, toast, fail } = useApp();
  const [data, setData] = useState<{ base: HistMap; daily: HistMap } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const months = useMemo(() => (D ? Array.from({ length: 12 }, (_, i) => addMonths(D.month, -(i + 1))) : []), [D]);   // 12 bulan sebelum bulan terpilih, terbaru dulu
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const reload = useCallback(async () => {
    if (!siteId || !months.length) return;
    try { const r = await loadHistory(siteId, months); if (alive.current) { setData(r); setErr(null); } }
    catch (e) { if (alive.current) setErr(e instanceof Error ? e.message : String(e)); }
  }, [siteId, months]);
  useEffect(() => { reload(); }, [reload]);

  if (!D || !siteId) return <Loading error={null} />;
  if (err) return <Loading error={err} />;
  if (!data) return <Loading error={null} />;

  const fromDaily = (m: string, k: HistKey) => FROM_DAILY.includes(k) && data.daily[m]?.[k] !== undefined;
  const shown = (m: string, k: HistKey) => (fromDaily(m, k) ? data.daily[m]?.[k] : data.base[m]?.[k]);

  function change(m: string, k: HistKey, raw: string) {
    const key = `${m}|${k}`, clean = raw.replace(/[^\d]/g, "");
    setDraft((p) => ({ ...p, [key]: clean }));
    debounced(`hist:${key}`, async () => {
      await saveHistory(siteId!, m, k, clean === "" ? null : Number(clean));
      setData((p) => { if (!p) return p; const b = { ...p.base, [m]: { ...p.base[m] } }; if (clean === "") delete b[m][k]; else b[m][k] = Number(clean); return { ...p, base: b }; });
      setDraft((p) => { const n = { ...p }; delete n[key]; return n; });
    }, 500, fail);
  }

  async function applyPaste() {
    const rows = parsePaste(paste).filter((r) => months.includes(r.month));
    if (!rows.length) { fail(new Error("Tidak ada baris yang cocok. Format: 2026-03 [tab] angka [tab] angka … (12 bulan terakhir saja).")); return; }
    let n = 0;
    try {
      for (const r of rows) for (let i = 0; i < HIST_CATS.length; i++) {
        const k = HIST_CATS[i].k, v = r.vals[i];
        if (v === null || fromDaily(r.month, k)) continue;
        await saveHistory(siteId!, r.month, k, v); n++;
      }
      toast(`${n} angka riwayat tersimpan`); setPaste(""); setShowPaste(false); await reload();
    } catch (e) { fail(e as Error); }
  }

  const filled = months.filter((m) => HIST_CATS.some((c) => shown(m, c.k) !== undefined)).length;

  return (
    <div className="page enter">
      <section>
        <div className="eyebrow">Riwayat 12 bulan</div>
        <h1>{filled} dari 12 bulan sudah terisi</h1>
        <p className="lede">Isi total bulanan untuk bulan yang belum memakai data harian. Angka ini dipakai grafik tren 13 bulan dan laporan (Security Desk maupun Laporan Manajemen CIKOPS). Bulan yang sudah punya data harian terisi otomatis dan tidak bisa diubah di sini.</p>
        {!canWrite && <p className="readonly-note" style={{ marginTop: 14 }}>Akun ini hanya bisa melihat data.</p>}
      </section>

      <fieldset className="sec ro" disabled={!canWrite}>
        <div className="hist-bar">
          <button type="button" className="btn q sm" onClick={() => setShowPaste((v) => !v)}>{showPaste ? "Tutup" : "Tempel dari Excel"}</button>
          <small>Bulan terpilih: {label(D.month)} · menampilkan 12 bulan sebelumnya</small>
        </div>
        {showPaste && (
          <div className="hist-paste">
            <p>Satu baris per bulan: <code>2026-03</code> lalu angka sesuai urutan kolom ({HIST_CATS.map((c) => c.n).join(", ")}), dipisah tab (salin langsung dari Excel). Kolom kosong dilewati.</p>
            <textarea className="g-in" rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={`2026-03\t5200\t800\t900\t6100\t240`} />
            <button type="button" className="btn red sm" onClick={applyPaste} disabled={!paste.trim()}>Simpan angka yang ditempel</button>
          </div>
        )}
        <div className="hist-wrap">
          <table className="hist">
            <thead><tr><th>Bulan</th>{HIST_CATS.map((c) => <th key={c.k}>{c.n}</th>)}</tr></thead>
            <tbody>
              {months.map((m) => (
                <tr key={m}>
                  <th scope="row">{label(m)}</th>
                  {HIST_CATS.map((c) => {
                    const ro = fromDaily(m, c.k), key = `${m}|${c.k}`;
                    const v = key in draft ? draft[key] : shown(m, c.k) === undefined ? "" : String(shown(m, c.k));
                    return (
                      <td key={c.k} className={ro ? "auto" : ""}>
                        <input className="g-in" inputMode="numeric" value={ro ? fmt(Number(v)) : v} disabled={ro || !canWrite} aria-label={`${c.n} ${label(m)}`} title={ro ? "Terisi otomatis dari data harian" : undefined}
                          onChange={(e) => change(m, c.k, e.target.value)} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hist-note">Kolom Transporter timbang/non-timbang, Biomas, Pelanggaran, dan Kejadian membutuhkan <code>supabase/lengkapi_security.sql</code> (sekali di Supabase SQL Editor). Bulan {MON_EN[parseMonth(D.month).m0]} berjalan memakai data harian.</p>
      </fieldset>
    </div>
  );
}
