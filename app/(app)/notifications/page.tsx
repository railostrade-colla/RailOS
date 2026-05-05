"use client"

import { useMemo, useState } from "react"
import { BellRing, CheckCheck } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { useNotifications } from "@/hooks/useNotifications"
import {
  deleteNotification,
  markAllAsRead,
  type DBNotification,
} from "@/lib/data/notifications"
import { NotificationItem } from "@/components/notifications/NotificationItem"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

// ─── Filter families (map notification_type → tab) ────────────────
type FilterKey = "all" | "deals" | "auctions" | "projects" | "support" | "system"

const FILTERS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: "all",       label: "الكل" },
  { key: "deals",     label: "الصفقات" },
  { key: "auctions",  label: "المزادات" },
  { key: "projects",  label: "المشاريع" },
  { key: "support",   label: "الدعم" },
  { key: "system",    label: "النظام" },
]

/** Returns the filter family a notification belongs to (or null = always all). */
function familyOf(type: string): Exclude<FilterKey, "all"> | null {
  if (type.startsWith("deal_") || type === "shares_received" || type === "shares_sold")
    return "deals"
  if (type.startsWith("auction_")) return "auctions"
  if (type.startsWith("project_") || type === "level_upgraded" || type.startsWith("kyc_"))
    return "projects"
  if (type === "support_reply" || type.startsWith("dispute_")) return "support"
  // Phase 10.61 — `system_announcement` is the catch-all type used by
  // admin broadcasts + the new notify_all_admins() helper. Make sure
  // it lands in the "system" filter so users can find admin messages.
  if (
    type === "system" ||
    type === "system_announcement" ||
    type === "news_published" ||
    type === "council_announcement"
  ) return "system"
  return null
}

/** Counts how many notifications are in each filter family. */
function buildCounts(items: DBNotification[]): Record<FilterKey, number> {
  const counts: Record<FilterKey, number> = {
    all: items.length,
    deals: 0,
    auctions: 0,
    projects: 0,
    support: 0,
    system: 0,
  }
  for (const n of items) {
    const fam = familyOf(n.notification_type)
    if (fam) counts[fam]++
  }
  return counts
}

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, refresh } = useNotifications(100)
  const [filter, setFilter] = useState<FilterKey>("all")

  const counts = useMemo(() => buildCounts(notifications), [notifications])

  const displayed = useMemo(() => {
    if (filter === "all") return notifications
    return notifications.filter((n) => familyOf(n.notification_type) === filter)
  }, [notifications, filter])

  async function handleMarkAllRead() {
    const ok = await markAllAsRead()
    if (ok) {
      showSuccess("تم تعليم الكل كمقروء")
      refresh()
    } else {
      showError("تعذّر التعليم — حاول مرة أخرى")
    }
  }

  async function handleDelete(id: string) {
    const ok = await deleteNotification(id)
    if (ok) {
      showSuccess("تم الحذف")
      refresh()
    } else {
      showError("تعذّر الحذف")
    }
  }

  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
          <PageHeader
            badge={`NOTIFICATIONS · ${
              unreadCount > 0 ? `${unreadCount} جديد` : "كل شي مقروء"
            }`}
            title="الإشعارات"
            description="آخر التحديثات والأنشطة في حسابك"
          />

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4 lg:mx-0 lg:px-0">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-[11px] whitespace-nowrap transition-colors flex-shrink-0",
                  filter === f.key
                    ? "bg-white text-black font-bold"
                    : "bg-white/[0.05] border border-white/[0.08] text-neutral-400 hover:text-white",
                )}
              >
                {f.label} ({counts[f.key]})
              </button>
            ))}
          </div>

          {/* Mark-all-read action */}
          {unreadCount > 0 && (
            <div className="flex justify-end mb-3">
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-neutral-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" strokeWidth={1.75} />
                تعليم الكل كمقروء
              </button>
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="text-sm text-neutral-400">جاري التحميل...</div>
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-12">
              <BellRing
                className="w-12 h-12 text-neutral-600 mx-auto mb-3"
                strokeWidth={1.5}
              />
              <div className="text-sm text-white font-bold mb-1">
                {notifications.length === 0
                  ? "لا توجد إشعارات بعد"
                  : "لا إشعارات في هذا التصنيف"}
              </div>
              <div className="text-xs text-neutral-500">
                ستظهر هنا الإشعارات الجديدة
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "rounded-2xl border overflow-hidden transition-all",
                    n.is_read
                      ? "bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.07]"
                      : "bg-white/[0.08] border-white/[0.12] hover:bg-white/[0.1]",
                  )}
                >
                  <NotificationItem
                    notification={n}
                    onAction={() => {
                      // realtime channel will refresh after mark-as-read
                    }}
                    onDelete={handleDelete}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
