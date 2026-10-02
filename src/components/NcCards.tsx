"use client";
import Link from "next/link";
import { MONTH_ID, fmt } from "@/lib/constants";
import type { NcSummary } from "@/lib/gc/summary";

const mLabel = (k: string) => MONTH_ID[Number(k.slice(5, 7)) - 1]?.slice(0, 3) ?? k;
const pct = (n: number | null) => (n === null ? "–" : `${n.toFixed(n < 10 ? 2 : 1).replace(".", ",")}%`);

/** Kartu ringkas pelanggaran transporter: angka utama + tren 12 bulan. */
export function NcSummaryCard({ s, link = true, className = "c6" }: { s: NcSummary | null; link?: boolean; className?: string }) {
  const max = Math.max(1, ...(s?.trend.map((t) => t.nc) ?? [1]));
  const d = s ? s.total - s.prev : 0;
  return (
    <section className={`dcard ${className}`}>
      <div className="dch"><h2>Pelanggaran transporter{s ? ` · ${MONTH_ID[Number(s.month.slice(5, 7)) - 1]}` : ""}</h2>{link && <Link className="btn q sm" href="/gc">Dashboard NC</Link>}</div>
      {!s ? <div className="sk" style={{ height: 150 }} /> : (<>
        <div className="mk">
          <div className={s.total ? "bad" : ""}><b>{fmt(s.total)}</b><span>Laporan NC <em className={d > 0 ? "dn" : "up"}>{d > 0 ? "▲" : d < 0 ? "▼" : "="} {Math.abs(d)}</em></span></div>
          <div><b>{pct(s.rate)}</b><span>dari {fmt(s.inspected)} diperiksa</span></div>
          <div><b>{fmt(s.reject)}</b><span>Reject · {fmt(s.accept)} accept</span></div>
          <div className={s.repeat ? "bad" : ""}><b>{fmt(s.repeat)}</b><span>Supplier berulang</span></div>
        </div>
        <div className="nctrend" aria-label="Laporan NC per bulan, 12 bulan terakhir">
          {s.trend.map((t, i) => (
            <div key={t.month} className={i === s.trend.length - 1 ? "cur" : ""} title={`${mLabel(t.month)}: ${t.nc} laporan`}>
              <span className="v">{t.nc || ""}</span>
              <i style={{ height: `${Math.max(2, (t.nc / max) * 100)}%` }}></i>
              <span className="n">{mLabel(t.month)}</span>
            </div>
          ))}
        </div>
      </>)}
    </section>
  );
}

/** Kategori temuan & supplier dengan NC terbanyak bulan ini. */
export function NcTopCard({ s, className = "c6" }: { s: NcSummary | null; className?: string }) {
  const bar = (rows: [string, number][]) => rows.length ? (
    <div className="hbar">{rows.slice(0, 5).map(([n, v]) => <div className="r" key={n}><span title={n}>{n}</span><span className="t"><i style={{ width: `${(v / rows[0][1]) * 100}%` }}></i></span><b>{v}</b></div>)}</div>
  ) : <p className="sub">Belum ada pelanggaran bulan ini.</p>;
  return (
    <section className={`dcard ${className}`}>
      <div className="dch"><h2>Temuan terbanyak</h2><span className="sub" style={{ margin: 0 }}>bulan ini</span></div>
      {!s ? <div className="sk" style={{ height: 150 }} /> : (
        <>
          <div className="nctop">
            <div><h3>Jenis pelanggaran</h3>{bar(s.byCat)}</div>
            <div><h3>Supplier</h3>{bar(s.bySupplier)}</div>
          </div>
          <div className="nclatest">
            <h3>Laporan terbaru</h3>
            {s.latest.length ? <ul>{s.latest.slice(0, 4).map((r) => (
              <li key={r.id}><span className="tn">{r.tanggal.slice(8, 10)}/{r.tanggal.slice(5, 7)}</span><b>{r.no_polisi}</b><span className="co">{r.nama_supplier}</span><span className="tg">{(r.temuan_list ?? []).join(", ")}</span><em className={r.status === "Reject" ? "rj" : "ac"}>{r.status}</em></li>
            ))}</ul> : <p className="sub">Belum ada laporan bulan ini.</p>}
          </div>
        </>
      )}
    </section>
  );
}
