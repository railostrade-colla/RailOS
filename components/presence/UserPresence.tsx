"use client"

/**
 * UserPresence — Phase 12.8 v2 (realtime-first).
 *
 * Online detection comes from the Supabase Realtime presence channel
 * (`globalPresence`) — flips in < 1 s when a user joins or leaves.
 *
 * The DB column `profiles.last_seen_at` is only queried for OFFLINE
 * users so we can show "آخر اتصال منذ X". One-shot read, no polling.
 *
 * Three building blocks:
 *   • <UserPresenceDot/>   — the badge dot
 *   • <UserPresenceText/>  — dot + text (e.g. inside an avatar caption)
 *   • <UserPresenceLabel/> — name + dot + text
 */

import { useEffect, useState } from "react"
import {
  getUserPresence,
  formatPresence,
  type UserPresence,
} from "@/lib/data/presence"
import { useIsOnline } from "@/lib/hooks/useIsOnline"
import { cn } from "@/lib/utils/cn"

/**
 * Resolves a unified presence object combining instant realtime
 * online state with a one-time DB fetch for the last-seen text.
 *
 * - When online (realtime): `is_online=true`, no DB read.
 * - When offline: fetch DB once, refetch only when the user goes
 *   offline (transition online→offline) so the text is fresh.
 */
function useResolvedPresence(
  userId: string | null | undefined,
): UserPresence | null {
  const isOnline = useIsOnline(userId)
  const [lastSeen, setLastSeen] = useState<UserPresence | null>(null)

  // Reset cached last-seen whenever the userId changes.
  useEffect(() => {
    setLastSeen(null)
  }, [userId])

  // Fetch DB last_seen_at only when offline + we don't have it yet.
  useEffect(() => {
    if (!userId) return
    if (isOnline) return
    if (lastSeen) return
    let cancelled = false
    void getUserPresence(userId).then((p) => {
      if (cancelled) return
      setLastSeen(p)
    })
    return () => {
      cancelled = true
    }
  }, [userId, isOnline, lastSeen])

  // When the user just went offline (true→false), refresh the text
  // so it doesn't get stuck on a stale "قبل ٢ د".
  useEffect(() => {
    if (!userId) return
    if (!isOnline) return
    // userIsNowOnline → drop any cached offline data
    setLastSeen(null)
  }, [userId, isOnline])

  if (isOnline) {
    return {
      last_seen_at: new Date().toISOString(),
      is_online: true,
      seconds_ago: 0,
    }
  }
  return lastSeen
}

// ──────────────────────────────────────────────────────────────────

export function UserPresenceDot({
  userId,
  size = "sm",
  className,
}: {
  userId: string | null | undefined
  size?: "xs" | "sm" | "md"
  className?: string
}) {
  const isOnline = useIsOnline(userId)
  const sizes = {
    xs: "w-1.5 h-1.5",
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
  }
  return (
    <span
      title={isOnline ? "متّصل الآن" : "غير متصل"}
      className={cn(
        "inline-block rounded-full ring-2 ring-[#0f0f0f] transition-colors",
        sizes[size],
        isOnline ? "bg-green-400" : "bg-neutral-600",
        className,
      )}
      aria-label={isOnline ? "متّصل الآن" : "غير متصل"}
    />
  )
}

export function UserPresenceText({
  userId,
  className,
}: {
  userId: string | null | undefined
  className?: string
}) {
  const presence = useResolvedPresence(userId)
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
          "inline-block w-1.5 h-1.5 rounded-full shrink-0 transition-colors",
          isOnline ? "bg-green-400" : "bg-neutral-500",
        )}
        aria-hidden="true"
      />
      {formatPresence(presence)}
    </span>
  )
}

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
  const presence = useResolvedPresence(userId)
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
          "inline-block w-1.5 h-1.5 rounded-full shrink-0 transition-colors",
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
