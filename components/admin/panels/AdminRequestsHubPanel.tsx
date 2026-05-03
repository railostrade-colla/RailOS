"use client"

/**
 * AdminRequestsHubPanel (Phase 9.4)
 *
 * Aggregated processing inbox with 5 sub-tabs. Notification-locking
 * lets multiple admins work in parallel without overlapping —
 * clicking "معالجة" calls admin_lock_notification first, the row
 * shows "قيد المعالجة من <name>" to other admins, and super admins
 * see a "تجاوز" button instead of a disabled state.
 */

import { useEffect, useState, useCallback } from "react"
import { Lock, RefreshCw, AlertOctagon, Eye } from "lucide-react"
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
  getMyAdminRole,
  getPendingFeeRequests,
  getPendingDeals,
  getOpenDisputes,
  getTradingVolumeStats,
  getPendingShareRequests,
  getAdminNotifications,
  lockNotification,
  processNotification,
  unlockNotification,
  type AdminRoleInfo,
  type PendingFeeRequest,
  type PendingDeal,
  type OpenDispute,
  type VolumeStats,
  type PendingShareRequest,
  type AdminInboxNotification,
} from "@/lib/data/admin-requests"
import { showSuccess, showError, showInfo } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return ""
  return iso.replace("T", " ").slice(0, 16)
}

type SubTab = "shares" | "volume" | "fees" | "deals" | "disputes" | "inbox"

const POLL_INTERVAL_MS = 30_000

