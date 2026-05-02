"use client"

import { useState } from "react"
import { Bell } from "lucide-react"
import { useNotifications } from "@/hooks/useNotifications"
import { NotificationDropdown } from "./NotificationDropdown"
import { cn } from "@/lib/utils/cn"

interface Props {
  /**
   * Where to anchor the unread-count badge inside the bell button.
   * Desktop header places its red dot at top-right; mobile at top-left.
   * Defaults to "right" (desktop convention).
   */
  badgePosition?: "left" | "right"

  /**
   * Where to align the dropdown panel under the bell.
   * Desktop drops below-right (left-edge anchored), mobile below-left
   * to fit RTL viewport. Defaults to "right".
   */
  dropdownAlign?: "left" | "right"

  /**
   * Optional extra hover style — mobile header uses `active:bg-white/[0.1]`.
   */
  withActiveState?: boolean
}

/**
 * NotificationBell — drop-in replacement for the static `<Link/>` Bell
 * button used in DesktopHeader and MobileHeader.
 *
 * ⚠️ The OUTER button preserves the exact same visual contract as the
 * legacy Bell link:
 *   `relative w-9 h-9 flex items-center justify-center rounded-full
 *    bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08]
 *    transition-colors`
 * with a `Bell w-4 h-4 text-neutral-300 strokeWidth=1.5` inside.
 *
 * The legacy red dot is replaced by a numeric badge when there are
 * unread notifications, and falls back to the same red dot when count
 * is unknown / zero.
 */
export function NotificationBell({
  badgePosition = "right",
  dropdownAlign = "right",
  withActiveState = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const { unreadCount } = useNotifications(20)

  const showBadge = unreadCount > 0

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors",
          withActiveState && "active:bg-white/[0.1]",
        )}
        aria-label="الإشعارات"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="w-4 h-4 text-neutral-300" strokeWidth={1.5} />

        {showBadge ? (
          <span
            className={cn(
              "absolute min-w-[16px] h-[16px] px-1 bg-red-400 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-[0_0_4px_rgba(248,113,113,0.6)] leading-none",
              badgePosition === "right" ? "-top-0.5 -right-0.5" : "-top-0.5 -left-0.5",
            )}
            aria-label={`${unreadCount} إشعار غير مقروء`}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : (
          // Preserve the legacy small red dot when there are no unread.
          // This keeps the visual identical to the previous design.
          <span
            className={cn(
              "absolute w-1.5 h-1.5 bg-red-400 rounded-full shadow-[0_0_4px_rgba(248,113,113,0.6)]",
              badgePosition === "right" ? "top-2 right-2" : "top-2 left-2",
            )}
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <>
          {/* Click-away overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            className={cn(
              "absolute top-full mt-2 z-50",
              dropdownAlign === "right" ? "left-0" : "right-0",
            )}
          >
            <NotificationDropdown onClose={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  )
}
