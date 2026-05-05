"use client"

/**
 * UsersListPanel — Phase 10.64 redesign.
 *
 * Lists every registered (non-admin) user from `profiles` with:
 *   • Full row data (name, level, KYC, ambassador, rating, last seen,
 *     account state — active / banned / temp-suspended).
 *   • Actions:
 *       - تفاصيل      → opens UserDetailsModal (every joined table)
 *       - 🌟 سفير      → toggles is_ambassador via admin_set_ambassador
 *       - حظر / رفع   → admin_ban_user (with optional duration) /
 *                       admin_unban_user
 *   • Removed: any "promote to admin" action — admins are managed
 *     in the System ▸ Admins panel, not here.
 */

import { useEffect, useMemo, useState, useCallback } from "react"
import { Search, X, Ban, Crown, Star, Clock, AlertTriangle } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  KPI, AdminEmpty, InnerTabBar,
} from "@/components/admin/ui"
import {
  getAllUsersForAdmin,
  isSuperAdminDB,
  adminBanUser,
  adminUnbanUser,
  adminSetAmbassador,
  type AdminUserListRow,
} from "@/lib/data/admin-utilities"
import { UserDetailsModal } from "./UserDetailsModal"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—"
  return iso.slice(0, 10)
}

type LevelTab = "all" | "basic" | "advanced" | "pro" | "elite" | "ambassador" | "banned" | "kyc_pending"

const LEVEL_LABEL: Record<string, { label: string; color: "blue" | "green" | "purple" | "yellow" | "gray" }> = {
  basic:    { label: "أساسي",   color: "gray" },
  advanced: { label: "متقدّم",   color: "blue" },
  pro:      { label: "محترف",   color: "purple" },
  elite:    { label: "نخبة",     color: "yellow" },
}

const KYC_LABEL: Record<string, { label: string; color: "green" | "yellow" | "red" | "gray" }> = {
  approved:      { label: "موثَّق",      color: "green"  },
  pending:       { label: "قيد المراجعة", color: "yellow" },
  rejected:      { label: "مرفوض",       color: "red"    },
  not_submitted: { label: "—",            color: "gray"   },
}

// Predefined ban durations
const BAN_DURATIONS = [
  { key: "1d",  label: "يوم واحد",      hours: 24 },
  { key: "7d",  label: "أسبوع",         hours: 24 * 7 },
  { key: "30d", label: "شهر",            hours: 24 * 30 },
  { key: "perm", label: "دائم",          hours: 0 },
] as const

