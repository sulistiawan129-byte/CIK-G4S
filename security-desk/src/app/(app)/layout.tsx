import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppProvider } from "@/components/AppContext";
import { Shell } from "@/components/Shell";
import type { Profile, Site } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile || !profile.active) redirect("/login?e=nonaktif");
  if (profile.role === "display") redirect("/display");
  const { data: sites } = await sb.from("sites").select("id,code,name,client").order("code");
  return (
    <AppProvider profile={profile as Profile} sites={(sites ?? []) as Site[]}>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
