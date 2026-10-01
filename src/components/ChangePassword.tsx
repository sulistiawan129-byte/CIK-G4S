"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Ubah password sendiri. Password lama diperiksa dulu (login ulang diam-diam)
 * supaya orang lain yang memakai sesi yang tertinggal terbuka tidak bisa menggantinya.
 * Akun dipakai bersama aplikasi lain (mis. G-C), jadi password baru berlaku di sana juga.
 */
export function ChangePassword({ email, open, onClose, onDone }: { email: string; open: boolean; onClose: () => void; onDone: (msg: string) => void }) {
  const [oldPw, setOldPw] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [mounted, setMounted] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    setOldPw(""); setPw(""); setPw2(""); setErr(""); setShow(false);
    const t = setTimeout(() => first.current?.focus(), 50);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", esc);
    return () => { clearTimeout(t); document.removeEventListener("keydown", esc); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const rules = [
    { ok: pw.length >= 8, t: "Minimal 8 karakter" },
    { ok: /[A-Za-z]/.test(pw) && /\d/.test(pw), t: "Ada huruf dan angka" },
    { ok: !!pw && pw !== oldPw, t: "Berbeda dari password lama" },
    { ok: !!pw2 && pw === pw2, t: "Kedua password baru sama" },
  ];
  const valid = !!oldPw && rules.every((r) => r.ok);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) { setErr("Periksa lagi syarat password baru."); return; }
    setBusy(true); setErr("");
    const sb = supabaseBrowser();
    const check = await sb.auth.signInWithPassword({ email, password: oldPw });
    if (check.error) { setBusy(false); setErr("Password lama salah."); return; }
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setErr(/same|different/i.test(error.message) ? "Password baru harus berbeda dari password lama."
        : /weak|short|characters/i.test(error.message) ? `Password terlalu lemah: ${error.message}`
        : /reauth|nonce/i.test(error.message) ? "Supabase meminta verifikasi tambahan. Minta Master Admin mematikan 'Secure password change' di Authentication → Providers → Email, atau minta reset password."
        : error.message);
      return;
    }
    onDone("Password berhasil diubah. Gunakan password baru saat login berikutnya.");
    onClose();
  }

  if (!mounted || !open) return null;
  return createPortal(
    <div className="cp-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form className="cp" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="cp-title">
        <div className="cp-h">
          <div><div className="eyebrow">Akun saya</div><h2 id="cp-title">Ubah password</h2><p className="sub">{email}</p></div>
          <button type="button" className="dclose" style={{ position: "static" }} onClick={onClose} aria-label="Tutup" disabled={busy}>×</button>
        </div>
        <label>Password lama<input ref={first} type={show ? "text" : "password"} autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} /></label>
        <label>Password baru<input type={show ? "text" : "password"} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <label>Ulangi password baru<input type={show ? "text" : "password"} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        <label className="cp-show"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Tampilkan password</label>
        <ul className="cp-rules">{rules.map((r) => <li key={r.t} className={r.ok ? "ok" : ""}>{r.t}</li>)}</ul>
        <p className="note">Akun ini juga dipakai di aplikasi lain pada sistem yang sama (mis. G-C). Password baru ikut berlaku di sana.</p>
        {err && <div className="cp-err" role="alert">{err}</div>}
        <div className="cp-f">
          <button type="button" className="btn q" onClick={onClose} disabled={busy}>Batal</button>
          <button type="submit" className="btn red" disabled={busy || !valid}>{busy ? "Menyimpan…" : "Simpan password baru"}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}
