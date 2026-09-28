/** Ikon garis sederhana untuk menu (tanpa library tambahan). */
const P: Record<string, string> = {
  ringkasan: "M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 9h8V3h-8z",
  harian: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 12h2M12 12h2M16 12h0M8 16h2M12 16h2",
  kejadian: "M12 3l9 16H3zM12 10v4M12 17v.5",
  personel: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6",
  kpi: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  laporan: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6",
  pengguna: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM9 12l2 2 4-4",
  display: "M3 5h18v11H3zM8 20h8M12 16v4",
  gate: "M3 21V8l9-5 9 5v13M7 21v-8h10v8M7 17h10",
};
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] ?? P.ringkasan} />
    </svg>
  );
}
