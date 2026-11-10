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
import { L } from "@/lib/lang";
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
    <section className="sec" aria-label={L("Kejadian otomatis", "Automatic incidents")}>
      <div><h2>{L("Dihitung otomatis", "Calculated automatically")}</h2><p className="sub">{L("Dua jenis kejadian ini tidak perlu diisi di sini — angkanya diambil dari data lain dan ikut dihitung di Laporan Manajemen CIKOPS.", "These two incident types do not need to be entered here — the numbers come from other data and are included in the CIKOPS Management Report.")}</p></div>
      <ul className="rows inc">
        <li>
          <div><b>{L("Timbangan (selisih ≥ 40 kg)", "Weighbridge (gap ≥ 40 kg)")}</b><div className="sub" style={{ margin: 0 }}>{L("dari isian", "from the")} <em>{L("Transporter & biomas", "Transporters & biomass")}</em> {L("di bawah", "section below")}{po ? ` · ${fmt(po)} ${L("kendaraan Palm Oil / Fat Blend", "Palm Oil / Fat Blend vehicles")}` : ""}</div></div>
          <div className="num" style={{ fontSize: 32 }}>{fmt(sel)}</div>
        </li>
        <li>
          <div><b>{L("Pelanggaran Transporter", "Transporter Violations")}</b><div className="sub" style={{ margin: 0 }}>{L("dari laporan NC modul G-C bulan ini", "from this month's NC reports (G-C module)")}</div></div>
          <div className="num" style={{ fontSize: 32 }}>{pel === null ? "…" : fmt(pel)}</div>
        </li>
      </ul>
      <p className="sub" style={{ marginTop: 10 }}>{L("Total kejadian termasuk otomatis", "Total incidents including automatic")}: <b>{fmt(total)}</b> ({fmt(manual)} {L("manual", "manual")} + {fmt(sel)} {L("timbangan", "weighbridge")} + {pel === null ? "…" : fmt(pel)} {L("pelanggaran", "violations")})</p>
    </section>
  );
}
