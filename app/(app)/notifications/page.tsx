"use client"

import { useMemo, useState } from "react"
import { BellRing, CheckCheck, Trash2, X } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { useNotifications } from "@/hooks/useNotifications"
import {
  deleteNotification,
  deleteAllNotifications,
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
  // Phase 13.62 — bulk-delete confirmation state.
  const [showClearAll, setShowClearAll] = useState(false)
  const [clearing, setClearing] = useState(false)

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

  // Phase 13.62 — bulk-delete confirm + execute.
  async function handleClearAll() {
    setClearing(true)
    const ok = await deleteAllNotifications()
    setClearing(false)
    if (ok) {
      showSuccess("✅ تم مسح جميع الإشعارات")
      setShowClearAll(false)
      refresh()
    } else {
      showError("تعذّر مسح الإشعارات — حاول مرة أخرى")
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

          {/* Phase 13.62 — bulk actions row.
              Mark-all-read shows only when there are unread items;
              clear-all shows whenever there's any notification. */}
          {notifications.length > 0 && (
            <div className="flex justify-end gap-3 mb-3">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-neutral-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" strokeWidth={1.75} />
                  تعليم الكل كمقروء
                </button>
              )}
              <button
                onClick={() => setShowClearAll(true)}
                className="text-[11px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" strokeWidth={1.75} />
                مسح الكل
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

      {/* Phase 13.62 — clear-all confirmation modal */}
      {showClearAll && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border-2 border-red-400/40 rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-red-400/[0.12] border border-red-400/[0.3] flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" strokeWidth={2} />
                </div>
                <div>
                  <div className="text-base font-bold text-white">مسح جميع الإشعارات</div>
                  <div className="text-[11px] text-neutral-400">إجراء لا يمكن التراجع عنه</div>
                </div>
              </div>
              <button
                onClick={() => setShowClearAll(false)}
                disabled={clearing}
                className="text-neutral-500 hover:text-white disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-xl p-3 mb-4 text-xs text-red-300 leading-relaxed">
              ⚠ ستُحذف <span className="font-bold text-white">{notifications.length.toLocaleString("en-US")}</span> إشعار من حسابك (المقروءة وغير المقروءة).
              <span className="block mt-1 text-red-300/80 text-[11px]">
                لا يمكن استرجاعها بعد المسح.
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowClearAll(false)}
                disabled={clearing}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                تراجع
              </button>
              <button
                onClick={handleClearAll}
                disabled={clearing}
                className="flex-1 py-3 rounded-xl bg-red-500/[0.18] border border-red-500/[0.4] text-red-300 text-sm font-bold hover:bg-red-500/[0.25] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" strokeWidth={2.5} />
                {clearing ? "جارٍ المسح..." : "نعم، امسح الكل"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
