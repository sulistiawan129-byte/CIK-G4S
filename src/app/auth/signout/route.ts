import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  // "local": hanya keluar dari Security Desk, sesi di aplikasi lain pada project yang sama tidak ikut putus
  await supabaseServer().auth.signOut({ scope: "local" });
  const to = new URL(req.url).searchParams.get("to") === "pos" ? "/pos/login" : "/login";
  return NextResponse.redirect(new URL(to, req.url), { status: 303 });
}
