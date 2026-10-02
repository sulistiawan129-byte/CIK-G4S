"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Klien untuk tabel modul G-C (schema public).
 * Memakai SATU koneksi Supabase yang sama dengan aplikasi utama (login, realtime),
 * tetapi query .from()/.rpc() diarahkan ke schema "public".
 * (createBrowserClient menyimpan satu instance per browser, jadi tidak boleh dibuat dua klien
 *  dengan schema berbeda: yang dibuat pertama akan dipakai untuk semuanya.)
 */
let client: SupabaseClient | undefined;
export function createClient(): SupabaseClient {
  if (client) return client;
  const base = supabaseBrowser();
  const pub = base.schema("public");
  client = new Proxy(base, {
    get(target, prop, recv) {
      if (prop === "from") return pub.from.bind(pub);
      if (prop === "rpc") return pub.rpc.bind(pub);
      const v = Reflect.get(target, prop, recv);
      return typeof v === "function" ? v.bind(target) : v;
    },
  }) as SupabaseClient;
  return client;
}
