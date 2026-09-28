"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useApp } from "@/components/AppContext";
import { Loading } from "@/components/ui";
import { Field, PhysRow, Section, YesNo } from "@/components/gate/Parts";
import { ADM_ITEMS, PHYS_AREAS, SAFETY_ITEMS, fDateLong, fDur, fTime, findings, gateApi, loadOptions, useGateRow, useTick, type Adm, type GateRow, type NcMeta, type Phys } from "@/lib/gate";

const yn = (v: boolean | null | undefined, yes = "Ada", no = "Tidak ada") => (v === true ? yes : v === false ? no : "–");

function Summary({ g }: { g: GateRow }) {
  return (
    <div className="g-sum">
      <div className="g-sum-col">
        <h3>Identitas</h3>
        <dl>
          <dt>Perusahaan</dt><dd>{g.company_name || "–"}</dd>
          <dt>Jenis kendaraan</dt><dd>{g.vehicle_type || "–"}</dd>
          <dt>KIR</dt><dd>{g.kir || "–"}</dd>
          <dt>Pengemudi</dt><dd>{g.driver_name || "–"}<small>{g.driver_id_type} {g.driver_id_no}{g.driver_phone ? ` · ${g.driver_phone}` : ""}</small></dd>
          <dt>Kernet</dt><dd>{g.helper_name || "–"}{g.helper_id_no && <small>{g.helper_id_no}</small>}</dd>
        </dl>
      </div>
      <div className="g-sum-col">
        <h3>Kedatangan <span>{fTime(g.in_at)}</span></h3>
        <dl>
          <dt>Dept tujuan</dt><dd>{g.in_dept_name || "–"}</dd>
          <dt>No surat jalan</dt><dd>{g.in_sj || "–"}</dd>
          <dt>No segel</dt><dd>{g.in_seal || "–"}</dd>
          <dt>Material</dt><dd>{g.in_material || "–"}</dd>
          <dt>Petugas</dt><dd>{g.in_by_name || "–"}</dd>
        </dl>
      </div>
      {g.status === "out" && (
        <div className="g-sum-col">
          <h3>Keberangkatan <span>{fTime(g.out_at)}</span></h3>
          <dl>
            <dt>Tujuan</dt><dd>{g.out_dest || "–"}</dd>
            <dt>No surat jalan</dt><dd>{g.out_sj || "–"}</dd>
            <dt>No segel</dt><dd>{g.out_seal || "–"}</dd>
            <dt>Material</dt><dd>{g.out_material || "–"}</dd>
            <dt>Petugas</dt><dd>{g.out_by_name || "–"}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

function CheckTable({ g }: { g: GateRow }) {
  const out = g.status === "out";
  const cell = (v: boolean | null | undefined, yes: string, no: string) => <td className={v === false ? "bad" : v ? "ok" : ""}>{yn(v, yes, no)}</td>;
  return (
    <div className="tw g-ct">
      <table>
        <thead><tr><th>Pemeriksaan</th><th>Datang</th>{out && <th>Berangkat</th>}</tr></thead>
        <tbody>
          {ADM_ITEMS.map((a) => <tr key={a.k}><td>{a.n}</td>{cell(g.adm_in?.[a.k], "Lengkap", "Tidak lengkap")}{out && cell(g.adm_out?.[a.k], "Lengkap", "Tidak lengkap")}</tr>)}
          {SAFETY_ITEMS.map((s) => <tr key={s.k}><td>{s.n}</td>{cell(g.safety?.[s.k], "Ada", "Tidak ada")}{out && <td className="na">–</td>}</tr>)}
          <tr><td>Surat izin B3</td><td className={g.safety?.b3 === "tidak" ? "bad" : g.safety?.b3 === "ya" ? "ok" : ""}>{g.safety?.b3 === "ya" ? "Ada" : g.safety?.b3 === "tidak" ? "Tidak ada" : g.safety?.b3 === "na" ? "Tidak perlu" : "–"}</td>{out && <td className="na">–</td>}</tr>
          <tr><td>Infestasi hama</td>{cell(g.safety?.hama === undefined || g.safety?.hama === null ? null : !g.safety.hama, "Bersih", "Ada hama")}{out && <td className="na">–</td>}</tr>
          {PHYS_AREAS.map((p) => {
            const a = g.phys_in?.[p.k], b = g.phys_out?.[p.k];
            return <tr key={p.k}><td>{p.n}</td><td className={a?.ok === false ? "bad" : a?.ok ? "ok" : ""}>{a?.ok === false ? `Temuan: ${a.note || "-"}` : a?.ok ? "OK" : "–"}</td>{out && <td className={b?.ok === false ? "bad" : b?.ok ? "ok" : ""}>{b?.ok === false ? `Temuan: ${b.note || "-"}` : b?.ok ? "OK" : "–"}</td>}</tr>;
          })}
        </tbody>
      </table>
      {(g.adm_in?.note || g.adm_out?.note) && <p className="note">Catatan administrasi: {[g.adm_in?.note, g.adm_out?.note].filter(Boolean).join(" · ")}</p>}
    </div>
  );
}

function GateOut({ g }: { g: GateRow }) {
  const { toast, fail } = useApp();
  const [f, setF] = useState({ out_dest: "", out_sj: "", out_seal: "", out_material: "" });
  const [adm, setAdm] = useState<Adm>({});
  const [phys, setPhys] = useState<Phys>({});
  const [ack, setAck] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const missing = { adm: ADM_ITEMS.some((a) => adm[a.k] == null), phys: PHYS_AREAS.some((p) => phys[p.k]?.ok == null || (phys[p.k]?.ok === false && !phys[p.k]?.note?.trim())), ack: !ack };
  const incomplete = Object.values(missing).some(Boolean);
  const all = findings({ adm_in: g.adm_in, safety: g.safety, phys_in: g.phys_in, adm_out: adm, phys_out: phys, status: "out" });
  const newOut = all.filter((x) => x.stage === "out");
  const sealChanged = g.in_seal && f.out_seal && g.in_seal.trim() !== f.out_seal.trim();

  async function save() {
    setTried(true);
    if (incomplete) { toast("Masih ada yang belum diisi (ditandai merah)", "err"); return; }
    setBusy(true);
    try {
      await gateApi.update(g.id, { ...f, adm_out: adm, phys_out: phys, driver_ack_out: true, status: "out", finding_count: all.length });
      toast(`${g.nopol} tercatat keluar`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { fail(e as Error); setBusy(false); }
  }
  return (
    <>
      <Section n="1" title="Waktu berangkat" sub="Jam keluar tercatat otomatis saat disimpan.">
        <div className="g-grid">
          <Field label="Tujuan" htmlFor="o-dest" wide><input id="o-dest" className="g-in" autoFocus value={f.out_dest} onChange={(e) => setF({ ...f, out_dest: e.target.value })} /></Field>
          <Field label="No surat jalan" htmlFor="o-sj"><input id="o-sj" className="g-in" value={f.out_sj} onChange={(e) => setF({ ...f, out_sj: e.target.value })} /></Field>
          <Field label="No segel" htmlFor="o-seal" hint={g.in_seal ? `Segel saat datang: ${g.in_seal}` : "Kalau ada"}><input id="o-seal" className="g-in" value={f.out_seal} onChange={(e) => setF({ ...f, out_seal: e.target.value })} /></Field>
          <Field label="Material" htmlFor="o-mat" wide><input id="o-mat" className="g-in" value={f.out_material} onChange={(e) => setF({ ...f, out_material: e.target.value })} /></Field>
          {sealChanged && <div className="g-alert warn wide">Nomor segel berbeda dengan saat datang ({g.in_seal} → {f.out_seal}). Pastikan memang ada penyegelan ulang.</div>}
        </div>
      </Section>
      <div className={`g-sec-wrap ${tried && missing.adm ? "has-missing" : ""}`}>
        <Section n="2" title="Administrasi">
          <div className="g-checks">
            {ADM_ITEMS.map((a) => (
              <div className={`g-check ${tried && adm[a.k] == null ? "invalid" : ""}`} key={a.k}>
                <b>{a.n}<small>Saat datang: {yn(g.adm_in?.[a.k], "lengkap", "tidak lengkap")}</small></b>
                <YesNo label={a.n} value={adm[a.k]} onChange={(v) => setAdm((p) => ({ ...p, [a.k]: v }))} />
              </div>
            ))}
            <input className="g-in g-note" placeholder="Keterangan (opsional)" value={adm.note ?? ""} onChange={(e) => setAdm((p) => ({ ...p, note: e.target.value }))} aria-label="Keterangan administrasi" />
          </div>
        </Section>
      </div>
      <div className={`g-sec-wrap ${tried && missing.phys ? "has-missing" : ""}`}>
        <Section n="3" title="Kondisi fisik saat berangkat" sub="Bandingkan dengan kondisi saat datang." right={<button type="button" className="btn q sm" onClick={() => setPhys(Object.fromEntries(PHYS_AREAS.map((p) => [p.k, { ok: true, note: "" }])))}>Semua OK</button>}>
          <div className="g-physlist">
            {PHYS_AREAS.map((p) => <PhysRow key={p.k} name={p.n} hint={p.hint} before={g.phys_in?.[p.k]} value={phys[p.k]} onChange={(v) => setPhys((x) => ({ ...x, [p.k]: v }))} />)}
          </div>
        </Section>
      </div>
      <Section n="4" title="Konfirmasi">
        {newOut.length > 0 && <div className="g-alert bad"><b>{newOut.length} temuan saat berangkat:</b> {newOut.map((x) => x.t).join("; ")}.</div>}
        <label className={`g-ack ${tried && !ack ? "invalid" : ""}`}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>Pengemudi <b>{g.driver_name || "…"}</b> sudah melihat hasil pemeriksaan keberangkatan dan menyetujuinya.</span>
        </label>
      </Section>
      <div className="g-bar">
        <Link href="/gate" className="btn q">Kembali</Link>
        <span className="g-bar-info">{incomplete ? "Lengkapi yang ditandai merah" : all.length ? `Total ${all.length} temuan` : "Semua lengkap"}</span>
        <button className="btn red big" onClick={save} disabled={busy}>{busy ? "Menyimpan…" : "Simpan & catat keluar"}</button>
      </div>
    </>
  );
}

function NcBox({ g }: { g: GateRow }) {
  const { site, toast, fail } = useApp();
  const [meta, setMeta] = useState<NcMeta | null>(null);
  const [open, setOpen] = useState(false);
  const [p, setP] = useState({ plant: "", identitas: "", status: "", catatan: "", categories: [] as number[] });
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadOptions().then((o) => setMeta(o.meta)).catch(() => {}); }, []);
  useEffect(() => {
    if (!meta?.available) return;
    const fs = findings(g);
    setP((x) => ({
      plant: x.plant || (meta.plants.includes(site?.code ?? "") ? site!.code : meta.plants[0] ?? ""),
      identitas: x.identitas || (meta.identitas.includes(g.driver_id_type) ? g.driver_id_type : meta.identitas[0] ?? ""),
      status: x.status || meta.status[0] || "",
      catatan: x.catatan || fs.map((f) => `${f.t}${f.stage === "out" ? " (berangkat)" : ""}`).join("; "),
      categories: x.categories,
    }));
  }, [meta, g, site]);

  if (g.nc_report_id) return <div className="g-alert info">Laporan pelanggaran sudah dibuat di aplikasi NC.</div>;
  if (!meta) return null;
  if (!meta.available) return null;
  if (!g.company_id) return <div className="g-alert warn">Perusahaan &ldquo;{g.company_name}&rdquo; tidak ada di daftar supplier, jadi laporan pelanggaran tidak bisa dibuat dari sini.</div>;

  async function submit() {
    if (!p.plant || !p.identitas || !p.status) { toast("Lengkapi plant, identitas dan status", "err"); return; }
    setBusy(true);
    try { await gateApi.createNc({ id: g.id, ...p }); toast("Laporan pelanggaran dibuat di aplikasi NC"); setOpen(false); }
    catch (e) { fail(e as Error); }
    setBusy(false);
  }
  return (
    <div className="g-nc">
      {!open ? (
        <button className="btn q" onClick={() => setOpen(true)}>Buat laporan pelanggaran (NC) →</button>
      ) : (
        <div className="g-nc-form">
          <h3>Laporan pelanggaran transporter</h3>
          <p className="sub">Data kendaraan, pengemudi, supplier dan tanggal diambil dari pemeriksaan ini dan langsung masuk ke aplikasi NC.</p>
          <div className="g-grid">
            <Field label="Plant" htmlFor="nc-pl"><select id="nc-pl" className="g-in" value={p.plant} onChange={(e) => setP({ ...p, plant: e.target.value })}>{meta.plants.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Jenis identitas" htmlFor="nc-ji"><select id="nc-ji" className="g-in" value={p.identitas} onChange={(e) => setP({ ...p, identitas: e.target.value })}>{meta.identitas.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Status" htmlFor="nc-st"><select id="nc-st" className="g-in" value={p.status} onChange={(e) => setP({ ...p, status: e.target.value })}>{meta.status.map((x) => <option key={x}>{x}</option>)}</select></Field>
          </div>
          {meta.categories.length > 0 && (
            <fieldset className="g-cats"><legend>Kategori temuan</legend>
              {meta.categories.map((c) => (
                <label key={c.id} className={p.categories.includes(c.id) ? "on" : ""}>
                  <input type="checkbox" checked={p.categories.includes(c.id)} onChange={(e) => setP({ ...p, categories: e.target.checked ? [...p.categories, c.id] : p.categories.filter((x) => x !== c.id) })} />{c.name}
                </label>
              ))}
            </fieldset>
          )}
          <Field label="Catatan" htmlFor="nc-cat" wide><textarea id="nc-cat" className="g-in" rows={3} value={p.catatan} onChange={(e) => setP({ ...p, catatan: e.target.value })} /></Field>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
            <button className="btn q" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn red" onClick={submit} disabled={busy}>{busy ? "Mengirim…" : "Kirim ke aplikasi NC"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { profile, canGate, toast, fail } = useApp();
  const { row: g } = useGateRow(id);
  const [confirmDel, setConfirmDel] = useState(false);
  useTick(30000);
  const isAdmin = profile.role === "master_admin" || profile.role === "admin";

  if (g === undefined) return <Loading />;
  if (g === null) return <div className="errbox">Pemeriksaan tidak ditemukan atau akun ini tidak punya akses.</div>;
  const fs = findings(g);

  async function ackOne(who: "sl" | "spv") { try { await gateApi.acknowledge([g!.id], who); toast("Tercatat"); } catch (e) { fail(e as Error); } }
  async function del() { try { await gateApi.remove(g!.id); toast("Pemeriksaan dihapus"); router.push("/gate"); } catch (e) { fail(e as Error); } }

  return (
    <div className="page enter gate-form">
      <section>
        <div className="eyebrow">{g.doc_no} · {fDateLong(g.in_at)}</div>
        <div className="g-title">
          <span className="g-plate xl">{g.nopol}</span>
          <span className={`g-state ${g.status}`}>{g.status === "in" ? `Di dalam area · ${fDur(g.in_at)}` : `Keluar ${fTime(g.out_at)} · ${fDur(g.in_at, g.out_at)} di dalam`}</span>
        </div>
        <p className="lede">{g.company_name} · {g.driver_name} · masuk {fTime(g.in_at)} ke {g.in_dept_name || "–"}</p>
        {params.get("baru") && g.status === "in" && <div className="g-alert ok" style={{ marginTop: 14 }}>Kendaraan tercatat masuk. Halaman ini dipakai lagi saat kendaraan keluar.</div>}
      </section>

      <section className="sec">
        <div className="sechead">
          <h2>Data pemeriksaan</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn q sm" href={`/gate-cetak/${g.id}`} target="_blank">Cetak form</Link>
            {isAdmin && (!confirmDel ? <button className="btn q sm" onClick={() => setConfirmDel(true)}>Hapus</button> : <><span className="sub" style={{ margin: 0, alignSelf: "center" }}>Yakin hapus?</span><button className="btn red sm" onClick={del}>Ya, hapus</button><button className="btn q sm" onClick={() => setConfirmDel(false)}>Batal</button></>)}
          </div>
        </div>
        <Summary g={g} />
        <CheckTable g={g} />
        {fs.length > 0 && <div className="g-alert bad"><b>{fs.length} temuan:</b> {fs.map((f) => `${f.t}${f.stage === "out" ? " (berangkat)" : ""}`).join("; ")}.</div>}
        {fs.length > 0 && canGate && <NcBox g={g} />}
      </section>

      {g.status === "in" && canGate && (
        <>
          <div className="g-divider"><span>Gate Out · pemeriksaan keberangkatan</span></div>
          <GateOut g={g} />
        </>
      )}

      {g.status === "out" && (
        <section className="sec">
          <h2>Mengetahui</h2>
          <div className="g-sign">
            {([["sl", "Shift Leader", g.sl_name, g.sl_at], ["spv", "Supervisor", g.spv_name, g.spv_at]] as const).map(([k, l, n, at]) => (
              <div key={k} className={`g-sign-box ${at ? "done" : ""}`}>
                <small>{l}</small>
                {at ? <><b>{n || "–"}</b><span>{new Date(at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}</span></>
                  : isAdmin ? <button className="btn sm" onClick={() => ackOne(k)}>Tandai diketahui</button> : <span>Belum</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function Page() { return <Suspense><Detail /></Suspense>; }
