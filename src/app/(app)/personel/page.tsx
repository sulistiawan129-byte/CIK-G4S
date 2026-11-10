"use client";
import { useApp } from "@/components/AppContext";
import { Loading } from "@/components/ui";
import { LEAVE_TYPES, NI_STATUS, leaveLabel, monLabel, statusLabel } from "@/lib/constants";
import { L } from "@/lib/lang";
import { monthsOpen } from "@/lib/calc";
import { parseMonth } from "@/lib/dates";
import { api, debounced } from "@/lib/data";
import { useDrafts } from "@/lib/useDrafts";
import type { Improvement, Leave } from "@/lib/types";

export default function Personel() {
  const { D, setD, error, siteId, canWrite, toast, fail } = useApp();
  const { set, clear, val } = useDrafts();
  if (!D) return <Loading error={error} />;

  function editLeave(id: string, k: keyof Leave, v: string, immediate = false) {
    setD((p) => p && { ...p, leaves: p.leaves.map((l) => (l.id === id ? { ...l, [k]: v } : l)) });
    const key = `lv:${id}:${k}`;
    if (immediate) { api.updateLeave(id, { [k]: v }).catch(fail); return; }
    set(key, v);
    debounced(key, async () => { await api.updateLeave(id, { [k]: v }); clear(key); }, 500, fail);
  }
  function editNi(id: string, k: keyof Improvement, v: string, immediate = false) {
    setD((p) => p && { ...p, improvements: p.improvements.map((n) => (n.id === id ? { ...n, [k]: v } : n)) });
    const key = `ni:${id}:${k}`;
    if (immediate) { api.updateImprovement(id, { [k]: v }).catch(fail); if (k === "status" && v === "Selesai") toast(L("Ditandai selesai", "Marked as done")); return; }
    set(key, v);
    debounced(key, async () => { await api.updateImprovement(id, { [k]: v }); clear(key); }, 500, fail);
  }
  async function addLeave() {
    if (!siteId || !D) return;
    try { const r = await api.addLeave(siteId, D.month); const id = (r.data as { id: string }).id; setD((p) => p && { ...p, leaves: [...p.leaves, { id, name: "", date_text: "", type: "Annual Leave", backup: "" }] }); setTimeout(() => document.getElementById(`lv-name-${id}`)?.focus(), 40); } catch (e) { fail(e as Error); }
  }
  async function addNi() {
    if (!siteId || !D) return;
    try { const r = await api.addImprovement(siteId, D.month); const id = (r.data as { id: string }).id; setD((p) => p && { ...p, improvements: [...p.improvements, { id, opened_month: D.month, description: "", priority: "High", progress: "", status: "Open" }] }); setTimeout(() => document.getElementById(`ni-desc-${id}`)?.focus(), 40); } catch (e) { fail(e as Error); }
  }
  async function del(kind: "lv" | "ni", id: string) {
    setD((p) => p && (kind === "lv" ? { ...p, leaves: p.leaves.filter((l) => l.id !== id) } : { ...p, improvements: p.improvements.filter((n) => n.id !== id) }));
    try { await (kind === "lv" ? api.deleteLeave(id) : api.deleteImprovement(id)); toast(L("Dihapus", "Deleted")); } catch (e) { fail(e as Error); }
  }

  const open = D.improvements.filter((n) => n.status !== "Selesai").length;
  return (
    <div className="page enter">
      <section>
        <div className="eyebrow">{L("Personel & temuan", "Personnel & findings")}</div>
        <h1>{L("Pastikan tidak ada pos kosong", "Make sure no post is left empty")}</h1>
        <p className="lede">{L("Kotak merah berarti belum diisi dan akan tampil sebagai catatan di laporan. Semua perubahan tersimpan otomatis.", "A red box means not filled in and will appear as a note in the report. All changes are saved automatically.")}</p>
        {!canWrite && <p className="readonly-note" style={{ marginTop: 14 }}>{L("Akun ini hanya bisa melihat data.", "This account can only view data.")}</p>}
      </section>

      <fieldset className="sec ro" disabled={!canWrite}>
        <div><h2>{L("Cuti, sakit & backup", "Leave, sick & backup")}</h2><p className="sub">{D.leaves.length} {L("catatan bulan ini", "records this month")}</p></div>
        <ul className="rows lv">
          {D.leaves.map((l) => {
            const bk = val(`lv:${l.id}:backup`, l.backup), need = /sakit|sick/i.test(l.type) && !bk.trim();
            return (
              <li key={l.id}>
                <input id={`lv-name-${l.id}`} className="inline" style={{ fontWeight: 600 }} value={val(`lv:${l.id}:name`, l.name)} placeholder={L("Nama", "Name")} aria-label={L("Nama", "Name")} onChange={(e) => editLeave(l.id, "name", e.target.value)} />
                <input className="inline" value={val(`lv:${l.id}:date_text`, l.date_text)} placeholder={L("Tanggal, mis. 3 & 4 Agustus 2026", "Date, e.g. 3 & 4 August 2026")} aria-label={L("Tanggal", "Date")} onChange={(e) => editLeave(l.id, "date_text", e.target.value)} />
                <select className="inline" value={l.type} aria-label={L("Keterangan", "Type")} onChange={(e) => editLeave(l.id, "type", e.target.value, true)}>{LEAVE_TYPES.map((o) => <option key={o} value={o}>{leaveLabel(o)}</option>)}</select>
                <input className={`inline ${need ? "need" : ""}`} value={bk} placeholder={L("Siapa yang menggantikan?", "Who is covering?")} aria-label="Backup" onChange={(e) => editLeave(l.id, "backup", e.target.value)} />
                <button type="button" className="iconbtn" aria-label={L("Hapus baris", "Delete row")} onClick={() => del("lv", l.id)}>×</button>
              </li>
            );
          })}
        </ul>
        <div><button type="button" className="btn q" onClick={addLeave}>+ {L("Tambah", "Add")}</button></div>
      </fieldset>

      <fieldset className="sec ro" disabled={!canWrite}>
        <div className="sechead">
          <div><h2>Need improvement</h2><p className="sub">{L(`${open} masih terbuka. Angka di kiri adalah umur item.`, `${open} still open. The number on the left is the item's age.`)}</p></div>
          <div className="nibar" aria-hidden="true">{D.improvements.map((n) => <i key={n.id} className={n.status}></i>)}</div>
        </div>
        <ul className="rows ni">
          {D.improvements.map((n) => {
            const a = monthsOpen(n.opened_month, D.month), { y, m0 } = parseMonth(n.opened_month), g = val(`ni:${n.id}:progress`, n.progress);
            return (
              <li key={n.id}>
                <div className={`age ${a >= 3 && n.status !== "Selesai" ? "old" : ""}`}>{a}<small>{L("bulan", "mo")}</small></div>
                <div>
                  <input id={`ni-desc-${n.id}`} className="inline" style={{ fontWeight: 600 }} value={val(`ni:${n.id}:description`, n.description)} placeholder={L("Deskripsi", "Description")} aria-label={L("Deskripsi", "Description")} onChange={(e) => editNi(n.id, "description", e.target.value)} />
                  <div className="sub" style={{ margin: "0 8px", display: "flex", gap: 6, alignItems: "center" }}>
                    <select className="inline" style={{ width: "auto", padding: "2px 4px" }} value={n.priority} aria-label={L("Tingkat", "Priority")} onChange={(e) => editNi(n.id, "priority", e.target.value, true)}>{["High", "Medium", "Low"].map((o) => <option key={o}>{o}</option>)}</select>
                    · {L("dibuka", "opened")} {monLabel(m0)} {y}
                  </div>
                </div>
                <input className={`inline ${!g && n.status !== "Selesai" ? "need" : ""}`} value={g} placeholder={L("Progres terakhir", "Latest progress")} aria-label={L("Progres", "Progress")} onChange={(e) => editNi(n.id, "progress", e.target.value)} />
                <div className="seg" role="group" aria-label="Status">
                  {NI_STATUS.map((s) => <button type="button" key={s} aria-pressed={n.status === s} onClick={() => editNi(n.id, "status", s, true)}>{statusLabel(s)}</button>)}
                </div>
                <button type="button" className="iconbtn" aria-label={L("Hapus item", "Delete item")} onClick={() => del("ni", n.id)}>×</button>
              </li>
            );
          })}
        </ul>
        <div><button type="button" className="btn q" onClick={addNi}>+ {L("Tambah item", "Add item")}</button></div>
      </fieldset>
    </div>
  );
}
