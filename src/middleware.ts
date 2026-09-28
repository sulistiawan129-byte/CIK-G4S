import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Menyegarkan sesi Supabase di setiap request dan mengarahkan:
 *  - belum login        → /login
 *  - akun peran display → hanya boleh /display
 *  - akun petugas gate  → aplikasi petugas /pos (dan /gate)
 *  - domain khusus petugas (env POS_HOST, opsional) → langsung ke /pos
 */
export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/health")) return NextResponse.next();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Tanpa konfigurasi, tampilkan halaman login (yang akan menjelaskan masalahnya) daripada error 500.
    return req.nextUrl.pathname.startsWith("/login") ? NextResponse.next() : NextResponse.redirect(new URL("/login", req.url));
  }
  const posHost = process.env.POS_HOST;
  if (posHost && req.headers.get("host") === posHost) {
    const p0 = req.nextUrl.pathname;
    if (p0 === "/" || p0 === "/login") return NextResponse.redirect(new URL(p0 === "/" ? "/pos" : "/pos/login", req.url));
  }
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "security" },
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const isPos = path === "/pos" || path.startsWith("/pos/");
  const isLogin = path.startsWith("/login") || path.startsWith("/pos/login");

  if (!user) {
    if (isLogin || path.startsWith("/auth")) return res;
    const url = req.nextUrl.clone();
    url.pathname = isPos ? "/pos/login" : "/login";
    url.search = path === "/" || path === "/pos" ? "" : `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }

  if (isLogin || path.startsWith("/api") || path.startsWith("/auth")) return res;

  const { data: profile, error: pErr } = await supabase.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  if (pErr) {
    // Biasanya: schema "security" belum di-expose, atau schema.sql belum dijalankan.
    const url = req.nextUrl.clone();
    url.pathname = isPos ? "/pos/login" : "/login";
    url.search = `?e=schema&m=${encodeURIComponent(pErr.message.slice(0, 160))}`;
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(url);
  }
  if (!profile || !profile.active) {
    if (path !== "/login") {
      const url = req.nextUrl.clone();
      url.pathname = isPos ? "/pos/login" : "/login";
      url.search = "?e=nonaktif";
      await supabase.auth.signOut({ scope: "local" });
      return NextResponse.redirect(url);
    }
  }
  if (profile?.role === "display" && !path.startsWith("/display")) {
    const url = req.nextUrl.clone();
    url.pathname = "/display";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (profile?.role === "gate" && !isPos && !path.startsWith("/gate")) {
    const url = req.nextUrl.clone();
    url.pathname = "/pos";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|pos-manifest.json).*)"],
};
