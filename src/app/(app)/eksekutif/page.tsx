"use client";
import { useApp } from "@/components/AppContext";
import { Count, Loading, Spark } from "@/components/ui";
import { CATS, DOW, dec, fmt } from "@/lib/constants";
import { agg, incTotal, kpiCalc, monthName, monthsOpen, patrolPct, r4Day, vsPrev } from "@/lib/calc";
import { parseMonth } from "@/lib/dates";
import { LONG_MS, fDurMs, fDurShort, gateStats, todayWIB, useGateList, useTick } from "@/lib/gate";
import { FlowChart } from "@/components/gate/Flow";
import { useNcSummary } from "@/lib/gc/summary";
import { NcSummaryCard, NcTopCard } from "@/components/NcCards";

/** Dashboard eksekutif untuk Management: ringkasan security + transporter, hanya lihat. */
export default function Eksekutif() {
  const { D, error, siteId, site } = useApp();
  const day = todayWIB();
  const { inside, history, live } = useGateList(siteId, day);
  const { data: nc } = useNcSummary(D?.month ?? null);
  useTick(30000);
  if (!D) return <Loading error={error} />;

  const { name, year } = monthName(D.month);
  const { m0 } = parseMonth(D.month);
  const r4c = CATS.filter((c) => c.r4);
  const r4h = D.totals13.karyawan.map((_, i) => r4c.reduce((a, c) => a + D.totals13[c.k][i], 0));
  const mo = agg(D, "motor").total, vi = agg(D, "visitor").total;
  const inc = incTotal(D), incOn = [...D.inc].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const pc = patrolPct(D), k = kpiCalc(D);
  const kpiNow = k.monthly[m0];
  const openNi = D.improvements.filter((n) => n.status !== "Selesai");
  const oldest = openNi.length ? Math.max(...openNi.map((n) => monthsOpen(n.opened_month, D.month))) : 0;
  const gs = gateStats(history ?? [], inside ?? []);
  const max = Math.max(...D.days.map((x) => r4Day(D, x.d - 1)), 1);
  const dl = (a: number, b: number) => { if (!b) return null; const p = ((a - b) / b) * 100; return <span className={p < 0 ? "dn" : "up"}>{p < 0 ? "▼" : "▲"} {dec(Math.abs(p), 1)}% dari bulan lalu</span>; };

  return (
    <div className="dgrid enter exec">
      <section className="dband xband" aria-label="Ringkasan bulan">
        <div>
          <div>
            <div className="eyebrow">Ringkasan eksekutif · {site?.name ?? ""}</div>
            <div className="dper">{name} {year}</div>
            <div className="dready">Data realtime · hanya lihat</div>
          </div>
        </div>
        <div className="dk"><Count className="dkv" value={r4h[12]} /><div className="dkl">Kendaraan roda empat</div><div className="dkd">{dl(r4h[12], r4h[11])}</div><Spark vals={r4h} /></div>
        <div className="dk"><Count className="dkv" value={mo} /><div className="dkl">Motor · visitor {fmt(vi)}</div><div className="dkd">{dl(mo, D.totals13.motor[11])}</div><Spark vals={D.totals13.motor} /></div>
        <div className="dk"><div className="dkv">{dec(pc, 2)}<small>%</small></div><div className="dkl">Checkpoint patroli</div><div className="dkd"><span className={pc >= 99.5 ? "up" : "dn"}>{fmt(D.patrol.target_checkpoint - D.patrol.actual_checkpoint)} terlewat</span></div></div>
        <div className="dk"><Count className="dkv" value={inc} /><div className="dkl">Kejadian</div><div className="dkd">{incOn.slice(0, 2).map((i) => `${i.category} ${i.value}`).join(" · ") || "Nihil"}</div></div>
        <div className="dk"><div className="dkv">{kpiNow === null ? "–" : dec(kpiNow)}</div><div className="dkl">Skor KPI {name}</div><div className="dkd">Tahun berjalan {dec(k.final)}</div></div>
      </section>

      <NcSummaryCard s={nc} link={false} />
      <NcTopCard s={nc} />

      <section className="dcard c8">
        <div className="dch"><h2>Kendaraan roda empat per hari</h2><span className="dleg"><span><i style={{ background: "var(--bar)" }}></i>Hari kerja</span><span><i style={{ background: "var(--bar-we)" }}></i>Libur</span></span></div>
        <div className="xstrip">
          {D.days.map((x, i) => {
            const v = r4Day(D, i);
            return (
              <div key={x.d} className={`${x.we ? "we" : ""} ${!D.filled[i] ? "empty" : ""}`} title={`${DOW[x.dow]}, ${x.d} ${name}: ${fmt(v)}`}>
                <i style={{ height: `${Math.max(2, (v / max) * 100)}%` }}></i><span>{x.d}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="dcard c4">
        <div className="dch"><h2>Kejadian</h2><span className="sub" style={{ margin: 0 }}>{name}</span></div>
        {incOn.length ? <div className="hbar">{incOn.map((i) => <div className="r" key={i.category}><span>{i.category}</span><span className="t"><i style={{ width: `${(i.value / incOn[0].value) * 100}%` }}></i></span><b>{i.value}</b></div>)}</div> : <p className="sub">Tidak ada kejadian.</p>}
        <div className="xmini">
          <div><b>{openNi.length}</b><span>Temuan terbuka{openNi.length ? ` · tertua ${oldest} bln` : ""}</span></div>
          <div><b>{D.leaves.length}</b><span>Cuti / sakit</span></div>
        </div>
      </section>

      <section className="dcard c6">
        <div className="dch"><h2>Portal gate · hari ini <span className={`live ${live ? "on" : ""}`}><i></i>{live ? "LIVE" : "…"}</span></h2></div>
        <div className="mk">
          <div><b>{gs.masuk}</b><span>Masuk</span></div>
          <div><b>{gs.keluar}</b><span>Keluar</span></div>
          <div className={gs.lama ? "bad" : ""}><b>{gs.dalam}</b><span>Di dalam{gs.lama ? ` · ${gs.lama} > 4 jam` : ""}</span></div>
          <div className={gs.temuan ? "bad" : ""}><b>{gs.temuan}</b><span>Ada temuan</span></div>
        </div>
        <FlowChart today={history ?? []} day={day} />
        <div className="dleg" style={{ marginTop: 6 }}><span><i style={{ background: "var(--bar)" }}></i>Masuk</span><span><i style={{ background: "#DA291C" }}></i>Keluar</span><span>rata-rata {gs.avgMs ? fDurMs(gs.avgMs) : "–"} di dalam</span></div>
      </section>

      <section className="dcard c6">
        <div className="dch"><h2>Transporter di dalam area</h2><span className="sub" style={{ margin: 0 }}>terlama di atas</span></div>
        <div className="inl">
          {(inside ?? []).slice(0, 8).map((g) => (
            <div key={g.id} className={`inr ${Date.now() - new Date(g.in_at).getTime() > LONG_MS ? "long" : ""}`}>
              <span className="g-plate sm">{g.nopol}</span>
              <span><b>{g.company_name || "–"}</b><small>{g.in_dept_name || "–"}</small></span>
              <span className="dur">{fDurShort(g.in_at)}</span>
            </div>
          ))}
          {inside && inside.length === 0 && <p className="sub">Tidak ada kendaraan di dalam area.</p>}
          {inside && inside.length > 8 && <p className="sub" style={{ gridColumn: "1/-1" }}>+{inside.length - 8} kendaraan lain</p>}
        </div>
      </section>

      <section className="dcard c12">
        <div className="dch"><h2>Rekap per kategori · {name} {year}</h2></div>
        <div className="xcats">
          {CATS.map((c) => { const v = vsPrev(D, c.k); return (
            <div key={c.k}><small>{c.n}</small><b>{fmt(v.t)}</b><span className={v.d < 0 ? "dn" : "up"}>{v.d < 0 ? "▼" : "▲"} {fmt(Math.abs(v.d))} ({dec(Math.abs(v.pct), 1)}%)</span><Spark vals={D.totals13[c.k]} /></div>
          ); })}
        </div>
      </section>
    </div>
  );
}
