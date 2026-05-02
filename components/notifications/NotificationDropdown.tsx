"use client"

import Link from "next/link"
import { CheckCheck } from "lucide-react"
import { useNotifications } from "@/hooks/useNotifications"
import { markAllAsRead } from "@/lib/data/notifications"
import { NotificationItem } from "./NotificationItem"

interface Props {
  onClose: () => void
}

export function NotificationDropdown({ onClose }: Props) {
  const { notifications, unreadCount, loading, refresh } = useNotifications(20)

  async function handleMarkAllRead() {
    const ok = await markAllAsRead()
    if (ok) refresh()
  }

  return (
    <div
      className="w-[min(360px,calc(100vw-2rem))] bg-[rgba(15,15,15,0.95)] backdrop-blur-2xl
                 border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
      role="dialog"
      aria-label="الإشعارات"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        <h3 className="text-base font-bold text-white">الإشعارات</h3>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1 text-xs text-blue-400 hover:underline"
          >
            <CheckCheck className="w-4 h-4" strokeWidth={1.75} />
            تمييز الكل كمقروء
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-sm text-neutral-400">
            جاري التحميل...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-neutral-400">
            لا توجد إشعارات
          </div>
        ) : (
          notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onAction={onClose} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/[0.06]">
        <Link
          href="/notifications"
          onClick={onClose}
          className="block text-center text-sm text-blue-400 hover:underline"
        >
          عرض كل الإشعارات
        </Link>
      </div>
    </div>
  )
}
