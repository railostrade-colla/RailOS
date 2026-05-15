"use client"

import { memo, useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, TrendingUp, BarChart3, Users, User } from "lucide-react"
import { cn } from "@/lib/utils/cn"

interface NavTab {
  id: string
  label: string
  href: string
  icon: typeof Home
}

const tabs: NavTab[] = [
  { id: "home", label: "الرئيسية", href: "/dashboard", icon: Home },
  { id: "market", label: "السوق", href: "/market", icon: TrendingUp },
  { id: "investment", label: "الاستثمار", href: "/investment", icon: BarChart3 },
  { id: "community", label: "المجتمع", href: "/community", icon: Users },
  { id: "profile", label: "حسابي", href: "/profile", icon: User },
]

/**
 * BottomNav - شريط التنقل السفلي العائم
 *
 * المميزات:
 * - capsule عائمة في الأسفل
 * - sliding indicator يتحرك تحت التاب النشط
 * - يختفي تلقائياً عند scroll down
 * - يظهر تلقائياً عند scroll up
 * - RTL support
 * - backdrop-blur للخلفية
 *
 * Phase 14.10 A — memo'd at the bottom of this file. Now that AppShell
 * lives in the route layout and BottomNav is its direct child, every
 * navigation triggers an AppShell re-render (usePathname changes).
 * Without memo, BottomNav would re-render too — which would re-run its
 * scroll-direction useEffect setup (fine), but more importantly would
 * recompute the indicator position on every tab switch.
 *
 * BottomNav has zero props, so React.memo's default shallow comparison
 * makes the memo a perfect identity short-circuit.
 */
function BottomNavImpl() {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)
  const navRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<{
    width: number
    right: number
  }>({ width: 0, right: 0 })

  // تحديد التاب النشط
  const activeIndex = tabs.findIndex((tab) => pathname.startsWith(tab.href))

  // إخفاء/إظهار عند الـ scroll
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      // إذا في أعلى الصفحة، اظهر دائماً
      if (currentScrollY < 50) {
        setIsVisible(true)
      } else if (currentScrollY > lastScrollY.current) {
        // scroll down → اخفي
        setIsVisible(false)
      } else {
        // scroll up → اظهر
        setIsVisible(true)
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // حساب موقع وعرض الـ indicator
  useEffect(() => {
    if (activeIndex === -1 || !navRef.current) return

    const navElement = navRef.current
    const tabElement = navElement.querySelectorAll(
      "[data-tab]"
    )[activeIndex] as HTMLElement | undefined

    if (tabElement) {
      const navRect = navElement.getBoundingClientRect()
      const tabRect = tabElement.getBoundingClientRect()

      // في RTL: نحسب من اليمين
      const right = navRect.right - tabRect.right
      const width = tabRect.width

      setIndicatorStyle({ width, right })
    }
  }, [activeIndex, pathname])

  return (
    <nav
      className={cn(
        "fixed bottom-3.5 left-3 right-3 z-50 transition-transform duration-300 ease-out lg:hidden",
        !isVisible && "translate-y-[120%]"
      )}
      aria-label="التنقل الرئيسي"
    >
      {/* Phase 14.13 M2 Hotfix — always-dark: the floating pill stays
          dark in light mode; re-asserts white icon/text + green
          active so the nav reads against its dark glass. */}
      <div
        ref={navRef}
        className="always-dark relative max-w-md mx-auto bg-[rgba(15,15,15,0.92)] backdrop-blur-2xl border border-white/[0.08] rounded-[40px] p-2 shadow-2xl"
        style={{ direction: "rtl" }}
      >
        {/* Sliding indicator */}
        {activeIndex !== -1 && (
          <div
            className="absolute top-2 bottom-2 bg-[rgba(40,40,40,0.95)] rounded-[28px] transition-all duration-300 ease-out shadow-inner"
            style={{
              width: indicatorStyle.width,
              right: indicatorStyle.right,
            }}
            aria-hidden="true"
          />
        )}

        {/* Tabs */}
        <div className="relative flex gap-1">
          {tabs.map((tab, index) => {
            const Icon = tab.icon
            const isActive = activeIndex === index

            return (
              <Link
                key={tab.id}
                href={tab.href}
                prefetch
                data-tab={tab.id}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-2 px-1 relative z-10 transition-colors duration-200 rounded-[28px]",
                  "min-h-[52px] justify-center",
                  isActive ? "text-white" : "text-neutral-500 hover:text-neutral-300"
                )}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className="w-[18px] h-[18px]"
                  strokeWidth={isActive ? 2 : 1.5}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "text-[9px] leading-none transition-all",
                    isActive ? "font-medium" : "font-normal"
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Safe area for iPhones */}
      <div className="safe-bottom" aria-hidden="true" />
    </nav>
  )
}

/**
 * Phase 14.10 A — memo'd export. AppShell re-renders on every
 * navigation (usePathname changes) but BottomNav has no props, so
 * React.memo's default shallow comparison short-circuits the re-render
 * entirely. The component's internal usePathname() still ticks to
 * update the active-tab indicator — that's the only intentional work.
 */
export const BottomNav = memo(BottomNavImpl)
