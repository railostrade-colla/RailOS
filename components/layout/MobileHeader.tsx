"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HelpCircle, Grid3x3 } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { Logo } from "@/components/brand/Logo"

/**
 * MobileHeader - الهيدر العلوي للموبايل والتابلت
 * يظهر فقط على شاشات <1024px
 *
 * يحتوي على نفس أيقونات Desktop:
 * - Support (الدعم)
 * - Notifications (الإشعارات)
 * - Menu (القائمة → /menu)
 */
export function MobileHeader() {
  const pathname = usePathname()

  // Phase 14.13 M2 Hotfix (Part A) — header follows the theme; only the
  // logo box keeps `always-dark` (white SVG logo). See DesktopHeader.
  return (
    <header className="app-chrome lg:hidden sticky top-0 z-40 backdrop-blur-xl">
      <div className="px-4 py-3 flex items-center justify-between">
        {/* Logo — Phase 10.96: click reloads the app instead of navigating
            (per founder spec: "ايقونة التطبيق الاجراء النقر يتم تحديث التطبيق") */}
        <button
          onClick={() => { if (typeof window !== "undefined") window.location.reload() }}
          className="no-shadow flex items-center hover:opacity-80 transition-opacity"
          aria-label="تحديث التطبيق"
        >
          <Logo size="sm" />
        </button>

        {/* Action Icons */}
        <div className="flex items-center gap-2">
          {/* Support */}
          <Link
            href="/support"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] active:bg-white/[0.1] transition-colors"
            aria-label="الدعم"
          >
            <HelpCircle className="w-4 h-4 text-neutral-300" strokeWidth={1.5} />
          </Link>

          {/* Notifications — bell links straight to /notifications page */}
          <NotificationBell badgePosition="left" withActiveState />


          {/* Menu (يفتح صفحة /menu) */}
          <Link
            href="/menu"
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-full border transition-colors",
              pathname.startsWith("/menu")
                ? "bg-white/[0.08] border-white/[0.15]"
                : "bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.08] active:bg-white/[0.1]"
            )}
            aria-label="القائمة الرئيسية"
            aria-current={pathname.startsWith("/menu") ? "page" : undefined}
          >
            <Grid3x3 className="w-4 h-4 text-neutral-300" strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </header>
  )
}
