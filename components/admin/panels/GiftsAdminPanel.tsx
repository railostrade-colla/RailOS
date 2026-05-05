"use client"

/**
 * GiftsAdminPanel (Phase 9.6 → expanded in 10.54)
 *
 * Admin grants gifts to users + lists/revokes them.
 * Three gift categories: shares-from-project / fee-units / free-contract.
 * User picker now supports filter chips: all / new / active / inactive.
 */

import { useEffect, useState, useCallback } from "react"
import { Gift, Trash2, Search, Sparkles, Users as UsersIcon, Clock, UserMinus } from "lucide-react"
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
import {
  getUsersForAdminPicker,
  type UserPickerFilter,
  type UserPickerRow,
} from "@/lib/data/admin-utilities"
import { getAllProjects } from "@/lib/data/projects"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return ""
  return iso.replace("T", " ").slice(0, 16)
}

type SubTab = "grant" | "all" | "active" | "used" | "expired"
type GiftCategory = "shares" | "fee_units" | "free_contract"

const GIFT_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  free_contract: { label: "عقد جماعي مجاني", icon: "🤝" },
  fee_units: { label: "وحدات رسوم", icon: "💎" },
  fee_discount: { label: "خصم رسوم", icon: "💸" },
  shares: { label: "حصص من مشروع", icon: "📈" },
}

const FILTER_OPTIONS: { key: UserPickerFilter; label: string; icon: typeof UsersIcon }[] = [
  { key: "all", label: "الكل", icon: UsersIcon },
  { key: "new", label: "جدد", icon: Sparkles },
  { key: "active", label: "نشطون", icon: Clock },
  { key: "inactive", label: "خاملون", icon: UserMinus },
]

