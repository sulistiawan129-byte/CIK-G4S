"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useApp } from "@/components/AppContext";
import { fDur, fTime, gateApi, todayWIB, useGateList, useTick, type GateRow, useGateBase } from "@/lib/gate";

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
  const isAdmin = profile.role === "master_admin" || profile.role === "admin";
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

  const stats = {
    masuk: history?.length ?? 0,
    keluar: history?.filter((g) => g.status === "out").length ?? 0,
    temuan: history?.filter((g) => g.finding_count > 0).length ?? 0,
    lama: (inside ?? []).filter((g) => (Date.now() - new Date(g.in_at).getTime()) / 3600000 >= LONG_HOURS).length,
  };
  const isToday = day === todayWIB();
  const selectable = shown.filter((g) => g.status === "out" && (!g.sl_at || !g.spv_at));

  return (
    <div className="page enter gate-home">
      <section className="g-hero">
        <div className="g-hero-l">
          <div className="eyebrow">Gate transporter · {site?.name ?? ""}</div>
          <h1>{insideShown.length} kendaraan di dalam area</h1>
          <p className="lede">{isToday ? "Hari ini" : day}: {stats.masuk} masuk, {stats.keluar} keluar, {stats.temuan} dengan temuan.{stats.lama ? ` ${stats.lama} kendaraan sudah lebih dari ${LONG_HOURS} jam di dalam.` : ""}</p>
        </div>
        <div className="g-hero-r">
          {canGate && <Link href={`${base}/baru`} className="g-big in"><span>Gate In</span><small>Kendaraan datang</small></Link>}
          <form className="g-big out" onSubmit={goOut}>
            <label htmlFor="g-find"><span>Gate Out</span><small>Ketik nopol kendaraan yang keluar</small></label>
            <input id="g-find" className="g-in" placeholder="Cari nopol…" autoCapitalize="characters" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
        </div>
      </section>

      <section className="sec">
        <div className="sechead">
          <div><h2>Di dalam area</h2><p className="sub">Urut dari yang paling lama. Kartu merah: lebih dari {LONG_HOURS} jam.</p></div>
          <span className={`livep ${live ? "on" : ""}`}><i></i>{live ? "Live" : "…"}</span>
        </div>
        {inside === null ? <div className="sk" style={{ height: 120 }} /> : insideShown.length ? (
          <div className="g-cards">{insideShown.map((g) => <Card key={g.id} g={g} />)}</div>
        ) : <div className="g-empty">{q ? `Tidak ada kendaraan “${q}” di dalam area.` : "Tidak ada kendaraan di dalam area."}</div>}
      </section>

      <section className="sec">
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

