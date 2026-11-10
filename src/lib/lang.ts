/* Bahasa tampilan (ID / EN) untuk seluruh Security Desk.
   Satu nilai global yang dipasang oleh LanguageProvider; pergantian bahasa me-remount halaman (key), jadi
   fungsi biasa seperti L("Teks", "Text") aman dipakai di komponen maupun di fungsi util. */
export type UiLang = "id" | "en";
let UI: UiLang = "id";
export const getUiLang = (): UiLang => UI;
export const setUiLang = (l: UiLang) => { UI = l === "en" ? "en" : "id"; };
/** Pilih teks sesuai bahasa aktif. */
export const L = (id: string, en: string): string => (UI === "en" ? en : id);
export const locale = () => (UI === "en" ? "en-GB" : "id-ID");
