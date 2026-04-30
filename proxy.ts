import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

/**
 * Next.js 16 Proxy (renamed from middleware).
 *
 * Dev-mode behavior:
 *  - يُحدِّث Supabase auth cookies في كل request (يحافظ على الجلسة)
 *  - لا يقوم بأي redirect — صفحات mock-data تعمل بدون auth
 *
 * عند الانتقال للإنتاج: أعِد تفعيل redirects المحفوظة أدناه (publicPaths/admin guard).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  // ───── Refresh auth session cookies (مهم: يضمن بقاء المستخدم مسجَّلاً) ─────
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    })

    // مجرّد قراءة المستخدم تكفي لإطلاق Set-Cookie إذا انتهى JWT
    try {
      await supabase.auth.getUser()
    } catch {
      /* تجاهل: لو فشل (مفاتيح غير صحيحة في dev) لا نريد كسر الـ request */
    }
  }

  return response

  /* eslint-disable @typescript-eslint/no-unreachable */
  /* === المنطق الكامل (للإنتاج — يحجب الصفحات حسب الدور) ===

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  const publicPaths = [
    "/",
    "/splash",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/about",
    "/terms",
    "/privacy",
  ]
  const isPublic =
    publicPaths.includes(path) ||
    path.startsWith("/auth/") ||
    path === "/admin-login"

  const isAdminPath = path.startsWith("/admin") && path !== "/admin-login"

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (user && (path === "/login" || path === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (user && isAdminPath) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  === */
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
