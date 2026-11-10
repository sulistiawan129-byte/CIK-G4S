"use client";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppContext";
import { Loading } from "@/components/ui";
import { MODULES, modLabel } from "@/lib/access";
import { L } from "@/lib/lang";
import { checks } from "@/lib/calc";
import { parseMonth } from "@/lib/dates";
import { SLIDES, renderSlide, slideName, slideOk, type SlideCtx } from "@/lib/slides";
import { api, debounced } from "@/lib/data";
import { useDrafts } from "@/lib/useDrafts";

/** Slide 1280×720 yang diskalakan mengikuti lebar wadahnya. */
function SlideView({ html, className, id }: { html: string; className: string; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const w = ref.current!;
    const fit = () => { const s = w.firstElementChild as HTMLElement | null; if (s) s.style.transform = `scale(${w.clientWidth / 1280})`; };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(w);
    return () => ro.disconnect();
  }, [html]);
  return <div ref={ref} id={id} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

const MONTH_ID_FIXED = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function Laporan() {
  const { D, setD, error, site, siteId, canWrite, toast, fail, pulse } = useApp();
  const params = useSearchParams();
  const [slide, setSlide] = useState(() => Math.min(SLIDES.length - 1, Math.max(0, Number(params.get("s")) || 0)));
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const { set, clear, val } = useDrafts();

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return;
      if (e.key === "ArrowRight") setSlide((s) => Math.min(SLIDES.length - 1, s + 1));
      if (e.key === "ArrowLeft") setSlide((s) => Math.max(0, s - 1));
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);
  useEffect(() => { if (pulse) setFlash((f) => f + 1); }, [pulse]);

  if (!D) return <Loading error={error} />;
  const ctx: SlideCtx = { D, site };
  const ch = checks(D), ready = SLIDES.filter((s) => slideOk(D, s, ch)).length, s = SLIDES[slide];
  const { y, m0 } = parseMonth(D.month);

  function editNote(cat: string, k: "note" | "weekly_note", v: string) {
    if (!siteId || !D) return;
    const cur = D.notes[cat] ?? { note: "", weekly_note: "" }, next = { ...cur, [k]: v };
    set(`${cat}:${k}`, v);
    setD((p) => p && { ...p, notes: { ...p.notes, [cat]: next } });
    setFlash((f) => f + 1);
    const month = D.month;
    debounced(`note:${cat}`, async () => { await api.setNote(siteId, month, cat, next); clear(`${cat}:${k}`); }, 600, fail);
  }
  function editPatrolNote(v: string) {
    if (!siteId || !D) return;
    set("pat:note", v);
    const next = { ...D.patrol, note: v };
    setD((p) => p && { ...p, patrol: next });
    setFlash((f) => f + 1);
    const month = D.month;
    debounced("patrol", async () => { await api.setPatrol(siteId, month, next); clear("pat:note"); }, 600, fail);
  }

  async function exportPptx() {
    if (!D) return;
    setBusy(L("Menyiapkan slide…", "Preparing slides…"));
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-20000px;top:0;width:1280px;height:720px;overflow:hidden";
    document.body.appendChild(host);
    try {
      const [{ toPng }, PptxGenJS] = await Promise.all([import("html-to-image"), import("pptxgenjs").then((m) => m.default)]);
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.title = `Security Monthly Report ${MONTH_ID_FIXED[m0]} ${y}`;
      for (let i = 0; i < SLIDES.length; i++) {
        setBusy(L(`Menyusun slide ${i + 1} dari ${SLIDES.length}…`, `Building slide ${i + 1} of ${SLIDES.length}…`));
        host.innerHTML = `<div style="position:relative;width:1280px;height:720px;background:#fff">${renderSlide(SLIDES[i], ctx, i + 1)}</div>`;
        const png = await toPng(host.firstElementChild as HTMLElement, { width: 1280, height: 720, pixelRatio: 2, cacheBust: true });
        pptx.addSlide().addImage({ data: png, x: 0, y: 0, w: 13.333, h: 7.5 });
      }
      await pptx.writeFile({ fileName: `Security_Report_${site?.code ?? "SITE"}_${y}-${String(m0 + 1).padStart(2, "0")}.pptx` });
      toast(L("File PowerPoint diunduh", "PowerPoint file downloaded"));
    } catch (e) {
      fail(e as Error);
    } finally {
      host.remove();
      setBusy(null);
    }
  }

  const goLabel = s.go ? (() => { const m = MODULES.find((x) => x.href === s.go); return m ? modLabel(m) : null; })() : null;
  return (
    <div className="page enter">
      <section className="sechead">
        <div>
          <div className="eyebrow">{L("Laporan bulanan", "Monthly report")}</div>
          <h1>{ready === SLIDES.length ? L("Siap dikirim", "Ready to send") : L("Hampir siap", "Almost ready")}</h1>
          <p className="lede">{L("Format sama dengan laporan yang biasa dikirim ke klien. Titik kuning berarti ada data yang belum lengkap. Berubah otomatis setiap ada data baru.", "Same format as the report usually sent to the client. A yellow dot means some data is incomplete. It updates automatically whenever new data arrives. (The slide content is always generated in Indonesian, the client's report language.)")}</p>
        </div>
        <div className="sendbox">
          <div className="num" style={{ fontSize: 40 }}>{ready}<span style={{ color: "var(--ink3)" }}>/{SLIDES.length}</span></div>
          <div className="sub" style={{ margin: "0 0 12px" }}>{L("slide siap", "slides ready")}</div>
          <button className="btn red" onClick={exportPptx} disabled={!!busy}>{busy ?? L("Unduh PowerPoint", "Download PowerPoint")}</button>
        </div>
      </section>

      <section className="rep">
        <div className="thumbs">
          {SLIDES.map((x, i) => (
            <button className="thumb" key={x.n} aria-current={i === slide} onClick={() => setSlide(i)}>
              <SlideView className="tv" html={renderSlide(x, ctx, i + 1)} />
              <div className="cap"><span>{String(i + 1).padStart(2, "0")} · {slideName(x)}</span><span className={`dot ${slideOk(D, x, ch) ? "ok" : "warn"}`}></span></div>
            </button>
          ))}
        </div>
        <div>
          <SlideView key={`${slide}-${flash}`} className={`sw ${flash ? "pulse" : ""}`} html={renderSlide(s, ctx, slide + 1)} />
          <div className="pager">
            <button className="btn q" disabled={slide === 0} onClick={() => setSlide(slide - 1)}>← {L("Sebelumnya", "Previous")}</button>
            <span className="sub" style={{ margin: 0 }}>Slide {slide + 1} {L("dari", "of")} {SLIDES.length} · {L("← → untuk pindah", "← → to navigate")}</span>
            <button className="btn" disabled={slide === SLIDES.length - 1} onClick={() => setSlide(slide + 1)}>{L("Berikutnya", "Next")} →</button>
          </div>
          <fieldset className="ro" disabled={!canWrite}>
            {s.cat ? (
              <>
                <div className="notes">
                  <div><label htmlFor="rn">{L("Alasan / penyebab (grafik tahunan)", "Reason / cause (annual chart)")}</label><textarea id="rn" className="inline" value={val(`${s.cat}:note`, D.notes[s.cat]?.note ?? "")} onChange={(e) => editNote(s.cat!, "note", e.target.value)} /></div>
                  <div><label htmlFor="rw">{L("Catatan mingguan", "Weekly note")}</label><textarea id="rw" className="inline" value={val(`${s.cat}:weekly_note`, D.notes[s.cat]?.weekly_note ?? "")} onChange={(e) => editNote(s.cat!, "weekly_note", e.target.value)} /></div>
                </div>
                <p className="note" style={{ marginTop: 8 }}>{L("Ketik, dan slide langsung berubah. Angka, selisih dan rata-rata ditulis otomatis.", "Type and the slide updates instantly. Figures, differences and averages are written automatically.")}</p>
              </>
            ) : s.patrol ? (
              <div className="notes"><div><label htmlFor="rp">{L("Catatan patroli", "Patrol note")}</label><textarea id="rp" className="inline" value={val("pat:note", D.patrol.note)} onChange={(e) => editPatrolNote(e.target.value)} /></div></div>
            ) : (
              <p className="note" style={{ marginTop: 20 }}>{L("Isi slide ini diambil dari menu", "This slide's content comes from the menu")} <Link className="link" href={s.go!}>{goLabel} <span className="arr">→</span></Link></p>
            )}
          </fieldset>
        </div>
      </section>
    </div>
  );
}

export default function Page() { return <Suspense><Laporan /></Suspense>; }
