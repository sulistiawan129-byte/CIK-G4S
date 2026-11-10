"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { translate, type Lang } from "@/lib/gc/i18n";
import { L as Lfn, setUiLang } from "@/lib/lang";
import { setReportLang } from "@/lib/analisa/report";

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  /** Teks langsung: L("Indonesia", "English"). */
  L: (id: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const KEY = "sd-lang";

/** Satu penyedia bahasa untuk seluruh aplikasi. Penyedia di dalamnya (mis. GcFrame) hanya meneruskan anak. */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const parent = useContext(LanguageContext);
  const [lang, setLangState] = useState<Lang>("id");
  setUiLang(parent ? parent.lang : lang);
  setReportLang(parent ? parent.lang : lang);

  useEffect(() => {
    if (parent) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY) ?? localStorage.getItem("cikops-lang"); } catch {}
    if (saved === "id" || saved === "en") setLangState(saved);
  }, [parent]);

  if (parent) return <>{children}</>;

  function setLang(l: Lang) {
    setUiLang(l);
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch {}
  }
  const value: LanguageContextValue = { lang, setLang, t: (key) => translate(key, lang), L: Lfn };
  // key = bahasa → seluruh halaman dirender ulang saat bahasa diganti
  return <LanguageContext.Provider value={value}><div key={lang} style={{ display: "contents" }}>{children}</div></LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext) ?? { lang: "id", setLang: () => {}, t: (key) => key, L: Lfn };
}
