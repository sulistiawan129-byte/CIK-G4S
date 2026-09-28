"use client";
import { useApp } from "@/components/AppContext";
import { Count, Loading } from "@/components/ui";
import { KPI_OBJ, MON, MONTH_ID } from "@/lib/constants";
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
        <div className="eyebrow">KPI · nilai dari klien</div>
        <h1>Skor {MONTH_ID[m0]}</h1>
        <p className="lede">Pilih skor 1–5 untuk tiap objektif. Klik skor yang sama sekali lagi untuk mengosongkan. Nilai tahun berjalan dirata-rata dari bulan yang sudah dinilai.</p>
        {!canWrite && <p className="readonly-note" style={{ marginTop: 14 }}>Akun ini hanya bisa melihat data.</p>}
      </section>
      <section className="kpihead">
        <div className="stat0"><div className="num" style={{ fontSize: 64 }}>{k.monthly[m0] === null ? "–" : <Count value={k.monthly[m0] as number} d={2} />}</div><div className="l">Nilai {MONTH_ID[m0]}</div></div>
        <div className="stat0"><div className="num" style={{ fontSize: 64 }}><Count value={k.final} d={2} /></div><div className="l">Tahun berjalan · {k.rows[0].n} bulan</div></div>
        <div className="kbars" aria-label="Nilai per bulan">
          {MON.map((m, j) => { const v = k.monthly[j]; return <div className="kb" key={m}><i style={{ height: `${v ? (v / 5) * 100 : 0}%` }} className={j === m0 ? "cur" : ""}></i><span>{m}</span></div>; })}
        </div>
      </section>
      <fieldset className="sec ro" disabled={!canWrite}>
        <ul className="rows kpi">
          {KPI_OBJ.map((o, i) => (
            <li key={o[0]}>
              <div><b>{o[0]}</b><div className="hist" title="Jan–Des">{MON.map((m, j) => { const v = D.kpi[i][j]; return <i key={m} className={v === null ? "" : v >= 5 ? "s5" : v >= 4 ? "s4" : "lo"}></i>; })}</div></div>
              <span className="sub" style={{ margin: 0 }}>{o[1]}%</span>
              <div className="seg" role="group" aria-label={`Skor ${o[0]}`}>
                {[1, 2, 3, 4, 5].map((v) => <button type="button" key={v} aria-pressed={D.kpi[i][m0] === v} onClick={() => score(i, v)}>{v}</button>)}
              </div>
            </li>
          ))}
        </ul>
        <p className="note">Garis kecil di bawah nama = riwayat Jan–Des {y}.</p>
      </fieldset>
    </div>
  );
}
