"use client"

import { WifiOff } from "lucide-react"
import { useTranslations } from "next-intl"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"

/**
 * OfflineBanner — شريط أصفر يظهر في الأعلى عند فقدان الاتصال.
 *
 * - sticky في الأعلى (z-50)
 * - لون: yellow-400 (#FBBF24) — متناسق مع design system
 * - يختفي تلقائياً عند العودة للاتصال
 * - نص أسود للوضوح على الخلفية الصفراء
 */
export function OfflineBanner() {
  const { isOnline } = useOnlineStatus()
  const t = useTranslations("components")

  if (isOnline) return null

  return (
    <div
      className="sticky top-0 z-50 w-full bg-yellow-400 border-b-2 border-yellow-500 shadow-md"
      role="alert"
      aria-live="assertive"
    >
      <div className="px-4 py-2.5">
        <div className="flex items-center justify-center gap-2 text-black font-bold text-xs lg:text-sm max-w-screen-2xl mx-auto">
          <WifiOff className="w-4 h-4 animate-pulse flex-shrink-0" strokeWidth={2.5} />
          <span className="flex items-center gap-1.5">
            <span>⚠️</span>
            <span>{t("offline")}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
