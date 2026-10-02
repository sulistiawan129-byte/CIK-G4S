"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "./AppContext";
import { Icon } from "./Icon";
import { ChangePassword } from "./ChangePassword";
import { MONTH_ID } from "@/lib/constants";
import { MODULES, ROLE_LABEL, canPath, isFull, isUserAdmin, moduleOf } from "@/lib/access";
import { addMonths, parseMonth } from "@/lib/dates";
import { SLIDES, slideOk } from "@/lib/slides";
import { checks } from "@/lib/calc";

/** Kerangka admin penuh layar: menu gelap di kiri (bisa diciutkan), header ringkas, tab bar di HP. */
export function Shell({ children }: { children: React.ReactNode }) {
  const { profile, sites, siteId, setSiteId, month, setMonth, live, can, D, canWrite, toast } = useApp();
  const [pwOpen, setPwOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [mini, setMini] = useState(false);
  const path = usePathname();
  const full = isFull(profile.role);
  const mod = moduleOf(path);
  const allowed = canPath(profile.role, path) && (!mod || can(mod.key));
  const title = path.startsWith("/pengguna") ? "Pengguna" : path.startsWith("/gc/tujuan") ? "Supplier & tujuan" : mod?.label ?? "Security Desk";
  const showMonth = MODULES.some((m) => (m.group === "security" || m.key === "eksekutif") && m.key === mod?.key);
  const groups: [string, string][] = [["security", "Security"], ["transporter", "Kepatuhan transporter"], ["lain", "Lainnya"]];

  useEffect(() => { try { setMini(localStorage.getItem("sd-mini") === "1"); } catch {} }, []);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".umenu")) setMenu(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  function toggleMini() { setMini((v) => { try { localStorage.setItem("sd-mini", v ? "0" : "1"); } catch {} return !v; }); }
  function toggleTheme() {
    const r = document.documentElement;
    const dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    r.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("sd-theme", r.dataset.theme); } catch {}
  }

  const ml = month ? `${MONTH_ID[parseMonth(month).m0]} ${parseMonth(month).y}` : "…";
  const ready = D ? (() => { const ch = checks(D); return SLIDES.filter((s) => slideOk(D, s, ch)).length; })() : null;
  const initials = (profile.full_name || profile.email || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const site = sites.find((s) => s.id === siteId);

  return (
    <div className={`adm ${mini ? "mini" : ""}`}>
      <nav className="rail" aria-label="Menu">
        <Link href={full ? "/" : profile.role === "she_dept" ? "/gc" : "/eksekutif"} className="rail-brand"><i></i><span>Security Desk</span></Link>
        {groups.map(([g, gl]) => {
          const items = MODULES.filter((m) => m.group === g && can(m.key));
          if (!items.length) return null;
          return (
            <div className="rail-grp" key={g}>
              <small>{gl}</small>
              {items.map((m) => (
                <Link key={m.key} href={m.href} aria-current={mod?.key === m.key ? "page" : undefined} title={m.label}>
                  <Icon name={m.icon} /><span>{m.label}</span>
                  {m.key === "laporan" && ready !== null && <em className="rail-badge">{ready}/{SLIDES.length}</em>}
                </Link>
              ))}
            </div>
          );
        })}
        {isUserAdmin(profile.role) && <Link href="/pengguna" aria-current={path.startsWith("/pengguna") ? "page" : undefined} title="Pengguna"><Icon name="pengguna" /><span>Pengguna</span></Link>}
        {full && <>
          <div className="rail-sep"></div>
          <Link href="/display" target="_blank" className="rail-x" title="Layar ruang Security"><Icon name="display" /><span>Layar ruang Security ↗</span></Link>
          <Link href="/pos" target="_blank" className="rail-x" title="Aplikasi petugas gate"><Icon name="gate" /><span>Aplikasi petugas ↗</span></Link>
        </>}
        <div className="rail-grow"></div>
        <button className="rail-tg" onClick={toggleMini} aria-label={mini ? "Lebarkan menu" : "Ciutkan menu"}>{mini ? "»" : "«"}</button>
      </nav>

      <div className="amain">
        <header className="atop">
          <h1>{title}</h1>
          <span className={`live ${live ? "on" : ""}`} title={live ? "Tersambung realtime" : "Menyambungkan…"}><i></i>{live ? "LIVE" : "…"}</span>
          {sites.length > 1 ? (
            <select className="sitesel" value={siteId ?? ""} onChange={(e) => setSiteId(e.target.value)} aria-label="Pilih site">
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : <span className="atop-site">{site?.name ?? sites[0]?.name ?? ""}</span>}
          <span className="sp"></span>
          {showMonth && (
            <div className="mswitch">
              <button onClick={() => month && setMonth(addMonths(month, -1))} aria-label="Bulan sebelumnya">‹</button>
              <b>{ml}</b>
              <button onClick={() => month && setMonth(addMonths(month, 1))} aria-label="Bulan berikutnya">›</button>
            </div>
          )}
          <button className="tt" onClick={toggleTheme} aria-label="Ganti tema terang/gelap">◐</button>
          <div className="umenu">
            <button onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label="Menu akun"><span className="av">{initials}</span></button>
            {menu && (
              <div className="pop">
                <div><b>{profile.full_name}</b><p className="sub">{profile.email}</p></div>
                <span className="chip">{ROLE_LABEL[profile.role]}{!canWrite ? " · lihat saja" : ""}</span>
                <button className="btn q" style={{ width: "100%", justifyContent: "center" }} onClick={() => { setMenu(false); setPwOpen(true); }}>Ubah password</button>
                <form action="/auth/signout" method="post"><button className="btn q" style={{ width: "100%", justifyContent: "center" }}>Keluar</button></form>
              </div>
            )}
          </div>
        </header>
        <main className="acontent">{allowed ? children : <div className="errbox">Akun ini tidak punya akses ke menu ini.</div>}</main>
      </div>
      <ChangePassword email={profile.email ?? ""} open={pwOpen} onClose={() => setPwOpen(false)} onDone={(m) => toast(m)} />
    </div>
  );
}
