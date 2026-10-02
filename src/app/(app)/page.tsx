"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppContext";
import { CategoryDrawer, Count, Loading, Spark } from "@/components/ui";
import { CATS, DOW, DOWL, EVENT_KINDS, MONTH_ID, dec, fmt, type CatKey } from "@/lib/constants";
import { checks, incOrdered, incTotal, kpiCalc, monthName, monthsOpen, patrolPct, r4Day, agg, vsPrev } from "@/lib/calc";
import { parseMonth, shiftNow } from "@/lib/dates";
import { SLIDES, slideOk } from "@/lib/slides";
import { api } from "@/lib/data";
import type { MonthData } from "@/lib/types";
import { LONG_MS, fDurMs, fDurShort, gateStats, todayWIB, useGateList, useTick } from "@/lib/gate";
import { FlowChart } from "@/components/gate/Flow";
import { useNcSummary } from "@/lib/gc/summary";
import { NcSummaryCard, NcTopCard } from "@/components/NcCards";

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  if (!now) return <span>&nbsp;</span>;
  const [sn, sh] = shiftNow(now.getHours());
  return (
    <>
      <span>{now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })} · {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
      <span className="sepd">·</span><span>Shift {sn} {sh}</span>
    </>
  );
}

function Ring({ ok, total }: { ok: number; total: number }) {
  const [off, setOff] = useState(314.16);
  useEffect(() => { const r = requestAnimationFrame(() => setOff(314.16 * (1 - ok / total))); return () => cancelAnimationFrame(r); }, [ok, total]);
  return (
    <div className="ring" aria-label={`${ok} dari ${total} slide siap`}>
      <svg viewBox="0 0 120 120" width="170" height="170">
        <circle className="trk" cx="60" cy="60" r="50" fill="none" strokeWidth="9" />
        <circle className="val" cx="60" cy="60" r="50" fill="none" strokeWidth="9" strokeDasharray="314.16" style={{ strokeDashoffset: off }} />
      </svg>
      <div className="c"><div><Count className="num" value={ok} /><small>dari {total} slide siap</small></div></div>
    </div>
  );
}

