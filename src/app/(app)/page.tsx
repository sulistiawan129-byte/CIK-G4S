"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppContext";
import { CategoryDrawer, Count, Loading, Spark } from "@/components/ui";
import { CATS, EVENT_KINDS, catName, dec, dowLong, dowShort, fmt, incLabel, kindLabel, monthLong, type CatKey } from "@/lib/constants";
import { L } from "@/lib/lang";
import { checks, incOrdered, incTotal, kpiCalc, monthName, monthsOpen, patrolPct, r4Day, agg, vsPrev } from "@/lib/calc";
import { parseMonth, shiftNow } from "@/lib/dates";
import { SLIDES, slideName, slideOk } from "@/lib/slides";
import { api } from "@/lib/data";
import type { MonthData } from "@/lib/types";
import { LONG_MS, fDurMs, fDurShort, gateStats, todayWIB, useGateList, useTick } from "@/lib/gate";
import { FlowChart } from "@/components/gate/Flow";
import { useNcSummary } from "@/lib/gc/summary";
import { NcSummaryCard, NcTopCard } from "@/components/NcCards";
import { AnalisaSummary } from "@/components/analisa/Analisa";

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
        {t && <><b>{dowShort(t.dow)}, {t.d}</b><br />{fmt(r4Day(D, t.d - 1))} {L("roda empat", "four-wheelers")} · {fmt(D.daily.motor[t.d - 1])} {L("motor", "motorcycles")}{evDays.has(t.d) && <><br /><span style={{ color: "#FF8A7F" }}>● {L("ada catatan", "has notes")}</span></>}{!D.filled[t.d - 1] && <><br /><span style={{ opacity: .7 }}>{L("belum diisi", "not filled in")}</span></>}</>}
      </div>
      <div className="strip">
        {D.days.map((x, i) => {
          const v = r4Day(D, x.d - 1);
          return (
            <button key={x.d} data-day={x.d} className={`dcol ${x.we ? "we" : ""}`} aria-pressed={x.d === sel} style={{ ["--i" as string]: i }}
              aria-label={`${x.d}: ${v} ${L("kendaraan roda empat", "four-wheel vehicles")}`} onClick={() => setSel(x.d)}
              onPointerEnter={(e) => show(e.currentTarget, x.d)} onFocus={(e) => show(e.currentTarget, x.d)} onKeyDown={(e) => key(e, x.d)}>
              <span className={`ev ${evDays.has(x.d) ? "on" : ""}`}></span>
              <span className="b" style={{ height: Math.max(3, (v / max) * 110) }}></span>
              <span className="dt">{x.d}</span>
              <span className="dw">{dowShort(x.dow).slice(0, 2)}</span>
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
    try { await api.addEvent(siteId, x.iso, kind, txt.trim()); setTxt(""); toast(L("Catatan ditambahkan", "Note added")); } catch (er) { fail(er as Error); }
  }
  return (
    <div className="daydetail" key={sel}>
      <div>
        <div className="eyebrow" style={{ color: "var(--ink3)" }}>{dowLong(x.dow)} · {L("minggu ke-", "week ")}{x.wk} · {x.we ? L("hari libur", "weekend") : L("hari kerja", "weekday")}</div>
        <div className="num" style={{ marginTop: 6 }}>{sel} {name}</div>
        <div className="mini">
          <div><b>{fmt(r4Day(D, sel - 1))}</b><span>{L("roda empat", "four-wheelers")}</span></div>
          <div><b>{fmt(D.daily.motor[sel - 1])}</b><span>{L("motor", "motorcycles")}</span></div>
          <div><b>{fmt(D.daily.visitor[sel - 1])}</b><span>{L("visitor", "visitors")}</span></div>
        </div>
        {canWrite && <Link className="link" style={{ marginTop: 12, display: "inline-block" }} href={`/harian?d=${sel}`}>{L("Ubah data tanggal ini", "Edit this date")} <span className="arr">→</span></Link>}
      </div>
      <div>
        {ev.length ? (
          <ul className="evlist">{ev.map((e) => (
            <li key={e.id}><span className="k">{kindLabel(e.kind)}</span><span>{e.description}</span>
              {canWrite ? <button className="del" aria-label={L("Hapus catatan", "Delete note")} onClick={() => api.deleteEvent(e.id).then(() => toast(L("Catatan dihapus", "Note deleted"))).catch(fail)}>{L("Hapus", "Delete")}</button> : <span />}</li>
          ))}</ul>
        ) : <p className="sub" style={{ margin: 0 }}>{L("Tidak ada kejadian atau temuan tercatat.", "No incidents or findings recorded.")}</p>}
        {canWrite && (
          <form className="evadd" onSubmit={add}>
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label={L("Jenis catatan", "Note type")}>{EVENT_KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}</select>
            <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={L("Tambah catatan untuk tanggal ini", "Add a note for this date")} aria-label={L("Isi catatan", "Note text")} />
            <button className="btn q" type="submit">{L("Tambah", "Add")}</button>
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
    if (miss) { toast(L("Isi dulu semua kolomnya", "Fill in all fields first"), "err"); return; }
    try {
      for (const f of fx) {
        if (f.type === "backup") await api.updateLeave(f.id, { backup: vals[f.id].trim() });
        if (f.type === "note" && siteId) { const cur = D.inc.find((i) => i.category === f.id)!; await api.setIncident(siteId, D.month, f.id, { note: vals[f.id].trim() }, cur); }
      }
      setGone(ci);
      toast(L("Tersimpan. Slide laporan ikut diperbarui.", "Saved. The report slides are updated too."));
      setTimeout(() => setGone(null), 900);
    } catch (e) { fail(e as Error); }
  }
  if (!ch.length) return <div className="allgood"><span className="check">✓</span><div><b>{L("Semua beres.", "All clear.")}</b><div className="sub">{L("Laporan bulan ini siap dikirim.", "This month's report is ready to send.")}</div></div></div>;
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
                <button className="btn" onClick={() => save(ci)}>{L("Simpan", "Save")}</button>
              </div>
            )}
          </div>
          <Link className="link" href={c.go}>{L("Buka", "Open")} <span className="arr">→</span></Link>
        </li>
      ))}
    </ul>
  );
}

