"use client"

/**
 * GiftsAdminPanel (Phase 9.6)
 *
 * Admin grants gifts to users (currently only `free_contract`),
 * lists all granted gifts, and revokes unredeemed ones.
 */

import { useEffect, useState, useCallback } from "react"
import { Gift, Trash2 } from "lucide-react"
import {
  Badge,
  ActionBtn,
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
  SectionHeader,
  KPI,
  InnerTabBar,
  AdminEmpty,
} from "@/components/admin/ui"
import {
  getAllUserGifts,
  adminGrantGift,
  adminRevokeGift,
  type UserGiftRow,
} from "@/lib/data/gifts"
import { UserPicker } from "@/components/admin/UserPicker"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return ""
  return iso.replace("T", " ").slice(0, 16)
}

type SubTab = "grant" | "all" | "active" | "used" | "expired"

const GIFT_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  free_contract: { label: "عقد جماعي مجاني", icon: "🤝" },
  fee_units: { label: "وحدات رسوم", icon: "💎" },
  fee_discount: { label: "خصم رسوم", icon: "💸" },
}

export function GiftsAdminPanel() {
  const [tab, setTab] = useState<SubTab>("grant")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [gifts, setGifts] = useState<UserGiftRow[]>([])

  // Grant form (now uses the reusable UserPicker)
  const [selectedUser, setSelectedUser] = useState<{ id: string; display_name: string } | null>(null)
  const [giftType, setGiftType] = useState<string>("free_contract")
  const [reason, setReason] = useState("")
  const [expiresAt, setExpiresAt] = useState("")

  const refresh = useCallback(async () => {
    const all = await getAllUserGifts()
    setGifts(all)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleGrant = async () => {
    if (!selectedUser) {
      showError("اختر مستخدماً")
      return
    }
    if (!giftType.trim()) {
      showError("نوع الهدية مطلوب")
      return
    }
    setSubmitting(true)
    const result = await adminGrantGift({
      user_id: selectedUser.id,
      gift_type: giftType.trim(),
      reason: reason.trim() || undefined,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    })
    setSubmitting(false)

    if (!result.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        not_admin: "صلاحياتك لا تسمح",
        cannot_grant_self: "لا يمكنك منح نفسك هدية",
        invalid_gift_type: "نوع الهدية غير صحيح",
        user_not_found: "المستخدم غير موجود",
        missing_table: "الجداول غير منشورة بعد",
      }
      showError(map[result.reason ?? ""] ?? "فشل منح الهدية")
      return
    }

    showSuccess(`🎁 تم منح الهدية لـ ${selectedUser.display_name}`)
    setSelectedUser(null)
    setReason("")
    setExpiresAt("")
    refresh()
  }

  const handleRevoke = async (g: UserGiftRow) => {
    if (g.is_used) {
      showError("لا يمكن إلغاء هدية مُستخدَمة")
      return
    }
    setSubmitting(true)
    const result = await adminRevokeGift(g.id)
    setSubmitting(false)
    if (!result.success) {
      showError("فشل الإلغاء")
      return
    }
    showSuccess("تم إلغاء الهدية")
    refresh()
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-neutral-400">جاري التحميل...</div>
      </div>
    )
  }

  // Filter for sub-tabs
  const filtered = (() => {
    switch (tab) {
      case "active":
        return gifts.filter((g) => g.status === "active")
      case "used":
        return gifts.filter((g) => g.status === "used")
      case "expired":
        return gifts.filter((g) => g.status === "expired")
      case "all":
        return gifts
      default:
        return []
    }
  })()

  const stats = {
    total: gifts.length,
    active: gifts.filter((g) => g.status === "active").length,
    used: gifts.filter((g) => g.status === "used").length,
    expired: gifts.filter((g) => g.status === "expired").length,
  }

  const tabs = [
    { key: "grant" as const, label: "🎁 منح هدية" },
    { key: "all" as const, label: "📋 الكل", count: stats.total },
    { key: "active" as const, label: "✨ نشطة", count: stats.active },
    { key: "used" as const, label: "✓ مُستخدَمة", count: stats.used },
    { key: "expired" as const, label: "⏰ منتهية", count: stats.expired },
  ]

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="🎁 الهدايا"
        subtitle="منح الهدايا للمستخدمين + متابعة الاستخدام"
        action={<ActionBtn label="تحديث" color="gray" sm onClick={refresh} />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="إجمالي" val={stats.total} color="#fff" />
        <KPI label="نشطة" val={stats.active} color="#4ADE80" />
        <KPI label="مُستخدَمة" val={stats.used} color="#60A5FA" />
        <KPI label="منتهية" val={stats.expired} color="#a3a3a3" />
      </div>

      <InnerTabBar tabs={tabs} active={tab} onSelect={(k) => setTab(k as SubTab)} />

      {/* ═══ Grant form ═══ */}
      {tab === "grant" && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-4 h-4 text-purple-400" strokeWidth={2} />
            <div className="text-sm font-bold text-white">منح هدية جديدة</div>
          </div>

          {/* User picker */}
          <div className="mb-4">
            <UserPicker
              label="المستخدم *"
              value={selectedUser}
              onChange={setSelectedUser}
              placeholder="ابحث بالاسم أو username..."
            />
          </div>

          {/* Gift type */}
          <div className="mb-4">
            <label className="text-xs text-neutral-400 mb-1.5 block">نوع الهدية *</label>
            <select
              value={giftType}
              onChange={(e) => setGiftType(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
            >
              <option value="free_contract">🤝 عقد جماعي مجاني</option>
              {/* Future types — schema is ready, RPCs not wired yet:
                  <option value="fee_units">💎 وحدات رسوم</option>
                  <option value="fee_discount">💸 خصم رسوم</option>  */}
            </select>
            <div className="text-[10px] text-neutral-500 mt-1.5 leading-relaxed">
              💡 العقد المجاني يتجاوز رسوم 10% عند الإنهاء.
            </div>
          </div>

          {/* Expiry (optional) */}
          <div className="mb-4">
            <label className="text-xs text-neutral-400 mb-1.5 block">
              تاريخ الانتهاء (اختياري)
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
            />
            <div className="text-[10px] text-neutral-500 mt-1">اتركه فارغاً للهدايا الدائمة</div>
          </div>

          {/* Reason */}
          <div className="mb-4">
            <label className="text-xs text-neutral-400 mb-1.5 block">السبب (اختياري)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="مثلاً: مكافأة على نشاط الشهر..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
            />
          </div>

          <button
            onClick={handleGrant}
            disabled={!selectedUser || submitting}
            className="w-full bg-purple-500/[0.15] border border-purple-500/[0.3] text-purple-400 py-3 rounded-xl text-sm font-bold hover:bg-purple-500/[0.2] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Gift className="w-4 h-4" strokeWidth={2.5} />
            {submitting ? "جاري المنح..." : "منح الهدية"}
          </button>
        </div>
      )}

      {/* ═══ Lists ═══ */}
      {tab !== "grant" && (
        filtered.length === 0 ? (
          <AdminEmpty title="لا توجد هدايا في هذا التبويب" />
        ) : (
          <Table>
            <THead>
              <TH>المستخدم</TH>
              <TH>النوع</TH>
              <TH>الحالة</TH>
              <TH>السبب</TH>
              <TH>الانتهاء</TH>
              <TH>التاريخ</TH>
              <TH>إجراءات</TH>
            </THead>
            <TBody>
              {filtered.map((g) => {
                const meta = GIFT_TYPE_LABELS[g.gift_type] ?? {
                  label: g.gift_type,
                  icon: "🎁",
                }
                const statusColor =
                  g.status === "active" ? "green" as const
                  : g.status === "used" ? "blue" as const
                  : "gray" as const
                const statusLabel =
                  g.status === "active" ? "نشطة"
                  : g.status === "used" ? "مُستخدَمة"
                  : "منتهية"

                return (
                  <TR key={g.id}>
                    <TD>{g.user_name}</TD>
                    <TD>
                      <span className="text-[11px]">
                        {meta.icon} {meta.label}
                      </span>
                    </TD>
                    <TD><Badge label={statusLabel} color={statusColor} /></TD>
                    <TD>
                      <span className="text-[11px] text-neutral-300 max-w-xs line-clamp-1 inline-block">
                        {g.granted_reason ?? "—"}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-[11px] text-neutral-500">
                        {g.expires_at ? fmtDate(g.expires_at) : "بلا انتهاء"}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-[11px] text-neutral-500">
                        {fmtDate(g.created_at)}
                      </span>
                    </TD>
                    <TD>
                      {g.is_used ? (
                        <span className="text-[10px] text-neutral-500">
                          ✓ مُستهلكة {g.used_at ? `(${fmtDate(g.used_at)})` : ""}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRevoke(g)}
                          disabled={submitting}
                          className={cn(
                            "bg-red-500/[0.1] border border-red-500/[0.3] text-red-400 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-red-500/[0.15]",
                            submitting && "opacity-50 cursor-not-allowed",
                          )}
                        >
                          <Trash2 className="w-3 h-3" strokeWidth={2.5} />
                          إلغاء
                        </button>
                      )}
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )
      )}
    </div>
  )
}
