"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

function Form() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(
    params.get("e") === "nonaktif" ? "Email dan password benar, tapi akun ini belum diberi peran (atau sudah dinonaktifkan). Akun perlu diaktifkan dulu oleh Admin G4S / Admin GA di menu Pengguna → Beri akses."
      : params.get("e") === "schema" ? `Data belum bisa dibaca: ${params.get("m") ?? ""}` : ""
  );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setErr(error.message === "Invalid login credentials" ? "Email atau password salah." : error.message); setBusy(false); return; }
      window.location.assign(params.get("next") || "/pos");
    } catch (er) { setErr((er as Error).message); setBusy(false); }
  }
  return (
    <form className="pos-login" onSubmit={submit}>
      <div className="pos-login-brand"><i></i><div><b>Pos Gate</b><span>Pemeriksaan transporter</span></div></div>
      <h1>Masuk petugas</h1>
      {err && <div className="err" role="alert">{err}</div>}
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button className="btn red big" type="submit" disabled={busy}>{busy ? "Memeriksa…" : "Masuk"}</button>
      <p className="note">Akun dibuat oleh admin di Security Desk.</p>
    </form>
  );
}

export default function PosLogin() {
  return <div className="pos-login-wrap"><Suspense><Form /></Suspense></div>;
}