/** Catatan terbaru bulan ini (untuk peran lihat-saja). */
function Feed({ D }: { D: MonthData }) {
  const { name } = monthName(D.month);
  const feed = [...D.events].sort((a, b) => (b.day + b.created_at).localeCompare(a.day + a.created_at)).slice(0, 7);
  if (!feed.length) return <p className="sub">{L("Belum ada catatan bulan ini.", "No notes this month yet.")}</p>;
  return (
    <ul className="dfeed">
      {feed.map((e) => <li key={e.id}><span className="t">{Number(e.day.slice(8, 10))} {name.slice(0, 3)}</span><span className="k">{e.kind}</span><span>{e.description}</span></li>)}
    </ul>
  );
}

export default function Home() {
  const { D, error, siteId, canWrite } = useApp();
  const [selState, setSel] = useState(1);
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
  // pindah bulan: tanggal terpilih bisa melebihi jumlah hari bulan baru (mis. 31 → Februari) sebelum efek penyetel jalan
  const sel = Math.max(1, Math.min(selState, D.days.length));
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
  const dl = (a: number, b: number) => <span className={a < b ? "dn" : "up"}>{a < b ? "▼" : "▲"} {fmt(Math.abs(a - b))} {L("dari bulan lalu", "vs last month")}</span>;
  const open = (c: CatKey) => { setDk(c); setDrawer(c); };
  const off = 314.16 * (1 - ok / SLIDES.length);
  const insideTop = (inside ?? []).slice(0, 8);

  return (
    <div className="dgrid dash enter">
      {/* ── angka utama ── */}
      <section className="dband six" aria-label={L("Ringkasan bulan", "Month summary")}>
        <div>
          {canWrite && (
            <div className="dring" aria-label={L(`${ok} dari ${SLIDES.length} slide siap`, `${ok} of ${SLIDES.length} slides ready`)}>
              <svg viewBox="0 0 120 120" width="76" height="76"><circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="11" /><circle cx="60" cy="60" r="50" fill="none" stroke="#DA291C" strokeWidth="11" strokeDasharray="314.16" style={{ strokeDashoffset: off, transition: "stroke-dashoffset 1s" }} /></svg>
              <b>{ok}</b>
            </div>
          )}
          <div>
            <div className="eyebrow">{L("Periode", "Period")}</div>
            <div className="dper">{name} {year}</div>
            <div className="dready">{canWrite ? <>{ok}/{SLIDES.length} {L("slide laporan siap", "report slides ready")} · <Link href="/laporan" style={{ color: "#fff" }}>{L("Buka", "Open")} →</Link></> : L("Realtime · hanya lihat", "Realtime · view only")}</div>
          </div>
        </div>
        <button className="dk" onClick={() => open("karyawan")}><Count className="dkv" value={r4} /><div className="dkl">{L("Kendaraan roda empat", "Four-wheel vehicles")}</div><div className="dkd">{dl(r4, r4h[11])}</div><Spark vals={r4h} /></button>
        <button className="dk" onClick={() => open("motor")}><Count className="dkv" value={mo} /><div className="dkl">{L("Motor", "Motorcycles")}</div><div className="dkd">{dl(mo, moh[11])}</div><Spark vals={moh} /></button>
        <div className="dk"><Count className="dkv" value={inc} /><div className="dkl">{L("Kejadian", "Incidents")}</div><div className="dkd">{incOn.slice(0, 2).map((i) => `${incLabel(i.category)} ${i.value}`).join(" · ") || L("Nihil", "None")}</div></div>
        <div className="dk"><Count className="dkv" value={nc?.total ?? 0} /><div className="dkl">{L("Pelanggaran transporter", "Transporter violations")}</div><div className="dkd">{nc ? <span className={nc.total > nc.prev ? "dn" : "up"}>{nc.rate === null ? "–" : `${dec(nc.rate)}%`} {L("dari", "of")} {fmt(nc.inspected)} {L("diperiksa", "inspected")}</span> : "…"}</div></div>
        <div className="dk"><Count className="dkv" value={gs.dalam} /><div className="dkl">{L("Transporter di dalam · live", "Transporters inside · live")}</div><div className="dkd"><span className={gs.lama ? "dn" : "up"}>{gs.masuk} {L("masuk hari ini", "in today")}{gs.lama ? ` · ${gs.lama} > ${L("4 jam", "4 h")}` : ""}</span></div></div>
      </section>

      {/* ── baris 2: kendaraan harian + perlu dicek / catatan ── */}
      <section className="dcard c8">
        <div className="dch"><h2>{L("Kendaraan per hari", "Vehicles per day")} · {name}</h2><button className="btn q sm" onClick={() => open("karyawan")}>{L("Rincian per kategori", "Details by category")}</button></div>
        <Strip D={D} sel={sel} setSel={setSel} />
        <DayDetail D={D} sel={sel} />
      </section>
      <section className="dcard c4" id="todo">
        {canWrite ? (<>
          <div className="dch"><h2>{L("Perlu dicek", "Needs checking")}</h2>{ch.length > 0 && <span className="g-tag bad">{ch.length}</span>}</div>
          <Todo D={D} />
          <div className="dfill dslides">
            <h3>{L("Kesiapan slide laporan", "Report slide readiness")}</h3>
            <ul>{SLIDES.map((sl) => { const good = slideOk(D, sl, ch); return <li key={sl.n} className={good ? "ok" : "no"}><i>{good ? "✓" : "!"}</i>{slideName(sl)}</li>; })}</ul>
          </div>
          <Link className="dfoot" href="/laporan">{L("Laporan bulanan", "Monthly report")} · {ok}/{SLIDES.length} {L("slide siap", "slides ready")} <span className="arr">→</span></Link>
        </>) : (<>
          <div className="dch"><h2>{L("Catatan terbaru", "Latest notes")}</h2><span className="sub" style={{ margin: 0 }}>{D.events.length} {L("bulan ini", "this month")}</span></div>
          <Feed D={D} />
          <div className="dfill dslides">
            <h3>{L("Kelengkapan laporan bulan ini", "This month's report completeness")} · {ok}/{SLIDES.length}</h3>
            <ul>{SLIDES.map((sl) => { const good = slideOk(D, sl, ch); return <li key={sl.n} className={good ? "ok" : "no"}><i>{good ? "✓" : "!"}</i>{slideName(sl)}</li>; })}</ul>
          </div>
        </>)}
      </section>

      {/* ── analisa otomatis (temuan, rekomendasi, perhatian, tren 13 bulan) ── */}
      <AnalisaSummary />

      {/* ── baris 3: pelanggaran transporter ── */}
      <NcSummaryCard s={nc} link={canWrite} />
      <NcTopCard s={nc} />

      {/* ── baris 4: portal gate ── */}
      <section className="dcard c6">
        <div className="dch"><h2>{L("Portal gate · hari ini", "Gate portal · today")} <span className={`live ${gLive ? "on" : ""}`}><i></i>{gLive ? "LIVE" : "…"}</span></h2>{canWrite && <Link className="btn q sm" href="/gate">{L("Detail", "Detail")}</Link>}</div>
        <div className="mk">
          <div><b>{gs.masuk}</b><span>{L("Masuk", "In")}</span></div>
          <div><b>{gs.keluar}</b><span>{L("Keluar", "Out")}</span></div>
          <div className={gs.lama ? "bad" : ""}><b>{gs.dalam}</b><span>{L("Di dalam", "Inside")}{gs.lama ? ` · ${gs.lama} > ${L("4 jam", "4 h")}` : ""}</span></div>
          <div className={gs.temuan ? "bad" : ""}><b>{gs.temuan}</b><span>{L("Ada temuan", "With findings")}</span></div>
        </div>
        <div className="dfill dflow"><FlowChart today={history ?? []} day={day} /></div>
        <div className="dleg"><span><i style={{ background: "var(--bar)" }}></i>{L("Masuk", "In")}</span><span><i style={{ background: "#DA291C" }}></i>{L("Keluar", "Out")}</span><span>{L("per jam · rata-rata", "per hour · average")} {gs.avgMs ? fDurMs(gs.avgMs) : "–"} {L("di dalam", "inside")}</span></div>
      </section>
      <section className="dcard c6">
        <div className="dch"><h2>{L("Di dalam area", "Inside the area")}</h2><span className="sub" style={{ margin: 0 }}>{L("terlama di atas", "longest at top")}</span></div>
        <div className="dfill">
          <div className="inl two">
            {insideTop.map((g) => {
              const cls = Date.now() - new Date(g.in_at).getTime() > LONG_MS ? "long" : "";
              const body = (<><span className="g-plate sm">{g.nopol}</span><span><b>{g.company_name || "–"}</b><small>{g.driver_name} · {g.in_dept_name || "–"}</small></span><span className="dur">{fDurShort(g.in_at)}</span></>);
              return canWrite ? <Link key={g.id} href={`/gate/${g.id}`} className={cls}>{body}</Link> : <div key={g.id} className={`inr ${cls}`}>{body}</div>;
            })}
          </div>
          {inside && inside.length === 0 && <div className="dempty">{L("Tidak ada kendaraan di dalam area.", "No vehicles inside the area.")}</div>}
        </div>
        {inside && inside.length > 8 && (canWrite ? <Link className="dfoot" href="/gate">+{inside.length - 8} {L("kendaraan lain", "more vehicles")} <span className="arr">→</span></Link> : <span className="dfoot">+{inside.length - 8} {L("kendaraan lain", "more vehicles")}</span>)}
      </section>

      {/* ── baris 5: kejadian, patroli & personel, KPI ── */}
      <section className="dcard c4">
        <div className="dch"><h2>{L("Kejadian", "Incidents")}</h2><span className="sub" style={{ margin: 0 }}>{fmt(inc)} total · {L("bulan lalu", "last month")}</span></div>
        <div className="dfill">
          <div className="hbar inc">{incOrdered(D).map((i) => { const pv = D.incPrev[i.category]; const mx = Math.max(1, ...D.inc.map((x) => x.value)); return (
            <div className={`r ${i.value ? "" : "zero"}`} key={i.category}><span title={incLabel(i.category)}>{incLabel(i.category)}</span><span className="t"><i style={{ width: `${(i.value / mx) * 100}%` }}></i></span><b>{i.value}</b><em>{pv ?? "–"}</em></div>
          ); })}</div>
        </div>
      </section>
      <section className="dcard c4">
        <div className="dch"><h2>{L("Patroli & personel", "Patrol & personnel")}</h2></div>
        <div className="dfill dstat">
          <div><b>{dec(pc, 2)}<small>%</small></b><span>{L("Checkpoint patroli", "Patrol checkpoints")} · {fmt(D.patrol.target_checkpoint - D.patrol.actual_checkpoint)} {L("terlewat", "missed")}</span><i className="meter"><i style={{ width: `${Math.min(100, pc)}%` }}></i></i></div>
          <div className={oldest >= 3 ? "bad" : ""}><b>{openNi.length}</b><span>{L("Temuan terbuka", "Open findings")}{openNi.length ? L(` · tertua ${oldest} bulan`, ` · oldest ${oldest} months`) : L(" · semua selesai", " · all done")}</span></div>
          <div><b>{D.leaves.length}</b><span>{L("Cuti / sakit bulan ini", "Leave / sick this month")}</span></div>
        </div>
      </section>
      <section className="dcard c4">
        <div className="dch"><h2>KPI</h2><span className="sub" style={{ margin: 0 }}>{year}</span></div>
        <div className="dfill dstat">
          <div><b>{kNow === null ? "–" : dec(kNow)}</b><span>{L("Skor", "Score")} {name} {L("(skala 1–5)", "(scale 1–5)")}</span></div>
          <div><b>{dec(k.final)}</b><span>{L("Tahun berjalan", "Year to date")}</span></div>
          <div className="kmonths" aria-label={L("Skor KPI per bulan", "KPI score per month")}>{k.monthly.map((v, i) => <span key={i} className={i === m0 ? "cur" : ""} title={`${monthLong(i)}: ${v === null ? "–" : dec(v)}`}><i style={{ height: `${v === null ? 0 : (v / 5) * 100}%` }}></i></span>)}</div>
        </div>
      </section>

      {/* ── baris 6: rekap per kategori ── */}
      <section className="dcard c12">
        <div className="dch"><h2>{L("Rekap per kategori", "Summary by category")} · {name} {year}</h2><span className="sub" style={{ margin: 0 }}>{L("dibanding bulan lalu", "vs last month")}</span></div>
        <div className="xcats">
          {CATS.map((c) => { const v = vsPrev(D, c.k); return (
            <button key={c.k} className="xcat" onClick={() => open(c.k)}><small>{catName(c)}</small><b>{fmt(v.t)}</b><span className={v.d < 0 ? "dn" : "up"}>{v.d < 0 ? "▼" : "▲"} {fmt(Math.abs(v.d))} ({dec(Math.abs(v.pct), 1)}%)</span><Spark vals={D.totals13[c.k]} /></button>
          ); })}
        </div>
      </section>

      <CategoryDrawer D={D} open={!!drawer} k={dk} setK={setDk} onClose={() => setDrawer(null)} />
    </div>
  );
}
