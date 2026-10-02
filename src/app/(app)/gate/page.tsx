"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useApp } from "@/components/AppContext";
import { isFull } from "@/lib/access";
import { fDur, fDurMs, fTime, gateApi, gateStats, todayWIB, useGateList, useTick, type GateRow, useGateBase } from "@/lib/gate";
import { FlowChart } from "@/components/gate/Flow";

const LONG_HOURS = 4;

function Card({ g }: { g: GateRow }) {
  const base = useGateBase();
  const hrs = (Date.now() - new Date(g.in_at).getTime()) / 3600000;
  return (
    <Link href={`${base}/${g.id}`} className={`g-card ${hrs >= LONG_HOURS ? "long" : ""} ${g.finding_count ? "has-f" : ""}`}>
      <div className="g-card-top">
        <span className="g-plate">{g.nopol}</span>
        <span className="g-dur" title="Lama di dalam area">{fDur(g.in_at)}</span>
      </div>
      <b className="g-card-co">{g.company_name || "–"}</b>
      <span className="g-card-meta">{g.driver_name || "–"} · {g.vehicle_type || "kendaraan"}</span>
      <div className="g-card-foot">
        <span>Masuk {fTime(g.in_at)} · {g.in_dept_name || "–"}</span>
        {g.finding_count > 0 && <span className="g-tag bad">{g.finding_count} temuan</span>}
      </div>
      <span className="g-card-cta">Gate Out →</span>
    </Link>
  );
}