export function UsersListPanel() {
  const [users, setUsers] = useState<AdminUserListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<LevelTab>("all")
  const [search, setSearch] = useState("")
  const [isSuper, setIsSuper] = useState(false)

  // Modals
  const [detailsUserId, setDetailsUserId] = useState<string | null>(null)
  const [banTarget, setBanTarget] = useState<AdminUserListRow | null>(null)
  const [banReason, setBanReason] = useState("")
  const [banDuration, setBanDuration] = useState<typeof BAN_DURATIONS[number]["key"]>("7d")
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [rows, sup] = await Promise.all([
      getAllUsersForAdmin(500),
      isSuperAdminDB(),
    ])
    // Hide admin/super_admin accounts here — those are managed in
    // the System ▸ Admins panel.
    setUsers(rows.filter((u) => !u.is_admin))
    setIsSuper(sup)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const stats = useMemo(() => {
    const now = Date.now()
    return {
      total:        users.length,
      verified:     users.filter((u) => u.kyc_status === "approved").length,
      pending:      users.filter((u) => u.kyc_status === "pending").length,
      ambassadors:  users.filter((u) => u.is_ambassador).length,
      banned:       users.filter((u) => u.is_banned).length,
      new30d:       users.filter((u) => {
        const days = (now - new Date(u.created_at).getTime()) / 86_400_000
        return days <= 30
      }).length,
    }
  }, [users])

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (tab === "kyc_pending" && u.kyc_status !== "pending") return false
      if (tab === "ambassador" && !u.is_ambassador) return false
      if (tab === "banned" && !u.is_banned) return false
      if (tab !== "all" && tab !== "kyc_pending" && tab !== "ambassador" && tab !== "banned"
          && u.level !== tab) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = (
          (u.full_name || "") + " " +
          (u.username || "") + " " +
          (u.phone || "") + " " +
          (u.email || "")
        ).toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [users, tab, search])

  // ─── Actions ───────────────────────────────────────────────────
  const toggleAmbassador = async (u: AdminUserListRow) => {
    if (!isSuper) return showError("فقط المسؤول الأعلى يستطيع تعيين السفراء")
    const enable = !u.is_ambassador
    const ok = window.confirm(
      enable
        ? `تعيين ${u.full_name} سفيراً؟ سيستلم 1% من رسوم إحالاته.`
        : `إلغاء تعيين ${u.full_name} كسفير؟`,
    )
    if (!ok) return
    setSubmitting(true)
    const r = await adminSetAmbassador(u.id, enable)
    setSubmitting(false)
    if (!r.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        not_super_admin: "صلاحياتك لا تسمح",
      }
      return showError(map[r.reason ?? ""] ?? "فشل التحديث")
    }
    showSuccess(enable ? `🌟 ${u.full_name} أصبح سفيراً` : `تم إلغاء تعيين ${u.full_name}`)
    refresh()
  }

  const handleBanSubmit = async () => {
    if (!banTarget) return
    const dur = BAN_DURATIONS.find((d) => d.key === banDuration)!
    const until = dur.hours > 0
      ? new Date(Date.now() + dur.hours * 3600 * 1000)
      : null  // permanent
    setSubmitting(true)
    const r = await adminBanUser(banTarget.id, banReason || null, until)
    setSubmitting(false)
    if (!r.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        not_admin: "صلاحياتك لا تسمح",
        cannot_ban_self: "لا يمكنك حظر نفسك",
        cannot_ban_admin: "لا يمكن حظر أدمن — أزل دور الإدارة أولاً",
        not_found: "المستخدم غير موجود",
      }
      return showError(map[r.reason ?? ""] ?? "فشل الحظر")
    }
    showSuccess(
      until
        ? `🔒 تم حظر ${banTarget.full_name} حتى ${until.toISOString().slice(0, 10)}`
        : `🔒 تم حظر ${banTarget.full_name} نهائياً`,
    )
    setBanTarget(null)
    setBanReason("")
    setBanDuration("7d")
    refresh()
  }

  const unban = async (u: AdminUserListRow) => {
    const ok = window.confirm(`رفع الحظر عن ${u.full_name}؟`)
    if (!ok) return
    setSubmitting(true)
    const r = await adminUnbanUser(u.id)
    setSubmitting(false)
    if (!r.success) return showError("فشل رفع الحظر")
    showSuccess(`✓ تم رفع الحظر عن ${u.full_name}`)
    refresh()
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <div className="flex justify-between items-start mb-4 gap-3">
        <div>
          <div className="text-lg font-bold text-white">⊙ المستخدمون المسجَّلون</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            مستخدمو التطبيق فقط — تفاصيل كاملة + إدارة الحظر والسفراء
          </div>
        </div>
        <ActionBtn label="🔄 تحديث" color="gray" sm onClick={refresh} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
        <KPI label="الإجمالي" val={fmtNum(stats.total)} color="#fff" />
        <KPI label="موثَّقون" val={fmtNum(stats.verified)} color="#4ADE80" />
        <KPI label="KYC معلّق" val={fmtNum(stats.pending)} color="#FBBF24" />
        <KPI label="السفراء" val={fmtNum(stats.ambassadors)} color="#22d3ee" />
        <KPI
          label="محظورون"
          val={fmtNum(stats.banned)}
          color="#F87171"
          accent={stats.banned > 0 ? "rgba(248,113,113,0.05)" : undefined}
        />
        <KPI label="جدد (30 يوم)" val={fmtNum(stats.new30d)} color="#60A5FA" />
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث (اسم / username / هاتف / بريد)..."
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      <InnerTabBar
        tabs={[
          { key: "all", label: "الكل", count: users.length },
          { key: "ambassador", label: "🌟 سفراء", count: stats.ambassadors },
          { key: "banned", label: "🔒 محظورون", count: stats.banned },
          { key: "kyc_pending", label: "KYC معلّق", count: stats.pending },
          { key: "basic", label: "أساسي", count: users.filter((u) => u.level === "basic").length },
          { key: "advanced", label: "متقدّم", count: users.filter((u) => u.level === "advanced").length },
          { key: "pro", label: "محترف", count: users.filter((u) => u.level === "pro").length },
          { key: "elite", label: "نخبة", count: users.filter((u) => u.level === "elite").length },
        ]}
        active={tab}
        onSelect={(k) => setTab(k as LevelTab)}
      />

      {loading ? (
        <AdminEmpty title="جاري التحميل..." />
      ) : filtered.length === 0 ? (
        <AdminEmpty
          title="لا يوجد مستخدمون"
          body={
            users.length === 0
              ? "لا توجد سجلات في `profiles` بعد — أو RLS يحجب القراءة."
              : "لا تطابق نتائج للفلتر/البحث الحالي."
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>المستخدم</TH>
            <TH>المستوى</TH>
            <TH>KYC</TH>
            <TH>سفير</TH>
            <TH>الصفقات</TH>
            <TH>الاستثمار</TH>
            <TH>التقييم</TH>
            <TH>الحالة</TH>
            <TH>تسجيل</TH>
            <TH>إجراءات</TH>
          </THead>
          <TBody>
            {filtered.map((u) => {
              const level = LEVEL_LABEL[u.level] ?? LEVEL_LABEL.basic
              const kyc = KYC_LABEL[u.kyc_status] ?? KYC_LABEL.not_submitted
              const isTempBanned = u.banned_until && new Date(u.banned_until) > new Date()
              return (
                <TR key={u.id}>
                  {/* User cell */}
                  <TD>
                    <div className="min-w-0">
                      <div className="text-xs text-white font-bold truncate">
                        {u.full_name}
                        {u.is_ambassador && (
                          <span className="text-[10px] text-cyan-400 mx-1.5">🌟</span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-500" dir="ltr">
                        @{u.username || "—"} · {u.email || u.phone || "—"}
                      </div>
                    </div>
                  </TD>

                  {/* Level */}
                  <TD><Badge label={level.label} color={level.color} /></TD>

                  {/* KYC */}
                  <TD><Badge label={kyc.label} color={kyc.color} /></TD>

                  {/* Ambassador */}
                  <TD>
                    {u.is_ambassador ? (
                      <Badge label="✓" color="green" />
                    ) : (
                      <span className="text-neutral-600 text-[10px]">—</span>
                    )}
                  </TD>

                  {/* Trades */}
                  <TD>
                    <span className="font-mono text-xs text-blue-400">
                      {fmtNum(u.trades_completed)}
                    </span>
                  </TD>

                  {/* Total invested */}
                  <TD>
                    <span className="font-mono text-xs text-yellow-400">
                      {u.total_invested > 0 ? fmtNum(u.total_invested) : "—"}
                    </span>
                  </TD>

                  {/* Rating */}
                  <TD>
                    {u.rating_count > 0 ? (
                      <span className="text-[11px] text-yellow-300 font-mono">
                        ⭐ {Number(u.rating_average).toFixed(1)} ({u.rating_count})
                      </span>
                    ) : (
                      <span className="text-neutral-600 text-[10px]">—</span>
                    )}
                  </TD>

                  {/* State */}
                  <TD>
                    {u.is_banned ? (
                      <Badge
                        label={isTempBanned ? `🔒 حتى ${fmtDate(u.banned_until)}` : "🔒 محظور"}
                        color="red"
                      />
                    ) : (
                      <Badge label="نشط" color="green" />
                    )}
                  </TD>

                  {/* Created */}
                  <TD>
                    <span className="text-[11px] text-neutral-500" dir="ltr">
                      {fmtDate(u.created_at)}
                    </span>
                  </TD>

                  {/* Actions */}
                  <TD>
                    <div className="flex gap-1.5 flex-wrap">
                      <ActionBtn
                        label="تفاصيل"
                        color="blue"
                        sm
                        onClick={() => setDetailsUserId(u.id)}
                      />
                      {isSuper && (
                        <ActionBtn
                          label={u.is_ambassador ? "إلغاء سفير" : "🌟 سفير"}
                          color={u.is_ambassador ? "gray" : "green"}
                          sm
                          onClick={() => toggleAmbassador(u)}
                        />
                      )}
                      {u.is_banned ? (
                        <ActionBtn
                          label="رفع الحظر"
                          color="green"
                          sm
                          onClick={() => unban(u)}
                        />
                      ) : (
                        <ActionBtn
                          label="🔒 حظر"
                          color="red"
                          sm
                          onClick={() => { setBanTarget(u); setBanReason(""); setBanDuration("7d") }}
                        />
                      )}
                    </div>
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {/* ═══ User details modal ═══ */}
      {detailsUserId && (
        <UserDetailsModal
          userId={detailsUserId}
          onClose={() => setDetailsUserId(null)}
        />
      )}

      {/* ═══ Ban modal ═══ */}
      {banTarget && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !submitting && setBanTarget(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-red-500/[0.3] rounded-2xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/[0.1] border border-red-500/[0.3] flex items-center justify-center flex-shrink-0">
                <Ban className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1">
                <div className="text-base font-bold text-red-400 mb-1">
                  حظر / إيقاف مؤقّت
                </div>
                <div className="text-xs text-neutral-400">
                  {banTarget.full_name}
                  <span className="text-neutral-600 mx-1">·</span>
                  <span dir="ltr">{banTarget.email || banTarget.phone || "—"}</span>
                </div>
              </div>
              <button
                onClick={() => !submitting && setBanTarget(null)}
                className="text-neutral-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Duration picker */}
            <label className="text-xs text-neutral-400 mb-2 block font-bold">
              مدة الحظر
            </label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {BAN_DURATIONS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => setBanDuration(d.key)}
                  className={cn(
                    "px-3 py-2 rounded-xl border text-xs transition-colors flex items-center justify-center gap-1.5",
                    banDuration === d.key
                      ? "bg-red-500/[0.15] border-red-500/[0.4] text-red-300 font-bold"
                      : "bg-white/[0.04] border-white/[0.06] text-neutral-400 hover:text-white",
                  )}
                >
                  {d.key === "perm" ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  {d.label}
                </button>
              ))}
            </div>

            {/* Reason */}
            <label className="text-xs text-neutral-400 mb-2 block font-bold">
              السبب (اختياري — يظهر للمستخدم)
            </label>
            <textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              rows={3}
              placeholder="مثلاً: مخالفة شروط الاستخدام..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder:text-neutral-600 outline-none resize-none mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => !submitting && setBanTarget(null)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleBanSubmit}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50"
              >
                {submitting ? "جاري..." : "تأكيد الحظر"}
              </button>
            </div>

            <div className="text-[10px] text-neutral-500 mt-3 leading-relaxed">
              <Crown className="inline w-3 h-3 mr-1" />
              الحظر يضع <span className="font-mono text-white">is_banned = TRUE</span> + يسجّل في
              <span className="font-mono text-white"> audit_log</span>. للحظر المؤقّت يُسجَّل تاريخ الانتهاء في
              <span className="font-mono text-white"> banned_until</span>.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
