"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Bell } from "lucide-react"
import { useNotifications } from "@/hooks/useNotifications"
import { cn } from "@/lib/utils/cn"

interface Props {
  /**
   * Where to anchor the unread-count badge inside the bell button.
   * Desktop header places its red dot at top-right; mobile at top-left.
   * Defaults to "right" (desktop convention).
   */
  badgePosition?: "left" | "right"

  /**
   * Optional extra hover style — mobile header uses `active:bg-white/[0.1]`.
   */
  withActiveState?: boolean
}

/**
 * NotificationBell — bell icon with unread badge that navigates directly
 * to /notifications on click. (No dropdown — the full page is the
 * single source of truth.)
 *
 * Visual contract preserved from the legacy header link:
 *   `relative w-9 h-9 rounded-full bg-white/[0.05] border border-white/[0.08]
 *    hover:bg-white/[0.08] transition-colors`
 *  with a `Bell w-4 h-4 text-neutral-300 strokeWidth=1.5` inside.
 *
 * Phase 11.29 — when unread count is 0, the badge / red dot is FULLY
 * hidden. Previously a small "always-on" red dot rendered for unread=0
 * so the bell never looked "empty"; the founder explicitly asked for
 * the clean state because a permanent dot reads as "you have a new
 * notification" and was driving false-alarm clicks.
 */
export function NotificationBell({
  badgePosition = "right",
  withActiveState = false,
}: Props) {
  const t = useTranslations("notifyUI")
  const { unreadCount } = useNotifications(20)
  const showBadge = unreadCount > 0

  return (
    <Link
      href="/notifications"
      className={cn(
        "relative w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors",
        withActiveState && "active:bg-white/[0.1]",
      )}
      aria-label={t("bellLabel")}
    >
      <Bell className="w-4 h-4 text-neutral-300" strokeWidth={1.5} />

      {showBadge && (
        <span
          className={cn(
            "absolute min-w-[16px] h-[16px] px-1 bg-red-400 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-[0_0_4px_rgba(248,113,113,0.6)] leading-none",
            badgePosition === "right" ? "-top-0.5 -right-0.5" : "-top-0.5 -left-0.5",
          )}
          aria-label={t("unreadCountLabel", { n: unreadCount })}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  )
}
