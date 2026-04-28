import { ReactNode } from "react"
import { DesktopHeader } from "./DesktopHeader"
import { MobileHeader } from "./MobileHeader"
import { BottomNav } from "./BottomNav"
import { cn } from "@/lib/utils/cn"

interface AppLayoutProps {
  children: ReactNode
  hideBottomNav?: boolean
}

/**
 * AppLayout - التخطيط الموحد للتطبيق
 *
 * البنية الموحّدة:
 *   - root: min-h-screen + flex-col → يضمن ارتفاع 100vh كحدّ أدنى
 *   - main: flex-1 + flex-col → يملأ المساحة المتبقية بعد الـ header
 *   - الـ scroll طبيعي عند تجاوز المحتوى للارتفاع
 *
 * Desktop (≥1024px): Header علوي + content بعرض كامل
 * Mobile/Tablet (<1024px): Header علوي بسيط + content + BottomNav سفلي
 *
 * hideBottomNav: لإخفاء الـ BottomNav (مفيد لشاشات chat كاملة الارتفاع)
 */
export function AppLayout({ children, hideBottomNav = false }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
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
      </main>

      {/* Mobile Bottom Nav (fixed) */}
      {!hideBottomNav && <BottomNav />}
    </div>
  )
}
