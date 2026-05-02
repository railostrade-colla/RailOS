"use client"

import Link from "next/link"
import {
  AlertTriangle,
  Award,
  Bell,
  CheckCircle,
  Clock,
  FileCheck,
  Gavel,
  Megaphone,
  MessageSquare,
  ShoppingCart,
  TrendingUp,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { markAsRead, type DBNotification } from "@/lib/data/notifications"
import { cn } from "@/lib/utils/cn"

/**
 * Icon mapping by `notification_type`. Uses the existing schema's
 * `notification_type` column. Unknown types fall back to `Bell`.
 */
const TYPE_ICONS: Record<string, LucideIcon> = {
  deal_created: ShoppingCart,
  deal_completed: CheckCircle,
  deal_cancelled: XCircle,
  deal_expired: Clock,
  shares_received: TrendingUp,
  shares_sold: TrendingUp,
  project_approved: FileCheck,
  project_rejected: XCircle,
  kyc_approved: CheckCircle,
  kyc_rejected: XCircle,
  level_upgraded: Award,
  auction_won: Gavel,
  auction_outbid: AlertTriangle,
  council_announcement: Megaphone,
  support_reply: MessageSquare,
  dispute_opened: AlertTriangle,
  dispute_resolved: CheckCircle,
  system: Bell,
}

/** Priority → text-color token (matches the rest of the app palette). */
const PRIORITY_COLOR: Record<string, string> = {
  low: "text-neutral-400",
  normal: "text-blue-400",
  high: "text-yellow-400",
  urgent: "text-red-400",
}

interface Props {
  notification: DBNotification
  /**
   * Called after the click is handled (used by the dropdown to close
   * itself). The page-level list passes a no-op.
   */
  onAction: () => void
}

export function NotificationItem({ notification, onAction }: Props) {
  const Icon = TYPE_ICONS[notification.notification_type] ?? Bell
  const colorClass = PRIORITY_COLOR[notification.priority] ?? PRIORITY_COLOR.normal
  const unread = !notification.is_read

  async function handleClick() {
    if (unread) {
      // Fire-and-forget: realtime subscription will refresh the list.
      void markAsRead(notification.id)
    }
    onAction()
  }

  const inner = (
    <div
      className={cn(
        "flex gap-3 p-4 border-b border-white/[0.06] transition-colors cursor-pointer",
        unread ? "bg-white/[0.03] hover:bg-white/[0.05]" : "hover:bg-white/[0.02]",
      )}
    >
      {/* Type icon */}
      <div
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center",
          colorClass,
        )}
      >
        <Icon className="w-5 h-5" strokeWidth={1.75} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 text-right">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-bold text-white truncate">
            {notification.title}
          </h4>
          {unread && (
            <span
              className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-400 mt-1.5"
              aria-label="غير مقروء"
            />
          )}
        </div>

        <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
          {notification.message}
        </p>

        <div className="flex items-center justify-between mt-2 gap-2">
          <span className="text-[11px] text-neutral-500">
            {formatTime(notification.created_at)}
          </span>

          {notification.action_label && (
            <span className="text-[11px] text-blue-400 font-medium truncate">
              {notification.action_label} ←
            </span>
          )}
        </div>
      </div>
    </div>
  )

  if (notification.link_url) {
    return (
      <Link href={notification.link_url} onClick={handleClick}>
        {inner}
      </Link>
    )
  }

  return (
    <button type="button" onClick={handleClick} className="w-full text-right">
      {inner}
    </button>
  )
}

function formatTime(date: string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3_600_000)
  const days = Math.floor(diffMs / 86_400_000)

  if (minutes < 1) return "الآن"
  if (minutes < 60) return `منذ ${minutes} دقيقة`
  if (hours < 24) return `منذ ${hours} ساعة`
  if (days < 7) return `منذ ${days} يوم`
  return then.toLocaleDateString("ar-IQ")
}
