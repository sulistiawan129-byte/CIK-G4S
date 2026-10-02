"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Klien Supabase untuk tabel modul G-C (schema public). Sesi login sama dengan aplikasi utama. */
let client: SupabaseClient | undefined;
export function createClient() {
  if (client) return client;
  client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return client;
}
