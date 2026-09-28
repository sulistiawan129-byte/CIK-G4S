"use client";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppContext";
import { supabaseBrowser } from "@/lib/supabase/client";
import { MODULES, ROLE_LABEL } from "@/lib/constants";
import type { Profile, Role } from "@/lib/types";

interface Log { id: number; actor_email: string | null; table_name: string; action: string; at: string }
const TABLE_LABEL: Record<string, string> = { gate_inspections: "Gate transporter", daily_counts: "Data harian", day_events: "Catatan tanggal", incident_counts: "Kejadian", patrol_monthly: "Patroli", leaves: "Cuti/sakit", improvements: "Need improvement", kpi_scores: "KPI", report_notes: "Catatan laporan", profiles: "Pengguna" };

export default function Pengguna() {
  const { profile, sites, toast, fail } = useApp();
  const [users, setUsers] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [form, setForm] = useState({ email: "", full_name: "", password: "", role: "admin" as Role, site_ids: sites.map((s) => s.id) });
  const [busy, setBusy] = useState(false);
  const [newPw, setNewPw] = useState<{ email: string; pw: string } | null>(null);
  const sb = supabaseBrowser();

  const load = useCallback(async () => {
    const [u, l] = await Promise.all([
      sb.from("profiles").select("*").order("created_at"),
      sb.from("activity_log").select("id,actor_email,table_name,action,at").order("at", { ascending: false }).limit(40),
    ]);
    if (u.data) setUsers(u.data as Profile[]);
    if (l.data) setLogs(l.data as Log[]);
  }, [sb]);

  useEffect(() => {
    load();
    const ch = sb.channel("users-admin").on("postgres_changes", { event: "*", schema: "security", table: "profiles" }, load).subscribe();
    const t = setInterval(load, 30000);
    return () => { sb.removeChannel(ch); clearInterval(t); };
  }, [load, sb]);

  if (profile.role !== "master_admin") return <div className="errbox">Hanya Master Admin.</div>;

  async function update(id: string, patch: Partial<Profile>) {
    setUsers((p) => p.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    const { error } = await sb.from("profiles").update(patch).eq("id", id);
    if (error) fail(new Error(error.message)); else toast("Tersimpan");
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return toast(j.error ?? "Gagal membuat akun", "err");
    toast(j.existed ? `${form.email} sudah punya akun; akses Security Desk ditambahkan (password lama tetap)` : `Akun ${form.email} dibuat`);
    setForm({ ...form, email: "", full_name: "", password: "" });
    load();
  }
  async function resetPw(u: Profile) {
    const pw = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6).toUpperCase();
    const r = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, password: pw }) });
    const j = await r.json();
    if (!r.ok) return toast(j.error ?? "Gagal", "err");
    setNewPw({ email: u.email ?? "", pw });
  }
  const toggleIn = (arr: string[] | null, v: string) => { const a = arr ?? []; return a.includes(v) ? a.filter((x) => x !== v) : [...a, v]; };

  return (
    <div className="page enter">
      <section>
        <div className="eyebrow">Pengguna & akses</div>
        <h1>Siapa boleh melihat dan mengubah apa</h1>
        <p className="lede">Akun login dipakai bersama aplikasi lain di project Supabase yang sama; akses Security Desk diatur terpisah di sini. Peran menentukan boleh mengubah data atau hanya melihat. Akun Petugas Gate masuk lewat link khusus <b>/pos</b>. Site membatasi data plant mana yang terlihat. Menu membatasi halaman yang muncul.</p>
      </section>

      <section className="sec">
        <h2>Tambah akun</h2>
        <form className="newuser users" onSubmit={create}>
          <label>Nama<input type="text" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
          <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Password awal<input type="password" required minLength={8} title="Kalau email sudah punya akun di aplikasi lain, password lama tetap dipakai" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          <label>Peran<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <button className="btn red" disabled={busy}>{busy ? "Membuat…" : "Buat akun"}</button>
        </form>
        {sites.length > 1 && <div className="checks">{sites.map((s) => <label key={s.id}><input type="checkbox" checked={form.site_ids.includes(s.id)} onChange={() => setForm({ ...form, site_ids: toggleIn(form.site_ids, s.id) })} />{s.name}</label>)}</div>}
        {newPw && <div className="allgood"><span className="check">✓</span><div><b>Password baru untuk {newPw.email}</b><div className="sub">Berikan ke pengguna: <code style={{ fontSize: 16, fontWeight: 700 }}>{newPw.pw}</code></div></div><button className="link" onClick={() => setNewPw(null)}>Tutup</button></div>}
      </section>

      <section className="sec">
        <div><h2>{users.length} akun</h2><p className="sub">Perubahan langsung berlaku. Pengguna yang dinonaktifkan akan keluar saat membuka halaman berikutnya.</p></div>
        <ul className="rows users">
          {users.map((u) => (
            <li key={u.id}>
              <div><b>{u.full_name || "(tanpa nama)"}</b><div className="sub" style={{ margin: 0 }}>{u.email}</div>
                <button className="link" style={{ fontSize: 12.5, marginTop: 4 }} onClick={() => resetPw(u)} disabled={u.id === profile.id}>Atur ulang password</button><div className="note">Akun dipakai bersama aplikasi lain; password baru berlaku di sana juga.</div></div>
              <select value={u.role} disabled={u.id === profile.id} onChange={(e) => update(u.id, { role: e.target.value as Role })} aria-label="Peran">{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="checks">{sites.map((s) => <label key={s.id}><input type="checkbox" disabled={u.role === "master_admin"} checked={u.role === "master_admin" || u.site_ids.includes(s.id)} onChange={() => update(u.id, { site_ids: toggleIn(u.site_ids, s.id) })} />{s.code}</label>)}</div>
                {u.role !== "master_admin" && u.role !== "display" && u.role !== "gate" && (
                  <div className="checks" title="Kosongkan semua = semua menu">
                    {MODULES.map((m) => <label key={m.key}><input type="checkbox" checked={!u.modules || u.modules.includes(m.key)} onChange={() => update(u.id, { modules: toggleIn(u.modules ?? MODULES.map((x) => x.key), m.key) })} />{m.label}</label>)}
                  </div>
                )}
              </div>
              <button className={`toggle ${u.active ? "on" : "off"}`} disabled={u.id === profile.id} onClick={() => update(u.id, { active: !u.active })}>{u.active ? "Aktif" : "Nonaktif"}</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="sec">
        <div><h2>Aktivitas terbaru</h2><p className="sub">40 perubahan terakhir di semua data.</p></div>
        <ul className="rows actlog">
          {logs.map((l) => (
            <li key={l.id}><span className="tn">{new Date(l.at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span><span>{l.actor_email ?? "sistem"}</span><span>{l.action === "INSERT" ? "Menambah" : l.action === "UPDATE" ? "Mengubah" : "Menghapus"} · {TABLE_LABEL[l.table_name] ?? l.table_name}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
