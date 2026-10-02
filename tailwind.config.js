/** Tailwind hanya dipakai modul G-C (halaman di /gc). Semua kelas berlaku di dalam elemen .gc,
 *  preflight dimatikan supaya tidak mengubah tampilan halaman lain. */
const v = (n) => `rgb(var(--gc-${n}) / <alpha-value>)`;
const scale = (name, keys) => Object.fromEntries(keys.map((k) => [k, v(`${name}-${k}`)]));
module.exports = {
  content: ["./src/app/(app)/gc/**/*.{ts,tsx}", "./src/components/gc/**/*.{ts,tsx}", "./src/app/(app)/eksekutif/**/*.{ts,tsx}", "./src/components/exec/**/*.{ts,tsx}"],
  important: ".gc",
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: v("ink-900"), ...scale("ink", ["900", "800", "700", "600"]) },
        canvas: v("canvas"),
        surface: v("surface"),
        steel: scale("steel", ["50", "100", "300", "400", "500", "600", "700"]),
        brand: { DEFAULT: v("brand-500"), ...scale("brand", ["50", "100", "400", "500", "600", "700"]) },
        clear: { DEFAULT: v("clear-500"), ...scale("clear", ["50", "500", "600", "700"]) },
        alert: { DEFAULT: v("alert-500"), ...scale("alert", ["50", "500", "600"]) },
      },
      // latar gelap (sidebar, tombol hitam) tetap gelap di tema gelap; latar putih ikut tema
      backgroundColor: {
        ink: { DEFAULT: v("inkbg-900"), ...scale("inkbg", ["900", "800", "700", "600"]) },
        white: v("whitebg"),
      },
      fontFamily: {
        display: ["Saira Condensed", "Arial Narrow", "sans-serif"],
        body: ["Figtree", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,.04), 0 1px 12px rgba(0,0,0,.04)",
        pop: "0 8px 24px rgba(0,0,0,.12)",
      },
      borderRadius: { xl2: "12px" },
    },
  },
  plugins: [],
};
