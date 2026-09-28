import type { Metadata, Viewport } from "next";
import "@fontsource/saira-condensed/500.css";
import "@fontsource/saira-condensed/600.css";
import "@fontsource/saira-condensed/700.css";
import "@fontsource/saira-condensed/800.css";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Security Desk",
  description: "Sistem operasional & laporan bulanan security",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#141416", width: "device-width", initialScale: 1, viewportFit: "cover" };

const themeBoot = `try{var t=localStorage.getItem("sd-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBoot }} /></head>
      <body>{children}</body>
    </html>
  );
}
