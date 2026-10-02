"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/components/AppContext";
import { Combo } from "@/components/gate/Parts";
import {
  ADM_ITEMS, LONG_MS, PHYS_AREAS, SAFETY_ITEMS, VEHICLE_TYPES, fDurShort, fTime, findings, gateApi, gateStats, loadOptions, normNopol,
  todayWIB, useGateList, useTick, type Adm, type GateRow, type Option, type Phys, type Safety,
} from "@/lib/gate";

/* Checklist cepat: semua dianggap OK, petugas cukup ketuk yang bermasalah. */
const okAdm = (): Adm => ({ ktp_sim: true, stnk_kir: true });
const okSafety = (): Safety => ({ ganjal: true, p3k_apar: true, fitting: true, sepatu_vest: true, b3: "na", hama: false });
const okPhys = (): Phys => Object.fromEntries(PHYS_AREAS.map((p) => [p.k, { ok: true, note: "" }]));

function Chip({ bad, onClick, children, title }: { bad: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return <button type="button" className={`pchip ${bad ? "bad" : "ok"}`} aria-pressed={bad} onClick={onClick} title={title}><i>{bad ? "✕" : "✓"}</i>{children}</button>;
}

function PhysChips({ value, onChange, before }: { value: Phys; onChange: (v: Phys) => void; before?: Phys }) {
  const bad = PHYS_AREAS.filter((p) => value[p.k]?.ok === false);
  return (
    <>
      <div className="pchips">
        {PHYS_AREAS.map((p) => (
          <Chip key={p.k} bad={value[p.k]?.ok === false} title={p.hint || undefined}
            onClick={() => onChange({ ...value, [p.k]: { ok: value[p.k]?.ok === false, note: "" } })}>
            {p.n}{before?.[p.k]?.ok === false && <small> · saat datang temuan</small>}
          </Chip>
        ))}
      </div>
      {bad.map((p) => (
        <input key={p.k} className={`g-in pnote ${!value[p.k]?.note?.trim() ? "need" : ""}`} placeholder={`Temuan ${p.n.toLowerCase()} — tulis singkat (wajib)`}
          value={value[p.k]?.note ?? ""} onChange={(e) => onChange({ ...value, [p.k]: { ok: false, note: e.target.value } })} aria-label={`Keterangan ${p.n}`} />
      ))}
    </>
  );
}

/* ───────── Form Gate In ringkas ───────── */
function GateInForm({ onSaved }: { onSaved: () => void }) {
  const { siteId, toast, fail } = useApp();
  const blank = { nopol: "", company_id: null as string | null, company_name: "", vehicle_type: "", driver_name: "", driver_id_type: "SIM", driver_id_no: "", driver_phone: "", in_dept_id: null as string | null, in_dept_name: "", in_sj: "", in_seal: "", in_material: "", kir: "", helper_name: "", helper_id_no: "" };
  const [f, setF] = useState(blank);
  const [adm, setAdm] = useState<Adm>(okAdm);
  const [safety, setSafety] = useState<Safety>(okSafety);
  const [phys, setPhys] = useState<Phys>(okPhys);
  const [more, setMore] = useState(false);
  const [ack, setAck] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<{ kind: "prev" | "inside"; g: GateRow } | null>(null);
  const [opts, setOpts] = useState<{ suppliers: Option[]; destinations: Option[]; identitas: string[] }>({ suppliers: [], destinations: [], identitas: ["SIM", "KTP"] });
  const t = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { loadOptions().then((o) => setOpts({ suppliers: o.suppliers, destinations: o.destinations, identitas: o.meta?.identitas?.length ? o.meta.identitas : ["SIM", "KTP"] })).catch(() => {}); }, []);
  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setF((p) => ({ ...p, [k]: v }));

  function onNopol(v: string) {
    set("nopol", v.toUpperCase()); setHint(null); clearTimeout(t.current);
    const n = normNopol(v);
    if (!siteId || n.replace(/\s/g, "").length < 4) return;
    t.current = setTimeout(async () => {
      const last = await gateApi.lastByNopol(siteId, n).catch(() => null);
      if (!last) return;
      if (last.status === "in") { setHint({ kind: "inside", g: last }); return; }
      setHint({ kind: "prev", g: last });
      setF((p) => ({ ...p, company_id: p.company_id ?? last.company_id, company_name: p.company_name || last.company_name, vehicle_type: p.vehicle_type || last.vehicle_type,
        driver_name: p.driver_name || last.driver_name, driver_id_type: p.driver_id_no ? p.driver_id_type : last.driver_id_type || p.driver_id_type,
        driver_id_no: p.driver_id_no || last.driver_id_no, driver_phone: p.driver_phone || last.driver_phone, kir: p.kir || last.kir }));
    }, 450);
  }

  const physMissing = PHYS_AREAS.some((p) => phys[p.k]?.ok === false && !phys[p.k]?.note?.trim());
  const miss = { nopol: !f.nopol.trim(), company: !f.company_name.trim(), driver: !f.driver_name.trim(), id: !f.driver_id_no.trim(), dept: !f.in_dept_name.trim(), phys: physMissing, ack: !ack };
  const fs = findings({ adm_in: adm, safety, phys_in: phys, adm_out: {}, phys_out: {}, status: "in" });
  const inv = (b: boolean) => (tried && b ? "invalid" : "");

  async function save(e: React.FormEvent) {
    e.preventDefault(); setTried(true);
    if (Object.values(miss).some(Boolean)) { toast("Masih ada yang belum diisi (ditandai merah)", "err"); return; }
    if (hint?.kind === "inside") { toast(`${hint.g.nopol} masih tercatat di dalam area. Gate Out dulu.`, "err"); return; }
    if (!siteId) return;
    setBusy(true);
    try {
      await gateApi.create({ site_id: siteId, ...f, nopol: normNopol(f.nopol), adm_in: adm, safety, phys_in: phys, driver_ack_in: true, finding_count: fs.length } as Partial<GateRow>);
      toast(`${normNopol(f.nopol)} tercatat masuk ${fs.length ? `· ${fs.length} temuan` : ""}`);
      setF(blank); setAdm(okAdm()); setSafety(okSafety()); setPhys(okPhys()); setAck(false); setTried(false); setHint(null); setMore(false);
      onSaved();
    } catch (er) { fail(er as Error); }
    setBusy(false);
  }

  const b3next = (v: Safety["b3"]) => (v === "na" ? "ya" : v === "ya" ? "tidak" : "na");
  return (
    <form className="pform" onSubmit={save} noValidate>
      <div className="pf-grid">
        <label className={`pf wide ${inv(miss.nopol)}`}><span>Nomor polisi *</span>
          <input className="g-in pf-plate" value={f.nopol} onChange={(e) => onNopol(e.target.value)} placeholder="B 1234 XYZ" autoCapitalize="characters" autoComplete="off" />
        </label>
        {hint?.kind === "inside" && <div className="g-alert bad wide">{hint.g.nopol} masih di dalam area sejak {fTime(hint.g.in_at)}. Lakukan Gate Out dulu.</div>}
        {hint?.kind === "prev" && <div className="g-alert ok wide">Pernah datang {new Date(hint.g.in_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} · data pengemudi diisi otomatis, cek lagi.</div>}
        <div className={`pf wide ${inv(miss.company)}`}><span>Perusahaan / supplier *</span>
          <Combo id="p-co" options={opts.suppliers} value={f.company_id} text={f.company_name} allowFree placeholder="Cari nama perusahaan…" invalid={tried && miss.company}
            onPick={(o, txt) => setF((p) => ({ ...p, company_id: o?.id ?? null, company_name: o?.name ?? txt }))} />
        </div>
        <label className={`pf ${inv(miss.driver)}`}><span>Nama pengemudi *</span><input className="g-in" value={f.driver_name} onChange={(e) => set("driver_name", e.target.value)} /></label>
        <div className={`pf ${inv(miss.id)}`}><span>Identitas *</span>
          <div className="pf-id">
            <select className="g-in" value={f.driver_id_type} onChange={(e) => set("driver_id_type", e.target.value)} aria-label="Jenis identitas">{opts.identitas.map((x) => <option key={x}>{x}</option>)}</select>
            <input className="g-in" value={f.driver_id_no} onChange={(e) => set("driver_id_no", e.target.value)} placeholder="Nomor" aria-label="Nomor identitas" inputMode="numeric" />
          </div>
        </div>
        <div className={`pf wide ${inv(miss.dept)}`}><span>Tujuan bongkar / departemen *</span>
          <Combo id="p-dept" options={opts.destinations} value={f.in_dept_id} text={f.in_dept_name} allowFree placeholder="Pilih tujuan…" invalid={tried && miss.dept}
            onPick={(o, txt) => setF((p) => ({ ...p, in_dept_id: o?.id ?? null, in_dept_name: o?.name ?? txt }))} />
        </div>
        <button type="button" className="pf-more wide" onClick={() => setMore((v) => !v)} aria-expanded={more}>{more ? "− Sembunyikan detail" : "+ Detail lain (jenis, surat jalan, segel, kenek, telepon)"}</button>
        {more && (<>
          <label className="pf"><span>Jenis kendaraan</span><select className="g-in" value={f.vehicle_type} onChange={(e) => set("vehicle_type", e.target.value)}><option value="">–</option>{VEHICLE_TYPES.map((v) => <option key={v}>{v}</option>)}</select></label>
          <label className="pf"><span>No. telepon</span><input className="g-in" inputMode="tel" value={f.driver_phone} onChange={(e) => set("driver_phone", e.target.value)} /></label>
          <label className="pf"><span>No. surat jalan</span><input className="g-in" value={f.in_sj} onChange={(e) => set("in_sj", e.target.value)} /></label>
          <label className="pf"><span>No. segel</span><input className="g-in" value={f.in_seal} onChange={(e) => set("in_seal", e.target.value)} /></label>
          <label className="pf"><span>Nama kenek</span><input className="g-in" value={f.helper_name} onChange={(e) => set("helper_name", e.target.value)} /></label>
          <label className="pf"><span>Material</span><input className="g-in" value={f.in_material} onChange={(e) => set("in_material", e.target.value)} /></label>
        </>)}
      </div>

      <div className="pf-check">
        <p className="pf-cap">Semua dianggap <b className="okc">lengkap / OK</b>. Ketuk yang <b className="badc">bermasalah</b>.</p>
        <h4>Administrasi</h4>
        <div className="pchips">{ADM_ITEMS.map((a) => <Chip key={a.k} bad={adm[a.k] === false} onClick={() => setAdm({ ...adm, [a.k]: adm[a.k] === false })}>{a.n}</Chip>)}</div>
        <h4>Safety</h4>
        <div className="pchips">
          {SAFETY_ITEMS.map((s) => <Chip key={s.k} bad={safety[s.k] === false} onClick={() => setSafety({ ...safety, [s.k]: safety[s.k] === false })}>{s.n}</Chip>)}
          <button type="button" className={`pchip ${safety.b3 === "tidak" ? "bad" : safety.b3 === "ya" ? "ok" : "na"}`} onClick={() => setSafety({ ...safety, b3: b3next(safety.b3) })}>
            <i>{safety.b3 === "tidak" ? "✕" : safety.b3 === "ya" ? "✓" : "–"}</i>Izin B3: {safety.b3 === "ya" ? "ada" : safety.b3 === "tidak" ? "tidak ada" : "tidak perlu"}
          </button>
          <Chip bad={safety.hama === true} onClick={() => setSafety({ ...safety, hama: !safety.hama })}>{safety.hama ? "Ada infestasi hama" : "Tanpa hama"}</Chip>
        </div>
        <h4>Kondisi fisik</h4>
        <PhysChips value={phys} onChange={setPhys} />
      </div>

      <label className={`pf-ack ${inv(miss.ack)}`}><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Pengemudi sudah menyetujui hasil pemeriksaan (tanda tangan digital)</label>
      <div className="pf-foot">
        <span className={fs.length ? "badc" : "okc"}>{fs.length ? `${fs.length} temuan` : "Tanpa temuan"}</span>
        <button className="btn red" disabled={busy}>{busy ? "Menyimpan…" : "Simpan Gate In"}</button>
      </div>
    </form>
  );
}

/* ───────── Lembar Gate Out ───────── */
function GateOutSheet({ g, onClose }: { g: GateRow; onClose: () => void }) {
  const { toast, fail } = useApp();
  const [f, setF] = useState({ out_dest: "", out_sj: "", out_seal: "", out_material: "" });
  const [adm, setAdm] = useState<Adm>(okAdm);
  const [phys, setPhys] = useState<Phys>(okPhys);
  const [ack, setAck] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dests, setDests] = useState<Option[]>([]);
  useEffect(() => { loadOptions().then((o) => setDests(o.destinations)).catch(() => {}); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);
  const all = findings({ adm_in: g.adm_in, safety: g.safety, phys_in: g.phys_in, adm_out: adm, phys_out: phys, status: "out" });
  const outF = all.filter((x) => x.stage === "out").length;
  const physMissing = PHYS_AREAS.some((p) => phys[p.k]?.ok === false && !phys[p.k]?.note?.trim());
  const sealChanged = g.in_seal && f.out_seal && g.in_seal.trim() !== f.out_seal.trim();

  async function save() {
    setTried(true);
    if (physMissing || !ack) { toast(physMissing ? "Tulis keterangan temuan fisik" : "Centang persetujuan pengemudi", "err"); return; }
    setBusy(true);
    try {
      await gateApi.update(g.id, { ...f, adm_out: adm, phys_out: phys, driver_ack_out: true, status: "out", finding_count: all.length });
      toast(`${g.nopol} keluar · ${fDurShort(g.in_at)} di dalam`);
      onClose();
    } catch (e) { fail(e as Error); setBusy(false); }
  }

  return createPortal(
    <div className="psheet-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="psheet" role="dialog" aria-modal="true" aria-label={`Gate Out ${g.nopol}`}>
        <div className="psh-h">
          <span className="g-plate">{g.nopol}</span>
          <div className="grow"><b>{g.company_name || "–"}</b><small>{g.driver_name} · masuk {fTime(g.in_at)} · {fDurShort(g.in_at)} di dalam</small></div>
          <button className="psh-x" onClick={onClose} aria-label="Tutup">×</button>
        </div>
        {g.finding_count > 0 && <div className="g-alert warn">Saat datang ada {g.finding_count} temuan. Cek kembali sebelum keluar.</div>}
        <div className="pf-grid">
          <div className="pf wide"><span>Tujuan</span><Combo id="o-dest" options={dests} value={null} text={f.out_dest} allowFree placeholder="Tujuan keluar…" onPick={(o, t) => setF((p) => ({ ...p, out_dest: o?.name ?? t }))} /></div>
          <label className="pf"><span>No. surat jalan</span><input className="g-in" value={f.out_sj} onChange={(e) => setF({ ...f, out_sj: e.target.value })} /></label>
          <label className="pf"><span>No. segel</span><input className="g-in" value={f.out_seal} placeholder={g.in_seal ? `Datang: ${g.in_seal}` : ""} onChange={(e) => setF({ ...f, out_seal: e.target.value })} /></label>
          {sealChanged && <div className="g-alert warn wide">Segel berbeda dengan saat datang ({g.in_seal} → {f.out_seal}).</div>}
        </div>
        <div className="pf-check">
          <h4>Administrasi</h4>
          <div className="pchips">{ADM_ITEMS.map((a) => <Chip key={a.k} bad={adm[a.k] === false} onClick={() => setAdm({ ...adm, [a.k]: adm[a.k] === false })}>{a.n}</Chip>)}</div>
          <h4>Kondisi fisik</h4>
          <PhysChips value={phys} onChange={setPhys} before={g.phys_in} />
        </div>
        <label className={`pf-ack ${tried && !ack ? "invalid" : ""}`}><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Pengemudi menyetujui pemeriksaan keluar</label>
        <div className="pf-foot">
          <Link href={`/pos/${g.id}`} className="btn q sm">Form lengkap</Link>
          <span className={outF ? "badc" : "okc"}>{outF ? `${outF} temuan baru` : "Tanpa temuan baru"}</span>
          <button className="btn red" disabled={busy} onClick={save}>{busy ? "Menyimpan…" : "Simpan Gate Out"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ───────── Beranda pos ───────── */
export function PosHome() {
  const { siteId } = useApp();
  const day = todayWIB();
  const { inside, history, live, reload } = useGateList(siteId, day);
  const [tab, setTab] = useState<"dalam" | "masuk">("dalam");
  const [q, setQ] = useState("");
  const [out, setOut] = useState<GateRow | null>(null);
  useTick(30000);
  const gs = gateStats(history ?? [], inside ?? []);
  const list = useMemo(() => {
    const s = q.trim().toUpperCase().replace(/\s+/g, "");
    return (inside ?? []).filter((g) => !s || g.nopol.replace(/\s+/g, "").includes(s) || (g.company_name || "").toUpperCase().includes(s));
  }, [inside, q]);
  const outToday = (history ?? []).filter((g) => g.status === "out").slice(0, 8);

  return (
    <div className={`pos2 tab-${tab}`}>
      <div className="pstats">
        <div><b>{gs.dalam}</b><span>Di dalam</span></div>
        <div><b>{gs.masuk}</b><span>Masuk hari ini</span></div>
        <div><b>{gs.keluar}</b><span>Keluar</span></div>
        <div className={gs.lama ? "bad" : ""}><b>{gs.lama}</b><span>&gt; 4 jam</span></div>
      </div>

      <section className="pcol pcol-in">
        <div className="pcol-h"><h2>Di dalam area</h2><span className={`live ${live ? "on" : ""}`}><i></i>{live ? "LIVE" : "…"}</span></div>
        <input className="g-in psearch" placeholder="Cari nopol / perusahaan untuk Gate Out…" value={q} onChange={(e) => setQ(e.target.value)} autoCapitalize="characters" />
        {inside === null ? <div className="sk" style={{ height: 140 }} /> : list.length ? (
          <div className="plist">
            {list.map((g) => (
              <button key={g.id} className={`pcard ${Date.now() - new Date(g.in_at).getTime() > LONG_MS ? "long" : ""}`} onClick={() => setOut(g)}>
                <span className="g-plate">{g.nopol}</span>
                <span className="grow"><b>{g.company_name || "–"}</b><small>{g.driver_name} · {g.in_dept_name || "–"} · masuk {fTime(g.in_at)}</small></span>
                <span className="pc-r"><b>{fDurShort(g.in_at)}</b>{g.finding_count > 0 && <em>{g.finding_count} temuan</em>}<i>Gate Out →</i></span>
              </button>
            ))}
          </div>
        ) : <div className="g-empty">{q ? `Tidak ada “${q}” di dalam area.` : "Tidak ada kendaraan di dalam area."}</div>}
        {outToday.length > 0 && (<>
          <div className="pcol-h" style={{ marginTop: 18 }}><h2>Sudah keluar hari ini</h2></div>
          <ul className="pout">{outToday.map((g) => <li key={g.id}><Link href={`/pos/${g.id}`}><span className="g-plate sm">{g.nopol}</span><span className="grow">{g.company_name}</span><small>{fTime(g.in_at)} → {fTime(g.out_at)}</small></Link></li>)}</ul>
        </>)}
      </section>

      <section className="pcol pcol-form">
        <div className="pcol-h"><h2>Gate In · kendaraan datang</h2><Link href="/pos/baru" className="sub" style={{ margin: 0 }}>Form lengkap</Link></div>
        <GateInForm onSaved={() => { reload(); setTab("dalam"); }} />
      </section>

      <nav className="ptabs" aria-label="Menu pos">
        <button aria-pressed={tab === "dalam"} onClick={() => setTab("dalam")}><b>{gs.dalam}</b>Di dalam · Gate Out</button>
        <button aria-pressed={tab === "masuk"} onClick={() => setTab("masuk")}><b>+</b>Gate In</button>
      </nav>
      {out && <GateOutSheet g={out} onClose={() => setOut(null)} />}
    </div>
  );
}
