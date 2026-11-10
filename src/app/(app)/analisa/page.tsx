"use client";
import { AnalisaFull } from "@/components/analisa/Analisa";
import { Loading } from "@/components/ui";
import { useApp } from "@/components/AppContext";
import { monthName } from "@/lib/calc";
import { L } from "@/lib/lang";

export default function AnalisaPage() {
  const { D, error } = useApp();
  if (!D) return <Loading error={error} />;
  const { name, year } = monthName(D.month);
  return (
    <div className="page enter">
      <div className="eyebrow">Security</div>
      <h1>{L("Analisa otomatis", "Automatic analysis")} · {name} {year}</h1>
      <p className="lede">{L("Temuan, rekomendasi, dan hal yang perlu perhatian dihitung otomatis dari data harian, riwayat 12 bulan, pelanggaran transporter (G-C), kejadian dan patroli — dengan logika yang sama seperti Laporan Manajemen di CIKOPS.", "Findings, recommendations and items needing attention are calculated automatically from daily data, the 12-month history, transporter violations (G-C), incidents and patrol — using the same logic as the Management Report in CIKOPS.")}</p>
      <AnalisaFull />
    </div>
  );
}
