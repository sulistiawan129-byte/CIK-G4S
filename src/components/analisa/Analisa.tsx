"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppContext";
import { loadSecurityAnalysis } from "@/lib/analisa/load";
import type { ModuleReport, ReportLang } from "@/lib/analisa/report";
import { AnalisaChart } from "./AnalisaChart";
import "./analisa.css";

export interface AnalysisState { reports: ModuleReport[] | null; warnings: string[]; loading: boolean; error: string | null }

/** Muat analisa untuk bulan yang sedang dibuka; ikut diperbarui (tertunda 3 dtk) saat data bulan berubah. */
export function useSecurityAnalysis(lang: ReportLang = "id"): AnalysisState {
  const { siteId, site, month, D } = useApp();
  const [st, setSt] = useState<AnalysisState>({ reports: null, warnings: [], loading: true, error: null });
  const seq = useRef(0);
  const stamp = D?.loadedAt ?? 0;
  useEffect(() => {
    if (!siteId || !site || !month) return;
    const id = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await loadSecurityAnalysis({ siteId, siteCode: site.code, month, lang });
        if (id === seq.current) setSt({ reports: r.reports, warnings: r.warnings, loading: false, error: null });
      } catch (e) {
        if (id === seq.current) setSt((s) => ({ ...s, loading: false, error: (e as Error).message }));
      }
    }, s0(stamp));
    return () => clearTimeout(t);
  }, [siteId, site, month, lang, stamp]);
  return st;
}
// pemuatan pertama langsung, pembaruan berikutnya ditunda supaya tidak membebani saat banyak input
let first = true;
function s0(stamp: number) { void stamp; if (first) { first = false; return 0; } return 3000; }

function Kpis({ r }: { r: ModuleReport }) {
  return (
    <div className="an-kpis">
      {r.kpis.map((k) => (
        <div key={k.label} className={`an-kpi ${k.tone ?? ""}`}><small>{k.label}</small><b>{k.value}</b>{k.sub ? <span>{k.sub}</span> : null}</div>
      ))}
    </div>
  );
}

function Lists({ r, L }: { r: ModuleReport; L: (id: string, en: string) => string }) {
  return (
    <div className="an-cols">
      {r.attention.length > 0 && (
        <div className="an-box alert"><h3>{L("Perlu perhatian", "Needs attention")}</h3><ul>{r.attention.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      )}
      <div className="an-box"><h3>{L("Temuan", "Findings")}</h3><ul>{r.insights.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      <div className="an-box rec"><h3>{L("Rekomendasi", "Recommendations")}</h3><ul>{r.actions.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
    </div>
  );
}

/** Ringkasan di dashboard: judul, KPI, perlu perhatian, temuan, rekomendasi, dua grafik utama. */
export function AnalisaSummary({ lang = "id", link = true }: { lang?: ReportLang; link?: boolean }) {
  const { reports, warnings, loading, error } = useSecurityAnalysis(lang);
  const L = (id: string, en: string) => (lang === "en" ? en : id);
  const main = reports?.[0];
  return (
    <section className="dcard c12 an" aria-label={L("Analisa otomatis", "Automatic analysis")}>
      <div className="dch">
        <h2>{L("Analisa otomatis", "Automatic analysis")}</h2>
        {link && <Link className="link" href="/analisa">{L("Lihat rincian lengkap", "See full detail")} <span className="arr">→</span></Link>}
      </div>
      {loading && !main && <div className="an-load">{L("Menyusun analisa…", "Preparing analysis…")}</div>}
      {error && <div className="an-warnings">{error}</div>}
      {warnings.map((w) => <div className="an-warnings" key={w}>{w}</div>)}
      {main && (
        <>
          <p className="an-lede">{main.headline}</p>
          {!main.empty && <Kpis r={main} />}
          {!main.empty && <Lists r={main} L={L} />}
          {!main.empty && main.charts.length > 0 && <div className="an-charts">{main.charts.slice(0, 2).map((c) => <AnalisaChart key={c.id} spec={c} />)}</div>}
        </>
      )}
    </section>
  );
}

/** Halaman lengkap: ringkasan + semua bagian rincian (kendaraan per kategori, visitor, transporter, pelanggaran, perusahaan khusus, kejadian & patroli). */
export function AnalisaFull({ lang = "id" }: { lang?: ReportLang }) {
  const { reports, warnings, loading, error } = useSecurityAnalysis(lang);
  const L = (id: string, en: string) => (lang === "en" ? en : id);
  if (loading && !reports) return <div className="an-load">{L("Menyusun analisa…", "Preparing analysis…")}</div>;
  const [main, ...subs] = reports ?? [];
  return (
    <div className="an">
      {error && <div className="an-warnings">{error}</div>}
      {warnings.map((w) => <div className="an-warnings" key={w}>{w}</div>)}
      {main && (
        <>
          <p className="an-lede">{main.headline}</p>
          {!main.empty && <Kpis r={main} />}
          {!main.empty && <Lists r={main} L={L} />}
          {!main.empty && <div className="an-charts">{main.charts.map((c) => <AnalisaChart key={c.id} spec={c} />)}</div>}
        </>
      )}
      {subs.filter((s) => !s.empty).map((s) => (
        <details className="an-sub" key={s.title} open={false}>
          <summary><span>{s.title.replace(/^Security — |^Security — /, "")}</span><small>{s.headline}</small></summary>
          <div className="an-sub-in">
            {s.kpis.length > 0 && <Kpis r={s} />}
            <Lists r={s} L={L} />
            {s.charts.length > 0 && <div className="an-charts">{s.charts.map((c) => <AnalisaChart key={c.id} spec={c} />)}</div>}
            {s.table && (
              <div className="an-table"><b>{s.table.title}</b>
                <table><thead><tr>{s.table.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{s.table.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
