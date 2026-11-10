"use client";
import { useApp } from "@/components/AppContext";
import { Count, Loading } from "@/components/ui";
import { KPI_OBJ, kpiLabel, monLabel, monthLong } from "@/lib/constants";
import { L } from "@/lib/lang";
import { kpiCalc } from "@/lib/calc";
import { parseMonth } from "@/lib/dates";
import { api } from "@/lib/data";

export default function KPI() {
  const { D, setD, error, siteId, canWrite, fail } = useApp();
  if (!D) return <Loading error={error} />;
  const k = kpiCalc(D), { y, m0 } = parseMonth(D.month);

  function score(obj: number, v: number) {
    if (!siteId) return;
    const cur = D!.kpi[obj][m0], next = cur === v ? null : v;
    setD((p) => { if (!p) return p; const kpi = p.kpi.map((r) => [...r]); kpi[obj][m0] = next; return { ...p, kpi }; });
    api.setKpi(siteId, y, m0 + 1, obj + 1, next).catch(fail);
  }

  return (
    <div className="page enter">
      <section>
        <div className="eyebrow">{L("KPI · nilai dari klien", "KPI · client scores")}</div>
        <h1>{L("Skor", "Score")} {monthLong(m0)}</h1>
        <p className="lede">{L("Pilih skor 1–5 untuk tiap objektif. Klik skor yang sama sekali lagi untuk mengosongkan. Nilai tahun berjalan dirata-rata dari bulan yang sudah dinilai.", "Pick a score from 1–5 for each objective. Click the same score again to clear it. The year-to-date value is the average of the months already scored.")}</p>
        {!canWrite && <p className="readonly-note" style={{ marginTop: 14 }}>{L("Akun ini hanya bisa melihat data.", "This account can only view data.")}</p>}
      </section>
      <section className="kpihead">
        <div className="stat0"><div className="num" style={{ fontSize: 64 }}>{k.monthly[m0] === null ? "–" : <Count value={k.monthly[m0] as number} d={2} />}</div><div className="l">{L("Nilai", "Score")} {monthLong(m0)}</div></div>
        <div className="stat0"><div className="num" style={{ fontSize: 64 }}><Count value={k.final} d={2} /></div><div className="l">{L("Tahun berjalan", "Year to date")} · {k.rows[0].n} {L("bulan", "months")}</div></div>
        <div className="kbars" aria-label={L("Nilai per bulan", "Score per month")}>
          {Array.from({ length: 12 }, (_, j) => monLabel(j)).map((m, j) => { const v = k.monthly[j]; return <div className="kb" key={m}><i style={{ height: `${v ? (v / 5) * 100 : 0}%` }} className={j === m0 ? "cur" : ""}></i><span>{m}</span></div>; })}
        </div>
      </section>
      <fieldset className="sec ro" disabled={!canWrite}>
        <ul className="rows kpi">
          {KPI_OBJ.map((o, i) => (
            <li key={o[0]}>
              <div><b>{kpiLabel(i)}</b><div className="hist" title={L("Jan–Des", "Jan–Dec")}>{Array.from({ length: 12 }, (_, j) => monLabel(j)).map((m, j) => { const v = D.kpi[i][j]; return <i key={m} className={v === null ? "" : v >= 5 ? "s5" : v >= 4 ? "s4" : "lo"}></i>; })}</div></div>
              <span className="sub" style={{ margin: 0 }}>{o[1]}%</span>
              <div className="seg" role="group" aria-label={`${L("Skor", "Score")} ${kpiLabel(i)}`}>
                {[1, 2, 3, 4, 5].map((v) => <button type="button" key={v} aria-pressed={D.kpi[i][m0] === v} onClick={() => score(i, v)}>{v}</button>)}
              </div>
            </li>
          ))}
        </ul>
        <p className="note">{L(`Garis kecil di bawah nama = riwayat Jan–Des ${y}.`, `The small bars under the name = Jan–Dec ${y} history.`)}</p>
      </fieldset>
    </div>
  );
}
