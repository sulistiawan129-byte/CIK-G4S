"use client";
/* GATE KENDARAAN PERUSAHAAN — dipakai petugas di /pos/kendaraan.
   Mencatat keluar/masuk mobil perusahaan (aset GA maupun non-aset, mis. mobil sales). Data disimpan di CIKOPS-FM lewat RPC publik
   (lihat src/lib/cikops/gate.ts), jadi Gate Log, Beranda, Command Center & laporan di CIKOPS langsung terisi. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppContext";
import { cikopsConfigured } from "@/lib/cikops/client";
import {
  closeLog, evOf, fmtDur, gateErr, listDrivers, listLogs, listVehicles, minsSince, openForVehicle, openManual, stampFor,
  wibDate, wibHHMM, type KDriver, type KLog, type KPlant, type KVehicle,
} from "@/lib/cikops/gate";
import "./kendaraan.css";

const MANUAL_ID = "__manual__";
const TUJUAN_DEFAULT = ["PLANT PRB", "BANK", "CUSTOMER", "BENGKEL / SERVIS", "KANTOR PUSAT"];
const up = (s: string) => s.toUpperCase();
const norm = (s: string) => s.replace(/[^A-Z0-9]/gi, "").toUpperCase();

export function KendaraanGate() {
  const { toast } = useApp();
  const [vehicles, setVehicles] = useState<KVehicle[]>([]);
  const [drivers, setDrivers] = useState<KDriver[]>([]);
  const [logs, setLogs] = useState<KLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tanggal, setTanggal] = useState(() => wibDate());
  const [plateQ, setPlateQ] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [manualVeh, setManualVeh] = useState<{ jenis: string; plant: KPlant } | null>(null);
  const [driverId, setDriverId] = useState("");
  const [driverMode, setDriverMode] = useState<"list" | "manual">("list");
  const [driverManual, setDriverManual] = useState("");
  const [autoDriver, setAutoDriver] = useState("");
  const [tujuan, setTujuan] = useState("");
  const [ket, setKet] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"active" | "done">("active");
  const [plantF, setPlantF] = useState<"all" | KPlant>("all");
  const [q, setQ] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const plateRef = useRef<HTMLInputElement>(null);
  const today = wibDate();

  const loadLogs = useCallback(async (silent = false) => {
    if (!cikopsConfigured()) return;
    try { setLogs(await listLogs(tanggal)); setError(""); }
    catch (e) { if (!silent) setError(gateErr(e)); }
    finally { setLoading(false); }
  }, [tanggal]);

  useEffect(() => {
    if (!cikopsConfigured()) { setLoading(false); return; }
    listVehicles().then(setVehicles).catch((e) => setError(gateErr(e)));
    listDrivers().then(setDrivers).catch(() => {});
  }, []);
  useEffect(() => { loadLogs(); const t = setInterval(() => loadLogs(true), 15000); return () => clearInterval(t); }, [loadLogs]);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!confirmId) return; const t = setTimeout(() => setConfirmId(null), 3500); return () => clearTimeout(t); }, [confirmId]);

  /* ── turunan ── */
  const active = useMemo(() => logs.filter((l) => l.status !== "DONE"), [logs]);
  const done = useMemo(() => logs.filter((l) => l.status === "DONE"), [logs]);
  const busy = useMemo(() => new Map(active.map((l) => [l.vehicleId, l])), [active]);
  const registered = vehicles.find((v) => v.id === vehicleId) ?? null;
  const plateClean = plateQ.trim().replace(/\s+/g, " ");
  const plateNorm = norm(plateClean);
  const plateValid = plateNorm.length >= 3 && /\d/.test(plateNorm) && /[A-Z]/.test(plateNorm);
  const exact = plateNorm ? vehicles.find((v) => norm(v.nopol) === plateNorm) ?? null : null;
  const selected: KVehicle | null = registered ?? (manualVeh && plateValid && !exact
    ? { id: MANUAL_ID, nopol: up(plateClean), jenis: manualVeh.jenis, plant: manualVeh.plant, color: "", kategori: "non_asset" } : null);
  const isManual = selected?.id === MANUAL_ID;
  const vList = useMemo(() => {
    const t = plateNorm.toLowerCase();
    return vehicles
      .filter((v) => !t || norm(v.nopol).toLowerCase().includes(t) || v.jenis.toLowerCase().includes(t))
      .sort((a, b) => Number(busy.has(a.id)) - Number(busy.has(b.id)) || a.plant.localeCompare(b.plant) || a.nopol.localeCompare(b.nopol));
  }, [vehicles, plateNorm, busy]);
  const driverOk = driverMode === "manual" ? driverManual.trim() !== "" : driverId !== "";
  const canSubmit = !!selected && driverOk && !submitting && !!tanggal && (!isManual || plateValid);
  const tujuanChips = useMemo(() => {
    const m = new Map<string, number>();
    logs.forEach((l) => { const k = up(l.tujuan.trim()); if (k) m.set(k, (m.get(k) ?? 0) + 1); });
    return [...new Set([...[...m.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]), ...TUJUAN_DEFAULT])].slice(0, 6);
  }, [logs]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = tab === "active" ? [...active].sort((a, b) => (evOf(a).first ?? "").localeCompare(evOf(b).first ?? "")) : done;
    return base.filter((l) => (plantF === "all" || l.plant === plantF) && (!needle || [l.nopol, l.driverName, l.tujuan, l.jenis].join(" ").toLowerCase().includes(needle)));
  }, [tab, active, done, plantF, q]);
  const outside = active.filter((l) => l.plant === "CIK").length;
  const inside = active.filter((l) => l.plant === "PRB").length;

  /* ── form ── */
  function pick(v: KVehicle) {
    if (busy.has(v.id)) return;
    setVehicleId(v.id); setPlateQ(v.nopol); setManualVeh(null);
    const last = [...logs].filter((l) => l.vehicleId === v.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (last) {   // driver otomatis: driver terakhir yang membawa kendaraan ini
      const d = drivers.find((x) => x.nama.trim().toLowerCase() === last.driverName.trim().toLowerCase());
      if (d) { setDriverMode("list"); setDriverId(d.id); setAutoDriver(d.nama); }
      else if (last.driverName !== "-") { setDriverMode("manual"); setDriverManual(up(last.driverName)); setAutoDriver(last.driverName); }
    } else setAutoDriver("");
  }
  // plat yang diketik ternyata sudah terdaftar → langsung pakai kendaraan terdaftar
  useEffect(() => { if (manualVeh && exact && !registered) pick(exact); }, [manualVeh, exact]); // eslint-disable-line react-hooks/exhaustive-deps
  function reset() { setVehicleId(""); setPlateQ(""); setManualVeh(null); setDriverId(""); setDriverMode("list"); setDriverManual(""); setAutoDriver(""); setTujuan(""); setKet(""); }
  function clearVehicle() { reset(); plateRef.current?.focus(); }

  async function submit() {
    if (!canSubmit || !selected) return;
    setSubmitting(true); setError("");
    try {
      const base = { driverId: driverMode === "list" ? driverId : null, driverName: driverMode === "manual" ? driverManual.trim() : null, tujuan: tujuan.trim(), keterangan: ket.trim(), timestamp: stampFor(tanggal) };
      let vid = selected.id;
      if (isManual) {
        vid = await openManual({ ...base, nopol: selected.nopol, jenis: selected.jenis, plant: selected.plant });
        listVehicles().then(setVehicles).catch(() => {});
      } else await openForVehicle(selected.id, base);
      toast(`${selected.nopol} ${selected.plant === "PRB" ? "tercatat MASUK CIK" : "tercatat KELUAR"}`);
      reset(); setTab("active");
      const fresh = await listLogs(tanggal); setLogs(fresh);
      const nl = fresh.find((l) => l.vehicleId === vid && l.status !== "DONE");
      if (nl) { setFlashId(nl.id); setTimeout(() => setFlashId(null), 1800); }
      plateRef.current?.focus();
    } catch (e) { setError(gateErr(e)); }
    finally { setSubmitting(false); }
  }

  async function close(l: KLog) {
    if (confirmId !== l.id) { setConfirmId(l.id); return; }
    setConfirmId(null); setBusyId(l.id); setError("");
    try { await closeLog(l.vehicleId); toast(`${l.nopol} ${l.plant === "PRB" ? "tercatat KELUAR CIK" : "tercatat KEMBALI"}`); await loadLogs(true); }
    catch (e) { setError(gateErr(e)); }
    finally { setBusyId(null); }
  }

  if (!cikopsConfigured()) {
    return <div className="kv"><div className="g-alert warn">Sambungan ke CIKOPS belum diatur. Isi <b>NEXT_PUBLIC_CIKOPS_SUPABASE_URL</b> dan <b>NEXT_PUBLIC_CIKOPS_SUPABASE_ANON_KEY</b> di Vercel Security Desk, lalu Redeploy.</div></div>;
  }

  return (
    <div className="kv">
      <div className="kv-stats">
        <div className={outside ? "hot" : ""}><b>{outside}</b><span>Mobil di luar</span></div>
        <div><b>{inside}</b><span>Dari luar, di dalam</span></div>
        <div><b>{done.length}</b><span>Selesai ({tanggal === today ? "hari ini" : tanggal})</span></div>
        <div><b>{logs.length}</b><span>Total catatan</span></div>
      </div>
      {error && <div className="g-alert bad" role="alert">{error}</div>}

      <div className="kv-grid">
        {/* ── FORM ── */}
        <section className="kv-card kv-form" aria-label="Catat kendaraan">
          <h2>Catat kendaraan</h2>
          <label className="kv-lab">1 · Plat nomor
            {selected && <button type="button" className="kv-link" onClick={clearVehicle}>Ganti</button>}
          </label>
          <div className="kv-plate">
            <input ref={plateRef} className="g-in kv-plate-in" value={plateQ} autoComplete="off" autoCapitalize="characters" placeholder="Ketik / pilih plat nomor" aria-label="Plat nomor"
              onChange={(e) => { setPlateQ(up(e.target.value)); setVehicleId(""); setAutoDriver(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { const f = vList.find((v) => !busy.has(v.id)); if (f && !selected) { e.preventDefault(); pick(f); } } }} />
            {plateQ && <button type="button" className="kv-x" onClick={clearVehicle} aria-label="Hapus">×</button>}
          </div>

          {!registered && !manualVeh && !exact && plateQ.trim() && (
            <button type="button" className="kv-manual-cta" onClick={() => setManualVeh({ jenis: "", plant: "CIK" })}>
              ✍ Plat tidak terdaftar di Aset GA? Catat manual{plateValid ? <b> · {up(plateClean)}</b> : null}
            </button>
          )}
          {!registered && manualVeh && (
            <div className="kv-manual">
              <div className="kv-manual-h"><b>Kendaraan tidak terdaftar di Aset GA</b><button type="button" className="kv-link" onClick={() => setManualVeh(null)}>Batal</button></div>
              <small>Mis. mobil sales / mobil perusahaan lain. Plat otomatis tersimpan sebagai mobil non-aset dan akan diverifikasi GA.</small>
              {!plateValid && <small className="warn">Ketik plat nomor yang lengkap di kolom atas (contoh: B 1234 ABC).</small>}
              <input className="g-in" value={manualVeh.jenis} maxLength={40} placeholder="Jenis / merek mobil (opsional) — mis. AVANZA PUTIH" onChange={(e) => setManualVeh({ ...manualVeh, jenis: up(e.target.value) })} />
              <div className="kv-dir" role="group" aria-label="Arah kendaraan">
                <button type="button" aria-pressed={manualVeh.plant === "CIK"} onClick={() => setManualVeh({ ...manualVeh, plant: "CIK" })}><b>KELUAR dulu</b><small>mobil ada di dalam plant, akan kembali</small></button>
                <button type="button" aria-pressed={manualVeh.plant === "PRB"} onClick={() => setManualVeh({ ...manualVeh, plant: "PRB" })}><b>MASUK dulu</b><small>mobil dari luar, akan keluar lagi</small></button>
              </div>
            </div>
          )}
          {!selected && !manualVeh && (
            <div className="kv-chips">
              {vList.length === 0 && <div className="g-empty">Plat tidak ditemukan</div>}
              {vList.slice(0, 40).map((v) => {
                const b = busy.get(v.id);
                return (
                  <button key={v.id} type="button" className={`kv-chip ${v.plant === "PRB" ? "prb" : ""}`} disabled={!!b} onClick={() => pick(v)}>
                    <b>{v.nopol}</b>
                    <small>{b ? `${evOf(b).running} · ${wibHHMM(evOf(b).first)}` : `${v.plant} · ${v.jenis || "-"}${v.kategori === "non_asset" ? " · Non-aset" : ""}`}</small>
                  </button>
                );
              })}
            </div>
          )}
          {selected && (
            <div className={`kv-dirbar ${selected.plant === "PRB" ? "in" : "out"}`}>
              <div><b>{selected.plant === "PRB" ? "MASUK CIK" : "KELUAR PLANT"}</b>
                <small>{selected.jenis || "-"} · {isManual ? "Non-aset · dicatat manual" : selected.kategori === "non_asset" ? "Mobil perusahaan non-aset" : `Kendaraan ${selected.plant}`}</small></div>
              <span className="g-plate">{selected.nopol}</span>
            </div>
          )}

          <label className="kv-lab">2 · Driver
            <button type="button" className="kv-link" onClick={() => { setDriverMode((m) => (m === "list" ? "manual" : "list")); setAutoDriver(""); }}>{driverMode === "manual" ? "Pilih dari daftar" : "Ketik manual"}</button>
          </label>
          {driverMode === "manual"
            ? <input className="g-in" value={driverManual} placeholder="Nama driver / pengemudi" onChange={(e) => setDriverManual(up(e.target.value))} />
            : <select className="g-in" value={driverId} onChange={(e) => { setDriverId(e.target.value); setAutoDriver(""); }}><option value="">— Pilih driver —</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}</select>}
          {autoDriver && <small className="kv-hint">✓ Terisi otomatis: <b>{autoDriver}</b> (driver terakhir kendaraan ini)</small>}

          <label className="kv-lab">3 · Tujuan</label>
          <input className="g-in" value={tujuan} placeholder="Contoh: ANTAR DOKUMEN KE PRB" onChange={(e) => setTujuan(up(e.target.value))} />
          <div className="kv-tchips">{tujuanChips.map((t) => <button key={t} type="button" className={tujuan === t ? "on" : ""} onClick={() => setTujuan(t)}>{t}</button>)}</div>

          <label className="kv-lab">Keperluan / catatan <em>(opsional)</em></label>
          <textarea className="g-in" rows={2} value={ket} placeholder="Keperluan perjalanan, barang bawaan, dll." onChange={(e) => setKet(up(e.target.value))} />

          <div className="kv-date">
            <label>Tanggal <input type="date" className="g-in" value={tanggal} max={today} onChange={(e) => e.target.value && setTanggal(e.target.value)} /></label>
            {tanggal !== today && <button type="button" className="kv-link" onClick={() => setTanggal(today)}>Kembali ke hari ini</button>}
          </div>
          <button type="button" className="btn red big kv-submit" disabled={!canSubmit} onClick={submit}>
            {submitting ? "Menyimpan…" : !selected ? "Pilih kendaraan" : !driverOk ? "Pilih driver" : selected.plant === "PRB" ? "Catat MASUK CIK" : "Catat KELUAR"}
          </button>
        </section>

        {/* ── DAFTAR ── */}
        <section className="kv-card kv-list" aria-label="Daftar kendaraan">
          <div className="kv-tabs" role="tablist">
            <button role="tab" aria-selected={tab === "active"} onClick={() => setTab("active")}>Masih aktif <b>{active.length}</b></button>
            <button role="tab" aria-selected={tab === "done"} onClick={() => setTab("done")}>Selesai <b>{done.length}</b></button>
          </div>
          <div className="kv-filters">
            <input className="g-in" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari plat, driver, tujuan…" aria-label="Cari" />
            <div className="kv-seg" role="group" aria-label="Kendaraan dari plant">
              {(["all", "CIK", "PRB"] as const).map((p) => <button key={p} type="button" aria-pressed={plantF === p} onClick={() => setPlantF(p)}>{p === "all" ? "Semua" : p}</button>)}
            </div>
          </div>
          {loading ? <div className="g-empty">Memuat…</div> : list.length === 0 ? (
            <div className="g-empty">{tab === "active" ? "Tidak ada kendaraan yang sedang aktif." : "Belum ada catatan selesai."}</div>
          ) : (
            <div className="kv-rows">
              {list.map((l) => {
                const e = evOf(l);
                const m = minsSince(e.first, tab === "done" ? e.second ?? Date.now() : Date.now());
                const old = tab === "active" && m > 8 * 60;
                const conf = confirmId === l.id;
                return (
                  <article key={l.id} className={`kv-row ${l.plant === "PRB" ? "prb" : ""} ${flashId === l.id ? "flash" : ""}`}>
                    <div className="kv-row-top">
                      <span className="g-plate">{l.nopol}</span>
                      <div className="kv-row-who"><b>{l.driverName}</b><small>{l.jenis}{l.color ? ` · ${l.color}` : ""}</small></div>
                      {l.kategori === "non_asset" && <span className="kv-tag">NON-ASET</span>}
                      <span className={`kv-tag ${l.plant === "PRB" ? "prb" : "cik"}`}>{l.plant}</span>
                    </div>
                    <div className="kv-row-meta">
                      <span>📍 {l.tujuan || "Tujuan tidak diisi"}{l.keterangan ? <em> — {l.keterangan}</em> : null}</span>
                      <span>🕒 {e.firstLbl} {wibHHMM(e.first)}{tab === "done" ? ` · ${e.secondLbl} ${wibHHMM(e.second)}` : ""}</span>
                    </div>
                    <div className="kv-row-foot">
                      <span className={`kv-timer ${old ? "old" : ""}`}>{tab === "active" ? `${e.running} · ` : "Durasi "}<b>{fmtDur(m)}</b></span>
                      {tab === "active" && (
                        <button type="button" className={`btn sm ${conf ? "red" : "q"}`} disabled={busyId === l.id} onClick={() => close(l)}>
                          {busyId === l.id ? "Menyimpan…" : conf ? "Ketuk lagi untuk konfirmasi" : e.act}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