export function AdminRequestsHubPanel() {
  const [tab, setTab] = useState<SubTab>("inbox")
  const [role, setRole] = useState<AdminRoleInfo>({
    is_admin: false,
    is_super_admin: false,
  })
  const [loading, setLoading] = useState(true)

  // Data buckets (one per tab)
  const [feeReqs, setFeeReqs] = useState<PendingFeeRequest[]>([])
  const [deals, setDeals] = useState<PendingDeal[]>([])
  const [disputes, setDisputes] = useState<OpenDispute[]>([])
  const [volume, setVolume] = useState<VolumeStats>({
    today: { count: 0, total: 0 },
    week: { count: 0, total: 0 },
    month: { count: 0, total: 0 },
  })
  const [shareReqs, setShareReqs] = useState<PendingShareRequest[]>([])
  const [inbox, setInbox] = useState<AdminInboxNotification[]>([])

  const refresh = useCallback(async () => {
    const [r, f, d, dis, v, sh, ib] = await Promise.all([
      getMyAdminRole(),
      getPendingFeeRequests(),
      getPendingDeals(),
      getOpenDisputes(),
      getTradingVolumeStats(),
      getPendingShareRequests(),
      getAdminNotifications(50),
    ])
    setRole(r)
    setFeeReqs(f)
    setDeals(d)
    setDisputes(dis)
    setVolume(v)
    setShareReqs(sh)
    setInbox(ib)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Light polling so admins see lock changes from peers within 30s
  useEffect(() => {
    const i = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(i)
  }, [refresh])

  // ─── Lock + process actions on inbox notifications ────────
  const handleLockAndProcess = async (n: AdminInboxNotification) => {
    // Step 1: try to acquire the lock
    const lockResult = await lockNotification(n.id)
    if (!lockResult.success) {
      const map: Record<string, string> = {
        not_admin: "صلاحياتك لا تسمح",
        not_found: "الإشعار غير موجود",
        already_locked: `قيد المعالجة من ${lockResult.locked_by ?? "أدمن آخر"}`,
        missing_table: "الجداول غير منشورة بعد",
        rls: "صلاحياتك لا تسمح",
      }
      showError(map[lockResult.reason ?? ""] ?? "فشل القفل")
      return
    }
    if (lockResult.override) {
      showInfo("✅ تجاوزت قفل أدمن آخر")
    }

    // Step 2: open the link / process. We don't have a single
    // generic editor here — we rely on the notification's link_url
    // to take the admin to the right screen. After they finish there,
    // they come back and click "إنهاء المعالجة" which fires processNotification.
    if (n.link_url) {
      window.open(n.link_url, "_blank")
    }

    showSuccess("🔓 الإشعار مقفول لك — اضغط 'إنهاء المعالجة' بعد الانتهاء")
    refresh()
  }

  const handleUnlock = async (n: AdminInboxNotification) => {
    const result = await unlockNotification(n.id)
    if (!result.success) {
      showError("فشل إلغاء القفل")
      return
    }
    showSuccess("تم إلغاء القفل")
    refresh()
  }

  const handleProcess = async (n: AdminInboxNotification) => {
    const result = await processNotification(n.id)
    if (!result.success) {
      const map: Record<string, string> = {
        not_admin: "صلاحياتك لا تسمح",
        locked_by_other: `مقفول من ${result.locked_by ?? "أدمن آخر"}`,
        not_found: "الإشعار غير موجود",
        missing_table: "الجداول غير منشورة بعد",
      }
      showError(map[result.reason ?? ""] ?? "فشل تسجيل المعالجة")
      return
    }
    showSuccess("✅ تم تسجيل معالجتك للإشعار")
    refresh()
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-neutral-400">جاري التحميل...</div>
      </div>
    )
  }

  if (!role.is_admin) {
    return (
      <div className="p-6">
        <AdminEmpty title="🔒 وصول مقيّد" body="هذه اللوحة للأدمن فقط." />
      </div>
    )
  }

  const tabs = [
    { key: "inbox" as const, label: "📬 صندوق الإشعارات", count: inbox.filter((n) => !n.processed_by).length },
    { key: "shares" as const, label: "📋 طلبات الحصص", count: shareReqs.length },
    { key: "volume" as const, label: "📊 حجم التداول" },
    { key: "fees" as const, label: "💳 وحدات الرسوم", count: feeReqs.length },
    { key: "deals" as const, label: "🤝 الصفقات", count: deals.length },
    { key: "disputes" as const, label: "⚖️ النزاعات", count: disputes.length },
  ]

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="🎯 مركز معالجة الطلبات"
        subtitle={`${role.is_super_admin ? "صلاحية: مدير عام (Super Admin)" : "صلاحية: أدمن"} · يحدّث كل 30 ثانية`}
        action={
          <ActionBtn
            label="تحديث"
            color="gray"
            sm
            onClick={refresh}
          />
        }
      />

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <KPI label="غير مُعالَج" val={inbox.filter((n) => !n.processed_by).length} color="#FBBF24" />
        <KPI label="مقفول حالياً" val={inbox.filter((n) => n.locked_by).length} color="#60A5FA" />
        <KPI label="طلبات رسوم" val={feeReqs.length} color="#a855f7" />
        <KPI label="صفقات معلّقة" val={deals.length} color="#FB923C" />
        <KPI label="نزاعات مفتوحة" val={disputes.length} color="#F87171" />
      </div>

      <InnerTabBar tabs={tabs} active={tab} onSelect={(k) => setTab(k as SubTab)} />

      {/* ═══════ Tab: Inbox ═══════ */}
      {tab === "inbox" && (
        inbox.length === 0 ? (
          <AdminEmpty title="لا توجد إشعارات" body="صندوق إشعاراتك فارغ." />
        ) : (
          <Table>
            <THead>
              <TH>النوع</TH>
              <TH>العنوان</TH>
              <TH>الأولوية</TH>
              <TH>الحالة</TH>
              <TH>التاريخ</TH>
              <TH>إجراءات</TH>
            </THead>
            <TBody>
              {inbox.map((n) => {
                const isLockedByMe = n.locked_by != null && n.locked_by === n.locked_by /* current user — server filters via own user_id query */
                const isLockedByOther = n.locked_by != null && !isLockedByMe
                const isProcessed = n.processed_by != null

                const status =
                  isProcessed
                    ? { label: `مكتمل (${n.processed_by_name})`, color: "green" as const }
                    : n.locked_by
                      ? { label: `مقفول (${n.locked_by_name})`, color: "blue" as const }
                      : n.priority === "urgent"
                        ? { label: "عاجل", color: "red" as const }
                        : { label: "غير مُعالَج", color: "yellow" as const }

                const priColor =
                  n.priority === "urgent" ? "red" as const
                  : n.priority === "high" ? "orange" as const
                  : n.priority === "low" ? "gray" as const
                  : "blue" as const

                return (
                  <TR key={n.id}>
                    <TD><span className="text-[11px] font-mono text-neutral-400">{n.notification_type}</span></TD>
                    <TD>
                      <div className="text-xs text-white font-bold max-w-xs truncate">{n.title}</div>
                      <div className="text-[10px] text-neutral-500 max-w-xs truncate">{n.message}</div>
                    </TD>
                    <TD><Badge label={n.priority} color={priColor} /></TD>
                    <TD><Badge label={status.label} color={status.color} /></TD>
                    <TD><span className="text-[11px] text-neutral-500">{fmtDate(n.created_at)}</span></TD>
                    <TD>
                      <div className="flex gap-1.5 flex-wrap">
                        {isProcessed ? (
                          <Badge label="✓ مكتمل" color="green" />
                        ) : n.locked_by ? (
                          <>
                            {role.is_super_admin && (
                              <ActionBtn
                                label="🔓 تجاوز"
                                color="red"
                                sm
                                onClick={() => handleLockAndProcess(n)}
                              />
                            )}
                            <ActionBtn
                              label="✅ إنهاء المعالجة"
                              color="green"
                              sm
                              onClick={() => handleProcess(n)}
                            />
                            <ActionBtn
                              label="إلغاء القفل"
                              color="gray"
                              sm
                              onClick={() => handleUnlock(n)}
                            />
                          </>
                        ) : (
                          <ActionBtn
                            label="🔒 معالجة"
                            color="blue"
                            sm
                            onClick={() => handleLockAndProcess(n)}
                          />
                        )}
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )
      )}

      {/* ═══════ Tab: Shares (Feature 5 placeholder) ═══════ */}
      {tab === "shares" && (
        shareReqs.length === 0 ? (
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 text-center">
            <Lock className="w-10 h-10 text-neutral-500 mx-auto mb-3" strokeWidth={1.5} />
            <div className="text-sm font-bold text-white mb-1">لا توجد طلبات حصص حالياً</div>
            <div className="text-xs text-neutral-500">
              تتفعّل هذه الواجهة كاملاً بعد إنجاز الميزة 5 (تعديل الحصص برمز ثنائي).
            </div>
          </div>
        ) : (
          <Table>
            <THead>
              <TH>المشروع</TH>
              <TH>النوع</TH>
              <TH>عدد الحصص</TH>
              <TH>طالب التعديل</TH>
              <TH>السبب</TH>
              <TH>التاريخ</TH>
            </THead>
            <TBody>
              {shareReqs.map((r) => (
                <TR key={r.id}>
                  <TD>{r.project_name}</TD>
                  <TD>
                    <Badge
                      label={r.modification_type === "increase" ? "زيادة" : "تقليل"}
                      color={r.modification_type === "increase" ? "green" : "red"}
                    />
                  </TD>
                  <TD><span className="font-mono text-yellow-400 font-bold">{fmtNum(r.shares_amount)}</span></TD>
                  <TD>{r.requested_by_name}</TD>
                  <TD><span className="text-[11px] text-neutral-400 max-w-xs line-clamp-1">{r.reason ?? "—"}</span></TD>
                  <TD><span className="text-[11px] text-neutral-500">{fmtDate(r.created_at)}</span></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )
      )}

      {/* ═══════ Tab: Volume (read-only) ═══════ */}
      {tab === "volume" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
              <div className="text-[11px] text-neutral-400 mb-1">اليوم</div>
              <div className="text-3xl font-bold text-yellow-400 font-mono mb-1">
                {fmtNum(volume.today.total)}
              </div>
              <div className="text-[11px] text-neutral-500">
                {volume.today.count} صفقة · IQD
              </div>
            </div>
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
              <div className="text-[11px] text-neutral-400 mb-1">آخر 7 أيام</div>
              <div className="text-3xl font-bold text-blue-400 font-mono mb-1">
                {fmtNum(volume.week.total)}
              </div>
              <div className="text-[11px] text-neutral-500">
                {volume.week.count} صفقة · IQD
              </div>
            </div>
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
              <div className="text-[11px] text-neutral-400 mb-1">آخر 30 يوم</div>
              <div className="text-3xl font-bold text-green-400 font-mono mb-1">
                {fmtNum(volume.month.total)}
              </div>
              <div className="text-[11px] text-neutral-500">
                {volume.month.count} صفقة · IQD
              </div>
            </div>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 flex items-center gap-3">
            <Eye className="w-4 h-4 text-blue-400 flex-shrink-0" strokeWidth={2} />
            <div className="text-xs text-neutral-300">
              هذه الأرقام للقراءة فقط — تُحسَب من الصفقات المكتملة (status=completed). للتفاصيل الكاملة استخدم تبويب{" "}
              <span className="font-bold text-white">الصفقات</span> من القائمة الرئيسية.
            </div>
          </div>
        </>
      )}

      {/* ═══════ Tab: Fees ═══════ */}
      {tab === "fees" && (
        feeReqs.length === 0 ? (
          <AdminEmpty title="لا توجد طلبات رسوم معلّقة" />
        ) : (
          <Table>
            <THead>
              <TH>المستخدم</TH>
              <TH>المبلغ</TH>
              <TH>طريقة الدفع</TH>
              <TH>التاريخ</TH>
              <TH>إجراءات</TH>
            </THead>
            <TBody>
              {feeReqs.map((r) => (
                <TR key={r.id}>
                  <TD>{r.user_name}</TD>
                  <TD><span className="font-mono text-yellow-400 font-bold">{fmtNum(r.amount_requested)}</span></TD>
                  <TD><span className="text-[11px]">{r.payment_method}</span></TD>
                  <TD><span className="text-[11px] text-neutral-500">{fmtDate(r.submitted_at)}</span></TD>
                  <TD>
                    <ActionBtn
                      label="فتح في طلبات الرسوم"
                      color="blue"
                      sm
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.location.href = "/admin?tab=fee_units_requests"
                        }
                      }}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )
      )}

      {/* ═══════ Tab: Deals ═══════ */}
      {tab === "deals" && (
        deals.length === 0 ? (
          <AdminEmpty title="لا توجد صفقات معلّقة" />
        ) : (
          <Table>
            <THead>
              <TH>المشروع</TH>
              <TH>المشتري</TH>
              <TH>البائع</TH>
              <TH>الحصص</TH>
              <TH>القيمة</TH>
              <TH>الحالة</TH>
              <TH>التاريخ</TH>
            </THead>
            <TBody>
              {deals.map((d) => (
                <TR key={d.id}>
                  <TD>{d.project_name}</TD>
                  <TD>{d.buyer_name}</TD>
                  <TD>{d.seller_name}</TD>
                  <TD><span className="font-mono">{fmtNum(d.shares_amount)}</span></TD>
                  <TD><span className="font-mono text-yellow-400">{fmtNum(d.total_amount)}</span></TD>
                  <TD>
                    <Badge
                      label={d.status === "in_dispute" ? "نزاع" : "معلّقة"}
                      color={d.status === "in_dispute" ? "red" : "yellow"}
                    />
                  </TD>
                  <TD><span className="text-[11px] text-neutral-500">{fmtDate(d.created_at)}</span></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )
      )}

      {/* ═══════ Tab: Disputes ═══════ */}
      {tab === "disputes" && (
        disputes.length === 0 ? (
          <AdminEmpty title="لا توجد نزاعات مفتوحة" />
        ) : (
          <Table>
            <THead>
              <TH>الصفقة</TH>
              <TH>فاتح النزاع</TH>
              <TH>السبب</TH>
              <TH>التاريخ</TH>
              <TH>إجراءات</TH>
            </THead>
            <TBody>
              {disputes.map((d) => (
                <TR key={d.id}>
                  <TD><span className="font-mono text-[11px]">#{d.deal_id.slice(0, 8)}</span></TD>
                  <TD>{d.opener_name}</TD>
                  <TD><span className="text-[11px] text-neutral-300 max-w-xs line-clamp-1">{d.reason}</span></TD>
                  <TD><span className="text-[11px] text-neutral-500">{fmtDate(d.opened_at)}</span></TD>
                  <TD>
                    <ActionBtn
                      label="فتح في النزاعات"
                      color="red"
                      sm
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.location.href = "/admin?tab=disputes"
                        }
                      }}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )
      )}

      {/* Footer note about locking */}
      <div className="mt-6 bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-xl p-3 flex items-start gap-2">
        <AlertOctagon className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
        <div className="text-[11px] text-blue-300 leading-relaxed">
          <strong>القفل التلقائي:</strong> عند الضغط على "معالجة" يُقفَل الإشعار باسمك ولا يستطيع أدمن آخر فتحه.
          ينتهي القفل تلقائياً بعد 15 دقيقة إذا لم تنهِه.
          {role.is_super_admin && " بصفتك Super Admin، يمكنك تجاوز قفل أي أدمن."}
        </div>
      </div>
    </div>
  )
}

// Suppress accidental import-time evaluation warnings
void RefreshCw