export function GiftsAdminPanel() {
  const [tab, setTab] = useState<SubTab>("grant")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [gifts, setGifts] = useState<UserGiftRow[]>([])

  // Grant form
  const [giftType, setGiftType] = useState<GiftCategory>("free_contract")
  const [reason, setReason] = useState("")
  const [expiresAt, setExpiresAt] = useState("")

  // Type-specific inputs
  const [shareProjectId, setShareProjectId] = useState<string>("")
  const [shareCount, setShareCount] = useState<string>("")
  const [feeUnitsAmount, setFeeUnitsAmount] = useState<string>("")
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])

  // User picker — filter chips + search
  const [userFilter, setUserFilter] = useState<UserPickerFilter>("all")
  const [userSearch, setUserSearch] = useState("")
  const [users, setUsers] = useState<UserPickerRow[]>([])
  const [pickedUserId, setPickedUserId] = useState<string | null>(null)
  const [pickerLoading, setPickerLoading] = useState(false)
  const pickedUser = users.find((u) => u.id === pickedUserId) ?? null

  // Phase 10.59: filter chip clicks should requery instantly (no
  // debounce); only search-text typing is debounced. Otherwise chip
  // clicks feel laggy and the user thinks the filters are broken.
  useEffect(() => {
    let cancelled = false
    setPickerLoading(true)
    // 250ms debounce only kicks in if userSearch is non-empty
    // (typing). Empty search → instant fetch.
    const debounceMs = userSearch.trim().length > 0 ? 250 : 0
    const t = window.setTimeout(() => {
      getUsersForAdminPicker(userFilter, userSearch, 50).then((rows) => {
        if (cancelled) return
        setUsers(rows)
        setPickerLoading(false)
      })
    }, debounceMs)
    return () => { cancelled = true; window.clearTimeout(t) }
  }, [userFilter, userSearch])

  // Load projects once for the "shares" gift type
  useEffect(() => {
    getAllProjects().then((rows) =>
      setProjects(rows.map((p) => ({ id: p.id, name: p.name }))),
    )
  }, [])

  const refresh = useCallback(async () => {
    const all = await getAllUserGifts()
    setGifts(all)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleGrant = async () => {
    if (!pickedUser) {
      showError("اختر مستخدماً")
      return
    }

    // Type-specific validation
    if (giftType === "shares") {
      if (!shareProjectId) return showError("اختر مشروعاً")
      const cnt = Number(shareCount) || 0
      if (cnt <= 0) return showError("عدد الحصص غير صحيح")
    }
    if (giftType === "fee_units") {
      const amt = Number(feeUnitsAmount) || 0
      if (amt <= 0) return showError("كمية الوحدات غير صحيحة")
    }

    setSubmitting(true)

    // Build a metadata-rich reason so the gifts table records the
    // type-specific context (project_id, share_count, fee_units, …).
    let enrichedReason = reason.trim()
    if (giftType === "shares") {
      const proj = projects.find((p) => p.id === shareProjectId)?.name ?? "—"
      const ctxLine = `📈 ${shareCount} حصة من "${proj}"`
      enrichedReason = enrichedReason ? `${ctxLine}\n${enrichedReason}` : ctxLine
    } else if (giftType === "fee_units") {
      const ctxLine = `💎 ${feeUnitsAmount} وحدة رسوم`
      enrichedReason = enrichedReason ? `${ctxLine}\n${enrichedReason}` : ctxLine
    }

    const result = await adminGrantGift({
      user_id: pickedUser.id,
      gift_type: giftType,
      reason: enrichedReason || undefined,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    })
    setSubmitting(false)

    if (!result.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        not_admin: "صلاحياتك لا تسمح",
        cannot_grant_self: "لا يمكنك منح نفسك هدية",
        invalid_gift_type: "نوع الهدية غير صحيح — تأكد من تحديث migration الهدايا",
        user_not_found: "المستخدم غير موجود",
        missing_table: "الجداول غير منشورة بعد",
      }
      showError(map[result.reason ?? ""] ?? "فشل منح الهدية")
      return
    }

    showSuccess(`🎁 تم منح الهدية لـ ${pickedUser.name}`)
    setPickedUserId(null)
    setShareProjectId("")
    setShareCount("")
    setFeeUnitsAmount("")
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
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 max-w-3xl">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-4 h-4 text-purple-400" strokeWidth={2} />
            <div className="text-sm font-bold text-white">منح هدية جديدة</div>
          </div>

          {/* ─── Step 1: Pick a user (with filter chips) ─── */}
          <div className="mb-5">
            <label className="text-xs text-neutral-400 mb-2 block font-bold">1. اختر المستخدم *</label>

            {/* Filter chips */}
            <div className="flex gap-2 mb-2 flex-wrap">
              {FILTER_OPTIONS.map((f) => {
                const Icon = f.icon
                const isActive = userFilter === f.key
                return (
                  <button
                    key={f.key}
                    onClick={() => { setUserFilter(f.key); setPickedUserId(null) }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors",
                      isActive
                        ? "bg-white text-black border-transparent font-bold"
                        : "bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:text-white"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {f.label}
                  </button>
                )
              })}
            </div>

            {/* Search box */}
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setPickedUserId(null) }}
                placeholder="ابحث بالاسم أو username..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
              />
            </div>

            {/* Picked user pill OR list */}
            {pickedUser ? (
              <div className="bg-purple-500/[0.08] border border-purple-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-purple-500/[0.15] border border-purple-500/[0.3] flex items-center justify-center text-xs font-bold text-purple-300 flex-shrink-0">
                    {pickedUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-white font-bold truncate">{pickedUser.name}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      {pickedUser.username && (<span className="font-mono" dir="ltr">@{pickedUser.username} · </span>)}
                      {pickedUser.level} · {pickedUser.days_old} يوم منذ التسجيل
                    </div>
                  </div>
                </div>
                <button onClick={() => setPickedUserId(null)} className="text-neutral-400 hover:text-white p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="text-[10px] text-neutral-500 mb-1.5 flex items-center gap-2">
                  {pickerLoading ? (
                    <span className="text-yellow-400">⏳ جاري الجلب من قاعدة البيانات...</span>
                  ) : (
                    <span>عُثر على <span className="text-white font-bold font-mono">{users.length}</span> مستخدم
                      {userFilter !== "all" && (
                        <span className="text-neutral-600"> · فلتر: {FILTER_OPTIONS.find((f) => f.key === userFilter)?.label}</span>
                      )}
                    </span>
                  )}
                </div>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04] max-h-72 overflow-y-auto">
                {users.length === 0 ? (
                  <div className="text-center py-6 text-xs text-neutral-500">
                    {pickerLoading ? "جاري التحميل..." : "لا يوجد مستخدمون يطابقون الفلتر"}
                  </div>
                ) : (
                  users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setPickedUserId(u.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-right"
                    >
                      <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white font-bold truncate">{u.name}</div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">
                          {u.username && (<span className="font-mono" dir="ltr">@{u.username} · </span>)}
                          {u.level} · {u.days_old} يوم
                          {u.days_since_seen !== null && (<span> · آخر دخول {u.days_since_seen} يوم</span>)}
                        </div>
                      </div>
                    </button>
                  ))
                )}
                </div>
              </>
            )}
          </div>

          {/* ─── Step 2: Pick gift type ─── */}
          <div className="mb-4">
            <label className="text-xs text-neutral-400 mb-2 block font-bold">2. نوع الهدية *</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                { key: "shares" as const, label: "📈 حصص من مشروع", desc: "هدية حصص مباشرة" },
                { key: "fee_units" as const, label: "💎 وحدات رسوم", desc: "وحدات لتغطية الرسوم" },
                { key: "free_contract" as const, label: "🤝 عقد مجاني", desc: "تجاوز رسوم العقد" },
              ]).map((g) => {
                const isActive = giftType === g.key
                return (
                  <button
                    key={g.key}
                    onClick={() => setGiftType(g.key)}
                    className={cn(
                      "p-3 rounded-xl border text-right transition-colors",
                      isActive
                        ? "bg-purple-500/[0.15] border-purple-500/[0.4]"
                        : "bg-white/[0.04] border-white/[0.08] hover:border-white/[0.15]"
                    )}
                  >
                    <div className={cn("text-sm font-bold", isActive ? "text-purple-300" : "text-white")}>
                      {g.label}
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-1">{g.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ─── Step 3: Type-specific inputs ─── */}
          {giftType === "shares" && (
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">المشروع *</label>
                <select
                  value={shareProjectId}
                  onChange={(e) => setShareProjectId(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20"
                >
                  <option value="">— اختر —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">عدد الحصص *</label>
                <input
                  type="number"
                  min={1}
                  value={shareCount}
                  onChange={(e) => setShareCount(e.target.value)}
                  placeholder="مثلاً 100"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20 font-mono"
                />
              </div>
            </div>
          )}

          {giftType === "fee_units" && (
            <div className="mb-4">
              <label className="text-xs text-neutral-400 mb-1.5 block">عدد وحدات الرسوم *</label>
              <input
                type="number"
                min={1}
                value={feeUnitsAmount}
                onChange={(e) => setFeeUnitsAmount(e.target.value)}
                placeholder="مثلاً 5000"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20 font-mono"
              />
            </div>
          )}

          {giftType === "free_contract" && (
            <div className="mb-4 bg-blue-500/[0.05] border border-blue-500/[0.2] rounded-xl p-3 text-[11px] text-blue-300 leading-relaxed">
              💡 العقد المجاني يتجاوز رسوم 10% عند إنهاء العقد. لا يحتاج إعدادات إضافية.
            </div>
          )}

          {/* ─── Step 4: Optional fields ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">تاريخ الانتهاء (اختياري)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">السبب (اختياري)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثلاً: مكافأة على نشاط..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
              />
            </div>
          </div>

          <button
            onClick={handleGrant}
            disabled={!pickedUser || submitting}
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
