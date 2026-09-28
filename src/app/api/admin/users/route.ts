import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

const ROLES = ["master_admin", "admin", "viewer", "display", "gate"];

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
    let userId: string | null = null;
    let existed = false;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
    if (data?.user) userId = data.user.id;
    else if (error && /already|registered|exists/i.test(error.message)) {
      // Email sudah punya akun di project ini (mis. dipakai aplikasi lain) → cukup beri akses Security Desk.
      userId = await findUserId(admin, email);
      existed = true;
    } else {
      return NextResponse.json({ error: error?.message ?? "Gagal membuat akun." }, { status: 400 });
    }
    if (!userId) return NextResponse.json({ error: "Akun dengan email ini tidak ditemukan." }, { status: 400 });
    const { error: pe } = await admin.from("profiles").upsert({ id: userId, email, full_name, role, site_ids, active: true });
    if (pe) return NextResponse.json({ error: pe.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: userId, existed });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

async function findUserId(admin: ReturnType<typeof supabaseAdmin>, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
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
