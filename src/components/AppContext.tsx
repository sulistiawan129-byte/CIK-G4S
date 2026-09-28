"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMonthData } from "@/lib/data";
import { latestMonthFor as latestMonth } from "@/lib/latest";
import type { ModuleKey } from "@/lib/constants";
import type { MonthData, Profile, Site } from "@/lib/types";

interface Ctx {
  profile: Profile;
  sites: Site[];
  site: Site | null;
  siteId: string | null;
  setSiteId: (id: string) => void;
  month: string | null;
  setMonth: (m: string) => void;
  canWrite: boolean;
  canGate: boolean;
  can: (m: ModuleKey) => boolean;
  D: MonthData | null;
  setD: React.Dispatch<React.SetStateAction<MonthData | null>>;
  error: string | null;
  live: boolean;
  pulse: number;
  reload: () => Promise<void>;
  toast: (msg: string, kind?: "ok" | "err") => void;
  fail: (e: Error) => void;
}
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp di luar <AppProvider>");
  return c;
};



export function AppProvider({ profile, sites, children }: { profile: Profile; sites: Site[]; children: React.ReactNode }) {
  const [siteId, setSiteIdState] = useState<string | null>(null);
  const [month, setMonthState] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ m: string; k: "ok" | "err"; n: number } | null>(null);
  const tRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let s: string | null = null;
    try { s = localStorage.getItem("sd-site"); } catch {}
    const pick = sites.find((x) => x.id === s)?.id ?? sites[0]?.id ?? null;
    setSiteIdState(pick);
  }, [sites]);

  useEffect(() => {
    if (!siteId) return;
    let m: string | null = null;
    try { m = sessionStorage.getItem("sd-month"); } catch {}
    if (m) setMonthState(m);
    else latestMonth(siteId).then(setMonthState);
  }, [siteId]);

  const setSiteId = (id: string) => { setSiteIdState(id); try { localStorage.setItem("sd-site", id); } catch {} };
  const setMonth = (m: string) => { setMonthState(m); try { sessionStorage.setItem("sd-month", m); } catch {} };

  const { data, setData, error, live, pulse, reload } = useMonthData(siteId, month);

  const toast = useCallback((m: string, k: "ok" | "err" = "ok") => {
    setToastMsg({ m, k, n: Date.now() });
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);
  const fail = useCallback((e: Error) => toast(/row-level security|permission/i.test(e.message) ? "Akun ini tidak punya izin mengubah data." : `Gagal menyimpan: ${e.message}`, "err"), [toast]);

  const canWrite = profile.role === "master_admin" || profile.role === "admin";
  const canGate = ["master_admin", "admin", "gate"].includes(profile.role);
  const can = useCallback((m: ModuleKey) => {
    if (profile.role === "gate") return m === "gate";
    return profile.role === "master_admin" || !profile.modules || profile.modules.includes(m);
  }, [profile]);

  const value = useMemo<Ctx>(() => ({
    profile, sites, site: sites.find((s) => s.id === siteId) ?? null, siteId, setSiteId, month, setMonth,
    canWrite, canGate, can, D: data, setD: setData, error, live, pulse, reload, toast, fail,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [profile, sites, siteId, month, canWrite, canGate, can, data, error, live, pulse, reload, toast, fail]);

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className={`toast ${toastMsg ? "on" : ""}`} role="status" aria-live="polite">
        <i style={{ background: toastMsg?.k === "err" ? "var(--red)" : "#3DDC84" }}></i>
        <span>{toastMsg?.m}</span>
      </div>
    </AppCtx.Provider>
  );
}
