import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

const ROLES = ["master_admin", "admin", "viewer", "display"];

/** Membuat akun baru. Hanya master admin. Service role key tidak pernah dikirim ke browser. */
export async function POST(req: Request) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum login." }, { status: 401 });
  const { data: me } = await sb.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  if (me?.role !== "master_admin" || !me.active) return NextResponse.json({ error: "Hanya Master Admin yang boleh membuat akun." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const full_name = String(body.full_name ?? "").trim();
  const role = String(body.role ?? "viewer");
  const site_ids = Array.isArray(body.site_ids) ? body.site_ids.map(String) : [];
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password minimal 8 karakter." }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Peran tidak dikenal." }, { status: 400 });

  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
    if (error || !data.user) return NextResponse.json({ error: error?.message ?? "Gagal membuat akun." }, { status: 400 });
    const { error: pe } = await admin.from("profiles").upsert({ id: data.user.id, email, full_name, role, site_ids, active: true });
    if (pe) return NextResponse.json({ error: pe.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: data.user.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Mengatur ulang password pengguna lain. Hanya master admin. */
export async function PATCH(req: Request) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum login." }, { status: 401 });
  const { data: me } = await sb.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  if (me?.role !== "master_admin" || !me.active) return NextResponse.json({ error: "Hanya Master Admin." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? ""), password = String(body.password ?? "");
  if (!id || password.length < 8) return NextResponse.json({ error: "Password minimal 8 karakter." }, { status: 400 });
  try {
    const { error } = await supabaseAdmin().auth.admin.updateUserById(id, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
