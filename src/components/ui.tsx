"use client";
import { useEffect, useRef, useState } from "react";
import { CATS, dec, fmt, type CatKey } from "@/lib/constants";
import { last13, monthLabelEn } from "@/lib/dates";
import { agg, catHighlights, monthName, vsPrev } from "@/lib/calc";
import type { MonthData } from "@/lib/types";
import Link from "next/link";

/** Angka yang "menghitung" dari nilai sebelumnya ke nilai baru — terasa hidup saat data realtime berubah. */
export function Count({ value, d = 0, className }: { value: number; d?: number; className?: string }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = from.current, to = value;
    if (reduce || start === to) { setShown(to); from.current = to; return; }
    let raf = 0; const t0 = performance.now(), dur = 900;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      setShown(start + (to - start) * e);
      if (k < 1) raf = requestAnimationFrame(step); else from.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = to; };
  }, [value]);
  return <span className={className}>{d ? dec(shown, d) : fmt(Math.round(shown))}</span>;
}

export function Spark({ vals, W = 220, H = 40 }: { vals: number[]; W?: number; H?: number }) {
  if (vals.length < 2) return null;
  const mx = Math.max(...vals), mn = Math.min(...vals), r = mx - mn || 1;
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * (W - 6) + 3, H - 5 - ((v - mn) / r) * (H - 12)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const l = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="sp-a" d={`${d} L${l[0]} ${H} L3 ${H} Z`} />
      <path className="sp-l" pathLength={1} d={d} />
      <circle className="sp-d" cx={l[0]} cy={l[1]} r={3.5} />
    </svg>
  );
}

export function Loading({ error }: { error?: string | null }) {
  if (error) return <div className="errbox">Data belum bisa dimuat: {error}</div>;
  return (
    <div className="loading" aria-busy="true" aria-label="Memuat data">
      <div className="sk" style={{ height: 14, width: 120 }} />
      <div className="sk" style={{ height: 52, width: "60%" }} />
      <div className="sk" style={{ height: 18, width: "40%" }} />
      <div className="sk" style={{ height: 180, marginTop: 24 }} />
    </div>
  );
}

function AnnualChart({ D, k }: { D: MonthData; k: CatKey }) {
  const vals = D.totals13[k], labels = last13(D.month).map(monthLabelEn), W = 540, H = 220, top = 24, base = H - 28;
  const mx = Math.max(...vals, 1) * 1.08, bw = W / vals.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafik 13 bulan">
      <line className="ch-g" x1={0} x2={W} y1={base} y2={base} />
      {vals.map((v, i) => {
        const h = (v / mx) * (base - top), x = i * bw + bw * 0.18, w = bw * 0.64, last = i === vals.length - 1;
        return (
          <g className="cb" key={i}>
            <rect className={last ? "ch-cur" : "ch-b"} x={x} y={base - h} width={w} height={h} rx={1.5} style={{ ["--i" as string]: i }} />
            <text className={`ch-v ${last ? "on" : ""}`} x={x + w / 2} y={base - h - 6} textAnchor="middle">{fmt(v)}</text>
            <text className="ch-t" x={x + w / 2} y={H - 10} textAnchor="middle">{labels[i].slice(0, 3)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function WeeklyChart({ D, k }: { D: MonthData; k: CatKey }) {
  const a = agg(D, k), W = 540, H = 200, top = 22, base = H - 28, mx = Math.max(...a.wd, ...a.we, 1) * 1.12, gw = W / 5;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafik mingguan">
      <line className="ch-g" x1={0} x2={W} y1={base} y2={base} />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          {([[a.wd[i], "ch-b", 0], [a.we[i], "ch-we", 1]] as [number, string, number][]).map(([v, cl, j]) => {
            const h = (v / mx) * (base - top), w = gw * 0.3, x = i * gw + gw * 0.18 + j * (w + 4);
            return (
              <g className="cb" key={j}>
                <rect className={cl} x={x} y={base - h} width={w} height={Math.max(h, 1)} rx={1.5} style={{ ["--i" as string]: i * 2 + j }} />
                <text className="ch-v on" x={x + w / 2} y={base - h - 6} textAnchor="middle">{fmt(v)}</text>
              </g>
            );
          })}
          <text className="ch-t" x={i * gw + gw / 2} y={H - 8} textAnchor="middle">Minggu {i + 1}</text>
        </g>
      ))}
    </svg>
  );
}

/** Panel samping rincian kategori kendaraan/visitor. */
export function CategoryDrawer({ D, open, k, setK, onClose }: { D: MonthData; open: boolean; k: CatKey; setK: (k: CatKey) => void; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => closeRef.current?.focus(), 60);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => { clearTimeout(t); document.removeEventListener("keydown", esc); };
  }, [open, onClose]);
  const c = CATS.find((x) => x.k === k)!, v = vsPrev(D, k), h = catHighlights(D, c), { name, year, prevName } = monthName(D.month);
  const si = 2 + CATS.findIndex((x) => x.k === k);
  return (
    <>
      <div className={`scrim ${open ? "on" : ""}`} onClick={onClose}></div>
      <aside className={`drawer ${open ? "on" : ""}`} aria-hidden={!open} aria-label="Rincian kategori">
        {open && (
          <>
            <button ref={closeRef} className="dclose" onClick={onClose} aria-label="Tutup">×</button>
            <div className="eyebrow">Rincian kategori</div>
            <div className="tabs" style={{ margin: "14px 0 26px" }}>
              {CATS.map((x) => <button key={x.k} aria-pressed={x.k === k} onClick={() => setK(x.k)}>{x.n}</button>)}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
              <Count className="num" value={v.t} />
              <span className={`chip ${v.d < 0 ? "bad" : "ok"}`}>{v.d < 0 ? "▼" : "▲"} {fmt(Math.abs(v.d))} dari {prevName}</span>
            </div>
            <p className="sub">{c.n} · {name} {year}</p>
            <h3 className="dh">13 bulan terakhir</h3>
            <div className="chart"><AnnualChart D={D} k={k} /></div>
            <h3 className="dh">Per minggu <span className="leg"><i className="b"></i>Hari kerja <i className="w"></i>Hari libur</span></h3>
            <div className="chart"><WeeklyChart D={D} k={k} /></div>
            <h3 className="dh">Highlights otomatis</h3>
            <ul className="hl">{h.short.map((t, i) => <li key={i}>{t}</li>)}</ul>
            <div style={{ marginTop: 28, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn red" href={`/laporan?s=${si}`} onClick={onClose}>Lihat di slide laporan →</Link>
              <Link className="btn q" href="/harian" onClick={onClose}>Ubah data harian</Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
