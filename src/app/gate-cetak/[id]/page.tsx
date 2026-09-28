"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ADM_ITEMS, PHYS_AREAS, fDateLong, fTime, gateApi, type GateRow } from "@/lib/gate";

/** Cetak dengan tata letak form kertas "Ceklist Pemeriksaan Kelengkapan Transporter". */
export default function Cetak() {
  const { id } = useParams<{ id: string }>();
  const [g, setG] = useState<GateRow | null | undefined>(undefined);
  const [client, setClient] = useState("FRISIAN FLAG INDONESIA");
  useEffect(() => {
    gateApi.get(id).then(async (r) => {
      setG(r);
      if (r) {
        const { data } = await supabaseBrowser().from("sites").select("client").eq("id", r.site_id).maybeSingle();
        if (data?.client) setClient(String(data.client).replace(/^PT\.?\s*/i, "").toUpperCase());
      }
    }).catch(() => setG(null));
  }, [id]);
  useEffect(() => { if (g) setTimeout(() => window.print(), 400); }, [g]);

  if (g === undefined) return <p style={{ padding: 24 }}>Memuat…</p>;
  if (g === null) return <p style={{ padding: 24 }}>Data tidak ditemukan.</p>;
  const out = g.status === "out";
  const yn = (v: boolean | null | undefined) => (v === true ? "YES" : v === false ? "NO" : "");
  const box = (v: boolean | null | undefined) => (v ? "☑" : "☐");
  const phys = (v?: { ok: boolean | null; note?: string }) => (v?.ok === false ? `Temuan: ${v.note || "-"}` : v?.ok ? "OK" : "");

  return (
    <div className="pf">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        body{background:#fff!important;background-image:none!important}
        .pf{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:11px;max-width:277mm;margin:0 auto;padding:12px}
        .pf table{width:100%;border-collapse:collapse}
        .pf td,.pf th{border:1px solid #000;padding:3px 5px;vertical-align:top;text-align:left}
        .pf th{background:#e8e8e8;font-size:12px}
        .pf .hd{display:grid;grid-template-columns:120px 1fr 120px;align-items:center;border:1px solid #000;border-bottom:0}
        .pf .hd div{padding:6px;text-align:center}
        .pf .hd h1{font-size:18px;margin:0}.pf .hd h2{font-size:14px;margin:2px 0}.pf .hd h3{font-size:15px;margin:4px 0 0}
        .pf .meta{display:flex;justify-content:space-between;border:1px solid #000;border-top:0;padding:3px 6px;font-size:10px}
        .pf .two{display:grid;grid-template-columns:1fr 1fr;gap:0}
        .pf .lbl{width:13%;white-space:nowrap;background:#f6f6f6}
        .pf .two .lbl{width:22%}
        .pf h1,.pf h2,.pf h3{font-family:Arial,Helvetica,sans-serif;text-transform:none;letter-spacing:0}
        .pf .sig{display:grid;grid-template-columns:1fr 1.1fr 1fr;margin-top:6px}
        .pf .sig table td{height:58px;text-align:center;vertical-align:bottom;font-size:10px}
        .pf .note{font-size:9.5px;font-style:italic;margin:3px 0}
        .pf .bar{display:flex;gap:8px;justify-content:flex-end;margin-bottom:10px}
        .pf .bar button{font:inherit;padding:6px 12px;border:1px solid #000;background:#fff;cursor:pointer}
        @media print{.pf .bar{display:none}.pf{padding:0}}
      `}</style>
      <div className="bar"><button onClick={() => window.print()}>Cetak / simpan PDF</button><button onClick={() => window.close()}>Tutup</button></div>

      <div className="hd">
        <div></div>
        <div><h1>{client}</h1><h2>GENERAL AFFAIRS DEPARTEMENT</h2><h3>CEKLIST PEMERIKSAAN KELENGKAPAN TRANSPORTER</h3></div>
        <div style={{ fontSize: 10 }}>No. {g.doc_no}</div>
      </div>
      <div className="meta"><span>Dicetak dari Security Desk</span><span>{fDateLong(g.in_at)}</span></div>

      <table><thead><tr><th colSpan={6}>IDENTITAS TRANSPORTER</th></tr></thead><tbody>
        <tr><td className="lbl">Nama Pengemudi</td><td>{g.driver_name}</td><td className="lbl">Nama Kernet</td><td>{g.helper_name}</td><td className="lbl">Perusahaan</td><td>{g.company_name}</td></tr>
        <tr><td className="lbl">KTP/SIM</td><td>{g.driver_id_type} {g.driver_id_no}</td><td className="lbl">KTP/SIM</td><td>{g.helper_id_no}</td><td className="lbl">Nopol</td><td><b>{g.nopol}</b></td></tr>
        <tr><td className="lbl">Kontak Pengemudi</td><td>{g.driver_phone}</td><td className="lbl">Jenis Kendaraan</td><td>{g.vehicle_type}</td><td className="lbl">KIR</td><td>{g.kir}</td></tr>
      </tbody></table>

      <div className="two">
        <table><thead><tr><th colSpan={4}>WAKTU DATANG</th></tr></thead><tbody>
          <tr><td className="lbl">Hari/Tanggal</td><td>{fDateLong(g.in_at)}</td><td className="lbl">Waktu</td><td>{fTime(g.in_at)}</td></tr>
          <tr><td className="lbl">No Surat Jalan</td><td>{g.in_sj}</td><td className="lbl">Dept Tujuan</td><td>{g.in_dept_name}</td></tr>
          <tr><td className="lbl">No Segel*</td><td>{g.in_seal}</td><td className="lbl">Material</td><td>{g.in_material}</td></tr>
        </tbody></table>
        <table><thead><tr><th colSpan={4}>WAKTU BERANGKAT</th></tr></thead><tbody>
          <tr><td className="lbl">Hari/Tanggal</td><td>{out ? fDateLong(g.out_at) : ""}</td><td className="lbl">Waktu</td><td>{out ? fTime(g.out_at) : ""}</td></tr>
          <tr><td className="lbl">No Surat Jalan</td><td>{g.out_sj}</td><td className="lbl">Tujuan</td><td>{g.out_dest}</td></tr>
          <tr><td className="lbl">No Segel*</td><td>{g.out_seal}</td><td className="lbl">Material</td><td>{g.out_material}</td></tr>
        </tbody></table>
      </div>

      <div className="two">
        <table><thead><tr><th>PEMERIKSAAN · Administrasi</th><th>KEDATANGAN</th><th>KEBERANGKATAN</th><th>KETERANGAN</th></tr></thead><tbody>
          {ADM_ITEMS.map((a, i) => <tr key={a.k}><td>{a.n}</td><td>{yn(g.adm_in?.[a.k])}</td><td>{yn(g.adm_out?.[a.k])}</td>{i === 0 && <td rowSpan={2}>{[g.adm_in?.note, g.adm_out?.note].filter(Boolean).join(" / ")}</td>}</tr>)}
        </tbody></table>
        <table><thead><tr><th colSpan={4}>Perlengkapan Safety <span style={{ fontWeight: 400, fontSize: 10 }}>(diisi ketika KEDATANGAN)</span></th></tr></thead><tbody>
          <tr><td>{box(g.safety?.ganjal)} Ganjal Ban</td><td>{box(g.safety?.p3k_apar)} Kotak P3K &amp; APAR</td><td>{box(g.safety?.fitting)} Fitting Steam 1 Inch</td></tr>
          <tr><td>{box(g.safety?.sepatu_vest)} Sepatu dan safety vest</td><td>{box(g.safety?.b3 === "ya")} Surat Ijin B3*{g.safety?.b3 === "na" ? " (tidak perlu)" : ""}</td><td>{box(g.safety?.hama === true)} Infestasi Hama</td></tr>
        </tbody></table>
      </div>
      <p className="note">Kebocoran oil, bensin dan limbah diisi pada bagian kolong mobil. Kabin dalam: dashboard, kompartemen kanan kiri pintu, langit-langit, lantai dan belakang jok.</p>

      <table><thead><tr><th style={{ width: "20%" }}>Kondisi Fisik</th><th>KEDATANGAN</th><th>KEBERANGKATAN</th></tr></thead><tbody>
        {PHYS_AREAS.map((p) => <tr key={p.k}><td>{p.n}</td><td>{phys(g.phys_in?.[p.k])}</td><td>{phys(g.phys_out?.[p.k])}</td></tr>)}
      </tbody></table>

      <div className="sig">
        <table><thead><tr><th colSpan={2} style={{ textAlign: "center" }}>KEDATANGAN</th></tr></thead><tbody><tr>
          <td>{g.driver_ack_in ? "✓ dikonfirmasi" : ""}<br />Pengemudi<br /><b>{g.driver_name}</b></td>
          <td>Security<br /><b>{g.in_by_name}</b></td>
        </tr></tbody></table>
        <table><thead><tr><th colSpan={2} style={{ textAlign: "center" }}>MENGETAHUI</th></tr></thead><tbody><tr>
          <td>{g.sl_at ? "✓ " + new Date(g.sl_at).toLocaleDateString("id-ID") : ""}<br />Shift Leader<br /><b>{g.sl_name ?? ""}</b></td>
          <td>{g.spv_at ? "✓ " + new Date(g.spv_at).toLocaleDateString("id-ID") : ""}<br />Supervisor<br /><b>{g.spv_name ?? ""}</b></td>
        </tr></tbody></table>
        <table><thead><tr><th colSpan={2} style={{ textAlign: "center" }}>KEBERANGKATAN</th></tr></thead><tbody><tr>
          <td>{g.driver_ack_out ? "✓ dikonfirmasi" : ""}<br />Pengemudi<br /><b>{out ? g.driver_name : ""}</b></td>
          <td>Security<br /><b>{g.out_by_name}</b></td>
        </tr></tbody></table>
      </div>
    </div>
  );
}
