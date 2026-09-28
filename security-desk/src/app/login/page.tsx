"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(params.get("e") === "nonaktif" ? "Akun ini belum aktif atau sudah dinonaktifkan. Hubungi Master Admin." : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setErr(error.message === "Invalid login credentials" ? "Email atau password salah." : error.message);
      setBusy(false);
      return;
    }
    router.replace(params.get("next") || "/");
    router.refresh();
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
      <p className="note">Lupa password? Minta Master Admin untuk mengatur ulang.</p>
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
