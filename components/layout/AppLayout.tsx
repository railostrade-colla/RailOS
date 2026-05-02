"use client"

import { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { DesktopHeader } from "./DesktopHeader"
import { MobileHeader } from "./MobileHeader"
import { BottomNav } from "./BottomNav"
import { Footer } from "./Footer"
import { OfflineBanner } from "./OfflineBanner"
import { PushPermissionPrompt } from "@/components/notifications/PushPermissionPrompt"
import { cn } from "@/lib/utils/cn"

interface AppLayoutProps {
  children: ReactNode
  /** يخفي شريط التنقّل السفلي (للموبايل) — مفيد لشاشات الدردشة الكاملة. */
  hideBottomNav?: boolean
  /** يخفي الـ Footer يدوياً (تجاوز للقائمة الافتراضية). */
  hideFooter?: boolean
}

/**
 * المسارات التي يظهر فيها الـ Footer.
 * أي صفحة خارج هذه القائمة لا تعرض Footer (حتى لو hideFooter=false).
 *
 * يطابق:
 *   - "/"         (الرئيسية)
 *   - المسار بالضبط (مثل "/market")
 *   - أو الصفحات الفرعية ("/market/new", "/portfolio?tab=...")
 *
 * ملاحظة: "/profile" يطابق "/profile" + "/profile/level" + "/profile-setup".
 */
const FOOTER_VISIBLE_PATHS = [
  "/",          // الصفحة الرئيسية (landing)
  "/dashboard", // اللوحة الرئيسية (home بعد تسجيل الدخول)
  "/market",    // السوق
  "/portfolio", // الاستثمار / محفظتي
  "/council",   // المجتمع / مجلس السوق
  "/profile",   // حسابي
  "/account",   // حسابي (alias)
  "/support",   // الدعم
]

function shouldShowFooter(pathname: string | null): boolean {
  if (!pathname) return false
  return FOOTER_VISIBLE_PATHS.some((path) => {
    if (path === "/") return pathname === "/"
    return pathname === path || pathname.startsWith(path + "/")
  })
}

/**
 * AppLayout - التخطيط الموحد للتطبيق
 *
 * Footer policy:
 *   - يظهر تلقائياً في 6 صفحات فقط (FOOTER_VISIBLE_PATHS)
 *   - hideFooter={true} يخفيه يدوياً (تجاوز إجباري لشاشات chat/splash)
 *   - باقي الصفحات: لا footer
 */
export function AppLayout({ children, hideBottomNav = false, hideFooter = false }: AppLayoutProps) {
  const pathname = usePathname()
  const showFooter = !hideFooter && shouldShowFooter(pathname)

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Offline banner (sticky top, above all) — shows only when offline */}
      <OfflineBanner />

      {/* Desktop Header (sticky top) */}
      <DesktopHeader />

      {/* Mobile Header (sticky top) */}
      <MobileHeader />

      {/* Main Content - flex-1 يملأ المساحة المتاحة */}
      <main
        className={cn(
          "flex-1 flex flex-col",
          !hideBottomNav && "pb-32 lg:pb-12"
        )}
      >
        {children}

        {/* Footer (path-aware — 6 pages only) */}
        {showFooter && (
          <div className="px-4 lg:px-8 max-w-screen-2xl mx-auto w-full">
            <Footer />
          </div>
        )}
      </main>

      {/* Mobile Bottom Nav (fixed) */}
      {!hideBottomNav && <BottomNav />}

      {/* Push permission prompt (shows once after 3s for new users) */}
      <PushPermissionPrompt />
    </div>
  )
}