function Strip({ D, sel, setSel }: { D: MonthData; sel: number; setSel: (d: number) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ d: number; x: number; y: number } | null>(null);
  const evDays = new Set(D.events.map((e) => Number(e.day.slice(8, 10))));
  const max = Math.max(...D.days.map((x) => r4Day(D, x.d - 1)), 1);
  function show(el: HTMLElement, d: number) {
    const w = wrap.current!.getBoundingClientRect(), r = el.getBoundingClientRect(), b = (el.querySelector(".b") as HTMLElement).getBoundingClientRect();
    setTip({ d, x: Math.max(80, Math.min(w.width - 80, r.left - w.left + r.width / 2)), y: b.top - w.top - 10 });
  }
  function key(e: React.KeyboardEvent, d: number) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const n = Math.max(1, Math.min(D.days.length, d + (e.key === "ArrowRight" ? 1 : -1)));
    setSel(n);
    const el = wrap.current?.querySelector<HTMLElement>(`[data-day="${n}"]`);
    if (el) { el.focus(); show(el, n); }
  }
  const t = tip ? D.days[tip.d - 1] : null;
  return (
    <div className="stripwrap" ref={wrap} onPointerLeave={() => setTip(null)}>
      <div className={`tip ${tip ? "on" : ""}`} style={tip ? { left: tip.x, top: tip.y } : undefined}>
        {t && <><b>{DOW[t.dow]}, {t.d}</b><br />{fmt(r4Day(D, t.d - 1))} roda empat · {fmt(D.daily.motor[t.d - 1])} motor{evDays.has(t.d) && <><br /><span style={{ color: "#FF8A7F" }}>● ada catatan</span></>}{!D.filled[t.d - 1] && <><br /><span style={{ opacity: .7 }}>belum diisi</span></>}</>}
      </div>
      <div className="strip">
        {D.days.map((x, i) => {
          const v = r4Day(D, x.d - 1);
          return (
            <button key={x.d} data-day={x.d} className={`dcol ${x.we ? "we" : ""}`} aria-pressed={x.d === sel} style={{ ["--i" as string]: i }}
              aria-label={`${x.d}: ${v} kendaraan roda empat`} onClick={() => setSel(x.d)}
              onPointerEnter={(e) => show(e.currentTarget, x.d)} onFocus={(e) => show(e.currentTarget, x.d)} onKeyDown={(e) => key(e, x.d)}>
              <span className={`ev ${evDays.has(x.d) ? "on" : ""}`}></span>
              <span className="b" style={{ height: Math.max(3, (v / max) * 110) }}></span>
              <span className="dt">{x.d}</span>
              <span className="dw">{DOW[x.dow].slice(0, 2)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayDetail({ D, sel }: { D: MonthData; sel: number }) {
  const { siteId, canWrite, toast, fail } = useApp();
  const [kind, setKind] = useState<string>("Temuan");
  const [txt, setTxt] = useState("");
  const x = D.days[sel - 1], ev = D.events.filter((e) => Number(e.day.slice(8, 10)) === sel), { name } = monthName(D.month);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!txt.trim() || !siteId) return;
    try { await api.addEvent(siteId, x.iso, kind, txt.trim()); setTxt(""); toast("Catatan ditambahkan"); } catch (er) { fail(er as Error); }
  }
  return (
    <div className="daydetail" key={sel}>
      <div>
        <div className="eyebrow" style={{ color: "var(--ink3)" }}>{DOWL[x.dow]} · minggu ke-{x.wk} · {x.we ? "hari libur" : "hari kerja"}</div>
        <div className="num" style={{ marginTop: 6 }}>{sel} {name}</div>
        <div className="mini">
          <div><b>{fmt(r4Day(D, sel - 1))}</b><span>roda empat</span></div>
          <div><b>{fmt(D.daily.motor[sel - 1])}</b><span>motor</span></div>
          <div><b>{fmt(D.daily.visitor[sel - 1])}</b><span>visitor</span></div>
        </div>
        {canWrite && <Link className="link" style={{ marginTop: 12, display: "inline-block" }} href={`/harian?d=${sel}`}>Ubah data tanggal ini <span className="arr">→</span></Link>}
      </div>
      <div>
        {ev.length ? (
          <ul className="evlist">{ev.map((e) => (
            <li key={e.id}><span className="k">{e.kind}</span><span>{e.description}</span>
              {canWrite ? <button className="del" aria-label="Hapus catatan" onClick={() => api.deleteEvent(e.id).then(() => toast("Catatan dihapus")).catch(fail)}>Hapus</button> : <span />}</li>
          ))}</ul>
        ) : <p className="sub" style={{ margin: 0 }}>Tidak ada kejadian atau temuan tercatat.</p>}
        {canWrite && (
          <form className="evadd" onSubmit={add}>
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Jenis catatan">{EVENT_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
            <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Tambah catatan untuk tanggal ini" aria-label="Isi catatan" />
            <button className="btn q" type="submit">Tambah</button>
          </form>
        )}
      </div>
    </div>
  );
}

function Todo({ D }: { D: MonthData }) {
  const { siteId, canWrite, toast, fail } = useApp();
  const ch = checks(D);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [gone, setGone] = useState<number | null>(null);
  async function save(ci: number) {
    const fx = ch[ci].fix!;
    const miss = fx.find((f) => !(vals[f.id] || "").trim());
    if (miss) { toast("Isi dulu semua kolomnya", "err"); return; }
    try {
      for (const f of fx) {
        if (f.type === "backup") await api.updateLeave(f.id, { backup: vals[f.id].trim() });
        if (f.type === "note" && siteId) { const cur = D.inc.find((i) => i.category === f.id)!; await api.setIncident(siteId, D.month, f.id, { note: vals[f.id].trim() }, cur); }
      }
      setGone(ci);
      toast("Tersimpan. Slide laporan ikut diperbarui.");
      setTimeout(() => setGone(null), 900);
    } catch (e) { fail(e as Error); }
  }
  if (!ch.length) return <div className="allgood"><span className="check">✓</span><div><b>Semua beres.</b><div className="sub">Laporan bulan ini siap dikirim.</div></div></div>;
  return (
    <ul className="todo">
      {ch.map((c, ci) => (
        <li key={c.title} className={gone === ci ? "done" : ""}>
          <span className={`dot ${c.lv}`}></span>
          <div>
            <b>{c.title}</b><div className="sub" style={{ margin: "2px 0 0" }}>{c.sub}</div>
            {c.fix && canWrite && (
              <div className="fix">
                {c.fix.map((f) => <input key={f.id} placeholder={f.label} aria-label={f.label} value={vals[f.id] ?? ""} onChange={(e) => setVals({ ...vals, [f.id]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && save(ci)} />)}
                <button className="btn" onClick={() => save(ci)}>Simpan</button>
              </div>
            )}
          </div>
          <Link className="link" href={c.go}>Buka <span className="arr">→</span></Link>
        </li>
      ))}
    </ul>
  );
}

/** Catatan terbaru bulan ini (untuk peran lihat-saja). */
function Feed({ D }: { D: MonthData }) {
  const { name } = monthName(D.month);
  const feed = [...D.events].sort((a, b) => (b.day + b.created_at).localeCompare(a.day + a.created_at)).slice(0, 7);
  if (!feed.length) return <p className="sub">Belum ada catatan bulan ini.</p>;
  return (
    <ul className="dfeed">
      {feed.map((e) => <li key={e.id}><span className="t">{Number(e.day.slice(8, 10))} {name.slice(0, 3)}</span><span className="k">{e.kind}</span><span>{e.description}</span></li>)}
    </ul>
  );
}

export default function Home() {
  const { D, error, siteId, canWrite } = useApp();
  const [sel, setSel] = useState(1);
  const [drawer, setDrawer] = useState<CatKey | null>(null);
  const [dk, setDk] = useState<CatKey>("karyawan");
  const inited = useRef<string | null>(null);
  const day = todayWIB();
  const { inside, history, live: gLive } = useGateList(siteId, day);
  useTick(30000);
  const { data: nc } = useNcSummary(D?.month ?? null);

  useEffect(() => {
    if (!D || inited.current === D.month) return;
    inited.current = D.month;
    const last = D.filled.lastIndexOf(true);
    setSel(last >= 0 ? last + 1 : 1);
  }, [D]);

  if (!D) return <Loading error={error} />;
  const { name, year } = monthName(D.month);
  const { m0 } = parseMonth(D.month);
  const ch = checks(D), ok = SLIDES.filter((s) => slideOk(D, s, ch)).length;
  const r4c = CATS.filter((c) => c.r4), r4h = D.totals13.karyawan.map((_, i) => r4c.reduce((a, c) => a + D.totals13[c.k][i], 0));
  const r4 = r4h[12], mo = agg(D, "motor").total, moh = D.totals13.motor;
  const inc = incTotal(D), incOn = [...D.inc].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const gs = gateStats(history ?? [], inside ?? []);
  const pc = patrolPct(D), k = kpiCalc(D), kNow = k.monthly[m0];
  const openNi = D.improvements.filter((n) => n.status !== "Selesai");
  const oldest = openNi.length ? Math.max(...openNi.map((n) => monthsOpen(n.opened_month, D.month))) : 0;
  const dl = (a: number, b: number) => <span className={a < b ? "dn" : "up"}>{a < b ? "▼" : "▲"} {fmt(Math.abs(a - b))} dari bulan lalu</span>;
  const open = (c: CatKey) => { setDk(c); setDrawer(c); };
  const off = 314.16 * (1 - ok / SLIDES.length);
  const insideTop = (inside ?? []).slice(0, 8);

  return (
    <div className="dgrid dash enter">
      {/* ── angka utama ── */}
      <section className="dband six" aria-label="Ringkasan bulan">
        <div>
          {canWrite && (
            <div className="dring" aria-label={`${ok} dari ${SLIDES.length} slide siap`}>
              <svg viewBox="0 0 120 120" width="76" height="76"><circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="11" /><circle cx="60" cy="60" r="50" fill="none" stroke="#DA291C" strokeWidth="11" strokeDasharray="314.16" style={{ strokeDashoffset: off, transition: "stroke-dashoffset 1s" }} /></svg>
              <b>{ok}</b>
            </div>
          )}
          <div>
            <div className="eyebrow">Periode</div>
            <div className="dper">{name} {year}</div>
            <div className="dready">{canWrite ? <>{ok}/{SLIDES.length} slide laporan siap · <Link href="/laporan" style={{ color: "#fff" }}>Buka →</Link></> : "Realtime · hanya lihat"}</div>
          </div>
        </div>
        <button className="dk" onClick={() => open("karyawan")}><Count className="dkv" value={r4} /><div className="dkl">Kendaraan roda empat</div><div className="dkd">{dl(r4, r4h[11])}</div><Spark vals={r4h} /></button>
        <button className="dk" onClick={() => open("motor")}><Count className="dkv" value={mo} /><div className="dkl">Motor</div><div className="dkd">{dl(mo, moh[11])}</div><Spark vals={moh} /></button>
        <div className="dk"><Count className="dkv" value={inc} /><div className="dkl">Kejadian</div><div className="dkd">{incOn.slice(0, 2).map((i) => `${i.category} ${i.value}`).join(" · ") || "Nihil"}</div></div>
        <div className="dk"><Count className="dkv" value={nc?.total ?? 0} /><div className="dkl">Pelanggaran transporter</div><div className="dkd">{nc ? <span className={nc.total > nc.prev ? "dn" : "up"}>{nc.rate === null ? "–" : `${nc.rate.toFixed(2).replace(".", ",")}%`} dari {fmt(nc.inspected)} diperiksa</span> : "…"}</div></div>
        <div className="dk"><Count className="dkv" value={gs.dalam} /><div className="dkl">Transporter di dalam · live</div><div className="dkd"><span className={gs.lama ? "dn" : "up"}>{gs.masuk} masuk hari ini{gs.lama ? ` · ${gs.lama} > 4 jam` : ""}</span></div></div>
      </section>

      {/* ── baris 2: kendaraan harian + perlu dicek / catatan ── */}
      <section className="dcard c8">
        <div className="dch"><h2>Kendaraan per hari · {name}</h2><button className="btn q sm" onClick={() => open("karyawan")}>Rincian per kategori</button></div>
        <Strip D={D} sel={sel} setSel={setSel} />
        <DayDetail D={D} sel={sel} />
      </section>
      <section className="dcard c4" id="todo">
        {canWrite ? (<>
          <div className="dch"><h2>Perlu dicek</h2>{ch.length > 0 && <span className="g-tag bad">{ch.length}</span>}</div>
          <Todo D={D} />
          <div className="dfill dslides">
            <h3>Kesiapan slide laporan</h3>
            <ul>{SLIDES.map((sl) => { const good = slideOk(D, sl, ch); return <li key={sl.n} className={good ? "ok" : "no"}><i>{good ? "✓" : "!"}</i>{sl.n}</li>; })}</ul>
          </div>
          <Link className="dfoot" href="/laporan">Laporan bulanan · {ok}/{SLIDES.length} slide siap <span className="arr">→</span></Link>
        </>) : (<>
          <div className="dch"><h2>Catatan terbaru</h2><span className="sub" style={{ margin: 0 }}>{D.events.length} bulan ini</span></div>
          <Feed D={D} />
          <div className="dfill dslides">
            <h3>Kelengkapan laporan bulan ini · {ok}/{SLIDES.length}</h3>
            <ul>{SLIDES.map((sl) => { const good = slideOk(D, sl, ch); return <li key={sl.n} className={good ? "ok" : "no"}><i>{good ? "✓" : "!"}</i>{sl.n}</li>; })}</ul>
          </div>
        </>)}
      </section>

      {/* ── baris 3: pelanggaran transporter ── */}
      <NcSummaryCard s={nc} link={canWrite} />
      <NcTopCard s={nc} />

      {/* ── baris 4: portal gate ── */}
      <section className="dcard c6">
        <div className="dch"><h2>Portal gate · hari ini <span className={`live ${gLive ? "on" : ""}`}><i></i>{gLive ? "LIVE" : "…"}</span></h2>{canWrite && <Link className="btn q sm" href="/gate">Detail</Link>}</div>
        <div className="mk">
          <div><b>{gs.masuk}</b><span>Masuk</span></div>
          <div><b>{gs.keluar}</b><span>Keluar</span></div>
          <div className={gs.lama ? "bad" : ""}><b>{gs.dalam}</b><span>Di dalam{gs.lama ? ` · ${gs.lama} > 4 jam` : ""}</span></div>
          <div className={gs.temuan ? "bad" : ""}><b>{gs.temuan}</b><span>Ada temuan</span></div>
        </div>
        <div className="dfill dflow"><FlowChart today={history ?? []} day={day} /></div>
        <div className="dleg"><span><i style={{ background: "var(--bar)" }}></i>Masuk</span><span><i style={{ background: "#DA291C" }}></i>Keluar</span><span>per jam · rata-rata {gs.avgMs ? fDurMs(gs.avgMs) : "–"} di dalam</span></div>
      </section>
      <section className="dcard c6">
        <div className="dch"><h2>Di dalam area</h2><span className="sub" style={{ margin: 0 }}>terlama di atas</span></div>
        <div className="dfill">
          <div className="inl two">
            {insideTop.map((g) => {
              const cls = Date.now() - new Date(g.in_at).getTime() > LONG_MS ? "long" : "";
              const body = (<><span className="g-plate sm">{g.nopol}</span><span><b>{g.company_name || "–"}</b><small>{g.driver_name} · {g.in_dept_name || "–"}</small></span><span className="dur">{fDurShort(g.in_at)}</span></>);
              return canWrite ? <Link key={g.id} href={`/gate/${g.id}`} className={cls}>{body}</Link> : <div key={g.id} className={`inr ${cls}`}>{body}</div>;
            })}
          </div>
          {inside && inside.length === 0 && <div className="dempty">Tidak ada kendaraan di dalam area.</div>}
        </div>
        {inside && inside.length > 8 && (canWrite ? <Link className="dfoot" href="/gate">+{inside.length - 8} kendaraan lain <span className="arr">→</span></Link> : <span className="dfoot">+{inside.length - 8} kendaraan lain</span>)}
      </section>

      {/* ── baris 5: kejadian, patroli & personel, KPI ── */}
      <section className="dcard c4">
        <div className="dch"><h2>Kejadian</h2><span className="sub" style={{ margin: 0 }}>{fmt(inc)} total · bulan lalu</span></div>
        <div className="dfill">
          <div className="hbar inc">{incOrdered(D).map((i) => { const pv = D.incPrev[i.category]; const mx = Math.max(1, ...D.inc.map((x) => x.value)); return (
            <div className={`r ${i.value ? "" : "zero"}`} key={i.category}><span title={i.category}>{i.category}</span><span className="t"><i style={{ width: `${(i.value / mx) * 100}%` }}></i></span><b>{i.value}</b><em>{pv ?? "–"}</em></div>
          ); })}</div>
        </div>
      </section>
      <section className="dcard c4">
        <div className="dch"><h2>Patroli & personel</h2></div>
        <div className="dfill dstat">
          <div><b>{dec(pc, 2)}<small>%</small></b><span>Checkpoint patroli · {fmt(D.patrol.target_checkpoint - D.patrol.actual_checkpoint)} terlewat</span><i className="meter"><i style={{ width: `${Math.min(100, pc)}%` }}></i></i></div>
          <div className={oldest >= 3 ? "bad" : ""}><b>{openNi.length}</b><span>Temuan terbuka{openNi.length ? ` · tertua ${oldest} bulan` : " · semua selesai"}</span></div>
          <div><b>{D.leaves.length}</b><span>Cuti / sakit bulan ini</span></div>
        </div>
      </section>
      <section className="dcard c4">
        <div className="dch"><h2>KPI</h2><span className="sub" style={{ margin: 0 }}>{year}</span></div>
        <div className="dfill dstat">
          <div><b>{kNow === null ? "–" : dec(kNow)}</b><span>Skor {name} (skala 1–5)</span></div>
          <div><b>{dec(k.final)}</b><span>Tahun berjalan</span></div>
          <div className="kmonths" aria-label="Skor KPI per bulan">{k.monthly.map((v, i) => <span key={i} className={i === m0 ? "cur" : ""} title={`${MONTH_ID[i]}: ${v === null ? "–" : dec(v)}`}><i style={{ height: `${v === null ? 0 : (v / 5) * 100}%` }}></i></span>)}</div>
        </div>
      </section>

      {/* ── baris 6: rekap per kategori ── */}
      <section className="dcard c12">
        <div className="dch"><h2>Rekap per kategori · {name} {year}</h2><span className="sub" style={{ margin: 0 }}>dibanding bulan lalu</span></div>
        <div className="xcats">
          {CATS.map((c) => { const v = vsPrev(D, c.k); return (
            <button key={c.k} className="xcat" onClick={() => open(c.k)}><small>{c.n}</small><b>{fmt(v.t)}</b><span className={v.d < 0 ? "dn" : "up"}>{v.d < 0 ? "▼" : "▲"} {fmt(Math.abs(v.d))} ({dec(Math.abs(v.pct), 1)}%)</span><Spark vals={D.totals13[c.k]} /></button>
          ); })}
        </div>
      </section>

      <CategoryDrawer D={D} open={!!drawer} k={dk} setK={setDk} onClose={() => setDrawer(null)} />
    </div>
  );
}
