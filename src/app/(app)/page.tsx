"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppContext";
import { CategoryDrawer, Count, Loading, Spark } from "@/components/ui";
import { CATS, DOW, DOWL, EVENT_KINDS, fmt, type CatKey } from "@/lib/constants";
import { checks, incTotal, monthName, patrolPct, r4Day, agg } from "@/lib/calc";
import { shiftNow } from "@/lib/dates";
import { SLIDES, slideOk } from "@/lib/slides";
import { api } from "@/lib/data";
import type { MonthData } from "@/lib/types";

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
        <Link className="link" style={{ marginTop: 12, display: "inline-block" }} href={`/harian?d=${sel}`}>Ubah data tanggal ini <span className="arr">→</span></Link>
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

export default function Home() {
  const { D, error } = useApp();
  const [sel, setSel] = useState(1);
  const [drawer, setDrawer] = useState<CatKey | null>(null);
  const [dk, setDk] = useState<CatKey>("karyawan");
  const inited = useRef<string | null>(null);

  useEffect(() => {
    if (!D || inited.current === D.month) return;
    inited.current = D.month;
    const last = D.filled.lastIndexOf(true);
    setSel(last >= 0 ? last + 1 : 1);
  }, [D]);

  if (!D) return <Loading error={error} />;
  const { name, year } = monthName(D.month);
  const ch = checks(D), ok = SLIDES.filter((s) => slideOk(D, s, ch)).length;
  const r4c = CATS.filter((c) => c.r4), r4h = D.totals13.karyawan.map((_, i) => r4c.reduce((a, c) => a + D.totals13[c.k][i], 0));
  const r4 = r4h[12], mo = agg(D, "motor").total, moh = D.totals13.motor;
  const inc = incTotal(D), incOn = [...D.inc].filter((i) => i.value > 0).sort((a, b) => b.value - a.value), pc = patrolPct(D);
  const dl = (a: number, b: number) => <><span className={a < b ? "dn" : "upc"}>{a < b ? "▼" : "▲"} {fmt(Math.abs(a - b))}</span> dari bulan lalu</>;
  const open = (k: CatKey) => { setDk(k); setDrawer(k); };

  return (
    <div className="page enter">
      <section className="hero">
        <div>
          <div className="live"><span className="pulse"></span><Clock /></div>
          <div className="eyebrow">Periode laporan</div>
          <h1 className="xl">{name} {year}</h1>
          <p className="lede">{ch.length ? <><b>{ok} dari {SLIDES.length} slide siap.</b> {ch.length} hal perlu dicek sebelum laporan dikirim.</> : <><b>Semua slide siap.</b> Laporan bisa dikirim.</>}</p>
          <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
            <button className="btn light" onClick={() => document.getElementById("todo")?.scrollIntoView({ behavior: "smooth" })}>{ch.length ? "Selesaikan yang tersisa ↓" : "Tidak ada yang tersisa"}</button>
            <Link className="btn ghost" href="/laporan">Buka laporan</Link>
          </div>
        </div>
        <Ring ok={ok} total={SLIDES.length} />
      </section>

      <section className="stats">
        <button className="stat" onClick={() => open("karyawan")}><Count className="num" value={r4} /><div className="l">Kendaraan roda empat</div><div className="d">{dl(r4, r4h[11])}</div><Spark vals={r4h} /><div className="more">Lihat rincian →</div></button>
        <button className="stat" onClick={() => open("motor")}><Count className="num" value={mo} /><div className="l">Motor masuk</div><div className="d">{dl(mo, moh[11])}</div><Spark vals={moh} /><div className="more">Lihat rincian →</div></button>
        <Link className="stat" href="/kejadian" style={{ textDecoration: "none" }}><Count className="num" value={inc} /><div className="l">Kejadian tercatat</div><div className="d">{incOn.length} kategori</div>
          <div className="stack" aria-hidden="true">{incOn.map((i, j) => <i key={i.category} style={{ flex: i.value, ["--o" as string]: 1 - j * 0.15 }} title={`${i.category}: ${i.value}`}></i>)}</div>
          <div className="stackl">{incOn.slice(0, 3).map((i) => `${i.category} ${i.value}`).join(" · ") || "Belum ada kejadian"}</div><div className="more">Buka kejadian →</div></Link>
        <Link className="stat" href="/kejadian" style={{ textDecoration: "none" }}><div className="num"><Count value={pc} d={2} /><span style={{ fontSize: ".45em" }}>%</span></div><div className="l">Checkpoint patroli</div><div className="d">{fmt(D.patrol.target_checkpoint - D.patrol.actual_checkpoint)} dari {fmt(D.patrol.target_checkpoint)} terlewat</div><div className="meter"><i style={{ width: `${pc}%` }}></i></div><div className="more">Buka patroli →</div></Link>
      </section>

      <section className="sec">
        <div className="sechead"><div><h2>Sebulan di gerbang</h2><p className="sub">Kendaraan roda empat per hari. Titik merah menandai kejadian atau temuan. Arahkan kursor, atau pakai tombol panah.</p></div><button className="btn q" onClick={() => open("karyawan")}>Rincian per kategori</button></div>
        <Strip D={D} sel={sel} setSel={setSel} />
        <DayDetail D={D} sel={sel} />
      </section>

      <section className="sec" id="todo">
        <div className="sechead"><div><h2>Perlu dicek</h2><p className="sub">Beberapa bisa langsung diselesaikan dari sini.</p></div></div>
        <Todo D={D} />
      </section>

      <CategoryDrawer D={D} open={!!drawer} k={dk} setK={setDk} onClose={() => setDrawer(null)} />
    </div>
  );
}
