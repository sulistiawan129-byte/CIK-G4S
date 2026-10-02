"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useMonthData } from "@/lib/data";
import { latestMonthFor } from "@/lib/latest";
import { CATS, DOW, DOWL, dec, fmt } from "@/lib/constants";
import { agg, checks, incTotal, kpiCalc, monthName, monthsOpen, patrolPct, r4Day, vsPrev } from "@/lib/calc";
import { parseMonth, shiftNow } from "@/lib/dates";
import { SLIDES, slideOk } from "@/lib/slides";
import { Count, Spark } from "@/components/ui";
import type { MonthData, Site } from "@/lib/types";
import { LONG_MS, fDurMs, fDurShort, gateStats, todayWIB, useGateList, useTick, type GateRow } from "@/lib/gate";
import { FlowChart } from "@/components/gate/Flow";

/** Daftar kendaraan di dalam area yang dipotong sesuai tinggi panel (+n kendaraan lain). */
function InsideList({ rows }: { rows: GateRow[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(rows.length);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const kids = [...el.querySelectorAll<HTMLElement>(".r")];
      kids.forEach((k) => (k.style.display = ""));
      const limit = el.getBoundingClientRect().bottom;
      const over = (k: HTMLElement, reserve: number) => k.getBoundingClientRect().bottom > limit - reserve;
      let n = kids.findIndex((k) => over(k, 0));
      if (n >= 0) { n = kids.findIndex((k) => over(k, 26)); }
      if (n < 0) n = kids.length;
      kids.forEach((k, i) => (k.style.display = i >= n ? "none" : ""));
      setFit(n);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows]);
  return (
    <div className="w-gin" ref={box}>
      {rows.length ? rows.map((g) => (
        <div key={g.id} className={`r ${Date.now() - new Date(g.in_at).getTime() > LONG_MS ? "long" : ""}`}>
          <span className="g-plate">{g.nopol}</span>
          <span className="co">{g.company_name || "–"}<small>{g.in_dept_name}</small></span>
          <span className="dur">{fDurShort(g.in_at)}</span>
        </div>
      )) : <div className="r empty"><span className="co">Tidak ada kendaraan di dalam area</span></div>}
      {fit < rows.length && <div className="more">+{rows.length - fit} kendaraan lain</div>}
    </div>
  );
}

