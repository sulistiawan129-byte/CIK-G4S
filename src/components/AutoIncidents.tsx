"use client";
/* Jenis kejadian yang DIHITUNG OTOMATIS (bukan diisi manual), sama dengan Laporan Manajemen CIKOPS:
   • Timbangan (selisih ≥ 40 kg) — dari isian Transporter bulanan
   • Pelanggaran Transporter — dari laporan NC modul G-C bulan ini
   Total gabungan = kejadian manual + dua baris ini. */
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppContext";
import { createClient } from "@/lib/gc/client";
import { monthEnd } from "@/lib/dates";
import { fmt } from "@/lib/constants";
import { incTotal } from "@/lib/calc";

export function AutoIncidents() {
  const { D } = useApp();
  const [pel, setPel] = useState<number | null>(null);
  const month = D?.month;
  useEffect(() => {
    if (!month) return;
    let alive = true;
    createClient().from("v_nc_reports").select("id", { count: "exact", head: true }).gte("tanggal", month).lte("tanggal", monthEnd(month))
      .then(({ count, error }) => { if (alive) setPel(error ? null : count ?? 0); });
    return () => { alive = false; };
  }, [month]);
  if (!D) return null;
  const sel = D.extra.selisih_timbang || 0, po = D.extra.palm_oil || 0, manual = incTotal(D);
  const total = manual + sel + (pel ?? 0);
  return (
    <section className="sec" aria-label="Kejadian otomatis">
      <div><h2>Dihitung otomatis</h2><p className="sub">Dua jenis kejadian ini tidak perlu diisi di sini — angkanya diambil dari data lain dan ikut dihitung di Laporan Manajemen CIKOPS.</p></div>
      <ul className="rows inc">
        <li>
          <div><b>Timbangan (selisih ≥ 40 kg)</b><div className="sub" style={{ margin: 0 }}>dari isian <em>Transporter &amp; biomas</em> di bawah{po ? ` · ${fmt(po)} kendaraan Palm Oil / Fat Blend` : ""}</div></div>
          <div className="num" style={{ fontSize: 32 }}>{fmt(sel)}</div>
        </li>
        <li>
          <div><b>Pelanggaran Transporter</b><div className="sub" style={{ margin: 0 }}>dari laporan NC modul G-C bulan ini</div></div>
          <div className="num" style={{ fontSize: 32 }}>{pel === null ? "…" : fmt(pel)}</div>
        </li>
      </ul>
      <p className="sub" style={{ marginTop: 10 }}>Total kejadian termasuk otomatis: <b>{fmt(total)}</b> ({fmt(manual)} manual + {fmt(sel)} timbangan + {pel === null ? "…" : fmt(pel)} pelanggaran)</p>
    </section>
  );
}
