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

import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { Search, ChevronDown } from "lucide-react"
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
  adminSetUserLevel,
  adminSetUserKyc,
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

export function UsersListPanel() {
  const [users, setUsers] = useState<AdminUserListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<LevelTab>("all")
  const [search, setSearch] = useState("")
  const [isSuper, setIsSuper] = useState(false)

  // Modals
  const [detailsUserId, setDetailsUserId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Phase 10.98 — per-row dropdown menus (level + ban). Single key
  // tracks which row (and which menu) is open; click anywhere else closes.
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!openMenu) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [openMenu])

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

  // ─── Phase 10.98 actions ───────────────────────────────────────
  const setUserLevel = async (
    u: AdminUserListRow,
    level: "basic" | "advanced" | "pro" | "elite",
  ) => {
    if (!isSuper) return showError("فقط Super Admin يستطيع تعديل المستوى")
    if (level === u.level) return setOpenMenu(null)
    setOpenMenu(null)
    setSubmitting(true)
    const r = await adminSetUserLevel(u.id, level)
    setSubmitting(false)
    if (!r.success) {
      const map: Record<string, string> = {
        super_admin_only: "هذا الإجراء يتطلب Super Admin",
        invalid_level: "مستوى غير صالح",
        user_not_found: "المستخدم غير موجود",
        missing_table: "طبّق Migration 10.99 أولاً في Supabase SQL Editor",
        update_failed: "فشل التحديث في قاعدة البيانات — طبّق Migration 10.99 (يضيف عمود level)",
        unknown: "خطأ في الاتصال — حاول مرة أخرى",
      }
      // eslint-disable-next-line no-console
      console.warn("[setUserLevel] failure:", r)
      return showError(
        map[r.reason ?? ""] ??
          `فشل تحديث المستوى${r.error ? ` (${r.error})` : ""}`
      )
    }
    showSuccess(`📊 تم تحديث مستوى ${u.full_name} إلى ${LEVEL_LABEL[level]?.label ?? level}`)
    refresh()
  }

  const verifyUserKyc = async (u: AdminUserListRow) => {
    const isVerified = u.kyc_status === "approved"
    const newStatus = isVerified ? "not_submitted" : "approved"
    const ok = window.confirm(
      isVerified
        ? `إلغاء توثيق ${u.full_name}؟`
        : `توثيق ${u.full_name} مباشرةً (قبول KYC)؟`,
    )
    if (!ok) return
    setSubmitting(true)
    const r = await adminSetUserKyc(u.id, newStatus)
    setSubmitting(false)
    if (!r.success) {
      const map: Record<string, string> = {
        not_admin: "صلاحياتك لا تسمح",
        invalid_status: "حالة غير صالحة",
        missing_table: "طبّق Migration 10.98 أولاً",
      }
      return showError(map[r.reason ?? ""] ?? "فشل التحديث")
    }
    showSuccess(
      isVerified
        ? `✓ تم إلغاء توثيق ${u.full_name}`
        : `✅ تم توثيق ${u.full_name}`,
    )
    refresh()
  }

  const banWithDays = async (u: AdminUserListRow, days: number | null) => {
    setOpenMenu(null)
    if (days !== null && days <= 0) return
    const until = days !== null
      ? new Date(Date.now() + days * 24 * 3600 * 1000)
      : null  // null = permanent
    const reason = window.prompt(
      days === null
        ? `حظر ${u.full_name} نهائياً — السبب (اختياري):`
        : `حظر ${u.full_name} لمدة ${days} يوم — السبب (اختياري):`,
      "",
    )
    if (reason === null) return  // user cancelled the prompt
    setSubmitting(true)
    const r = await adminBanUser(u.id, reason || null, until)
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
        ? `🔒 تم حظر ${u.full_name} حتى ${until.toISOString().slice(0, 10)}`
        : `🔒 تم حظر ${u.full_name} نهائياً`,
    )
    refresh()
  }

  const banWithCustomDays = (u: AdminUserListRow) => {
    setOpenMenu(null)
    const input = window.prompt(`عدد أيام الحظر المؤقت لـ ${u.full_name}:`, "7")
    if (!input) return
    const days = parseInt(input.trim(), 10)
    if (isNaN(days) || days <= 0 || days > 3650) {
      return showError("عدد أيام غير صالح (1 إلى 3650)")
    }
    void banWithDays(u, days)
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
                    <div className="flex gap-1.5 flex-wrap items-center">
                      <ActionBtn
                        label="تفاصيل"
                        color="blue"
                        sm
                        onClick={() => setDetailsUserId(u.id)}
                      />

                      {/* Phase 10.98 — Verify (KYC) button */}
                      <ActionBtn
                        label={u.kyc_status === "approved" ? "✓ موثَّق" : "🛡️ توثيق"}
                        color={u.kyc_status === "approved" ? "gray" : "green"}
                        sm
                        onClick={() => verifyUserKyc(u)}
                      />

                      {/* Phase 10.98 — Level dropdown (super_admin only) */}
                      {isSuper && (
                        <div className="relative inline-block" ref={openMenu === `level-${u.id}` ? menuRef : null}>
                          <button
                            onClick={() => setOpenMenu(openMenu === `level-${u.id}` ? null : `level-${u.id}`)}
                            className="px-2 py-1 text-[11px] rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 flex items-center gap-1"
                          >
                            📊 المستوى <ChevronDown className="w-3 h-3" />
                          </button>
                          {openMenu === `level-${u.id}` && (
                            <div className="absolute z-50 mt-1 right-0 bg-[#0a0a0a] border border-white/[0.1] rounded-lg shadow-xl py-1 min-w-[140px]">
                              {(["basic", "advanced", "pro", "elite"] as const).map((lvl) => {
                                const info = LEVEL_LABEL[lvl]
                                const isCurrent = u.level === lvl
                                return (
                                  <button
                                    key={lvl}
                                    onClick={() => setUserLevel(u, lvl)}
                                    disabled={isCurrent}
                                    className={cn(
                                      "w-full text-right px-3 py-1.5 text-[11px] flex items-center justify-between gap-2 hover:bg-white/[0.05] transition-colors",
                                      isCurrent && "opacity-50 cursor-default"
                                    )}
                                  >
                                    <span className="text-white">{info.label}</span>
                                    {isCurrent && <span className="text-green-400 text-[10px]">✓ حالي</span>}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {isSuper && (
                        <ActionBtn
                          label={u.is_ambassador ? "إلغاء سفير" : "🌟 سفير"}
                          color={u.is_ambassador ? "gray" : "green"}
                          sm
                          onClick={() => toggleAmbassador(u)}
                        />
                      )}

                      {/* Phase 10.98 — Ban dropdown (temp days / permanent) */}
                      {u.is_banned ? (
                        <ActionBtn
                          label="رفع الحظر"
                          color="green"
                          sm
                          onClick={() => unban(u)}
                        />
                      ) : (
                        <div className="relative inline-block" ref={openMenu === `ban-${u.id}` ? menuRef : null}>
                          <button
                            onClick={() => setOpenMenu(openMenu === `ban-${u.id}` ? null : `ban-${u.id}`)}
                            className="px-2 py-1 text-[11px] rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 flex items-center gap-1"
                          >
                            🔒 حظر <ChevronDown className="w-3 h-3" />
                          </button>
                          {openMenu === `ban-${u.id}` && (
                            <div className="absolute z-50 mt-1 right-0 bg-[#0a0a0a] border border-white/[0.1] rounded-lg shadow-xl py-1 min-w-[180px]">
                              <div className="px-3 py-1 text-[10px] text-neutral-500 border-b border-white/[0.05]">
                                حظر مؤقت
                              </div>
                              {[
                                { days: 1,   label: "يوم واحد" },
                                { days: 7,   label: "أسبوع" },
                                { days: 14,  label: "أسبوعان" },
                                { days: 30,  label: "شهر" },
                                { days: 90,  label: "3 أشهر" },
                              ].map((opt) => (
                                <button
                                  key={opt.days}
                                  onClick={() => banWithDays(u, opt.days)}
                                  className="w-full text-right px-3 py-1.5 text-[11px] text-white hover:bg-white/[0.05] transition-colors"
                                >
                                  {opt.label} <span className="text-neutral-500">({opt.days} يوم)</span>
                                </button>
                              ))}
                              <button
                                onClick={() => banWithCustomDays(u)}
                                className="w-full text-right px-3 py-1.5 text-[11px] text-blue-400 hover:bg-white/[0.05] transition-colors border-t border-white/[0.05]"
                              >
                                ✏️ مدة مخصصة...
                              </button>
                              <div className="border-t border-white/[0.05]" />
                              <button
                                onClick={() => banWithDays(u, null)}
                                className="w-full text-right px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-400/[0.08] transition-colors font-bold"
                              >
                                🚫 حظر نهائي (دائم)
                              </button>
                            </div>
                          )}
                        </div>
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

    </div>
  )
}
