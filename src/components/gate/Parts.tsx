"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Option, Tri } from "@/lib/gate";

/** Dua tombol besar: Ada / Tidak ada (atau label lain). */
export function YesNo({ value, onChange, yes = "Ada", no = "Tidak ada", invert, label }: { value: Tri | undefined; onChange: (v: boolean) => void; yes?: string; no?: string; invert?: boolean; label: string }) {
  return (
    <div className="g-yn" role="radiogroup" aria-label={label}>
      <button type="button" role="radio" aria-checked={value === true} className={`y ${invert ? "bad" : "good"}`} onClick={() => onChange(true)}>{yes}</button>
      <button type="button" role="radio" aria-checked={value === false} className={`n ${invert ? "good" : "bad"}`} onClick={() => onChange(false)}>{no}</button>
    </div>
  );
}

/** Pilihan tiga: untuk surat izin B3 (Ada / Tidak ada / Tidak perlu). */
export function Tri3({ value, onChange, label }: { value: string | null | undefined; onChange: (v: "ya" | "tidak" | "na") => void; label: string }) {
  const opts: ["ya" | "tidak" | "na", string, string][] = [["ya", "Ada", "good"], ["tidak", "Tidak ada", "bad"], ["na", "Tidak perlu", "neutral"]];
  return (
    <div className="g-yn three" role="radiogroup" aria-label={label}>
      {opts.map(([v, t, c]) => <button key={v} type="button" role="radio" aria-checked={value === v} className={c} onClick={() => onChange(v)}>{t}</button>)}
    </div>
  );
}

/** Satu area kondisi fisik: OK / Temuan (+ keterangan wajib saat Temuan). */
export function PhysRow({ name, hint, value, onChange, before }: { name: string; hint?: string; value: { ok: Tri; note?: string } | undefined; onChange: (v: { ok: Tri; note?: string }) => void; before?: { ok: Tri; note?: string } }) {
  const id = useId();
  return (
    <div className={`g-phys ${value?.ok === false ? "is-bad" : value?.ok ? "is-ok" : ""}`}>
      <div className="g-phys-h">
        <div>
          <b>{name}</b>
          {hint && <small>{hint}</small>}
          {before && <span className={`g-before ${before.ok === false ? "bad" : "ok"}`}>Saat datang: {before.ok === false ? `temuan${before.note ? ` (${before.note})` : ""}` : before.ok ? "OK" : "–"}</span>}
        </div>
        <YesNo label={name} value={value?.ok} yes="OK" no="Temuan" onChange={(ok) => onChange({ ok, note: ok ? "" : value?.note ?? "" })} />
      </div>
      {value?.ok === false && (
        <input id={id} className="g-in g-note" autoFocus placeholder="Tulis temuannya, mis. bocor oli di gardan" value={value.note ?? ""} onChange={(e) => onChange({ ok: false, note: e.target.value })} aria-label={`Keterangan ${name}`} />
      )}
    </div>
  );
}

/** Input pilihan dengan pencarian (daftar supplier/tujuan). Bisa juga ketik bebas bila allowFree. */
export function Combo({ id, options, value, text, onPick, placeholder, allowFree, invalid }: {
  id: string; options: Option[]; value: string | null; text: string; onPick: (o: Option | null, text: string) => void; placeholder?: string; allowFree?: boolean; invalid?: boolean;
}) {
  const [q, setQ] = useState(text);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setQ(text), [text]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? options.filter((o) => o.name.toLowerCase().includes(s)) : options).slice(0, 40);
  }, [q, options]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  function pick(o: Option) { onPick(o, o.name); setQ(o.name); setOpen(false); }
  function blur() {
    setTimeout(() => {
      if (box.current?.contains(document.activeElement)) return;
      setOpen(false);
      const exact = options.find((o) => o.name.toLowerCase() === q.trim().toLowerCase());
      if (exact) onPick(exact, exact.name);
      else if (allowFree) onPick(null, q.trim());
      else if (!value) setQ("");
      else setQ(text);
    }, 120);
  }
  return (
    <div className={`g-combo ${invalid ? "invalid" : ""}`} ref={box}>
      <input id={id} className="g-in" role="combobox" aria-expanded={open} aria-autocomplete="list" autoComplete="off" placeholder={placeholder} value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); if (value) onPick(null, e.target.value); }}
        onFocus={() => setOpen(true)} onBlur={blur}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(list.length - 1, h + 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
          if (e.key === "Enter" && open && list[hi]) { e.preventDefault(); pick(list[hi]); }
          if (e.key === "Escape") setOpen(false);
        }} />
      {value && <span className="g-combo-ok" aria-hidden="true">✓</span>}
      {open && (
        <ul className="g-combo-list" role="listbox">
          {list.length ? list.map((o, i) => (
            <li key={o.id} role="option" aria-selected={i === hi} onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setHi(i)}>
              <span>{o.name}</span>{o.sub && <small>{o.sub}</small>}
            </li>
          )) : <li className="empty">{allowFree ? "Tidak ada di daftar. Nama yang diketik tetap dipakai." : "Tidak ditemukan di daftar."}</li>}
        </ul>
      )}
    </div>
  );
}

export function Field({ label, htmlFor, req, children, hint, wide }: { label: string; htmlFor?: string; req?: boolean; children: React.ReactNode; hint?: string; wide?: boolean }) {
  return (
    <div className={`g-field ${wide ? "wide" : ""}`}>
      <label htmlFor={htmlFor}>{label}{req && <i aria-hidden="true">*</i>}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function Section({ n, title, sub, children, right }: { n: string; title: string; sub?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="g-sec">
      <header className="g-sec-h">
        <span className="g-no">{n}</span>
        <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
        {right && <div className="g-sec-r">{right}</div>}
      </header>
      <div className="g-sec-b">{children}</div>
    </section>
  );
}
