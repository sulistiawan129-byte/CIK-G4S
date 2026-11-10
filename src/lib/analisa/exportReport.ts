"use client";
/* Ekspor laporan Security bulanan (Excel & PDF) dari ModuleReport yang sama dengan tampilan analisa.
   PPT 12 slide tetap lewat menu "Laporan bulanan". */
import { fmtVal, type ChartSpec, type ModuleReport, type ReportLang } from "./report";

export interface ExportMeta { siteName: string; periodLabel: string; fileKey: string; lang: ReportLang }

const T = (lang: ReportLang, id: string, en: string) => (lang === "en" ? en : id);
const shortTitle = (r: ModuleReport, i: number, lang: ReportLang) => (i === 0 ? T(lang, "Ringkasan", "Summary") : r.title.replace(/^[^—]*— /, ""));

/** jsPDF (Helvetica) tidak punya glif ▲ ▼ ≥ ⚠ — ganti dengan padanan yang terbaca. */
const clean = (s: string) => String(s ?? "").replace(/▲\s?/g, "+").replace(/▼\s?/g, "-").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/⚠/g, "(!)").replace(/[^\u0000-ÿ–—•…]/g, "");

function chartRows(c: ChartSpec): (string | number)[][] {
  const head = [c.title, ...c.series.map((s) => s.name)];
  return [head, ...c.labels.map((l, i) => [l, ...c.series.map((s) => s.values[i] ?? 0)])];
}

/* ───────────── Excel ───────────── */
export async function exportSecurityXlsx(reports: ModuleReport[], meta: ExportMeta): Promise<void> {
  const XLSX = await import("xlsx");
  const { lang } = meta;
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  const nameOf = (raw: string) => {
    let n = raw.replace(/[\\/?*[\]:]/g, " ").slice(0, 31).trim() || "Sheet";
    let k = 2; const base = n;
    while (used.has(n.toLowerCase())) n = `${base.slice(0, 28)} ${k++}`;
    used.add(n.toLowerCase());
    return n;
  };
  reports.filter((r) => !r.empty || r === reports[0]).forEach((r, idx) => {
    const aoa: (string | number)[][] = [
      [`Security Desk — ${meta.siteName}`], [meta.periodLabel], [], [r.title], [r.headline], [],
    ];
    if (r.kpis.length) { aoa.push([T(lang, "Indikator", "Indicator"), T(lang, "Nilai", "Value"), T(lang, "Keterangan", "Note")]); r.kpis.forEach((k) => aoa.push([k.label, k.value, k.sub ?? ""])); aoa.push([]); }
    const list = (title: string, xs: string[]) => { if (xs.length) { aoa.push([title]); xs.forEach((x) => aoa.push(["•", x])); aoa.push([]); } };
    list(T(lang, "Perlu perhatian", "Needs attention"), r.attention);
    list(T(lang, "Temuan", "Findings"), r.insights);
    list(T(lang, "Rekomendasi", "Recommendations"), r.actions);
    if (r.table) { aoa.push([r.table.title]); aoa.push(r.table.headers); r.table.rows.forEach((row) => aoa.push(row)); aoa.push([]); }
    r.charts.forEach((c) => { chartRows(c).forEach((row) => aoa.push(row)); aoa.push([]); });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 38 }, { wch: 22 }, { wch: 36 }, ...Array(10).fill({ wch: 12 })];
    XLSX.utils.book_append_sheet(wb, ws, nameOf(shortTitle(r, idx, lang)));
  });
  XLSX.writeFile(wb, `Security-${meta.fileKey}.xlsx`);
}

/* ───────────── PDF ───────────── */
type RGB = [number, number, number];
const hex = (h: string): RGB => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

