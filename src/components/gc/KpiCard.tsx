import { LucideIcon } from "lucide-react";
import clsx from "clsx";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "brand" | "alert" | "clear" | "ink";
  hint?: string;
}

const tones = {
  brand: { bg: "bg-brand-50", text: "text-brand-600", ring: "ring-brand-500/10" },
  alert: { bg: "bg-alert-50", text: "text-alert-600", ring: "ring-alert-500/10" },
  clear: { bg: "bg-clear-50", text: "text-clear-600", ring: "ring-clear-500/10" },
  ink: { bg: "bg-ink-900", text: "text-brand-500", ring: "ring-ink-900/10" },
};

export default function KpiCard({ label, value, icon: Icon, tone = "brand", hint }: Props) {
  const t = tones[tone];
  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</p>
        <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center ring-4", t.bg, t.ring)}>
          <Icon className={clsx("w-4.5 h-4.5", t.text)} strokeWidth={2.2} />
        </div>
      </div>
      <div>
        <p className="font-display font-bold text-3xl text-ink-900 tabular-nums leading-none">{value}</p>
        {hint && <p className="text-xs text-steel-500 mt-2">{hint}</p>}
      </div>
    </div>
  );
}
