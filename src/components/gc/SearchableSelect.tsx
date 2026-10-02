"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export interface ComboOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  allOptionLabel?: string; // if provided, shows an "All" option with value ""
  className?: string;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Cari & pilih...",
  allOptionLabel,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function selectOption(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setTimeout(() => inputRef.current?.focus(), 10);
        }}
        className="w-full text-sm border border-steel-100 rounded-lg px-3 py-2 bg-white focus:border-brand-500 outline-none flex items-center justify-between gap-2 text-left"
      >
        <span className={`truncate ${selected ? "text-ink-900" : "text-steel-400"}`}>
          {selected ? selected.label : allOptionLabel && !value ? allOptionLabel : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-steel-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1.5 bg-white border border-steel-100 rounded-xl shadow-pop overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-steel-100">
            <Search className="w-3.5 h-3.5 text-steel-300 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ketik untuk mencari..."
              className="flex-1 min-w-0 text-sm outline-none focus:outline-none bg-transparent"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="text-steel-300 hover:text-steel-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {allOptionLabel && (
              <button
                type="button"
                onClick={() => selectOption("")}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-50 flex ${
                  value === "" ? "text-brand-600 font-semibold bg-brand-50" : "text-ink-900"
                }`}
              >
                <span className="block truncate min-w-0">{allOptionLabel}</span>
              </button>
            )}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-sm text-steel-400 text-center">Tidak ditemukan.</p>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => selectOption(o.value)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-50 flex ${
                  o.value === value ? "text-brand-600 font-semibold bg-brand-50" : "text-ink-900"
                }`}
              >
                <span className="block truncate min-w-0">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
