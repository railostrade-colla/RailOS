import { ReactNode } from "react"
import { DesktopHeader } from "./DesktopHeader"
import { MobileHeader } from "./MobileHeader"
import { BottomNav } from "./BottomNav"
import { Footer } from "./Footer"
import { OfflineBanner } from "./OfflineBanner"
import { cn } from "@/lib/utils/cn"

interface AppLayoutProps {
  children: ReactNode
  /** يخفي شريط التنقّل السفلي (للموبايل) — مفيد لشاشات الدردشة الكاملة. */
  hideBottomNav?: boolean
  /** يخفي الـ Footer (مفيد لشاشات الدردشة أو الشاشات الفائقة الصغر). */
  hideFooter?: boolean
}

/**
 * AppLayout - التخطيط الموحد للتطبيق
 *
 * البنية الموحّدة:
 *   - root: min-h-screen + flex-col → يضمن ارتفاع 100vh كحدّ أدنى
 *   - main: flex-1 + flex-col → يملأ المساحة المتبقية بعد الـ header
 *   - الـ scroll طبيعي عند تجاوز المحتوى للارتفاع
 *
 * Desktop (≥1024px): Header علوي + content بعرض كامل + Footer
 * Mobile/Tablet (<1024px): Header علوي + content + Footer + BottomNav سفلي
 *
 * Footer: نسخة كاملة موحَّدة (مأخوذة من تصميم Dashboard) — تظهر في كل الصفحات
 *         ما لم يُمَرَّر hideFooter={true}.
 */
export function AppLayout({ children, hideBottomNav = false, hideFooter = false }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
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

        {/* Unified Footer (Dashboard-style full version) */}
        {!hideFooter && (
          <div className="px-4 lg:px-8 max-w-screen-2xl mx-auto w-full">
            <Footer />
          </div>
        )}
      </main>

      {/* Mobile Bottom Nav (fixed) */}
      {!hideBottomNav && <BottomNav />}
    </div>
  )
}