export async function exportSecurityPdf(reports: ModuleReport[], meta: ExportMeta): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const { lang } = meta;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 14, CW = W - M * 2;
  let y = 0;

  const header = () => {
    doc.setFillColor(20, 20, 22); doc.rect(0, 0, W, 18, "F");
    doc.setFillColor(218, 41, 28); doc.rect(0, 18, W, 1.2, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("SECURITY DESK", M, 11);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.text(clean(`${meta.siteName} · ${meta.periodLabel}`), W - M, 11, { align: "right" });
    doc.setTextColor(20, 20, 22); y = 26;
  };
  const need = (h: number) => { if (y + h > H - 14) { doc.addPage(); header(); } };
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const heading = (t: string, size = 13) => { need(14); doc.setFont("helvetica", "bold"); doc.setFontSize(size); doc.setTextColor(20, 20, 22); doc.text(clean(t), M, y); y += size / 2.2 + 1.5; };
  const para = (t: string, size = 9.5) => { doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(70, 70, 75); const ls = doc.splitTextToSize(clean(t), CW) as string[]; need(ls.length * 4.4 + 2); doc.text(ls, M, y); y += ls.length * 4.4 + 2; };

  const bullets = (title: string, xs: string[], color: RGB) => {
    if (!xs.length) return;
    need(16);
    autoTable(doc, {
      startY: y, margin: { left: M, right: M }, theme: "plain",
      head: [[{ content: clean(title).toUpperCase(), styles: { textColor: color, fontStyle: "bold", fontSize: 8 } }]],
      body: xs.map((x) => [`•  ${clean(x)}`]),
      styles: { fontSize: 9, cellPadding: { top: 0.8, bottom: 0.8, left: 1, right: 1 }, textColor: [40, 40, 45] },
    });
    y = lastY() + 3;
  };

  const kpiTable = (r: ModuleReport) => {
    if (!r.kpis.length) return;
    need(22);
    autoTable(doc, {
      startY: y, margin: { left: M, right: M }, theme: "grid",
      head: [r.kpis.map((k) => clean(k.label))], body: [r.kpis.map((k) => clean(k.value)), r.kpis.map((k) => clean(k.sub ?? ""))],
      headStyles: { fillColor: [244, 244, 242], textColor: [93, 94, 99], fontSize: 7.5, fontStyle: "normal" },
      styles: { fontSize: 8, halign: "center", lineColor: [227, 227, 223], textColor: [20, 20, 22] },
      didParseCell: (d) => { if (d.section === "body" && d.row.index === 0) { d.cell.styles.fontSize = 13; d.cell.styles.fontStyle = "bold"; } if (d.section === "body" && d.row.index === 1) d.cell.styles.textColor = [120, 120, 126]; },
    });
    y = lastY() + 4;
  };

  /** Grafik vektor sederhana: batang (tunggal/bertumpuk), batang mendatar, garis. Donut → tabel data. */
  const drawChart = (c: ChartSpec) => {
    const h = c.type === "hbar" ? Math.max(30, c.labels.length * 6.5 + 8) : 52;
    need(h + 14); y += 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(20, 20, 22); doc.text(clean(c.title), M, y); y += 3;
    const x0 = M, w = CW;
    if (c.type === "donut") {
      autoTable(doc, { startY: y, margin: { left: M, right: M }, head: [[T(lang, "Kategori", "Category"), T(lang, "Jumlah", "Count")]], body: c.labels.map((l, i) => [clean(l), fmtVal(c.series[0]?.values[i] ?? 0, c.unit)]), styles: { fontSize: 8 }, theme: "striped", headStyles: { fillColor: [42, 43, 46] } });
      y = lastY() + 4; return;
    }
    const vals = c.series.map((s) => s.values);
    const n = c.labels.length;
    if (c.type === "hbar") {
      const lw = 52, bx = x0 + lw, bw = w - lw - 14;
      const mx = Math.max(1, ...vals[0]);
      c.labels.forEach((l, i) => {
        const by = y + i * 6.5, v = vals[0][i] ?? 0;
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(70, 70, 75);
        doc.text(clean(l).slice(0, 34), bx - 2, by + 3.6, { align: "right" });
        doc.setFillColor(...hex(c.colors?.[i] ?? c.series[0].color)); doc.rect(bx, by, Math.max(0.4, (v / mx) * bw), 4.6, "F");
        doc.setTextColor(20, 20, 22); doc.text(fmtVal(v, c.unit), bx + (v / mx) * bw + 1.5, by + 3.6);
      });
      y += c.labels.length * 6.5 + 4; return;
    }
    const ch = 36, base = y + ch;
    const stacked = c.type === "stacked";
    const tot = (i: number) => (stacked ? vals.reduce((a, s) => a + (s[i] ?? 0), 0) : Math.max(...vals.map((s) => s[i] ?? 0)));
    const mx = Math.max(1, ...Array.from({ length: n }, (_, i) => tot(i)));
    doc.setDrawColor(210, 210, 205); doc.setLineWidth(0.2); doc.line(x0, base, x0 + w, base);
    const bw = w / n;
    if (c.type === "line") {
      vals.forEach((s, si) => {
        doc.setDrawColor(...hex(c.series[si].color)); doc.setLineWidth(0.5);
        s.forEach((v, i) => { if (i === 0) return; doc.line(x0 + bw * (i - 0.5), base - ((s[i - 1] ?? 0) / mx) * ch, x0 + bw * (i + 0.5), base - ((v ?? 0) / mx) * ch); });
      });
    } else {
      const k = stacked ? 1 : vals.length;
      for (let i = 0; i < n; i++) {
        let acc = 0;
        vals.forEach((s, si) => {
          const v = s[i] ?? 0, bh = (v / mx) * ch, sw = (bw * 0.72) / k;
          const bx = x0 + bw * i + bw * 0.14 + (stacked ? 0 : si * sw);
          doc.setFillColor(...hex(c.series[si].color)); doc.rect(bx, base - bh - (stacked ? acc : 0), sw, bh, "F");
          acc += stacked ? bh : 0;
        });
        if (!stacked && vals.length === 1 && n <= 13) { doc.setFontSize(6); doc.setTextColor(70, 70, 75); doc.text(fmtVal(vals[0][i] ?? 0, c.unit), x0 + bw * (i + 0.5), base - ((vals[0][i] ?? 0) / mx) * ch - 1, { align: "center" }); }
      }
    }
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(93, 94, 99);
    c.labels.forEach((l, i) => doc.text(clean(l).slice(0, 10), x0 + bw * (i + 0.5), base + 3.5, { align: "center" }));
    if (c.deltas && c.deltas.some((d) => d !== null)) {
      doc.setFontSize(5.8);
      c.deltas.forEach((d, i) => { if (d === null) return; const good = c.goodUp === null || c.goodUp === undefined ? null : (d > 0) === c.goodUp; doc.setTextColor(...(Math.abs(d) < 0.5 || good === null ? ([120, 120, 126] as RGB) : good ? ([31, 122, 77] as RGB) : ([184, 32, 15] as RGB))); doc.text(`${d > 0 ? "+" : ""}${Math.round(d)}%`, x0 + bw * (i + 0.5), base + 6.8, { align: "center" }); });
    }
    if (c.series.length > 1) {
      let lx = x0; doc.setFontSize(7);
      c.series.forEach((s) => { doc.setFillColor(...hex(s.color)); doc.rect(lx, base + 8.2, 2.4, 2.4, "F"); doc.setTextColor(70, 70, 75); doc.text(clean(s.name), lx + 3.6, base + 10.2); lx += 12 + clean(s.name).length * 1.5; });
    }
    y = base + (c.series.length > 1 ? 14 : 10);
  };

  /* halaman judul + isi */
  header();
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(20, 20, 22);
  doc.text(T(lang, "Laporan Security Bulanan", "Monthly Security Report"), M, y + 4); y += 11;
  para(`${meta.siteName} · ${meta.periodLabel}`, 10.5);
  reports.filter((r) => !r.empty || r === reports[0]).forEach((r, idx) => {
    if (idx > 0) { doc.addPage(); header(); }
    heading(idx === 0 ? T(lang, "Ringkasan", "Summary") : shortTitle(r, idx, lang), 14);
    para(r.headline, 10);
    kpiTable(r);
    bullets(T(lang, "Perlu perhatian", "Needs attention"), r.attention, [184, 32, 15]);
    bullets(T(lang, "Temuan", "Findings"), r.insights, [93, 94, 99]);
    bullets(T(lang, "Rekomendasi", "Recommendations"), r.actions, [31, 122, 77]);
    r.charts.forEach(drawChart);
    if (r.table) {
      need(20); heading(r.table.title, 10);
      autoTable(doc, { startY: y, margin: { left: M, right: M }, head: [r.table.headers.map(clean)], body: r.table.rows.map((row) => row.map((c) => clean(String(c)))), styles: { fontSize: 8 }, headStyles: { fillColor: [42, 43, 46] }, theme: "striped" });
      y = lastY() + 4;
    }
  });

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(150, 150, 155);
    doc.text(clean(`Security Desk · ${meta.periodLabel}`), M, H - 7);
    doc.text(`${i} / ${n}`, W - M, H - 7, { align: "right" });
  }
  doc.save(`Security-${meta.fileKey}.pdf`);
}
