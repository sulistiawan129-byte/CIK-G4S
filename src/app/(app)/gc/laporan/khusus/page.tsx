"use client";

/* PERUSAHAAN KHUSUS — pantau pelanggaran transporter perusahaan tertentu (mis. PT BECIS, PT JAYA MUKTI MANDIRI) per bulan:
   jumlah kasus, jenis pelanggaran, driver pelanggar (nama langsung dari laporan NC) dan yang berulang, plus tren 6 bulan.
   Daftar perusahaan khusus tersimpan di security.special_companies (supabase/lengkapi_security.sql). */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Plus, UserRound, X } from "lucide-react";
import { useApp } from "@/components/AppContext";
import { useLanguage } from "@/components/gc/LanguageProvider";
import SearchableSelect from "@/components/gc/SearchableSelect";
import { createClient } from "@/lib/gc/client";
import { fetchSuppliers } from "@/lib/gc/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { NcReportRow, Supplier } from "@/lib/gc/types";

const DEFAULT_KHUSUS = ["PT. BECIS", "PT. JAYA MUKTI MANDIRI"];
const norm = (s: string) => String(s || "").toUpperCase().replace(/\s+/g, " ").trim();
const addM = (key: string, n: number) => { const [y, m] = key.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
const endOf = (key: string) => { const [y, m] = key.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const monLabel = (k: string) => `${MON[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`;
const nf = (n: number) => n.toLocaleString("id-ID");
const last4 = (s: string) => (s ? `••${String(s).replace(/\s/g, "").slice(-4)}` : "");

export default function KhususPage() {
  const { siteId, canWrite } = useApp();
  const { t } = useLanguage();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [reports, setReports] = useState<NcReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [specials, setSpecials] = useState<string[]>(DEFAULT_KHUSUS);
  const [needSql, setNeedSql] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pick, setPick] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    const { data, error } = await createClient().from("v_nc_reports").select("*").gte("tanggal", `${addM(month, -5)}-01`).lte("tanggal", endOf(month)).order("tanggal", { ascending: false });
    if (error) setErr(error.message); else { setErr(""); setReports((data ?? []) as NcReportRow[]); }
    setLoading(false);
  }, [month]);
  useEffect(() => { loadReports(); }, [loadReports]);
  useEffect(() => { fetchSuppliers().then(setSuppliers).catch(() => {}); }, []);

  const loadSpecials = useCallback(async () => {
    if (!siteId) return;
    const { data, error } = await supabaseBrowser().from("special_companies").select("name").eq("site_id", siteId).order("name");
    if (error) { setNeedSql(true); return; }   // SQL belum dijalankan → pakai daftar bawaan (hanya lihat)
    setNeedSql(false); setSpecials((data ?? []).map((r: { name: string }) => r.name));
  }, [siteId]);
  useEffect(() => { loadSpecials(); }, [loadSpecials]);

  async function addSpecial(name: string) {
    if (!siteId || !name) return;
    const { error } = await supabaseBrowser().from("special_companies").insert({ site_id: siteId, name });
    if (error && !/duplicate/i.test(error.message)) { setErr(error.message); return; }
    setPick(""); loadSpecials();
  }
  async function delSpecial(name: string) {
    if (!siteId) return;
    const { error } = await supabaseBrowser().from("special_companies").delete().eq("site_id", siteId).eq("name", name);
    if (error) setErr(error.message); else loadSpecials();
  }

  const kset = useMemo(() => new Set(specials.map(norm)), [specials]);
  const cur = useMemo(() => reports.filter((r) => r.tanggal.slice(0, 7) === month), [reports, month]);

  const agg = useMemo(() => {
    const co = new Map<string, { n: number; t: number }>();
    const je = new Map<string, number>(), kje = new Map<string, number>();
    const drv = new Map<string, { key: string; name: string; id: string; nopol: string; co: string; n: number }>();
    let temuan = 0;
    cur.forEach((r) => {
      const name = r.nama_supplier || "-";
      const e = co.get(name) ?? { n: 0, t: 0 }; e.n++; e.t += Math.max(1, r.temuan_list?.length ?? 0); co.set(name, e);
      (r.temuan_list ?? []).forEach((j) => { je.set(j, (je.get(j) ?? 0) + 1); temuan++; if (kset.has(norm(name))) kje.set(j, (kje.get(j) ?? 0) + 1); });
      const key = `${norm(r.nomor_identitas) || r.no_polisi}`;
      const d = drv.get(key) ?? { key, name: r.nama_petugas, id: r.nomor_identitas, nopol: r.no_polisi, co: name, n: 0 };
      d.n++; drv.set(key, d);
    });
    const companies = [...co.entries()].map(([name, v]) => ({ name, ...v, khusus: kset.has(norm(name)) })).sort((a, b) => b.n - a.n || b.t - a.t);
    const byCo = specials.map((k) => ({ name: k, n: companies.find((c) => norm(c.name) === norm(k))?.n ?? 0 }));
    const drivers = [...drv.values()];
    return {
      total: cur.length, temuan, companies, byCo, khususTotal: byCo.reduce((s, c) => s + c.n, 0),
      jenis: [...je.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
      kjenis: [...kje.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
      kdrivers: drivers.filter((d) => kset.has(norm(d.co))).sort((a, b) => b.n - a.n),
      repeat: drivers.filter((d) => d.n > 1).sort((a, b) => b.n - a.n),
    };
  }, [cur, kset, specials]);

  const months6 = useMemo(() => Array.from({ length: 6 }, (_, i) => addM(month, i - 5)), [month]);
  const trend = useMemo(() => specials.map((k) => ({ name: k, vals: months6.map((m) => reports.filter((r) => r.tanggal.slice(0, 7) === m && norm(r.nama_supplier) === norm(k)).length) })), [reports, months6, specials]);
  const tmax = Math.max(1, ...trend.flatMap((x) => x.vals));
  const maxJ = Math.max(1, ...agg.jenis.map((j) => j.n));
  const addOptions = suppliers.filter((s) => !kset.has(norm(s.name))).map((s) => ({ value: s.name, label: s.name }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="font-display font-bold text-ink-900 text-lg flex items-center gap-2"><Building2 className="w-5 h-5 text-brand-500" />{t("kh.title")}</h2>
          <p className="text-xs text-steel-500">{t("kh.sub")}</p>
        </div>
        <label className="ml-auto flex flex-col gap-1 text-[11px] font-medium text-steel-500">{t("kh.month")}
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="border border-steel-100 rounded-lg px-3 py-2 text-sm text-ink-900 bg-white" />
        </label>
      </div>
      {err && <div className="card p-4 text-sm text-red-600">{err}</div>}

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-display font-bold text-ink-900">{t("kh.list")}</h3>
          {needSql && <span className="text-[11px] text-amber-600">{t("kh.needSql")}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {specials.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 text-white text-xs font-semibold pl-3 pr-2 py-1.5">{k}
              {canWrite && !needSql && <button type="button" onClick={() => delSpecial(k)} aria-label={`${t("kh.remove")} ${k}`} className="rounded-full hover:bg-white/20 p-0.5"><X className="w-3 h-3" /></button>}
            </span>
          ))}
          {specials.length === 0 && <span className="text-xs text-steel-500">{t("kh.none")}</span>}
        </div>
        {canWrite && !needSql && (
          <div className="flex items-end gap-2 flex-wrap">
            <SearchableSelect value={pick} onChange={setPick} options={addOptions} placeholder={t("kh.addPh")} className="w-full sm:w-[320px]" />
            <button type="button" disabled={!pick} onClick={() => addSpecial(pick)} className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-40"><Plus className="w-4 h-4" />{t("kh.add")}</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[[t("kh.kTotal"), agg.total], [t("kh.kSpecial"), agg.khususTotal], [t("kh.kOther"), agg.total - agg.khususTotal], [t("kh.kRepeat"), agg.repeat.length]].map(([l, v]) => (
          <div key={String(l)} className="card p-4"><div className="text-[11px] font-medium text-steel-500">{l}</div><div className="text-3xl font-display font-bold text-ink-900">{loading ? "…" : nf(Number(v))}</div></div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h3 className="font-display font-bold text-ink-900 mb-3">{t("kh.perCo")}</h3>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-steel-500"><th className="py-1.5">#</th><th>{t("kh.company")}</th><th className="text-right">{t("kh.cases")}</th><th className="text-right">{t("kh.findings")}</th></tr></thead>
            <tbody>
              {agg.companies.length === 0 && <tr><td colSpan={4} className="py-4 text-steel-500">{t("kh.empty")}</td></tr>}
              {agg.companies.slice(0, 15).map((c, i) => (
                <tr key={c.name} className={`border-t border-steel-100 ${c.khusus ? "bg-amber-50" : ""}`}>
                  <td className="py-1.5 text-steel-500">{i + 1}</td>
                  <td className="font-medium text-ink-900">{c.name}{c.khusus && <span className="ml-2 text-[10px] font-bold text-amber-700 border border-amber-300 rounded-full px-1.5">{t("kh.tag")}</span>}</td>
                  <td className="text-right font-bold">{nf(c.n)}</td><td className="text-right">{nf(c.t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-5">
          <h3 className="font-display font-bold text-ink-900 mb-1">{t("kh.types")}</h3>
          <p className="text-xs text-steel-500 mb-3">{nf(agg.temuan)} {t("kh.findings").toLowerCase()} · {t("kh.specialOnly")}: {nf(agg.kjenis.reduce((s, j) => s + j.n, 0))}</p>
          <div className="space-y-2">
            {agg.jenis.length === 0 && <p className="text-xs text-steel-500">{t("kh.empty")}</p>}
            {agg.jenis.map((j) => {
              const kn = agg.kjenis.find((x) => x.name === j.name)?.n ?? 0;
              return (
                <div key={j.name} className="grid grid-cols-[1fr_auto] gap-x-3 items-center text-xs">
                  <span className="truncate">{j.name}</span><b>{nf(j.n)}{kn ? <span className="text-amber-700 font-semibold"> ({nf(kn)} {t("kh.tag").toLowerCase()})</span> : null}</b>
                  <div className="col-span-2 h-1.5 rounded-full bg-steel-100 overflow-hidden"><i className="block h-full bg-brand-500" style={{ width: `${(j.n / maxJ) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-display font-bold text-ink-900 mb-1 flex items-center gap-2"><UserRound className="w-4 h-4 text-brand-500" />{t("kh.drivers")}</h3>
        <p className="text-xs text-steel-500 mb-3">{t("kh.driversSub")}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-steel-500"><th className="py-1.5">{t("kh.driver")}</th><th>{t("kh.company")}</th><th>{t("kh.plate")}</th><th>{t("kh.idno")}</th><th className="text-right">{t("kh.cases")}</th></tr></thead>
            <tbody>
              {agg.kdrivers.length === 0 && <tr><td colSpan={5} className="py-4 text-steel-500">{t("kh.noDrivers")}</td></tr>}
              {agg.kdrivers.map((d) => (
                <tr key={d.key} className="border-t border-steel-100">
                  <td className="py-1.5 font-medium text-ink-900">{d.name}{d.n > 1 && <span className="ml-2 text-[10px] font-bold text-red-600 border border-red-300 rounded-full px-1.5">{t("kh.repeat")}</span>}</td>
                  <td>{d.co}</td><td className="font-mono">{d.nopol}</td><td className="font-mono">{last4(d.id)}</td><td className="text-right font-bold">{d.n}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-display font-bold text-ink-900 mb-3">{t("kh.trend")}</h3>
        <div className="space-y-4">
          {trend.map((row) => (
            <div key={row.name}>
              <div className="text-xs font-semibold text-ink-900 mb-1">{row.name}</div>
              <div className="grid grid-cols-6 gap-2 items-end h-24">
                {row.vals.map((v, i) => (
                  <div key={months6[i]} className="flex flex-col items-center justify-end h-full gap-1">
                    <b className="text-[11px]">{v}</b>
                    <i className="w-full rounded-t bg-brand-500 block" style={{ height: `${Math.max(2, (v / tmax) * 100)}%`, opacity: i === 5 ? 1 : 0.55 }} />
                    <span className="text-[10px] text-steel-500">{monLabel(months6[i])}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
