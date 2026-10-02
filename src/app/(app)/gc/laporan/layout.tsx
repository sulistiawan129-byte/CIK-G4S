"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FileSpreadsheet, UploadCloud, FileText, SearchCode, ShieldAlert, CalendarRange } from "lucide-react";
import { useGcPerm } from "@/components/gc/GcPerm";
import { useLanguage } from "@/components/gc/LanguageProvider";
import clsx from "clsx";

const tabs = [
  { href: "/gc/laporan", labelKey: "tabs.daftarLaporan", icon: ClipboardList },
  { href: "/gc/laporan/analisa", labelKey: "tabs.analisa", icon: SearchCode },
  { href: "/gc/laporan/decision", labelKey: "tabs.decision", icon: ShieldAlert },
  { href: "/gc/laporan/rekap-bulanan", labelKey: "tabs.rekap", icon: CalendarRange },
  { href: "/gc/laporan/cetak", labelKey: "tabs.cetak", icon: FileSpreadsheet },
  { href: "/gc/laporan/surat", labelKey: "tabs.surat", icon: FileText },
  { href: "/gc/laporan/import", labelKey: "tabs.import", icon: UploadCloud },
];

export default function LaporanLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const perm = useGcPerm();

  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.filter((tab) => perm.edit || tab.href !== "/gc/laporan/import").map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors shrink-0",
                active
                  ? "bg-ink-900 text-white"
                  : "bg-white text-steel-600 border border-steel-100 hover:bg-steel-50"
              )}
            >
              <Icon className="w-4 h-4" />
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
