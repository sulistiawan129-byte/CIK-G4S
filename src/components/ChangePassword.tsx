"use client";
import { L } from "@/lib/lang";
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
    { ok: pw.length >= 8, t: L("Minimal 8 karakter", "At least 8 characters") },
    { ok: /[A-Za-z]/.test(pw) && /\d/.test(pw), t: L("Ada huruf dan angka", "Contains letters and numbers") },
    { ok: !!pw && pw !== oldPw, t: L("Berbeda dari password lama", "Different from the old password") },
    { ok: !!pw2 && pw === pw2, t: L("Kedua password baru sama", "Both new passwords match") },
  ];
  const valid = !!oldPw && rules.every((r) => r.ok);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) { setErr(L("Periksa lagi syarat password baru.", "Check the new password requirements again.")); return; }
    setBusy(true); setErr("");
    const sb = supabaseBrowser();
    const check = await sb.auth.signInWithPassword({ email, password: oldPw });
    if (check.error) { setBusy(false); setErr(L("Password lama salah.", "The old password is incorrect.")); return; }
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setErr(/same|different/i.test(error.message) ? L("Password baru harus berbeda dari password lama.", "The new password must differ from the old one.")
        : /weak|short|characters/i.test(error.message) ? L(`Password terlalu lemah: ${error.message}`, `Password too weak: ${error.message}`)
        : /reauth|nonce/i.test(error.message) ? L("Supabase meminta verifikasi tambahan. Minta Admin G4S / Admin GA mematikan 'Secure password change' di Authentication → Providers → Email, atau minta reset password.", "Supabase requires extra verification. Ask the G4S / GA Admin to turn off 'Secure password change' under Authentication → Providers → Email, or ask for a password reset.")
        : error.message);
      return;
    }
    onDone(L("Password berhasil diubah. Gunakan password baru saat login berikutnya.", "Password changed. Use the new password the next time you sign in."));
    onClose();
  }

  if (!mounted || !open) return null;
  return createPortal(
    <div className="cp-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form className="cp" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="cp-title">
        <div className="cp-h">
          <div><div className="eyebrow">{L("Akun saya", "My account")}</div><h2 id="cp-title">{L("Ubah password", "Change password")}</h2><p className="sub">{email}</p></div>
          <button type="button" className="dclose" style={{ position: "static" }} onClick={onClose} aria-label={L("Tutup", "Close")} disabled={busy}>×</button>
        </div>
        <label>{L("Password lama", "Old password")}<input ref={first} type={show ? "text" : "password"} autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} /></label>
        <label>{L("Password baru", "New password")}<input type={show ? "text" : "password"} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <label>{L("Ulangi password baru", "Repeat new password")}<input type={show ? "text" : "password"} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        <label className="cp-show"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> {L("Tampilkan password", "Show password")}</label>
        <ul className="cp-rules">{rules.map((r) => <li key={r.t} className={r.ok ? "ok" : ""}>{r.t}</li>)}</ul>
        <p className="note">{L("Akun ini juga dipakai di aplikasi lain pada sistem yang sama (mis. G-C). Password baru ikut berlaku di sana.", "This account is also used in other apps on the same system (e.g. G-C). The new password applies there too.")}</p>
        {err && <div className="cp-err" role="alert">{err}</div>}
        <div className="cp-f">
          <button type="button" className="btn q" onClick={onClose} disabled={busy}>{L("Batal", "Cancel")}</button>
          <button type="submit" className="btn red" disabled={busy || !valid}>{busy ? L("Menyimpan…", "Saving…") : L("Simpan password baru", "Save new password")}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}
