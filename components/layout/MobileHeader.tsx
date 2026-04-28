"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, HelpCircle, Grid3x3 } from "lucide-react"
import { cn } from "@/lib/utils/cn"

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

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-[rgba(0,0,0,0.85)] backdrop-blur-xl">
      <div className="px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity" aria-label="رايلوس">
          <div className="w-9 h-9 rounded-lg overflow-hidden border border-white/[0.1] flex items-center justify-center bg-black flex-shrink-0">
            <Image src="/logo.png" alt="رايلوس" width={36} height={36} className="w-full h-full object-contain" />
          </div>
          <div className="text-right leading-none">
            <div className="text-sm font-bold text-white">رايلوس</div>
            <div className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider mt-0.5">RAILOS</div>
          </div>
        </Link>

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

          {/* Notifications */}
          <Link
            href="/notifications"
            className="relative w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] active:bg-white/[0.1] transition-colors"
            aria-label="الإشعارات"
          >
            <Bell className="w-4 h-4 text-neutral-300" strokeWidth={1.5} />
            {/* Notification dot */}
            <span
              className="absolute top-2 left-2 w-1.5 h-1.5 bg-red-400 rounded-full shadow-[0_0_4px_rgba(248,113,113,0.6)]"
              aria-label="إشعارات جديدة"
            />
          </Link>

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
