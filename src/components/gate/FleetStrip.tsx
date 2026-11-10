"use client";
/* Layar ruang Security: ringkasan MOBIL PERUSAHAAN yang sedang di luar / dari luar yang masih di dalam (data dari CIKOPS-FM). */
import { useEffect, useState } from "react";
import { cikopsConfigured } from "@/lib/cikops/client";
import { evOf, fmtDur, listLogs, minsSince, wibDate, type KLog } from "@/lib/cikops/gate";
import "./kendaraan.css";

export function FleetStrip() {
  const [rows, setRows] = useState<KLog[] | null>(null);
  useEffect(() => {
    if (!cikopsConfigured()) return;
    let alive = true;
    const load = () => listLogs(wibDate()).then((l) => { if (alive) setRows(l.filter((x) => x.status !== "DONE")); }).catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (!cikopsConfigured() || rows === null) return null;
  const out = rows.filter((r) => r.plant === "CIK").sort((a, b) => (evOf(a).first ?? "").localeCompare(evOf(b).first ?? ""));
  const inn = rows.filter((r) => r.plant === "PRB").length;
  return (
    <div className="w-fleet">
      <b>Mobil perusahaan · di luar <em>{out.length}</em>{inn ? <small> · dari luar di dalam {inn}</small> : null}</b>
      <span>
        {out.length === 0 ? "Semua mobil di dalam area" : out.slice(0, 4).map((r) => `${r.nopol} (${fmtDur(minsSince(evOf(r).first))})`).join(" · ") + (out.length > 4 ? ` · +${out.length - 4}` : "")}
      </span>
    </div>
  );
}
