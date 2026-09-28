"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Semua tabel Security Desk ada di schema "security" (terpisah dari aplikasi lain di project yang sama). */
export const DB_SCHEMA = "security";

let client: SupabaseClient | null = null;

/** Satu instance Supabase di browser (dipakai untuk query & realtime). */
export function supabaseBrowser(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { db: { schema: DB_SCHEMA } }
    ) as unknown as SupabaseClient;
  }
  return client;
}
