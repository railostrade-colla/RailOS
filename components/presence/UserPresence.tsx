"use client"

/**
 * UserPresence — small badge showing whether a user is currently
 * online, plus a hover-readable last-seen string.
 *
 * Phase 12.8.
 *
 * Polling: every 60s while mounted. Cheap (single RPC, returns a
 * tiny JSONB blob). Pauses while the tab is hidden.
 *
 * Two render modes:
 *   • <UserPresenceDot userId={...} />            — single 8 px dot
 *   • <UserPresenceLabel userId={...} name="..." /> — name + dot + text
 */

import { useEffect, useState, useRef } from "react"
import {
  getUserPresence,
  formatPresence,
  type UserPresence,
} from "@/lib/data/presence"
import { cn } from "@/lib/utils/cn"

const POLL_INTERVAL_MS = 60_000

function usePresence(userId: string | null | undefined): UserPresence | null {
  const [presence, setPresence] = useState<UserPresence | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    if (!userId) {
      setPresence(null)
      return
    }
    let intervalId: ReturnType<typeof setInterval> | null = null

    const tick = async () => {
      if (document.visibilityState !== "visible") return
      const p = await getUserPresence(userId)
      if (cancelledRef.current) return
      setPresence(p)
    }

    void tick()
    intervalId = setInterval(tick, POLL_INTERVAL_MS)

    const onVis = () => {
      if (document.visibilityState === "visible") void tick()
    }
    document.addEventListener("visibilitychange", onVis)

    return () => {
      cancelledRef.current = true
      if (intervalId) clearInterval(intervalId)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [userId])

  return presence
}

export function UserPresenceDot({
  userId,
  size = "sm",
  className,
}: {
  userId: string | null | undefined
  size?: "xs" | "sm" | "md"
  className?: string
}) {
  const presence = usePresence(userId)
  const sizes = {
    xs: "w-1.5 h-1.5",
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
  }
  const isOnline = !!presence?.is_online
  return (
    <span
      title={presence ? formatPresence(presence) : "غير معروف"}
      className={cn(
        "inline-block rounded-full ring-2 ring-[#0f0f0f] transition-colors",
        sizes[size],
        isOnline ? "bg-green-400" : "bg-neutral-600",
        className,
      )}
      aria-label={presence ? formatPresence(presence) : undefined}
    />
  )
}

/**
 * Just the text — "متّصل الآن" / "قبل ٥ د" — colored by state.
 * Use it next to compact metadata where you've already shown the name.
 */
export function UserPresenceText({
  userId,
  className,
}: {
  userId: string | null | undefined
  className?: string
}) {
  const presence = usePresence(userId)
  const isOnline = !!presence?.is_online
  return (
    <span
      className={cn(
        "text-[10px] inline-flex items-center gap-1",
        isOnline ? "text-green-400" : "text-neutral-500",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block w-1.5 h-1.5 rounded-full shrink-0",
          isOnline ? "bg-green-400" : "bg-neutral-500",
        )}
        aria-hidden="true"
      />
      {formatPresence(presence)}
    </span>
  )
}

/**
 * Renders "Name · ● online text" — used in deal page next to
 * buyer/seller names and inside the global request popup.
 */
export function UserPresenceLabel({
  userId,
  name,
  align = "right",
  showText = true,
  className,
}: {
  userId: string | null | undefined
  name: string
  align?: "right" | "left"
  showText?: boolean
  className?: string
}) {
  const presence = usePresence(userId)
  const isOnline = !!presence?.is_online
  const text = formatPresence(presence)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        align === "left" && "flex-row-reverse",
        className,
      )}
    >
      <span className="text-sm font-bold text-white truncate">{name}</span>
      <span
        className={cn(
          "inline-block w-1.5 h-1.5 rounded-full shrink-0",
          isOnline ? "bg-green-400" : "bg-neutral-500",
        )}
        aria-hidden="true"
      />
      {showText && (
        <span
          className={cn(
            "text-[10px] truncate",
            isOnline ? "text-green-400" : "text-neutral-500",
          )}
        >
          {text}
        </span>
      )}
    </span>
  )
}
