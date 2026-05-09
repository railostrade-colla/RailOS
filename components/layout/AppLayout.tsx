"use client"

import { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { DesktopHeader } from "./DesktopHeader"
import { MobileHeader } from "./MobileHeader"
import { BottomNav } from "./BottomNav"
import { Footer } from "./Footer"
import { OfflineBanner } from "./OfflineBanner"
import { PushPermissionPrompt } from "@/components/notifications/PushPermissionPrompt"
// Phase 12.8 — global popup that appears anywhere in the app when a
// buyer requests to open a deal on one of my listings. The seller can
// approve/reject without leaving their current page.
import { DealRequestNotifier } from "@/components/deals/DealRequestNotifier"
// Phase 12.8 — bumps profiles.last_seen_at every 30s while the tab is
// visible so other users see an accurate "متصل الآن" / "آخر اتصال" badge.
import { useHeartbeat } from "@/lib/hooks/useHeartbeat"
import { cn } from "@/lib/utils/cn"
// Phase 11.31 — global SWR preloader. Warms the dedupCache for every
// commonly-read endpoint (projects, portfolio, fee balance, profile,
// notifications) the moment the user enters the authenticated shell,
// so any subsequent page navigation renders from cache instantly
// while a silent background refresh brings the data up to date.
import { usePreloadAppData } from "@/lib/data/preload"

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
  "/",           // الصفحة الرئيسية (landing)
  "/dashboard",  // اللوحة الرئيسية (home بعد تسجيل الدخول)
  "/market",     // السوق
  "/investment", // الاستثمار / لوحة استثماراتي ← أضيف
  "/community",  // المجتمع ← أضيف
  "/about",      // عن رايلوس ← أضيف
  "/council",    // مجلس السوق
  "/profile",    // حسابي
  "/account",    // حسابي (alias)
  "/support",    // الدعم
  // ملاحظة: /portfolio لا يعرض Footer (حُذف عمداً).
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

  // Phase 11.31 — fire all common reads in parallel on shell mount,
  // then refresh every 60 s in the background. Pages read the same
  // cache keys with readPersistedSync for synchronous first paint.
  usePreloadAppData()

  // Phase 12.8 — keep profiles.last_seen_at fresh so counter-parties
  // see an accurate online/last-seen indicator next to my name.
  useHeartbeat()

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

      {/* Phase 12.8 — global deal-request popup (seller side).
          Renders nothing when there's nothing pending. */}
      <DealRequestNotifier />
    </div>
  )
}
