"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppContext";
import { CategoryDrawer, Loading } from "@/components/ui";
import { CATS, EXTRA_CATS, catName, catUnit, dowLong, dowShort, extraName, fmt, type CatKey, type ExtraKey } from "@/lib/constants";
import { L } from "@/lib/lang";
import { agg, monthName, r4Day } from "@/lib/calc";
import { firstMonOffset } from "@/lib/dates";
import { api, debounced } from "@/lib/data";
import { useDrafts } from "@/lib/useDrafts";

function cmpTxt(v: number, avg: number) {
  if (!avg) return null;
  const p = ((v - avg) / avg) * 100;
  if (Math.abs(p) < 15) return <em className="n">{L("wajar", "normal")}</em>;
  return <em className={p > 0 ? "hi" : "lo"}>{p > 0 ? "+" : ""}{Math.round(p)}%</em>;
}

const groups = (): { t: string; keys: CatKey[]; sum?: boolean }[] => [
  { t: L("Kendaraan roda empat", "Four-wheel vehicles"), keys: ["karyawan", "tamu", "kontraktor"], sum: true },
  { t: L("Motor & pengunjung", "Motorcycles & visitors"), keys: ["motor", "visitor"] },
];

function Harian() {
  const { D, setD, error, siteId, canWrite, toast, fail } = useApp();
  const params = useSearchParams();
  const [sel, setSel] = useState(1);
  const [flash, setFlash] = useState<{ d: number; n: number } | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [dk, setDk] = useState<CatKey>("karyawan");
  const { set, clear, val } = useDrafts();
  const [saving, setSaving] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);
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
    setSaving((n) => n + 1);
    debounced(key, async () => {
      try { await api.setDaily(siteId, day, k, v); clear(key); setSavedAt(Date.now()); }
      finally { setSaving((n) => Math.max(0, n - 1)); }
    }, 450, (e) => { setSaving(0); fail(e); });
  }
  function step(k: CatKey, dl: number) { change(k, String(Math.max(0, (parseInt(val(`${sel}:${k}`, D!.daily[k][sel - 1])) || 0) + dl))); }
  function changeX(k: ExtraKey, raw: string) {
    if (!siteId || !D) return;
    const v = Math.max(0, parseInt(raw) || 0);
    const key = `${sel}:${k}`, day = x.iso, i = sel - 1;
    set(key, raw);
    setD((p) => { if (!p) return p; const ed = { ...p.extraDaily, [k]: [...p.extraDaily[k]] }; ed[k][i] = v; return { ...p, extraDaily: ed }; });
    setSaving((n) => n + 1);
    debounced(key, async () => {
      try { await api.setDailyExtra(siteId, day, k, v); clear(key); setSavedAt(Date.now()); }
      finally { setSaving((n) => Math.max(0, n - 1)); }
    }, 450, (e) => { setSaving(0); fail(e); });
  }
  function stepX(k: ExtraKey, dl: number) { changeX(k, String(Math.max(0, (parseInt(val(`${sel}:${k}`, D!.extraDaily[k][sel - 1])) || 0) + dl))); }
  // urutan kolom untuk tombol Enter: kendaraan & visitor, lalu transporter & biomas
  const ORDER: string[] = [...CATS.map((c) => c.k), ...(D.extraReady ? EXTRA_CATS.map((c) => c.k) : [])];
  function onKey(e: React.KeyboardEvent<HTMLInputElement>, k: string) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const i = ORDER.indexOf(k);
    if (i < ORDER.length - 1) { const n = document.getElementById(`f-${ORDER[i + 1]}`) as HTMLInputElement; n?.focus(); n?.select(); return; }
    if (sel < D!.days.length) { setSel(sel + 1); toast(L(`Lanjut ke ${sel + 1} ${name}`, `Next: ${sel + 1} ${name}`)); setTimeout(() => { const n = document.getElementById(`f-${ORDER[0]}`) as HTMLInputElement; n?.focus(); n?.select(); }, 30); }
  }

  return (
    <div className="page enter">
      <section>
        <div className="eyebrow">{L("Data harian", "Daily data")}</div>
        <h1>{L("Isi per hari, sekali di akhir shift malam", "Fill in once a day, at the end of the night shift")}</h1>
        <p className="lede">{L("Pilih tanggal, isi angkanya, tekan Enter untuk pindah kolom. Di kolom terakhir, Enter membuka hari berikutnya. Tersimpan otomatis.", "Pick a date, enter the numbers, press Enter to move to the next field. In the last field, Enter opens the next day. Saved automatically.")}</p>
        <div className="fillbar" style={{ marginTop: 20 }}><span><b>{filled}</b> {L("dari", "of")} {past} {L("hari terisi", "days filled")}</span><div className="t"><i style={{ width: `${(filled / past) * 100}%` }}></i></div></div>
        {!canWrite && <p className="readonly-note" style={{ marginTop: 14 }}>{L("Akun ini hanya bisa melihat data.", "This account can only view data.")}</p>}
      </section>

      <section className="split">
        <div className="cal" role="group" aria-label={`${L("Kalender", "Calendar")} ${name}`}>
          {[1, 2, 3, 4, 5, 6, 0].map((h) => <div className="h" key={h}>{dowShort(h)}</div>)}
          {Array.from({ length: firstMonOffset(D.month) }, (_, i) => <div key={`b${i}`}></div>)}
          {D.days.map((d) => {
            const has = D.filled[d.d - 1], ev = D.events.some((e) => Number(e.day.slice(8, 10)) === d.d);
            const future = !has && new Date(d.iso + "T00:00:00") > today;
            const heat = has ? r4Day(D, d.d - 1) / Math.max(1, ...D.days.map((x) => r4Day(D, x.d - 1))) : 0;
            return (
              <button key={`${d.d}-${flash?.d === d.d ? flash.n : 0}`} className={`${d.we ? "we" : ""} ${has ? "has" : future ? "empty future" : "empty past-empty"} ${flash?.d === d.d ? "flash" : ""}`} aria-pressed={d.d === sel} onClick={() => setSel(d.d)} aria-label={`${d.d}${has ? "" : future ? L(", belum lewat", ", not yet") : L(", belum diisi", ", not filled in")}`} style={{ ["--h" as string]: heat.toFixed(2) }}>
                <span className="n">{d.d}{ev && <i className="evd"></i>}</span>
                <span className="t">{has ? fmt(r4Day(D, d.d - 1)) : future ? "" : L("kosong", "empty")}</span>
                {has && <span className="hb" style={{ width: `${Math.round(heat * 100)}%` }}></span>}
              </button>
            );
          })}
        </div>

        <div className="daypanel" key={sel}>
          <header className="dp-head">
            <div>
              <div className="dp-eyebrow">{x.we ? L("Hari libur", "Weekend") : L("Hari kerja", "Weekday")} · {L("Minggu ke-", "Week ")}{x.wk}</div>
              <h2 className="dp-title">{dowLong(x.dow)}, {sel} {name}</h2>
            </div>
            <span className={`dp-save ${saving ? "busy" : savedAt ? "ok" : D.filled[sel - 1] ? "ok" : ""}`} aria-live="polite">
              {saving ? L("Menyimpan…", "Saving…") : savedAt ? L("Tersimpan", "Saved") : D.filled[sel - 1] ? L("Sudah terisi", "Filled in") : L("Belum diisi", "Not filled in")}
            </span>
          </header>

          <fieldset className="ro dp-body" disabled={!canWrite}>
            {groups().map((g) => (
              <div className="dp-group" key={g.t}>
                <div className="dp-gh">
                  <span>{g.t}</span>
                  {g.sum && <b>{fmt(g.keys.reduce((t, k) => t + (parseInt(val(`${sel}:${k}`, D.daily[k][sel - 1])) || 0), 0))}</b>}
                </div>
                {g.keys.map((k) => {
                  const c = CATS.find((x) => x.k === k)!;
                  const a = agg(D, k), avg = x.we ? a.aWE : a.aWD, v = val(`${sel}:${k}`, D.daily[k][sel - 1]);
                  return (
                    <div className="dp-row" key={k}>
                      <label htmlFor={`f-${k}`}>
                        <span className="dp-name">{catName(c)}</span>
                        <span className="dp-meta">
                          {avg ? <>{L("Rata-rata", "Average")} {x.we ? L("hari libur", "weekend") : L("hari kerja", "weekday")} {fmt(avg)} {catUnit(c)}{D.filled[sel - 1] && cmpTxt(parseInt(v) || 0, avg)}</> : L("Belum ada pembanding bulan ini", "No comparison yet this month")}
                        </span>
                      </label>
                      <div className="step">
                        <button type="button" onClick={() => step(k, -1)} aria-label={`${L("Kurangi", "Decrease")} ${catName(c)}`}>−</button>
                        <input id={`f-${k}`} type="number" min={0} inputMode="numeric" value={v} onChange={(e) => change(k, e.target.value)} onKeyDown={(e) => onKey(e, k)} onFocus={(e) => e.target.select()} />
                        <button type="button" onClick={() => step(k, 1)} aria-label={`${L("Tambah", "Increase")} ${catName(c)}`}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {D.extraReady && (
              <div className="dp-group">
                <div className="dp-gh"><span>{L("Transporter & biomas", "Transporters & biomass")}</span></div>
                {EXTRA_CATS.map((c) => {
                  const v = val(`${sel}:${c.k}`, D.extraDaily[c.k][sel - 1]);
                  const tot = D.extraDaily[c.k].reduce((a, b) => a + b, 0);
                  return (
                    <div className="dp-row" key={c.k}>
                      <label htmlFor={`f-${c.k}`}>
                        <span className="dp-name">{extraName(c)}</span>
                        <span className="dp-meta">{L("Total bulan ini", "Total this month")} {fmt(tot)} {L(c.u, "units")}</span>
                      </label>
                      <div className="step">
                        <button type="button" onClick={() => stepX(c.k, -1)} aria-label={`${L("Kurangi", "Decrease")} ${extraName(c)}`}>−</button>
                        <input id={`f-${c.k}`} type="number" min={0} inputMode="numeric" value={v} onChange={(e) => changeX(c.k, e.target.value)} onKeyDown={(e) => onKey(e, c.k)} onFocus={(e) => e.target.select()} />
                        <button type="button" onClick={() => stepX(c.k, 1)} aria-label={`${L("Tambah", "Increase")} ${extraName(c)}`}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </fieldset>

          <footer className="dp-foot">
            <button type="button" className="btn q" disabled={sel === 1} onClick={() => setSel(sel - 1)}>← {sel > 1 ? `${sel - 1} ${name.slice(0, 3)}` : L("Sebelumnya", "Previous")}</button>
            <span className="dp-hint"><kbd>Enter</kbd> {L("pindah kolom", "next field")}</span>
            <button type="button" className="btn red" disabled={sel === D.days.length} onClick={() => setSel(sel + 1)}>{sel < D.days.length ? `${sel + 1} ${name.slice(0, 3)}` : L("Selesai", "Done")} →</button>
          </footer>
        </div>
      </section>

      <section className="sec">
        <h2>{L("Total bulan ini", "Total this month")}</h2>
        <div className="totals">
          {CATS.map((c) => <button className="tot" key={c.k} onClick={() => { setDk(c.k); setDrawer(true); }}><div className="num">{fmt(agg(D, c.k).total)}</div><div className="l">{catName(c)}</div></button>)}
        </div>
      </section>
      <CategoryDrawer D={D} open={drawer} k={dk} setK={setDk} onClose={() => setDrawer(false)} />
    </div>
  );
}

export default function Page() { return <Suspense><Harian /></Suspense>; }
