"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, BarChart3, Hammer, TrendingUp, Headphones, Users, BellRing, CheckCheck, Trash2 } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess } from "@/lib/utils/toast"
import { mockNotifications, generateMarketNotifications } from "@/lib/mock-data"
import { cn } from "@/lib/utils/cn"

type NotifType = "all" | "trade" | "auction" | "market" | "support" | "friend"

// Map market notifications into the app notification shape so the existing
// list renderer & filter logic stay unchanged.
const marketAsAppNotifications = generateMarketNotifications().map((m, i) => ({
  id: m.id,
  title: m.title,
  body: m.desc,
  read_status: !m.is_unread,
  created_at: new Date(Date.now() - (i + 1) * 3_600_000).toISOString(),
  link: m.href,
}))

const ALL_NOTIFS = [...marketAsAppNotifications, ...mockNotifications]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return "الآن"
  if (m < 60) return `منذ ${m} دقيقة`
  if (h < 24) return `منذ ${h} ساعة`
  if (d < 7) return `منذ ${d} يوم`
  return new Date(dateStr).toLocaleDateString("en-US")
}

function notifIcon(n: { title: string; body: string }) {
  const t = (n.title + " " + n.body).toLowerCase()
  if (t.includes("صفقة") || t.includes("تداول")) return BarChart3
  if (t.includes("مزاد")) return Hammer
  if (t.includes("صديق") || t.includes("طلب صديق")) return Users
  if (t.includes("دعم") || t.includes("رد") || t.includes("فريق")) return Headphones
  if (t.includes("سعر") || t.includes("ارتفع") || t.includes("انخفض")) return TrendingUp
  return Bell
}

function notifColors(n: { title: string; body: string }) {
  const t = (n.title + " " + n.body).toLowerCase()
  if (t.includes("صفقة")) return { color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" }
  if (t.includes("مزاد")) return { color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20" }
  if (t.includes("صديق")) return { color: "text-pink-400", bg: "bg-pink-400/10", border: "border-pink-400/20" }
  if (t.includes("دعم") || t.includes("رد")) return { color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20" }
  if (t.includes("سعر")) return { color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/20" }
  return { color: "text-neutral-400", bg: "bg-white/[0.06]", border: "border-white/[0.08]" }
}

const FILTERS: { key: NotifType; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "trade", label: "الصفقات" },
  { key: "auction", label: "المزادات" },
  { key: "market", label: "السوق" },
  { key: "support", label: "الدعم" },
  { key: "friend", label: "الأصدقاء" },
]

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState(ALL_NOTIFS)
  const [filter, setFilter] = useState<NotifType>("all")

  const unreadCount = notifications.filter((n) => !n.read_status).length

  const displayed = notifications.filter((n) => {
    const t = (n.title + " " + n.body).toLowerCase()
    if (filter === "all") return true
    if (filter === "trade") return t.includes("صفقة") || t.includes("تداول")
    if (filter === "auction") return t.includes("مزاد")
    if (filter === "market") return t.includes("سعر") || t.includes("ارتفع") || t.includes("انخفض") || t.includes("تجميد") || t.includes("سوق") || t.includes("وعد")
    if (filter === "support") return t.includes("دعم") || t.includes("رد") || t.includes("فريق")
    if (filter === "friend") return t.includes("صديق")
    return true
  })

  const markAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read_status: true })))
    showSuccess("تم تعليم الكل كمقروء")
  }

  const handleClick = (notif: typeof notifications[0]) => {
    setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read_status: true } : n)))
    router.push(notif.link)
  }

  const deleteNotif = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    showSuccess("تم الحذف")
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            badge={`NOTIFICATIONS · ${unreadCount > 0 ? `${unreadCount} جديد` : "كل شي مقروء"}`}
            title="الإشعارات"
            description="آخر التحديثات والأنشطة في حسابك"
          />

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4 lg:mx-0 lg:px-0">
            {FILTERS.map((f) => {
              const count = f.key === "all"
                ? notifications.length
                : notifications.filter((n) => {
                    const t = (n.title + " " + n.body).toLowerCase()
                    if (f.key === "trade") return t.includes("صفقة") || t.includes("تداول")
                    if (f.key === "auction") return t.includes("مزاد")
                    if (f.key === "market") return t.includes("سعر") || t.includes("ارتفع") || t.includes("انخفض")
                    if (f.key === "support") return t.includes("دعم") || t.includes("رد")
                    if (f.key === "friend") return t.includes("صديق")
                    return false
                  }).length
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-[11px] whitespace-nowrap transition-colors flex-shrink-0",
                    filter === f.key
                      ? "bg-white text-black font-bold"
                      : "bg-white/[0.05] border border-white/[0.08] text-neutral-400 hover:text-white"
                  )}
                >
                  {f.label} ({count})
                </button>
              )
            })}
          </div>

          {/* Mark all read */}
          {unreadCount > 0 && (
            <div className="flex justify-end mb-3">
              <button
                onClick={markAllRead}
                className="text-[11px] text-neutral-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" />
                تعليم الكل كمقروء
              </button>
            </div>
          )}

          {/* List */}
          {displayed.length === 0 ? (
            <div className="text-center py-12">
              <BellRing className="w-12 h-12 text-neutral-600 mx-auto mb-3" strokeWidth={1.5} />
              <div className="text-sm text-white font-bold mb-1">لا توجد إشعارات</div>
              <div className="text-xs text-neutral-500">ستظهر هنا الإشعارات الجديدة</div>
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map((notif) => {
                const Icon = notifIcon(notif)
                const colors = notifColors(notif)
                return (
                  <div
                    key={notif.id}
                    className={cn(
                      "rounded-2xl transition-all border group relative",
                      notif.read_status
                        ? "bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.07]"
                        : "bg-white/[0.08] border-white/[0.12] hover:bg-white/[0.1]"
                    )}
                  >
                    <button
                      onClick={() => handleClick(notif)}
                      className="w-full flex items-start gap-3 p-3.5 text-right"
                    >
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border", colors.bg, colors.border)}>
                        <Icon className={cn("w-4 h-4", colors.color)} strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-white truncate">{notif.title}</span>
                          {!notif.read_status && <div className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0" />}
                        </div>
                        <div className="text-[12px] text-neutral-400 leading-relaxed line-clamp-2 mb-1.5">{notif.body}</div>
                        <div className="text-[10px] text-neutral-500">{timeAgo(notif.created_at)}</div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotif(notif.id)
                      }}
                      className="absolute top-3 left-3 w-6 h-6 rounded-md bg-white/[0.04] border border-white/[0.06] text-neutral-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  )
}
