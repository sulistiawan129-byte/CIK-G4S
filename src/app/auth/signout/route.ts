import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  // "local": hanya keluar dari Security Desk, sesi di aplikasi lain pada project yang sama tidak ikut putus
  await supabaseServer().auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
