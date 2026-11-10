"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SERIES_COLORS, fmtNum, fmtVal, type ChartSpec } from "@/lib/analisa/report";

const GRID = "var(--line)";
const TICK = { fill: "var(--ink2)", fontSize: 11 } as const;

/** Menggambar ChartSpec (model grafik yang sama dengan Laporan Manajemen CIKOPS). */
export function AnalisaChart({ spec, height = 220 }: { spec: ChartSpec; height?: number }) {
  const { labels, series, unit } = spec;
  const data = labels.map((l, i) => ({ l, ...Object.fromEntries(series.map((s) => [s.name, s.values[i] ?? 0])) }));
  const fmt = (v: number) => fmtVal(v, unit);
  const tip = <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line2)", borderRadius: 6, fontSize: 12 }} />;
  const goodUp = spec.goodUp;

  let body: JSX.Element;
  if (spec.type === "donut") {
    const vals = series[0]?.values ?? [];
    const pie = labels.map((l, i) => ({ name: l, value: vals[i] ?? 0 }));
    body = (
      <PieChart>
        <Pie isAnimationActive={false} data={pie} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={1}>
          {pie.map((_, i) => <Cell key={i} fill={spec.colors?.[i] ?? SERIES_COLORS[i % SERIES_COLORS.length]} />)}
        </Pie>
        {tip}<Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    );
  } else if (spec.type === "hbar") {
    const s = series[0];
    body = (
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={TICK} tickFormatter={fmt} allowDecimals={false} />
        <YAxis type="category" dataKey="l" width={130} tick={TICK} interval={0} />
        {tip}
        <Bar isAnimationActive={false} dataKey={s?.name ?? "v"} radius={[0, 3, 3, 0]} label={{ position: "right", fontSize: 11, fill: "var(--ink2)", formatter: (v: number) => fmtNum(v) }}>
          {data.map((_, i) => <Cell key={i} fill={spec.colors?.[i] ?? s?.color ?? SERIES_COLORS[0]} />)}
        </Bar>
      </BarChart>
    );
  } else if (spec.type === "line") {
    body = (
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="l" tick={TICK} /><YAxis tick={TICK} tickFormatter={fmt} width={44} allowDecimals={false} />
        {tip}{series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s) => <Line key={s.name} isAnimationActive={false} dataKey={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 2 }} />)}
      </LineChart>
    );
  } else {
    const stacked = spec.type === "stacked";
    body = (
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="l" tick={TICK} interval={0} /><YAxis tick={TICK} tickFormatter={fmt} width={44} allowDecimals={unit === "pct"} />
        {tip}{series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s) => <Bar key={s.name} isAnimationActive={false} dataKey={s.name} fill={s.color} stackId={stacked ? "a" : undefined} radius={stacked ? 0 : [3, 3, 0, 0]} />)}
      </BarChart>
    );
  }

  const deltas = spec.deltas;
  return (
    <figure className="an-chart">
      <figcaption>{spec.title}</figcaption>
      <div style={{ width: "100%", height }}><ResponsiveContainer>{body}</ResponsiveContainer></div>
      {deltas && deltas.some((d) => d !== null) && (
        <div className="an-deltas" aria-label="Perubahan per bulan">
          {deltas.map((d, i) => {
            const good = d === null || goodUp === null || goodUp === undefined || Math.abs(d) < 0.5 ? "" : (d > 0) === goodUp ? "good" : "bad";
            return <span key={i} className={good} title={labels[i]}>{d === null ? "" : `${d > 0 ? "▲" : d < 0 ? "▼" : ""}${fmtNum(Math.abs(d), 0)}%`}</span>;
          })}
        </div>
      )}
      {spec.note && <small className="an-note">{spec.note}</small>}
    </figure>
  );
}
