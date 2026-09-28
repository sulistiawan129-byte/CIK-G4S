"use client";
import { useCallback, useState } from "react";

/**
 * Nilai yang sedang diketik pengguna. Selama ada draft, input memakai draft
 * (bukan data dari server), jadi pembaruan realtime dari layar lain tidak
 * menimpa ketikan yang belum tersimpan.
 */
export function useDrafts() {
  const [dr, setDr] = useState<Record<string, string>>({});
  const set = useCallback((k: string, v: string) => setDr((p) => ({ ...p, [k]: v })), []);
  const clear = useCallback((k: string) => setDr((p) => { if (!(k in p)) return p; const n = { ...p }; delete n[k]; return n; }), []);
  const val = useCallback((k: string, fallback: string | number) => (k in dr ? dr[k] : String(fallback ?? "")), [dr]);
  return { dr, set, clear, val };
}
