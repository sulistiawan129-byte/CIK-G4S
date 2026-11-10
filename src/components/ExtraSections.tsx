"use client";
/**
 * Bagian tambahan halaman Kejadian & patroli (tabel dari laporan_cikops.sql):
 * transporter bulanan, kunjungan team support pengamanan, dan issue area.
 * Semua angka ini juga dibaca CIKOPS (FM) untuk laporan manajemen.
 */
import { useRef, useState } from "react";
import { useApp } from "@/components/AppContext";
import { EXTRA_CATS, INC_CATS, TEAM_KEYS, extraName, fmt, incLabel, statusLabel } from "@/lib/constants";
import { L } from "@/lib/lang";
import { monthEnd } from "@/lib/dates";
import { api, debounced } from "@/lib/data";
import { useDrafts } from "@/lib/useDrafts";
import type { AreaIssue, MonthExtra } from "@/lib/types";

const shortDate = (iso: string) => { const [, m, d] = iso.split("-"); return `${Number(d)}/${Number(m)}`; };

export function ExtraSections() {
  const { D, setD, siteId, canWrite, toast, fail } = useApp();
  const { set, clear, val } = useDrafts();
  const Dref = useRef(D);
  Dref.current = D;
  const [day, setDay] = useState("");
  const [cat, setCat] = useState(INC_CATS[3]);
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState<AreaIssue["status"]>("Open");

  if (!D) return null;
  if (!D.extraReady) {
    return (
      <section className="sec">
        <h2>{L("Transporter, kunjungan & issue area", "Transporters, visits & area issues")}</h2>
        <p className="sub">{L("Bagian ini aktif setelah admin menjalankan", "This section is enabled after the admin runs")} <b>supabase/laporan_cikops.sql</b> {L("di Supabase.", "in Supabase.")}</p>
      </section>
    );
  }

  const tot = (k: (typeof EXTRA_CATS)[number]["k"]) => D.extraDaily[k].reduce((a, b) => a + b, 0);

  function patch(p: Partial<MonthExtra>, key: string, raw: string) {
    if (!siteId || !D) return;
    set(key, raw);
    const next = { ...D.extra, ...p, team: { ...D.extra.team, ...(p.team || {}) } };
    setD((x) => x && { ...x, extra: next });
    const month = D.month;
    debounced("extra", async () => { await api.setMonthExtra(siteId, month, Dref.current?.extra ?? next); clear(key); }, 500, fail);
  }
  const n = (raw: string) => Math.max(0, parseInt(raw) || 0);

  async function addIssue() {
    if (!siteId || !D || !desc.trim()) return;
    const d = day || (new Date().toISOString().slice(0, 7) === D.month.slice(0, 7) ? new Date().toISOString().slice(0, 10) : D.month);
    try { await api.addIssue(siteId, { day: d, category: cat, description: desc.trim(), status }); setDesc(""); toast(L("Issue area ditambahkan", "Area issue added")); } catch (e) { fail(e as Error); }
  }
  function toggle(i: AreaIssue) {
    const s: AreaIssue["status"] = i.status === "Open" ? "Close" : "Open";
    setD((x) => x && { ...x, issues: x.issues.map((y) => (y.id === i.id ? { ...y, status: s } : y)) });
    api.updateIssue(i.id, { status: s }).catch(fail);
  }

  const open = D.issues.filter((i) => i.status === "Open").length;

  return (
    <>
      <fieldset className="sec ro" disabled={!canWrite}>
        <div><h2>{L("Transporter & biomas", "Transporters & biomass")}</h2><p className="sub">{L("Jumlah harian diisi di menu Data harian. Di sini cukup dua angka bulanan.", "Daily counts are entered in the Daily data menu. Only two monthly figures are needed here.")}</p></div>
        <div className="totals">
          {EXTRA_CATS.map((c) => <div className="tot" key={c.k}><div className="num">{fmt(tot(c.k))}</div><div className="l">{extraName(c)}</div></div>)}
        </div>
        <div className="pat">
          <div><label htmlFor="x-sel">{L("Selisih timbang ≥ 40 kg", "Weighbridge gap ≥ 40 kg")}</label><input id="x-sel" type="number" min={0} value={val("x:sel", D.extra.selisih_timbang)} onChange={(e) => patch({ selisih_timbang: n(e.target.value) }, "x:sel", e.target.value)} /></div>
          <div><label htmlFor="x-po">{L("dari kendaraan Palm Oil / Fat Blend", "out of Palm Oil / Fat Blend vehicles")}</label><input id="x-po" type="number" min={0} value={val("x:po", D.extra.palm_oil)} onChange={(e) => patch({ palm_oil: n(e.target.value) }, "x:po", e.target.value)} /></div>
        </div>
      </fieldset>

      <fieldset className="sec ro" disabled={!canWrite}>
        <div><h2>{L("Kunjungan team support pengamanan", "Security support team visits")}</h2><p className="sub">{L("Jumlah kunjungan per kelompok bulan ini, plus siapa saja yang berkunjung.", "Number of visits per group this month, plus who visited.")}</p></div>
        <div className="pat">
          {TEAM_KEYS.map((k) => (
            <div key={k}><label htmlFor={`t-${k}`}>{k}</label><input id={`t-${k}`} type="number" min={0} value={val(`t:${k}`, D.extra.team[k] ?? 0)} onChange={(e) => patch({ team: { [k]: n(e.target.value) } }, `t:${k}`, e.target.value)} /></div>
          ))}
        </div>
        <label htmlFor="t-note" style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "4px 0 6px" }}>{L("Catatan kunjungan", "Visit notes")}</label>
        <textarea id="t-note" className="inline" value={val("t:note", D.extra.team_note)} placeholder={L("mis. External: BHABINSA, Polsek … · G4S: Supervisor Area, OH …", "e.g. External: BHABINSA, local police … · G4S: Area Supervisor, OH …")} onChange={(e) => patch({ team_note: e.target.value }, "t:note", e.target.value)} />
      </fieldset>

      <fieldset className="sec ro" disabled={!canWrite}>
        <div><h2>{L("Issue area", "Area issues")}</h2><p className="sub">{D.issues.length ? L(`${D.issues.length} issue bulan ini, ${open} masih open. Klik status untuk mengubah.`, `${D.issues.length} issue(s) this month, ${open} still open. Click the status to change it.`) : L("Belum ada issue area bulan ini.", "No area issues this month.")}</p></div>
        {D.issues.length > 0 && (
          <ul className="rows isl">
            {D.issues.map((i) => (
              <li key={i.id}>
                <b>{shortDate(i.day)}</b>
                <span className="sub" style={{ margin: 0 }}>{incLabel(i.category)}</span>
                <span>{i.description}</span>
                <button type="button" className={`btn ${i.status === "Open" ? "red" : "q"}`} onClick={() => toggle(i)}>{statusLabel(i.status)}</button>
                <button type="button" className="btn q" aria-label={L("Hapus issue", "Delete issue")} onClick={() => api.deleteIssue(i.id).then(() => toast(L("Issue dihapus", "Issue deleted"))).catch(fail)}>{L("Hapus", "Delete")}</button>
              </li>
            ))}
          </ul>
        )}
        <div className="issue-add">
          <input type="date" className="inline" aria-label={L("Tanggal", "Date")} value={day} min={D.month} max={monthEnd(D.month)} onChange={(e) => setDay(e.target.value)} />
          <select className="inline" aria-label={L("Jenis", "Type")} value={cat} onChange={(e) => setCat(e.target.value)}>{INC_CATS.map((c) => <option key={c} value={c}>{incLabel(c)}</option>)}</select>
          <input className="inline" placeholder={L("Deskripsi singkat…", "Short description…")} aria-label={L("Deskripsi", "Description")} value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addIssue()} />
          <select className="inline" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as AreaIssue["status"])}><option value="Open">{statusLabel("Open")}</option><option value="Close">{statusLabel("Close")}</option></select>
          <button type="button" className="btn red" onClick={addIssue}>+ {L("Tambah", "Add")}</button>
        </div>
      </fieldset>
    </>
  );
}