function useNow(ms = 1000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function Header({ site, live, loadedAt }: { site: Site | null; live: boolean; loadedAt?: number }) {
  const now = useNow();
  const [sn, sh] = now ? shiftNow(now.getHours()) : ["", ""];
  return (
    <header className="w-head">
      <div className="w-brand"><i></i><div><b>Security Desk</b><span>{site ? `${site.client ?? ""} · ${site.name}` : "…"}</span></div></div>
      <div className={`w-live ${live ? "on" : ""}`}><i></i>{live ? "LIVE" : "MENYAMBUNG…"}<span>{loadedAt ? `diperbarui ${new Date(loadedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}</span></div>
      <div className="w-clock">
        <b className="tn">{now ? now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "--.--"}<small>{now ? String(now.getSeconds()).padStart(2, "0") : ""}</small></b>
        <span>{now ? now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}<em>Shift {sn} · {sh}</em></span>
      </div>
    </header>
  );
}

function Wall({ D, site, live }: { D: MonthData; site: Site | null; live: boolean }) {
  const today = todayWIB();
  const { inside, history } = useGateList(site?.id ?? null, today);
  useTick(30000);
  const gs = gateStats(history ?? [], inside ?? []);
  const { name, year } = monthName(D.month);
  const lastIdx = D.filled.lastIndexOf(true), li = lastIdx >= 0 ? lastIdx : 0, day = D.days[li];
  const ch = checks(D), ready = SLIDES.filter((s) => slideOk(D, s, ch)).length;
  const r4 = r4Day(D, li), mo = D.daily.motor[li], vi = D.daily.visitor[li];
  const avgOf = (k: "motor" | "visitor") => { const a = agg(D, k); return day.we ? a.aWE : a.aWD; };
  const r4avg = CATS.filter((c) => c.r4).reduce((s, c) => { const a = agg(D, c.k); return s + (day.we ? a.aWE : a.aWD); }, 0);
  const pc = patrolPct(D), inc = incTotal(D), k = kpiCalc(D), { m0 } = parseMonth(D.month);
  const max = Math.max(...D.days.map((x) => r4Day(D, x.d - 1)), 1);
  const evDays = new Set(D.events.map((e) => Number(e.day.slice(8, 10))));
  const feed = [...D.events].sort((a, b) => (b.day + b.created_at).localeCompare(a.day + a.created_at)).slice(0, 6);
  const openNi = D.improvements.filter((n) => n.status !== "Selesai");
  const oldest = openNi.length ? Math.max(...openNi.map((n) => monthsOpen(n.opened_month, D.month))) : 0;
  const incOn = [...D.inc].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const tick = [
    ...(gs.lama ? [{ lv: "warn", title: `${gs.lama} transporter lebih dari 4 jam di dalam area`, sub: "" }] : []),
    ...(gs.temuan ? [{ lv: "warn", title: `${gs.temuan} pemeriksaan gate hari ini dengan temuan`, sub: "" }] : []),
    ...(feed[0] ? [{ lv: "note", title: `Catatan terbaru ${Number(feed[0].day.slice(8, 10))} ${name.slice(0, 3)}: ${feed[0].description}`, sub: "" }] : []),
    ...ch,
  ];
  const delta = (v: number, avg: number) => { if (!avg) return null; const p = Math.round(((v - avg) / avg) * 100); return <span className={Math.abs(p) < 15 ? "ok" : "warn"}>{p > 0 ? "+" : ""}{p}% dari rata-rata</span>; };

  return (
    <div className="wall">
      <Header site={site} live={live} loadedAt={D.loadedAt} />

      <section className="w-today">
        <div className="w-label">Data terakhir · {DOWL[day.dow]}, {day.d} {name}<em>{day.we ? "hari libur" : "hari kerja"}</em><em className="r">Portal gate · hari ini, realtime</em></div>
        <div className="w-tiles six">
          <div className="w-tile"><Count className="w-big" value={r4} /><b>Kendaraan roda empat</b>{delta(r4, r4avg)}</div>
          <div className="w-tile"><Count className="w-big" value={mo} /><b>Motor · visitor {fmt(vi)}</b>{delta(mo, avgOf("motor"))}</div>
          <div className="w-tile"><div className="w-big"><Count value={pc} d={2} /><small>%</small></div><b>Checkpoint patroli</b><span className={pc >= 99.5 ? "ok" : "warn"}>{fmt(D.patrol.target_checkpoint - D.patrol.actual_checkpoint)} terlewat bulan ini</span></div>
          <div className="w-tile accent"><Count className="w-big" value={gs.dalam} /><b>Transporter di dalam · live</b><span className={gs.lama ? "bad" : "ok"}>{gs.lama ? `${gs.lama} lebih dari 4 jam` : "semua di bawah 4 jam"}</span></div>
          <div className="w-tile"><div className="w-big"><Count value={gs.masuk} /><small style={{ color: "#8E8E93" }}> / {gs.keluar}</small></div><b>Masuk / keluar gate hari ini</b><span className="sm">rata-rata {gs.avgMs ? fDurMs(gs.avgMs) : "–"} di dalam</span></div>
          <div className="w-tile"><Count className={`w-big ${gs.temuan ? "red" : ""}`} value={gs.temuan} /><b>Temuan gate hari ini</b><span className="sm">dari {gs.masuk} pemeriksaan</span></div>
        </div>
      </section>

      <section className="w-mid">
        <div className="w-panel">
          <div className="w-ph"><h3>{name} {year} · roda empat per hari</h3><span className="w-leg"><i className="a"></i>Hari kerja <i className="b"></i>Hari libur <i className="c"></i>Ada catatan</span></div>
          <div className="w-strip">
            {D.days.map((x, i) => {
              const v = r4Day(D, x.d - 1);
              return (
                <div key={x.d} className={`w-d ${x.we ? "we" : ""} ${i === li ? "last" : ""} ${!D.filled[i] ? "empty" : ""}`} style={{ ["--i" as string]: i }}>
                  <span className={`ev ${evDays.has(x.d) ? "on" : ""}`}></span>
                  <span className="v">{i === li ? fmt(v) : ""}</span>
                  <span className="b" style={{ height: `${Math.max(2, (v / max) * 100)}%` }}></span>
                  <span className="n">{x.d}</span><span className="w">{DOW[x.dow].slice(0, 1)}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="w-panel w-gate">
          <div className="w-ph"><h3>Portal gate · live</h3><span className="w-leg"><i className="a"></i>Masuk <i className="r"></i>Keluar · per jam</span></div>
          <FlowChart today={history ?? []} day={today} dark />
          <InsideList rows={inside ?? []} />
        </div>
      </section>

      <section className="w-bottom">
        {CATS.filter((c) => c.k !== "tamu").map((c) => { const v = vsPrev(D, c.k); return (
          <div className="w-cat" key={c.k}>
            <b>{c.n}</b>
            <Count className="w-num" value={v.t} />
            <span className={v.d < 0 ? "dn" : "up"}>{v.d < 0 ? "▼" : "▲"} {fmt(Math.abs(v.d))} ({dec(Math.abs(v.pct), 1)}%)</span>
            <Spark vals={D.totals13[c.k]} W={200} H={34} />
          </div>
        ); })}
        <div className="w-cat">
          <b>Kejadian</b><Count className="w-num" value={inc} />
          <div className="w-stack">{incOn.map((i, j) => <i key={i.category} style={{ flex: i.value, opacity: 1 - j * .15 }}></i>)}</div>
          <span className="sm">{incOn.slice(0, 2).map((i) => `${i.category} ${i.value}`).join(" · ") || "Nihil"}</span>
        </div>
        <div className="w-cat">
          <b>Top transporter hari ini</b>
          <span className="w-name">{gs.top[0]?.[0] ?? "–"}</span>
          <span className="sm">{gs.top[0] ? `${gs.top[0][1]} kendaraan` : "belum ada kendaraan"}{gs.top[1] ? ` · berikutnya ${gs.top[1][0]}` : ""}</span>
        </div>
        <div className="w-cat">
          <b>Temuan terbuka</b><Count className="w-num" value={openNi.length} />
          <span className={oldest >= 3 ? "dn" : "sm"}>{openNi.length ? `tertua ${oldest} bulan` : "semua selesai"}</span>
          <span className="sm">KPI {name}: {k.monthly[m0] === null ? "–" : dec(k.monthly[m0] as number)} · laporan {ready}/{SLIDES.length}</span>
        </div>
      </section>

      <footer className="w-ticker" aria-label="Perlu dicek">
        <span className="w-tl">Perlu dicek</span>
        <div className="w-tm"><div className="w-tt">
          {(tick.length ? [...tick, ...tick] : [{ lv: "ok", title: "Semua data lengkap", sub: "" }, { lv: "ok", title: "Semua data lengkap", sub: "" }]).map((c, i) => (
            <span key={i} className={`w-ti ${c.lv}`}><i></i>{c.title}{c.sub ? ` — ${c.sub}` : ""}</span>
          ))}
        </div></div>
      </footer>
    </div>
  );
}

function Display() {
  const params = useSearchParams();
  const [sites, setSites] = useState<Site[] | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [idle, setIdle] = useState(false);
  const site = sites ? (sites.find((s) => s.code === params.get("site")) ?? sites[0] ?? null) : null;
  const { data, live, error } = useMonthData(site?.id ?? null, month);

  useEffect(() => { supabaseBrowser().from("sites").select("id,code,name,client").order("code").then(({ data }) => setSites((data ?? []) as Site[])); }, []);
  useEffect(() => {
    if (!site) return;
    const pick = () => latestMonthFor(site.id).then((m) => setMonth((cur) => (cur === m ? cur : m)));
    pick();
    const t = setInterval(pick, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [site]);
  // Layar menyala terus + muat ulang halaman tiap 6 jam supaya tetap segar.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const req = () => nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    req();
    const vis = () => document.visibilityState === "visible" && req();
    document.addEventListener("visibilitychange", vis);
    const reload = setTimeout(() => location.reload(), 6 * 60 * 60 * 1000);
    let t: ReturnType<typeof setTimeout>;
    const move = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), 4000); };
    move();
    window.addEventListener("pointermove", move);
    return () => { lock?.release(); document.removeEventListener("visibilitychange", vis); clearTimeout(reload); clearTimeout(t); window.removeEventListener("pointermove", move); };
  }, []);

  function full() { document.documentElement.requestFullscreen?.().catch(() => {}); }

  return (
    <div className={`wall-root ${idle ? "idle" : ""}`}>
      {sites && !sites.length ? <div className="w-msg">Akun ini belum diberi akses ke site mana pun.</div>
        : error ? <div className="w-msg">Data belum bisa dimuat: {error}</div>
        : !data ? <div className="w-msg"><span className="w-spin"></span>Memuat data…</div>
        : <Wall D={data} site={site} live={live} />}
      <div className="w-ctrl">
        <button onClick={full}>Layar penuh</button>
        <form action="/auth/signout" method="post"><button>Keluar</button></form>
      </div>
    </div>
  );
}

export default function Page() { return <Suspense><Display /></Suspense>; }
