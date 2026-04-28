import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

/**
 * Next.js 16 Proxy (renamed from middleware).
 *
 * المسؤوليات:
 *  1. تحديث جلسة Supabase بشكل مستمر (auth cookies).
 *  2. توجيه الزوار غير المسجّلين إلى /login للمسارات المحمية.
 *  3. إعادة المستخدمين المسجّلين بعيداً عن /login و /register.
 *  4. حماية مسارات /admin/* بناءً على role في جدول profiles.
 */
export async function proxy(request: NextRequest) {
  // ⚠️ DEV MODE: auth بالكامل معطّل أثناء مرحلة mock-data
  // عند الانتقال للإنتاج: أعِد تفعيل المنطق المحفوظ في النسخة المعلّقة أدناه.
  return NextResponse.next({ request })

  /* eslint-disable @typescript-eslint/no-unreachable */
  /* === المنطق الكامل (محفوظ للإنتاج) ===

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  )

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
    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
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

    if (
      !profile ||
      (profile.role !== "admin" && profile.role !== "super_admin")
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return response
  === */
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