export default function GatePage() {
  const { siteId, site, canGate, profile, toast, fail } = useApp();
  const router = useRouter();
  const [day, setDay] = useState(todayWIB());
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"semua" | "keluar" | "temuan" | "belum">("semua");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const { inside, history, live } = useGateList(siteId, day);
  useTick(30000);
  const isAdmin = isFull(profile.role);
  const base = useGateBase();

  const shown = useMemo(() => {
    const list = history ?? [];
    const s = q.trim().toUpperCase().replace(/\s+/g, "");
    return list.filter((g) =>
      (!s || g.nopol.replace(/\s+/g, "").includes(s) || g.company_name.toUpperCase().includes(s) || g.driver_name.toUpperCase().includes(s)) &&
      (tab === "semua" || (tab === "keluar" && g.status === "out") || (tab === "temuan" && g.finding_count > 0) || (tab === "belum" && g.status === "out" && (!g.sl_at || !g.spv_at)))
    );
  }, [history, q, tab]);

  const insideShown = useMemo(() => {
    const s = q.trim().toUpperCase().replace(/\s+/g, "");
    return (inside ?? []).filter((g) => !s || g.nopol.replace(/\s+/g, "").includes(s) || g.company_name.toUpperCase().includes(s));
  }, [inside, q]);

  function goOut(e: React.FormEvent) {
    e.preventDefault();
    if (insideShown.length === 1) router.push(`${base}/${insideShown[0].id}`);
    else if (!insideShown.length && q.trim()) toast(`Tidak ada kendaraan ${q.toUpperCase()} di dalam area`, "err");
  }
  async function ack(who: "sl" | "spv") {
    const ids = [...sel];
    if (!ids.length) return;
    try { await gateApi.acknowledge(ids, who); toast(`${ids.length} pemeriksaan ditandai diketahui ${who === "sl" ? "Shift Leader" : "Supervisor"}`); setSel(new Set()); }
    catch (e) { fail(e as Error); }
  }

  const gs = gateStats(history ?? [], inside ?? []);
  const stats = { masuk: gs.masuk, keluar: gs.keluar, temuan: gs.temuan, lama: gs.lama };
  const isToday = day === todayWIB();
  const selectable = shown.filter((g) => g.status === "out" && (!g.sl_at || !g.spv_at));

  return (
    <div className="dgrid enter gate-home">
      <section className="dband gband" aria-label="Ringkasan gate">
        <div className="gb-stats">
          <div><b>{gs.masuk}</b><span>Masuk {isToday ? "hari ini" : day}</span></div>
          <div><b>{gs.keluar}</b><span>Keluar</span></div>
          <div><b>{gs.dalam}</b><span>Di dalam · live</span></div>
          <div className={gs.lama ? "bad" : ""}><b>{gs.lama}</b><span>&gt; {LONG_HOURS} jam</span></div>
          <div className={gs.temuan ? "bad" : ""}><b>{gs.temuan}</b><span>Ada temuan</span></div>
          <div><b>{gs.avgMs ? fDurMs(gs.avgMs) : "–"}</b><span>Rata-rata di dalam</span></div>
        </div>
        <div className="gb-act">
          {canGate && <Link href={`${base}/baru`} className="btn red">+ Gate In</Link>}
          <form onSubmit={goOut} className="gb-find">
            <input className="g-in" placeholder={canGate ? "Gate Out · ketik nopol…" : "Cari nopol…"} aria-label="Cari nopol untuk Gate Out" autoCapitalize="characters" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
        </div>
      </section>

      <section className="dcard c8">
        <div className="dch"><h2>Di dalam area</h2><span className={`live ${live ? "on" : ""}`}><i></i>{live ? "LIVE" : "…"}</span><span className="sub" style={{ margin: 0 }}>{site?.name ?? ""} · merah: lebih dari {LONG_HOURS} jam</span></div>
        {inside === null ? <div className="sk" style={{ height: 120 }} /> : insideShown.length ? (
          <div className="g-cards">{insideShown.map((g) => <Card key={g.id} g={g} />)}</div>
        ) : <div className="g-empty">{q ? `Tidak ada kendaraan “${q}” di dalam area.` : "Tidak ada kendaraan di dalam area."}</div>}
      </section>

      <section className="dcard c4">
        <div className="dch"><h2>Arus per jam</h2><span className="sub" style={{ margin: 0 }}>{isToday ? "hari ini" : day}</span></div>
        <FlowChart today={history ?? []} day={day} />
        <div className="dleg" style={{ margin: "6px 0 14px" }}><span><i style={{ background: "var(--bar)" }}></i>Masuk</span><span><i style={{ background: "#DA291C" }}></i>Keluar</span></div>
        <div className="dch" style={{ marginTop: 4 }}><h2>Transporter teratas</h2></div>
        {gs.top.length ? (
          <div className="hbar">{gs.top.slice(0, 6).map(([n, v]) => <div className="r" key={n}><span>{n}</span><span className="t"><i style={{ width: `${(v / gs.top[0][1]) * 100}%` }}></i></span><b>{v}</b></div>)}</div>
        ) : <p className="sub">Belum ada kendaraan.</p>}
      </section>

      <section className="dcard c12">
        <div className="sechead">
          <div><h2>Riwayat pemeriksaan</h2><p className="sub">Semua kendaraan yang masuk pada tanggal ini.</p></div>
          <input type="date" className="g-in g-date" value={day} max={todayWIB()} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Tanggal" />
        </div>
        <div className="g-tabs" role="tablist">
          {([["semua", `Semua ${stats.masuk}`], ["keluar", `Sudah keluar ${stats.keluar}`], ["temuan", `Ada temuan ${stats.temuan}`], ["belum", "Belum diketahui SL/SPV"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {isAdmin && selectable.length > 0 && (
          <div className="g-batch">
            <label><input type="checkbox" checked={selectable.every((g) => sel.has(g.id))} onChange={(e) => setSel(e.target.checked ? new Set(selectable.map((g) => g.id)) : new Set())} /> Pilih semua ({selectable.length})</label>
            <span className="sp"></span>
            <button className="btn q sm" disabled={!sel.size} onClick={() => ack("sl")}>Diketahui Shift Leader</button>
            <button className="btn sm" disabled={!sel.size} onClick={() => ack("spv")}>Diketahui Supervisor</button>
          </div>
        )}
        {history === null ? <div className="sk" style={{ height: 160 }} /> : shown.length ? (
          <ul className="g-rows">
            {shown.map((g) => {
              const fs = g.finding_count;
              return (
                <li key={g.id}>
                  {isAdmin && <input type="checkbox" aria-label={`Pilih ${g.nopol}`} disabled={!(g.status === "out" && (!g.sl_at || !g.spv_at))} checked={sel.has(g.id)} onChange={(e) => { const n = new Set(sel); e.target.checked ? n.add(g.id) : n.delete(g.id); setSel(n); }} />}
                  <Link href={`${base}/${g.id}`} className="g-row">
                    <span className="g-plate sm">{g.nopol}</span>
                    <span className="g-row-main"><b>{g.company_name || "–"}</b><small>{g.driver_name} · {g.doc_no}</small></span>
                    <span className="g-row-time"><b>{fTime(g.in_at)} → {g.out_at ? fTime(g.out_at) : "…"}</b><small>{g.out_at ? fDur(g.in_at, g.out_at) : "masih di dalam"}</small></span>
                    <span className="g-row-tags">
                      {g.status === "in" ? <span className="g-tag warn">Di dalam</span> : <span className="g-tag ok">Keluar</span>}
                      {fs > 0 && <span className="g-tag bad">{fs} temuan</span>}
                      {g.nc_report_id && <span className="g-tag">NC</span>}
                      {g.status === "out" && <span className={`g-tag ${g.sl_at && g.spv_at ? "ok" : ""}`}>{g.sl_at && g.spv_at ? "Diketahui" : `SL ${g.sl_at ? "✓" : "–"} · SPV ${g.spv_at ? "✓" : "–"}`}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : <div className="g-empty">Belum ada data untuk pilihan ini.</div>}
      </section>
    </div>
  );
}

