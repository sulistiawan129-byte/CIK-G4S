"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppContext";
import { CategoryDrawer, Loading } from "@/components/ui";
import { CATS, DOWL, fmt, type CatKey } from "@/lib/constants";
import { agg, monthName, r4Day } from "@/lib/calc";
import { firstMonOffset } from "@/lib/dates";
import { api, debounced } from "@/lib/data";
import { useDrafts } from "@/lib/useDrafts";

function cmpTxt(v: number, avg: number) {
  if (!avg) return null;
  const p = ((v - avg) / avg) * 100;
  if (Math.abs(p) < 15) return <em className="n">wajar</em>;
  return <em className={p > 0 ? "hi" : "lo"}>{p > 0 ? "+" : ""}{Math.round(p)}% dari rata-rata</em>;
}

function Harian() {
  const { D, setD, error, siteId, canWrite, toast, fail } = useApp();
  const params = useSearchParams();
  const [sel, setSel] = useState(1);
  const [flash, setFlash] = useState<{ d: number; n: number } | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [dk, setDk] = useState<CatKey>("karyawan");
  const { set, clear, val } = useDrafts();
  const inited = useRef<string | null>(null);

  useEffect(() => {
    if (!D || inited.current === D.month) return;
    inited.current = D.month;
    const q = Number(params.get("d"));
    if (q >= 1 && q <= D.days.length) return setSel(q);
    const today = new Date();
    const past = D.days.filter((d) => new Date(d.iso + "T00:00:00") <= today).length || D.days.length;
    const firstEmpty = D.filled.slice(0, past).indexOf(false);
    setSel(firstEmpty >= 0 ? firstEmpty + 1 : past);
  }, [D, params]);

  if (!D) return <Loading error={error} />;
  const x = D.days[sel - 1], { name } = monthName(D.month);
  const today = new Date();
  const past = D.days.filter((d) => new Date(d.iso + "T00:00:00") <= today).length || D.days.length;
  const filled = D.filled.slice(0, past).filter(Boolean).length;

  function change(k: CatKey, raw: string) {
    if (!siteId || !D) return;
    const v = Math.max(0, parseInt(raw) || 0);
    const key = `${sel}:${k}`, day = x.iso, i = sel - 1;
    set(key, raw);
    setD((p) => { if (!p) return p; const daily = { ...p.daily, [k]: [...p.daily[k]] }; daily[k][i] = v; const f = [...p.filled]; f[i] = true; return { ...p, daily, filled: f }; });
    setFlash({ d: sel, n: Date.now() });
    debounced(key, async () => { await api.setDaily(siteId, day, k, v); clear(key); }, 450, fail);
  }
  function step(k: CatKey, dl: number) { change(k, String(Math.max(0, (parseInt(val(`${sel}:${k}`, D!.daily[k][sel - 1])) || 0) + dl))); }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>, k: CatKey) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const i = CATS.findIndex((c) => c.k === k);
    if (i < CATS.length - 1) { const n = document.getElementById(`f-${CATS[i + 1].k}`) as HTMLInputElement; n?.focus(); n?.select(); return; }
    if (sel < D!.days.length) { setSel(sel + 1); toast(`Lanjut ke ${sel + 1} ${name}`); setTimeout(() => { const n = document.getElementById(`f-${CATS[0].k}`) as HTMLInputElement; n?.focus(); n?.select(); }, 30); }
  }

  return (
    <div className="page enter">
      <section>
        <div className="eyebrow">Data harian</div>
        <h1>Isi per hari, sekali di akhir shift malam</h1>
        <p className="lede">Pilih tanggal, isi lima angka, tekan Enter untuk pindah kolom. Di kolom terakhir, Enter membuka hari berikutnya. Tersimpan otomatis.</p>
        <div className="fillbar" style={{ marginTop: 20 }}><span><b>{filled}</b> dari {past} hari terisi</span><div className="t"><i style={{ width: `${(filled / past) * 100}%` }}></i></div></div>
        {!canWrite && <p className="readonly-note" style={{ marginTop: 14 }}>Akun ini hanya bisa melihat data.</p>}
      </section>

      <section className="split">
        <div className="cal" role="group" aria-label={`Kalender ${name}`}>
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((h) => <div className="h" key={h}>{h}</div>)}
          {Array.from({ length: firstMonOffset(D.month) }, (_, i) => <div key={`b${i}`}></div>)}
          {D.days.map((d) => {
            const has = D.filled[d.d - 1], ev = D.events.some((e) => Number(e.day.slice(8, 10)) === d.d);
            return (
              <button key={`${d.d}-${flash?.d === d.d ? flash.n : 0}`} className={`${d.we ? "we" : ""} ${has ? "has" : "empty"} ${flash?.d === d.d ? "flash" : ""}`} aria-pressed={d.d === sel} onClick={() => setSel(d.d)}>
                <span className="n">{d.d}{ev && <i className="evd"></i>}</span>
                <span className="t">{has ? `${fmt(r4Day(D, d.d - 1))} mobil` : "belum diisi"}</span>
              </button>
            );
          })}
        </div>

        <fieldset className="panel ro" disabled={!canWrite} key={sel} style={{ animation: "viewin .35s both" }}>
          <div className="dayhead"><h2>{DOWL[x.dow]}, {sel} {name}</h2><span className={`chip ${x.we ? "we" : ""}`}>{x.we ? "Hari libur" : "Hari kerja"} · Mg {x.wk}</span></div>
          {CATS.map((c) => {
            const a = agg(D, c.k), avg = x.we ? a.aWE : a.aWD, v = val(`${sel}:${c.k}`, D.daily[c.k][sel - 1]);
            return (
              <div className="field" key={c.k}>
                <label htmlFor={`f-${c.k}`}>{c.n}<small>Rata-rata {x.we ? "hari libur" : "hari kerja"}: {fmt(avg)}</small><span className="cmp">{D.filled[sel - 1] && cmpTxt(parseInt(v) || 0, avg)}</span></label>
                <div className="step">
                  <button type="button" onClick={() => step(c.k, -1)} aria-label={`Kurangi ${c.n}`}>−</button>
                  <input id={`f-${c.k}`} type="number" min={0} inputMode="numeric" value={v} onChange={(e) => change(c.k, e.target.value)} onKeyDown={(e) => onKey(e, c.k)} onFocus={(e) => e.target.select()} />
                  <button type="button" onClick={() => step(c.k, 1)} aria-label={`Tambah ${c.n}`}>+</button>
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, gap: 12 }}>
            <button type="button" className="btn q" disabled={sel === 1} onClick={() => setSel(sel - 1)}>← {sel > 1 ? sel - 1 : ""}</button>
            <button type="button" className="btn" disabled={sel === D.days.length} onClick={() => setSel(sel + 1)}>Lanjut ke {sel < D.days.length ? `${sel + 1} ${name}` : ""} →</button>
          </div>
        </fieldset>
      </section>

      <section className="sec">
        <h2>Total bulan ini</h2>
        <div className="totals">
          {CATS.map((c) => <button className="tot" key={c.k} onClick={() => { setDk(c.k); setDrawer(true); }}><div className="num">{fmt(agg(D, c.k).total)}</div><div className="l">{c.n}</div></button>)}
        </div>
      </section>
      <CategoryDrawer D={D} open={drawer} k={dk} setK={setDk} onClose={() => setDrawer(false)} />
    </div>
  );
}

export default function Page() { return <Suspense><Harian /></Suspense>; }
