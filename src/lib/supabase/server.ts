import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Supabase di Server Component / Route Handler, memakai sesi dari cookie. */
export function supabaseServer() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "security" },
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            /* dipanggil dari Server Component: middleware yang menyegarkan sesi */
          }
        },
      },
    }
  );
}

/** Klien service role — HANYA untuk route server (membuat akun). */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diisi di environment.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    db: { schema: "security" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
