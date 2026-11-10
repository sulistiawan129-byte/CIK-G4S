"use client";
/* Klien Supabase KE CIKOPS-FM (project terpisah dari Security Desk).
   Hanya memanggil fungsi RPC publik gate kendaraan (anon key) — sama persis dengan halaman /gate CIKOPS yang dipakai petugas sebelumnya.
   Isi di Vercel Security Desk: NEXT_PUBLIC_CIKOPS_SUPABASE_URL dan NEXT_PUBLIC_CIKOPS_SUPABASE_ANON_KEY (nilai publik, sama dengan di Vercel CIKOPS). */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_ = process.env.NEXT_PUBLIC_CIKOPS_SUPABASE_URL ?? "";
const KEY_ = process.env.NEXT_PUBLIC_CIKOPS_SUPABASE_ANON_KEY ?? "";

export const cikopsConfigured = () => !!URL_ && !!KEY_;

let client: SupabaseClient | null = null;
export function cikopsClient(): SupabaseClient {
  if (!client) client = createClient(URL_, KEY_, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return client;
}
