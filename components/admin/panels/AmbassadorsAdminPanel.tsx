"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Search, X, ExternalLink } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  MOCK_AMBASSADORS_ADMIN,
  MOCK_AMBASSADOR_REWARDS_ADMIN,
  AMBASSADOR_STATUS_LABELS,
  REWARD_TYPE_LABELS,
  REWARD_STATUS_LABELS,
  SOCIAL_PLATFORM_ICONS,
  type AmbassadorAdmin,
  type AmbassadorRewardAdmin,
} from "@/lib/mock-data/ambassadors"
import {
  getAmbassadorsAdmin,
  getAmbassadorRewardsAdmin,
  approveAmbassador,
  rejectAmbassador,
  suspendAmbassador,
  reactivateAmbassador,
  terminateAmbassador,
} from "@/lib/data/ambassadors-admin"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type SubTab = "list" | "rewards"
type ActionMode = null | "approve" | "reject" | "suspend" | "reactivate" | "terminate"

const LEVEL_LABELS: Record<AmbassadorAdmin["user_level"], { label: string; icon: string }> = {
  basic: { label: "مبتدئ", icon: "🌱" },
  advanced: { label: "متقدّم", icon: "⭐" },
  pro: { label: "محترف", icon: "👑" },
}

/** Per-list stats — replaces getAmbassadorsAdminStats. */
function computeStats(list: AmbassadorAdmin[]) {
  let pending = 0, active = 0, suspended = 0, rejected = 0
  let totalReferrals = 0, totalRewards = 0
  for (const a of list) {
    if (a.application_status === "pending") pending++
    else if (a.application_status === "approved" && a.is_active) active++
    else if (a.application_status === "suspended") suspended++
    else if (a.application_status === "rejected") rejected++
    totalReferrals += a.total_referrals
    totalRewards += a.total_rewards_earned
  }
  return { pending, active, suspended, rejected, total: list.length, total_referrals: totalReferrals, total_rewards: totalRewards }
}

function computeRewardStats(rewards: AmbassadorRewardAdmin[]) {
  let paid = 0, pending = 0, total = 0
  for (const r of rewards) {
    total += r.amount
    if (r.status === "paid") paid += r.amount
    else if (r.status === "pending") pending += r.amount
  }
  return { paid, pending, total }
}

