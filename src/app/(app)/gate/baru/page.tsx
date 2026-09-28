"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppContext";
import { Combo, Field, PhysRow, Section, Tri3, YesNo } from "@/components/gate/Parts";
import { ADM_ITEMS, PHYS_AREAS, SAFETY_ITEMS, VEHICLE_TYPES, fDate, findings, gateApi, loadOptions, normNopol, type Adm, type GateRow, type Option, type Phys, type Safety } from "@/lib/gate";

type Form = {
  nopol: string; company_id: string | null; company_name: string; vehicle_type: string; kir: string;
  driver_name: string; driver_id_type: string; driver_id_no: string; driver_phone: string; helper_name: string; helper_id_no: string;
  in_sj: string; in_dept_id: string | null; in_dept_name: string; in_seal: string; in_material: string;
};
const EMPTY: Form = { nopol: "", company_id: null, company_name: "", vehicle_type: "", kir: "", driver_name: "", driver_id_type: "SIM", driver_id_no: "", driver_phone: "", helper_name: "", helper_id_no: "", in_sj: "", in_dept_id: null, in_dept_name: "", in_seal: "", in_material: "" };

export default function GateIn() {
  const { siteId, canGate, toast, fail } = useApp();
  const router = useRouter();
  const [f, setF] = useState<Form>(EMPTY);
  const [adm, setAdm] = useState<Adm>({});
  const [safety, setSafety] = useState<Safety>({});
  const [phys, setPhys] = useState<Phys>({});
  const [ack, setAck] = useState(false);
  const [opts, setOpts] = useState<{ suppliers: Option[]; destinations: Option[]; identitas: string[] }>({ suppliers: [], destinations: [], identitas: ["SIM", "KTP"] });
  const [prev, setPrev] = useState<GateRow | null>(null);
  const [inside, setInside] = useState<GateRow | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const nopolT = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadOptions().then((o) => setOpts({ suppliers: o.suppliers, destinations: o.destinations, identitas: o.meta?.identitas?.length ? o.meta.identitas : ["SIM", "KTP"] })).catch(() => {});
  }, []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  // Nopol pernah datang → isi otomatis data kendaraan & pengemudi yang masih kosong
  function onNopol(v: string) {
    set("nopol", v.toUpperCase());
    clearTimeout(nopolT.current);
    setPrev(null); setInside(null);
    const n = normNopol(v);
    if (!siteId || n.replace(/\s/g, "").length < 4) return;
    nopolT.current = setTimeout(async () => {
      const last = await gateApi.lastByNopol(siteId, n).catch(() => null);
      if (!last) return;
      if (last.status === "in") { setInside(last); return; }
      setPrev(last);
      setF((p) => ({
        ...p,
        company_id: p.company_id ?? last.company_id, company_name: p.company_name || last.company_name,
        vehicle_type: p.vehicle_type || last.vehicle_type, kir: p.kir || last.kir,
        driver_name: p.driver_name || last.driver_name, driver_id_type: p.driver_name ? p.driver_id_type : last.driver_id_type || p.driver_id_type,
        driver_id_no: p.driver_id_no || last.driver_id_no, driver_phone: p.driver_phone || last.driver_phone,
        helper_name: p.helper_name || last.helper_name, helper_id_no: p.helper_id_no || last.helper_id_no,
      }));
    }, 450);
  }

  const missing = {
    nopol: !f.nopol.trim(), company: !f.company_name.trim(), driver: !f.driver_name.trim(), sim: !f.driver_id_no.trim(), dept: !f.in_dept_name.trim(),
    adm: ADM_ITEMS.some((a) => adm[a.k] == null),
    safety: SAFETY_ITEMS.some((s) => safety[s.k] == null) || safety.b3 == null || safety.hama == null,
    phys: PHYS_AREAS.some((p) => phys[p.k]?.ok == null) || PHYS_AREAS.some((p) => phys[p.k]?.ok === false && !phys[p.k]?.note?.trim()),
    ack: !ack,
  };
  const incomplete = Object.values(missing).some(Boolean);
  const fs = findings({ adm_in: adm, safety, phys_in: phys, adm_out: {}, phys_out: {}, status: "in" });
  const done = [!missing.nopol && !missing.company && !missing.driver && !missing.sim, !missing.dept, !missing.adm, !missing.safety, !missing.phys, !missing.ack];

  async function save() {
    setTried(true);
    if (incomplete) {
      const first = document.querySelector(".g-sec .invalid, .g-sec.has-missing");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast("Masih ada yang belum diisi (ditandai merah)", "err");
      return;
    }
    if (!siteId) return;
    setBusy(true);
    try {
      const r = await gateApi.create({
        site_id: siteId, ...f, nopol: normNopol(f.nopol),
        adm_in: adm, safety, phys_in: phys, driver_ack_in: true, finding_count: fs.length,
      } as Partial<GateRow>);
      toast(`${normNopol(f.nopol)} tercatat masuk`);
      router.push(`/gate/${r.id}?baru=1`);
    } catch (e) { fail(e as Error); setBusy(false); }
  }

  if (!canGate) return <div className="errbox">Akun ini tidak punya akses untuk mencatat kendaraan masuk.</div>;
  const inv = (b: boolean) => (tried && b ? "invalid" : "");

  return (
    <div className="page enter gate-form">
      <section>
        <div className="eyebrow">Gate In · Kedatangan transporter</div>
        <h1>Pemeriksaan kendaraan masuk</h1>
        <p className="lede">Isi dari atas ke bawah. Jam masuk dicatat otomatis saat disimpan. Nopol yang pernah datang akan mengisi data pengemudi sendiri.</p>
        <ol className="g-steps" aria-label="Kemajuan pengisian">
          {["Identitas", "Kedatangan", "Administrasi", "Safety", "Kondisi fisik", "Konfirmasi"].map((t, i) => <li key={t} className={done[i] ? "ok" : ""}>{t}</li>)}
        </ol>
      </section>

      <Section n="1" title="Identitas transporter" sub="Mulai dari nomor polisi.">
        <div className="g-grid">
          <Field label="Nomor polisi" htmlFor="g-nopol" req wide>
            <input id="g-nopol" className={`g-in g-nopol ${inv(missing.nopol)}`} autoFocus autoCapitalize="characters" placeholder="B 1234 XYZ" value={f.nopol} onChange={(e) => onNopol(e.target.value)} />
          </Field>
          <Field label="Jenis kendaraan" htmlFor="g-vt">
            <input id="g-vt" className="g-in" list="g-vt-list" placeholder="Pilih atau ketik" value={f.vehicle_type} onChange={(e) => set("vehicle_type", e.target.value)} />
            <datalist id="g-vt-list">{VEHICLE_TYPES.map((v) => <option key={v} value={v} />)}</datalist>
          </Field>
          {inside && <div className="g-alert bad wide">Nopol ini tercatat <b>masih di dalam area</b> sejak {fDate(inside.in_at)}. <Link className="link" href={`/gate/${inside.id}`}>Buka untuk Gate Out →</Link></div>}
          {prev && <div className="g-alert info wide">Pernah datang {fDate(prev.in_at)}. Data kendaraan dan pengemudi diisi otomatis. Periksa lagi sebelum menyimpan.</div>}
          <Field label="Perusahaan / supplier" htmlFor="g-comp" req wide hint={f.company_name && !f.company_id ? "Tidak ada di daftar supplier. Laporan pelanggaran tidak bisa dibuat untuk perusahaan ini." : undefined}>
            <Combo id="g-comp" options={opts.suppliers} value={f.company_id} text={f.company_name} allowFree invalid={tried && missing.company} placeholder="Ketik nama perusahaan" onPick={(o, t) => setF((p) => ({ ...p, company_id: o?.id ?? null, company_name: o?.name ?? t }))} />
          </Field>
          <Field label="KIR" htmlFor="g-kir" hint="Nomor atau masa berlaku">
            <input id="g-kir" className="g-in" value={f.kir} onChange={(e) => set("kir", e.target.value)} />
          </Field>
        </div>
        <div className="g-sub">Pengemudi</div>
        <div className="g-grid">
          <Field label="Nama pengemudi" htmlFor="g-dn" req wide>
            <input id="g-dn" className={`g-in ${inv(missing.driver)}`} autoCapitalize="words" value={f.driver_name} onChange={(e) => set("driver_name", e.target.value)} />
          </Field>
          <Field label="Identitas" htmlFor="g-dit">
            <select id="g-dit" className="g-in" value={f.driver_id_type} onChange={(e) => set("driver_id_type", e.target.value)}>{opts.identitas.map((x) => <option key={x}>{x}</option>)}</select>
          </Field>
          <Field label={`Nomor ${f.driver_id_type}`} htmlFor="g-did" req wide>
            <input id="g-did" className={`g-in ${inv(missing.sim)}`} inputMode="numeric" value={f.driver_id_no} onChange={(e) => set("driver_id_no", e.target.value)} />
          </Field>
          <Field label="Kontak pengemudi" htmlFor="g-dp">
            <input id="g-dp" className="g-in" type="tel" inputMode="tel" placeholder="08…" value={f.driver_phone} onChange={(e) => set("driver_phone", e.target.value)} />
          </Field>
        </div>
        <div className="g-sub">Kernet <span>(kalau ada)</span></div>
        <div className="g-grid">
          <Field label="Nama kernet" htmlFor="g-hn"><input id="g-hn" className="g-in" autoCapitalize="words" value={f.helper_name} onChange={(e) => set("helper_name", e.target.value)} /></Field>
          <Field label="KTP/SIM kernet" htmlFor="g-hid"><input id="g-hid" className="g-in" inputMode="numeric" value={f.helper_id_no} onChange={(e) => set("helper_id_no", e.target.value)} /></Field>
        </div>
      </Section>

      <Section n="2" title="Waktu datang" sub="Jam masuk tercatat otomatis.">
        <div className="g-grid">
          <Field label="Dept tujuan" htmlFor="g-dept" req wide>
            <Combo id="g-dept" options={opts.destinations} value={f.in_dept_id} text={f.in_dept_name} allowFree invalid={tried && missing.dept} placeholder="Pilih tujuan" onPick={(o, t) => setF((p) => ({ ...p, in_dept_id: o?.id ?? null, in_dept_name: o?.name ?? t }))} />
          </Field>
          <Field label="No surat jalan" htmlFor="g-sj"><input id="g-sj" className="g-in" value={f.in_sj} onChange={(e) => set("in_sj", e.target.value)} /></Field>
          <Field label="No segel" htmlFor="g-seal" hint="Kalau ada"><input id="g-seal" className="g-in" value={f.in_seal} onChange={(e) => set("in_seal", e.target.value)} /></Field>
          <Field label="Material" htmlFor="g-mat" wide><input id="g-mat" className="g-in" value={f.in_material} onChange={(e) => set("in_material", e.target.value)} /></Field>
        </div>
      </Section>

      <div className={`g-sec-wrap ${tried && missing.adm ? "has-missing" : ""}`}>
        <Section n="3" title="Administrasi" sub="Dokumen kendaraan dan pengemudi.">
          <div className="g-checks">
            {ADM_ITEMS.map((a) => (
              <div className={`g-check ${tried && adm[a.k] == null ? "invalid" : ""}`} key={a.k}><b>{a.n}</b><YesNo label={a.n} value={adm[a.k]} onChange={(v) => setAdm((p) => ({ ...p, [a.k]: v }))} /></div>
            ))}
            <input className="g-in g-note" placeholder="Keterangan (opsional)" value={adm.note ?? ""} onChange={(e) => setAdm((p) => ({ ...p, note: e.target.value }))} aria-label="Keterangan administrasi" />
          </div>
        </Section>
      </div>

      <div className={`g-sec-wrap ${tried && missing.safety ? "has-missing" : ""}`}>
        <Section n="4" title="Perlengkapan safety" sub="Hanya diperiksa saat kedatangan." right={<button type="button" className="btn q sm" onClick={() => setSafety((p) => ({ ...p, ganjal: true, p3k_apar: true, fitting: true, sepatu_vest: true, hama: false, b3: p.b3 ?? "na" }))}>Semua lengkap</button>}>
          <div className="g-checks">
            {SAFETY_ITEMS.map((s) => (
              <div className={`g-check ${tried && safety[s.k] == null ? "invalid" : ""}`} key={s.k}><b>{s.n}</b><YesNo label={s.n} value={safety[s.k]} onChange={(v) => setSafety((p) => ({ ...p, [s.k]: v }))} /></div>
            ))}
            <div className={`g-check ${tried && safety.b3 == null ? "invalid" : ""}`}><b>Surat izin B3</b><Tri3 label="Surat izin B3" value={safety.b3} onChange={(v) => setSafety((p) => ({ ...p, b3: v }))} /></div>
            <div className={`g-check ${tried && safety.hama == null ? "invalid" : ""}`}><b>Infestasi hama <small>info ke QA bila ada</small></b><YesNo label="Infestasi hama" invert yes="Ada hama" no="Bersih" value={safety.hama} onChange={(v) => setSafety((p) => ({ ...p, hama: v }))} /></div>
          </div>
        </Section>
      </div>

      <div className={`g-sec-wrap ${tried && missing.phys ? "has-missing" : ""}`}>
        <Section n="5" title="Kondisi fisik kendaraan" sub="Pilih Temuan lalu tulis apa yang ditemukan." right={<button type="button" className="btn q sm" onClick={() => setPhys(Object.fromEntries(PHYS_AREAS.map((p) => [p.k, { ok: true, note: "" }])))}>Semua OK</button>}>
          <div className="g-physlist">
            {PHYS_AREAS.map((p) => <PhysRow key={p.k} name={p.n} hint={p.hint} value={phys[p.k]} onChange={(v) => setPhys((x) => ({ ...x, [p.k]: v }))} />)}
          </div>
        </Section>
      </div>

      <Section n="6" title="Konfirmasi" sub="Pengganti tanda tangan di form kertas.">
        {fs.length > 0 && (
          <div className="g-alert bad"><b>{fs.length} temuan</b> akan tercatat: {fs.map((x) => x.t).join("; ")}.</div>
        )}
        <label className={`g-ack ${tried && !ack ? "invalid" : ""}`}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>Pengemudi <b>{f.driver_name || "…"}</b> sudah melihat hasil pemeriksaan ini dan menyetujuinya.</span>
        </label>
      </Section>

      <div className="g-bar">
        <Link href="/gate" className="btn q">Batal</Link>
        <span className="g-bar-info">{incomplete ? `${[missing.nopol || missing.company || missing.driver || missing.sim, missing.dept, missing.adm, missing.safety, missing.phys, missing.ack].filter(Boolean).length} bagian belum lengkap` : fs.length ? `${fs.length} temuan` : "Semua lengkap"}</span>
        <button className="btn red big" onClick={save} disabled={busy}>{busy ? "Menyimpan…" : "Simpan & catat masuk"}</button>
      </div>
    </div>
  );
}
