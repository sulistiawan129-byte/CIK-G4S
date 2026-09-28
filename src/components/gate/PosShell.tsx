"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/components/AppContext";
import { GateBaseCtx } from "@/lib/gate";

export function PosShell({ children }: { children: React.ReactNode }) {
  const { profile, site, sites, siteId, setSiteId } = useApp();
  const path = usePathname();
  const initials = (profile.full_name || profile.email || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <GateBaseCtx.Provider value="/pos">
      <header className="top pos-top"><div className="top-in">
        <Link href="/pos" className="wm" style={{ textDecoration: "none" }}><i></i>Pos Gate</Link>
        {sites.length > 1 ? (
          <select className="sitesel" value={siteId ?? ""} onChange={(e) => setSiteId(e.target.value)} aria-label="Pilih site">
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : <span className="per">{site?.name ?? ""}</span>}
        <div className="sp"></div>
        {path !== "/pos/baru" && <Link href="/pos/baru" className="btn red sm pos-in">+ Gate In</Link>}
        <div className="pos-user">
          <span className="av">{initials}</span>
          <span className="pos-name">{profile.full_name?.split(" ")[0]}</span>
          <form action="/auth/signout?to=pos" method="post"><button className="pos-out">Keluar</button></form>
        </div>
      </div></header>
      <main className="pos-main">{children}</main>
    </GateBaseCtx.Provider>
  );
}