export function AmbassadorsAdminPanel() {
  const [tab, setTab] = useState<SubTab>("list")

  // Tab 1 state — default "all" so a fresh DB row is visible no matter
  // what status mapping it has.
  const [filter, setFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [levelFilter, setLevelFilter] = useState<string>("all")
  const [selected, setSelected] = useState<AmbassadorAdmin | null>(null)
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Tab 2 state
  const [rewardType, setRewardType] = useState<string>("all")
  const [rewardStatus, setRewardStatus] = useState<string>("all")

  // Production mode — DB only.
  const [ambassadors, setAmbassadors] = useState<AmbassadorAdmin[]>([])
  const [rewards, setRewards] = useState<AmbassadorRewardAdmin[]>([])

  const refresh = useCallback(async () => {
    const [amb, rw] = await Promise.all([
      getAmbassadorsAdmin(500),
      getAmbassadorRewardsAdmin(500),
    ])
    setAmbassadors(amb)
    setRewards(rw)
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getAmbassadorsAdmin(500),
      getAmbassadorRewardsAdmin(500),
    ]).then(([amb, rw]) => {
      if (cancelled) return
      setAmbassadors(amb)
      setRewards(rw)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => computeStats(ambassadors), [ambassadors])
  const rewardStats = useMemo(() => computeRewardStats(rewards), [rewards])

  const tabs = [
    { key: "list", label: "👥 السفراء + الطلبات", count: ambassadors.length },
    { key: "rewards", label: "🏆 المكافآت", count: rewards.length },
  ]

  const listFilterTabs = [
    { key: "all", label: "الكل", count: stats.total },
    { key: "pending", label: "بانتظار", count: stats.pending },
    { key: "approved", label: "مفعّلون", count: stats.active },
    { key: "suspended", label: "مُوقَفون", count: stats.suspended },
    { key: "rejected", label: "مرفوضون", count: stats.rejected },
  ]

  const filteredAmbassadors = ambassadors
    .filter((a) => filter === "all" || a.application_status === filter)
    .filter((a) => levelFilter === "all" || a.user_level === levelFilter)
    .filter((a) =>
      !search ||
      a.user_name.includes(search) ||
      a.user_email.toLowerCase().includes(search.toLowerCase())
    )

  const filteredRewards = rewards
    .filter((r) => rewardType === "all" || r.type === rewardType)
    .filter((r) => rewardStatus === "all" || r.status === rewardStatus)

  const closeAll = () => {
    setSelected(null)
    setActionMode(null)
    setReason("")
  }

  const handleAction = async () => {
    if (!selected || !actionMode || submitting) return
    if (
      (actionMode === "reject" || actionMode === "suspend" || actionMode === "terminate") &&
      !reason.trim()
    ) {
      showError("سبب الإجراء مطلوب")
      return
    }

    setSubmitting(true)
    try {
      const result = await (
        actionMode === "approve"    ? approveAmbassador(selected.id) :
        actionMode === "reject"     ? rejectAmbassador(selected.id, reason) :
        actionMode === "suspend"    ? suspendAmbassador(selected.id, reason) :
        actionMode === "reactivate" ? reactivateAmbassador(selected.id) :
        terminateAmbassador(selected.id, reason)
      )

      if (!result.success) {
        showError(result.error || "تعذّر تنفيذ الإجراء")
        return
      }

      const labels: Record<Exclude<ActionMode, null>, string> = {
        approve: `✅ تم تفعيل ${selected.user_name} كسفير + توليد رابط الإحالة`,
        reject: "❌ تم رفض الطلب + إرسال السبب للمستخدم",
        suspend: `⏸️ تم إيقاف ${selected.user_name} مؤقّتاً + إيقاف العائدات`,
        reactivate: `▶️ تم إعادة تفعيل ${selected.user_name}`,
        terminate: "🚫 تم إنهاء العضوية نهائياً",
      }
      showSuccess(labels[actionMode])
      await refresh()
      closeAll()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="🌟 السفراء"
        subtitle="إدارة برنامج السفراء وطلبات الانضمام والمكافآت"
      />

      {/* Top KPIs (always visible) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="بانتظار" val={stats.pending} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
        <KPI label="نشطون" val={stats.active} color="#4ADE80" />
        <KPI label="إجمالي الإحالات" val={fmtNum(stats.total_referrals)} color="#60A5FA" />
        <KPI label="إجمالي المكافآت" val={fmtNum(stats.total_rewards)} color="#a855f7" />
      </div>

      <InnerTabBar tabs={tabs} active={tab} onSelect={(k) => setTab(k as SubTab)} />

      {/* ═══════════ TAB 1: LIST ═══════════ */}
      {tab === "list" && (
        <>
          {/* Filters */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-3">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث (اسم/بريد)..."
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
              />
            </div>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
            >
              <option value="all">كل المستويات</option>
              <option value="basic">🌱 مبتدئ</option>
              <option value="advanced">⭐ متقدّم</option>
              <option value="pro">👑 محترف</option>
            </select>
          </div>

          <InnerTabBar tabs={listFilterTabs} active={filter} onSelect={setFilter} />

          {filteredAmbassadors.length === 0 ? (
            <AdminEmpty title="لا يوجد سفراء" body="جرّب تعديل الفلترة" />
          ) : (
            <Table>
              <THead>
                <TH>المستخدم</TH>
                <TH>المستوى</TH>
                <TH>الحالة</TH>
                <TH>الإحالات</TH>
                <TH>المكافآت</TH>
                <TH>تاريخ التقديم</TH>
                <TH>إجراءات</TH>
              </THead>
              <TBody>
                {filteredAmbassadors.map((a) => {
                  const lvl = LEVEL_LABELS[a.user_level]
                  const st = AMBASSADOR_STATUS_LABELS[a.application_status]
                  return (
                    <TR key={a.id}>
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-purple-400/[0.15] border border-purple-400/[0.3] flex items-center justify-center text-xs font-bold text-purple-300">
                            {a.user_name[0]}
                          </div>
                          <div>
                            <div className="text-xs text-white font-bold">{a.user_name}</div>
                            <div className="text-[10px] text-neutral-500" dir="ltr">{a.user_email}</div>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <span className="text-[11px] flex items-center gap-1">
                          <span>{lvl.icon}</span>
                          <span>{lvl.label}</span>
                        </span>
                      </TD>
                      <TD><Badge label={st.label} color={st.color} /></TD>
                      <TD><span className="font-mono text-blue-400">{fmtNum(a.total_referrals)}</span></TD>
                      <TD><span className="font-mono text-green-400">{fmtNum(a.total_rewards_earned)}</span></TD>
                      <TD><span className="text-[11px] text-neutral-500">{a.applied_at}</span></TD>
                      <TD>
                        <ActionBtn
                          label={a.application_status === "pending" ? "مراجعة" : "عرض"}
                          color={a.application_status === "pending" ? "blue" : "gray"}
                          sm
                          onClick={() => setSelected(a)}
                        />
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          )}
        </>
      )}

      {/* ═══════════ TAB 2: REWARDS ═══════════ */}
      {tab === "rewards" && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <KPI label="مدفوعة" val={fmtNum(rewardStats.paid)} color="#4ADE80" />
            <KPI label="معلّقة" val={fmtNum(rewardStats.pending)} color="#FBBF24" />
            <KPI label="إجمالي" val={fmtNum(rewardStats.total)} color="#a855f7" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-3">
            <select
              value={rewardType}
              onChange={(e) => setRewardType(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
            >
              <option value="all">كل الأنواع</option>
              {Object.entries(REWARD_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
            <select
              value={rewardStatus}
              onChange={(e) => setRewardStatus(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
            >
              <option value="all">كل الحالات</option>
              <option value="paid">مدفوعة</option>
              <option value="pending">معلّقة</option>
            </select>
          </div>

          {filteredRewards.length === 0 ? (
            <AdminEmpty title="لا توجد مكافآت" body="جرّب تعديل الفلترة" />
          ) : (
            <Table>
              <THead>
                <TH>السفير</TH>
                <TH>النوع</TH>
                <TH>المبلغ</TH>
                <TH>المُحال</TH>
                <TH>الحالة</TH>
                <TH>تاريخ المنح</TH>
                <TH>تاريخ الدفع</TH>
              </THead>
              <TBody>
                {filteredRewards.map((r) => {
                  const tpe = REWARD_TYPE_LABELS[r.type]
                  const st = REWARD_STATUS_LABELS[r.status]
                  return (
                    <TR key={r.id}>
                      <TD>{r.ambassador_name}</TD>
                      <TD>
                        <span className="text-[11px] flex items-center gap-1">
                          <span>{tpe.icon}</span>
                          <span>{tpe.label}</span>
                        </span>
                      </TD>
                      <TD><span className="font-mono text-green-400 font-bold">{fmtNum(r.amount)}</span></TD>
                      <TD>
                        {r.related_user_name || <span className="text-neutral-600">—</span>}
                      </TD>
                      <TD><Badge label={st.label} color={st.color} /></TD>
                      <TD><span className="text-[11px] text-neutral-500">{r.awarded_at}</span></TD>
                      <TD><span className="text-[11px] text-neutral-500">{r.paid_at || "—"}</span></TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          )}
        </>
      )}

      {/* ═══════════ DETAIL MODAL ═══════════ */}
      {selected && !actionMode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-400/[0.15] border border-purple-400/[0.3] flex items-center justify-center text-base font-bold text-purple-300">
                  {selected.user_name[0]}
                </div>
                <div>
                  <div className="text-base font-bold text-white">{selected.user_name}</div>
                  <div className="text-xs text-neutral-500" dir="ltr">{selected.user_email}</div>
                </div>
              </div>
              <button onClick={closeAll} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <Badge
                label={`${LEVEL_LABELS[selected.user_level].icon} ${LEVEL_LABELS[selected.user_level].label}`}
                color={selected.user_level === "pro" ? "purple" : selected.user_level === "advanced" ? "blue" : "gray"}
              />
              <Badge
                label={AMBASSADOR_STATUS_LABELS[selected.application_status].label}
                color={AMBASSADOR_STATUS_LABELS[selected.application_status].color}
              />
            </div>

            {/* Application details */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="text-[11px] font-bold text-neutral-400 mb-3">📋 تفاصيل الطلب</div>
              <div className="mb-3">
                <div className="text-[10px] text-neutral-500 mb-1">سبب التقدّم</div>
                <div className="text-xs text-neutral-200 leading-relaxed">{selected.application_reason}</div>
              </div>
              <div className="mb-3">
                <div className="text-[10px] text-neutral-500 mb-1">الخبرة</div>
                <div className="text-xs text-neutral-200 leading-relaxed">{selected.experience}</div>
              </div>
              {selected.social_media_links.length > 0 && (
                <div>
                  <div className="text-[10px] text-neutral-500 mb-2">حسابات التواصل</div>
                  <div className="flex flex-wrap gap-2">
                    {selected.social_media_links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11px] text-neutral-300 transition-colors"
                      >
                        <span>{SOCIAL_PLATFORM_ICONS[link.platform]}</span>
                        <span className="font-mono" dir="ltr">{link.platform}</span>
                        <ExternalLink className="w-3 h-3 text-neutral-500" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Stats (if approved/active) */}
            {(selected.application_status === "approved" || selected.application_status === "suspended") && (
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
                <div className="text-[11px] font-bold text-neutral-400 mb-3">📊 الإحصائيات</div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="bg-white/[0.04] rounded-lg p-2.5 text-center">
                    <div className="text-[10px] text-neutral-500 mb-1">إحالات</div>
                    <div className="text-base font-bold text-blue-400 font-mono">{fmtNum(selected.total_referrals)}</div>
                  </div>
                  <div className="bg-white/[0.04] rounded-lg p-2.5 text-center">
                    <div className="text-[10px] text-neutral-500 mb-1">تسجيلات</div>
                    <div className="text-base font-bold text-blue-400 font-mono">{fmtNum(selected.total_signups)}</div>
                  </div>
                  <div className="bg-white/[0.04] rounded-lg p-2.5 text-center">
                    <div className="text-[10px] text-neutral-500 mb-1">صفقات أولى</div>
                    <div className="text-base font-bold text-green-400 font-mono">{fmtNum(selected.total_first_trades)}</div>
                  </div>
                  <div className="bg-white/[0.04] rounded-lg p-2.5 text-center">
                    <div className="text-[10px] text-neutral-500 mb-1">مكافآت</div>
                    <div className="text-base font-bold text-purple-400 font-mono">{fmtNum(selected.total_rewards_earned)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Reasons */}
            {selected.rejection_reason && (
              <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-xl p-3 mb-4">
                <div className="text-[11px] text-red-400 font-bold mb-1">سبب الرفض:</div>
                <div className="text-xs text-neutral-300">{selected.rejection_reason}</div>
              </div>
            )}
            {selected.suspension_reason && (
              <div className="bg-orange-400/[0.05] border border-orange-400/[0.2] rounded-xl p-3 mb-4">
                <div className="text-[11px] text-orange-400 font-bold mb-1">سبب الإيقاف:</div>
                <div className="text-xs text-neutral-300">{selected.suspension_reason}</div>
                <div className="text-[10px] text-neutral-500 mt-1">في {selected.suspended_at}</div>
              </div>
            )}

            {/* Footer actions */}
            {selected.application_status === "pending" && (
              <div className="grid grid-cols-2 gap-2">
                <ActionBtn label="✅ موافقة" color="green" onClick={() => setActionMode("approve")} />
                <ActionBtn label="❌ رفض" color="red" onClick={() => setActionMode("reject")} />
              </div>
            )}
            {selected.application_status === "approved" && selected.is_active && (
              <ActionBtn label="⏸️ إيقاف مؤقّت" color="yellow" onClick={() => setActionMode("suspend")} />
            )}
            {selected.application_status === "suspended" && (
              <div className="grid grid-cols-2 gap-2">
                <ActionBtn label="▶️ إعادة تفعيل" color="green" onClick={() => setActionMode("reactivate")} />
                <ActionBtn label="🚫 إنهاء نهائي" color="red" onClick={() => setActionMode("terminate")} />
              </div>
            )}
            {(selected.application_status === "rejected") && (
              <button
                onClick={closeAll}
                className="w-full py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إغلاق
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ CONFIRM MODAL ═══════════ */}
      {selected && actionMode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">
                {actionMode === "approve" && "✅ تفعيل سفير"}
                {actionMode === "reject" && "❌ رفض الطلب"}
                {actionMode === "suspend" && "⏸️ إيقاف مؤقّت"}
                {actionMode === "reactivate" && "▶️ إعادة تفعيل"}
                {actionMode === "terminate" && "🚫 إنهاء نهائي"}
              </div>
              <button onClick={() => { setActionMode(null); setReason("") }} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-neutral-400 mb-3">
              السفير: <span className="text-white font-bold">{selected.user_name}</span>
            </div>

            <div className={cn(
              "rounded-xl p-3 mb-4 text-xs border",
              actionMode === "approve" && "bg-green-400/[0.05] border-green-400/[0.2] text-green-400",
              actionMode === "reject" && "bg-red-400/[0.05] border-red-400/[0.2] text-red-400",
              actionMode === "suspend" && "bg-yellow-400/[0.05] border-yellow-400/[0.2] text-yellow-400",
              actionMode === "reactivate" && "bg-green-400/[0.05] border-green-400/[0.2] text-green-400",
              actionMode === "terminate" && "bg-red-400/[0.05] border-red-400/[0.2] text-red-400",
            )}>
              {actionMode === "approve" && "سيتم تفعيل الحساب كسفير + توليد رابط إحالة شخصي + إشعار المستخدم."}
              {actionMode === "reject" && "سيتم رفض الطلب وإرسال السبب للمستخدم. يمكنه إعادة التقديم بعد 3 شهور."}
              {actionMode === "suspend" && "سيتوقّف نشاط السفير + إيقاف العائدات + لن تُحتسب إحالات جديدة."}
              {actionMode === "reactivate" && "سيُستأنف نشاط السفير + استئناف العائدات."}
              {actionMode === "terminate" && "⚠️ إنهاء نهائي + لا يمكن إعادة التقديم. سيُسجَّل في audit_log."}
            </div>

            {(actionMode === "reject" || actionMode === "suspend" || actionMode === "terminate") && (
              <>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">سبب الإجراء (إجباري)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="اكتب السبب الذي سيُرسل للسفير + يُسجَّل في audit_log..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none mb-4"
                />
              </>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setActionMode(null); setReason("") }}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleAction}
                disabled={submitting}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold border disabled:opacity-50",
                  actionMode === "approve" && "bg-green-500/[0.15] border-green-500/[0.3] text-green-400 hover:bg-green-500/[0.2]",
                  actionMode === "reject" && "bg-red-500/[0.15] border-red-500/[0.3] text-red-400 hover:bg-red-500/[0.2]",
                  actionMode === "suspend" && "bg-yellow-500/[0.15] border-yellow-500/[0.3] text-yellow-400 hover:bg-yellow-500/[0.2]",
                  actionMode === "reactivate" && "bg-green-500/[0.15] border-green-500/[0.3] text-green-400 hover:bg-green-500/[0.2]",
                  actionMode === "terminate" && "bg-red-500/[0.15] border-red-500/[0.3] text-red-400 hover:bg-red-500/[0.2]",
                )}
              >
                {submitting ? "جاري التنفيذ..." : "تأكيد"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
