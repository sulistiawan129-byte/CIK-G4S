"use client";
import { AnalisaFull } from "@/components/analisa/Analisa";
import { Loading } from "@/components/ui";
import { useApp } from "@/components/AppContext";
import { monthName } from "@/lib/calc";

export default function AnalisaPage() {
  const { D, error } = useApp();
  if (!D) return <Loading error={error} />;
  const { name, year } = monthName(D.month);
  return (
    <div className="page enter">
      <div className="eyebrow">Security</div>
      <h1>Analisa otomatis · {name} {year}</h1>
      <p className="lede">Temuan, rekomendasi, dan hal yang perlu perhatian dihitung otomatis dari data harian, riwayat 12 bulan, pelanggaran transporter (G-C), kejadian dan patroli — dengan logika yang sama seperti Laporan Manajemen di CIKOPS.</p>
      <AnalisaFull />
    </div>
  );
}
