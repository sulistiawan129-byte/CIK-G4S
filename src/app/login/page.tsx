"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(
    params.get("e") === "nonaktif"
      ? "Email dan password benar, tapi akun ini belum diberi akses Security Desk (atau sudah dinonaktifkan). Akun dari aplikasi lain seperti G-C perlu diaktifkan dulu oleh Master Admin di menu Pengguna → Beri akses."
      : params.get("e") === "schema"
        ? `Login berhasil, tapi data Security Desk belum bisa dibaca: ${params.get("m") ?? ""}. Pastikan schema.sql sudah dijalankan dan "security" sudah ditambahkan di Supabase → Project Settings → API → Exposed schemas.`
        : ""
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setErr("Aplikasi belum tersambung ke Supabase: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum ada saat build. Isi di Vercel → Settings → Environment Variables, lalu Redeploy.");
      return;
    }
    setBusy(true);
    try {
      const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Server Supabase tidak menjawab dalam 15 detik. Cek Project URL di Vercel, atau project Supabase sedang di-pause.")), 15000));
      const { error } = await Promise.race([supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password }), timeout]);
      if (error) {
        setErr(error.message === "Invalid login credentials" ? "Email atau password salah." : error.message === "Email not confirmed" ? "Email belum dikonfirmasi. Buka Supabase → Authentication → Users, lalu konfirmasi akun ini." : error.message);
        setBusy(false);
        return;
      }
      // Muat ulang penuh supaya server langsung membaca sesi baru.
      window.location.assign(params.get("next") || "/");
    } catch (er) {
      const m = (er as Error).message || String(er);
      setErr(/fetch|network/i.test(m) ? `Tidak bisa menghubungi Supabase (${m}). Cek Project URL di Vercel.` : m);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div>
        <div className="eyebrow">Masuk</div>
        <h2 style={{ fontSize: 30, marginTop: 6 }}>Security Desk</h2>
        <p className="sub">Gunakan akun yang diberikan Master Admin.</p>
      </div>
      {err && <div className="err" role="alert">{err}</div>}
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button className="btn red" type="submit" disabled={busy}>{busy ? "Memeriksa…" : "Masuk"}</button>
      <p className="note">Lupa password? Minta Master Admin untuk mengatur ulang. Setelah masuk, password bisa diganti sendiri lewat menu akun → Ubah password. Ada kendala? Buka <a href="/api/health" target="_blank" rel="noreferrer">/api/health</a> untuk cek koneksi.</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="login">
      <div className="side">
        <div className="wm" style={{ color: "#fff" }}><i></i>Security Desk</div>
        <div>
          <div className="eyebrow">Sistem operasional security</div>
          <h1 style={{ marginTop: 10 }}>Data harian.<br />Laporan bulanan.<br />Satu tempat.</h1>
          <p>Input di pos, pantau di layar ruang Security, laporan ke klien terbentuk sendiri.</p>
        </div>
        <div className="note" style={{ color: "rgba(255,255,255,.5)" }}>Akses dibatasi per peran dan per site.</div>
      </div>
      <Suspense><LoginForm /></Suspense>
    </div>
  );
}
