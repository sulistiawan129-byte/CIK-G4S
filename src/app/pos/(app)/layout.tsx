import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppProvider } from "@/components/AppContext";
import { PosShell } from "@/components/gate/PosShell";
import type { Profile, Site } from "@/lib/types";
import { isFull, normRole } from "@/lib/access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pos Gate", manifest: "/pos-manifest.json" };

/** Aplikasi khusus petugas gate: tanpa menu admin, tanpa data laporan bulanan. */
export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/pos/login");
  const { data: profile, error } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) redirect(`/pos/login?e=schema&m=${encodeURIComponent(error.message.slice(0, 160))}`);
  if (!profile || !profile.active) redirect("/pos/login?e=nonaktif");
  profile.role = normRole(profile.role);
  if (!(profile.role === "gate" || isFull(profile.role))) redirect("/");
  const { data: sites } = await sb.from("sites").select("id,code,name,client").order("code");
  return (
    <AppProvider profile={profile as Profile} sites={(sites ?? []) as Site[]} lite>
      <PosShell>{children}</PosShell>
    </AppProvider>
  );
}
