"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "./AppContext";
import { Icon } from "./Icon";
import { MODULES, MONTH_ID, ROLE_LABEL } from "@/lib/constants";
import { addMonths, parseMonth } from "@/lib/dates";
import { SLIDES, slideOk } from "@/lib/slides";
import { checks } from "@/lib/calc";

export function Shell({ children }: { children: React.ReactNode }) {
  const { profile, sites, siteId, setSiteId, month, setMonth, live, can, D, canWrite } = useApp();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const mod = MODULES.find((m) => (m.href === "/" ? path === "/" : path.startsWith(m.href)));
  const allowed = path.startsWith("/pengguna") ? profile.role === "master_admin" : !mod || can(mod.key);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".umenu")) setMenu(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  function toggleTheme() {
    const r = document.documentElement;
    const dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    r.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("sd-theme", r.dataset.theme); } catch {}
  }

  const ml = month ? `${MONTH_ID[parseMonth(month).m0]} ${parseMonth(month).y}` : "…";
  const ready = D ? (() => { const ch = checks(D); return SLIDES.filter((s) => slideOk(D, s, ch)).length; })() : null;
  const initials = (profile.full_name || profile.email || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <header className="top"><div className="top-in">
        <Link href="/" className="wm" style={{ textDecoration: "none" }}><i></i>Security Desk</Link>
        {sites.length > 1 ? (
          <select className="sitesel" value={siteId ?? ""} onChange={(e) => setSiteId(e.target.value)} aria-label="Pilih site">
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : <span className="per">{sites[0]?.name ?? "Belum ada site"}</span>}
        <div className="sp"></div>
        <span className={`livep ${live ? "on" : ""}`} title={live ? "Tersambung realtime" : "Menyambungkan…"}><i></i>{live ? "Live" : "Offline"}</span>
        <div className="mswitch">
          <button onClick={() => month && setMonth(addMonths(month, -1))} aria-label="Bulan sebelumnya">‹</button>
          <b>{ml}</b>
          <button onClick={() => month && setMonth(addMonths(month, 1))} aria-label="Bulan berikutnya">›</button>
        </div>
        <button className="tt" onClick={toggleTheme} aria-label="Ganti tema terang/gelap">◐</button>
        <div className="umenu">
          <button onClick={() => setMenu((v) => !v)} aria-expanded={menu}><span className="av">{initials}</span><span className="per" style={{ display: "inline" }}>{profile.full_name?.split(" ")[0]}</span></button>
          {menu && (
            <div className="pop">
              <div><b>{profile.full_name}</b><p className="sub">{profile.email}</p></div>
              <span className="chip">{ROLE_LABEL[profile.role]}</span>
              {!canWrite && <p className="sub">Akun ini hanya bisa melihat.</p>}
              <form action="/auth/signout" method="post"><button className="btn q" style={{ width: "100%", justifyContent: "center" }}>Keluar</button></form>
            </div>
          )}
        </div>
      </div></header>

      <div className="shell">
        <nav className="nav" aria-label="Menu">
          {MODULES.filter((m) => can(m.key)).map((m) => (
            <span key={m.key} style={{ display: "contents" }}>
              {m.key === "laporan" && <div className="sep"></div>}
              <Link href={m.href} aria-current={mod?.key === m.key ? "page" : undefined}>
                <Icon name={m.key} />{m.label}
                {m.key === "laporan" && ready !== null && <span className="badge">{ready}/{SLIDES.length}</span>}
              </Link>
            </span>
          ))}
          {profile.role === "master_admin" && <Link href="/pengguna" aria-current={path.startsWith("/pengguna") ? "page" : undefined}><Icon name="pengguna" />Pengguna</Link>}
          <div className="sep"></div>
          <Link href="/display" target="_blank" className="navdisp"><Icon name="display" />Layar ruang Security ↗</Link>
          <small>{ROLE_LABEL[profile.role]}{!canWrite ? " · lihat saja" : ""}</small>
        </nav>
        <main>{allowed ? children : <div className="errbox">Akun ini tidak punya akses ke menu ini.</div>}</main>
      </div>
    </>
  );
}
