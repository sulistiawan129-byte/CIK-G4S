"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Truck, MapPin } from "lucide-react";
import clsx from "clsx";

/** Tab Supplier / Tujuan (satu menu "Supplier & tujuan"). */
export default function MasterTabs() {
  const path = usePathname();
  const tabs = [{ href: "/gc/supplier", label: "Supplier", icon: Truck }, { href: "/gc/tujuan", label: "Tujuan", icon: MapPin }];
  return (
    <div className="flex gap-1 mb-5">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={clsx("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold no-underline", path === t.href ? "bg-ink-900 text-white" : "bg-white text-steel-600 border border-steel-100 hover:bg-steel-50")}>
          <t.icon className="w-4 h-4" />{t.label}
        </Link>
      ))}
    </div>
  );
}
