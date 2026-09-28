import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Cek koneksi: environment variable, Supabase Auth, dan akses ke schema "security". Tidak menampilkan nilai rahasia. */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const out: Record<string, string> = {
    "1_env_SUPABASE_URL": url ? `ada (${url.replace(/^https?:\/\//, "").split(".")[0]}…)` : "TIDAK ADA — isi di Vercel lalu Redeploy",
    "2_env_ANON_KEY": anon ? "ada" : "TIDAK ADA — isi di Vercel lalu Redeploy",
    "3_env_SERVICE_ROLE_KEY": process.env.SUPABASE_SERVICE_ROLE_KEY ? "ada" : "tidak ada (hanya perlu untuk membuat akun dari menu Pengguna)",
  };
  if (url && anon) {
    try {
      const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anon }, cache: "no-store" });
      out["4_supabase_auth"] = r.ok ? "OK" : `GAGAL (HTTP ${r.status}) — cek Project URL & anon key, atau project sedang di-pause`;
    } catch (e) {
      out["4_supabase_auth"] = `TIDAK BISA DIHUBUNGI — ${(e as Error).message}. Cek Project URL.`;
    }
    try {
      const r = await fetch(`${url}/rest/v1/sites?select=id&limit=1`, { headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Accept-Profile": "security" }, cache: "no-store" });
      const body = await r.text();
      out["5_schema_security"] = r.ok
        ? "OK (schema security bisa diakses)"
        : /PGRST106|schema must be one of/i.test(body)
          ? "BELUM DI-EXPOSE — Supabase → Project Settings → API → Exposed schemas → tambahkan security"
          : /does not exist|42P01/i.test(body)
            ? "TABEL BELUM ADA — jalankan supabase/schema.sql"
            : `GAGAL (HTTP ${r.status}): ${body.slice(0, 160)}`;
    } catch (e) {
      out["5_schema_security"] = `GAGAL — ${(e as Error).message}`;
    }
  }
  const ok = Object.values(out).every((v) => /^(ada|OK|tidak ada \(hanya)/.test(v));
  return NextResponse.json({ status: ok ? "SEMUA OK" : "ADA MASALAH", ...out }, { headers: { "Cache-Control": "no-store" } });
}
