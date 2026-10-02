"use client";
import { hourlyFlow, todayWIB, type GateRow } from "@/lib/gate";

/** Grafik batang masuk (abu/putih) & keluar (merah) per jam hari ini. */
export function FlowChart({ today, day = todayWIB(), dark }: { today: GateRow[]; day?: string; dark?: boolean }) {
  const { hin, hout } = hourlyFlow(today, day);
  const W = 480, H = 110, base = 92, mx = Math.max(2, ...hin, ...hout), bw = W / 24;
  const cur = day === todayWIB() ? Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })) % 24 : 23;
  return (
    <div className={`flow ${dark ? "dark" : ""}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Kendaraan masuk dan keluar per jam">
        <line className="fb-ax" x1={0} x2={W} y1={base} y2={base} />
        {hin.map((v, h) => {
          const a = (v / mx) * (base - 14), b = (hout[h] / mx) * (base - 14), x = h * bw;
          return (
            <g key={h} className={h > cur ? "future" : ""}>
              <rect className="fb-in" x={x + bw * 0.12} y={base - a} width={bw * 0.36} height={a} rx={1}><title>{`${String(h).padStart(2, "0")}.00 · masuk ${v}`}</title></rect>
              <rect className="fb-out" x={x + bw * 0.52} y={base - b} width={bw * 0.36} height={b} rx={1}><title>{`${String(h).padStart(2, "0")}.00 · keluar ${hout[h]}`}</title></rect>
              {h % 3 === 0 && <text className="fb-t" x={x + bw / 2} y={H - 4} textAnchor="middle">{String(h).padStart(2, "0")}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
