export default function FindingTags({ items }: { items: string[] }) {
  if (!items || items.length === 0) return <span className="text-steel-300 text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5 max-w-xs">
      {items.map((t) => (
        <span
          key={t}
          className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-ink-900/[0.04] text-ink-700 border border-ink-900/[0.06]"
        >
          {t}
        </span>
      ))}
    </div>
  );
}
