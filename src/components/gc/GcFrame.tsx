"use client";
import { LanguageProvider } from "@/components/gc/LanguageProvider";
import { GcPermProvider } from "@/components/gc/GcPerm";

/** Bingkai halaman modul G-C: bahasa, izin, dan cakupan Tailwind (.gc). */
export function GcFrame({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <GcPermProvider>
        <div className="gc">{children}</div>
      </GcPermProvider>
    </LanguageProvider>
  );
}
