"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Users, Calendar, Coins, FileText, AlertTriangle, X, Check, UserCheck, UserX, Ban } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
// Phase 13.65 — GridBackground removed per founder spec; the
// contract detail page now uses the same plain-black AppLayout
// background as the rest of the app.
import { PageHeader } from "@/components/layout/PageHeader"
import { ContractLimitCard } from "@/components/contracts/ContractLimitCard"
import { ContractWalletSection } from "@/components/contracts/ContractWalletSection"
import { Card, Modal, Badge } from "@/components/ui"
import { LEVEL_LABELS, LEVEL_ICONS } from "@/lib/utils/contractLimits"
import {
  calculateContractDistribution,
  endContract as endContractMock,
  CONTRACT_END_FEE_PCT,
} from "@/lib/mock-data"
import type { ContractDetail } from "@/lib/mock-data/types"
import {
  getContractById,
  endContract,
  cancelPendingContract,
  getContractMembersFull,
  updateMemberPermission,
  type ContractMemberFull,
} from "@/lib/data/contracts"
import { respondToContractInvite } from "@/lib/data/contract-invites"
import { createClient } from "@/lib/supabase/client"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtIQD = (n: number) => n.toLocaleString("en-US")

const statusLabel = (s: string) =>
  ({ pending: "قيد الانتظار", active: "نشط", ended: "منتهي" }[s] || s)

const statusBadge = (s: string) => {
  if (s === "pending") return "bg-yellow-400/15 border-yellow-400/30 text-yellow-400"
  if (s === "active") return "bg-green-400/15 border-green-400/30 text-green-400"
  return "bg-white/[0.06] border-white/[0.08] text-neutral-400"
}

export default function ContractDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = (params?.id as string) || "ct1"

  // Phase 13.67 — start with null so we never paint the legacy
  // mockContract's hardcoded 4 partners. A loading screen shows
  // until getContractById returns; a "not found" screen shows if
  // it stays null.
  const [contract, setContract] = useState<ContractDetail | null>(null)
  const [contractLoading, setContractLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>("")
  const [members, setMembers] = useState<ContractMemberFull[]>([])
  const [savingPermFor, setSavingPermFor] = useState<string | null>(null)

  const refreshMembers = async () => {
    const m = await getContractMembersFull(id)
    setMembers(m)
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getContractById(id),
      createClient().auth.getUser(),
      getContractMembersFull(id),
    ]).then(([c, u, m]) => {
      if (cancelled) return
      setContract(c)               // c may be null → loading→not-found below
      setContractLoading(false)
      const uid = u.data.user?.id ?? ""
      if (uid) setCurrentUserId(uid)
      setMembers(m)
    })

    // Phase 13.58 — realtime: any change to contract_members (a
    // partner accepts/declines, creator adds a new member) refreshes
    // the status badges + contract header without a page reload.
    // 200ms debounce coalesces the trigger-driven UPDATE bursts.
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        if (cancelled) return
        const [c2, m2] = await Promise.all([
          getContractById(id),
          getContractMembersFull(id),
        ])
        if (cancelled) return
        setContract(c2)
        setMembers(m2)
      }, 200)
    }
    const channel = supabase
      .channel(`contract:${id}:members`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contract_members", filter: `contract_id=eq.${id}` },
        () => scheduleRefresh(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "partnership_contracts", filter: `id=eq.${id}` },
        () => scheduleRefresh(),
      )
      .subscribe()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handlePermissionChange = async (
    memberId: string,
    perm: "view_only" | "buy_only" | "buy_and_sell",
  ) => {
    setSavingPermFor(memberId)
    const result = await updateMemberPermission(memberId, perm)
    setSavingPermFor(null)
    if (!result.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        not_creator: "فقط منشئ العقد يقدر يغيّر الصلاحيات",
        not_found: "العضو غير موجود",
        missing_table: "الجداول غير منشورة بعد",
        rls: "صلاحياتك لا تسمح",
      }
      showError(map[result.reason ?? ""] ?? "فشل تحديث الصلاحية")
      return
    }
    showSuccess("✅ تم تحديث الصلاحية")
    refreshMembers()
  }

  const [showEndModal, setShowEndModal] = useState(false)
  const [confirmCheck, setConfirmCheck] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Phase 13.66 — partner-side response (accept / decline) from
  // the contract detail page itself, mirroring the global modal.
  const [respondingInvite, setRespondingInvite] = useState<"accept" | "decline" | null>(null)
  const [showDeclineForm, setShowDeclineForm] = useState(false)
  const [declineReason, setDeclineReason] = useState("")

  // Phase 13.66 — creator-side: cancel a still-pending contract.
  const [showCancelPending, setShowCancelPending] = useState(false)
  const [cancellingPending, setCancellingPending] = useState(false)

  // Real ownership check — derived from the user_contracts list.
  // Falls back to mock string-match for the seed contract.
  const [creatorContractIds, setCreatorContractIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    let cancelled = false
    import("@/lib/data/contracts").then(({ getUserContracts }) => {
      getUserContracts().then((rows) => {
        if (cancelled) return
        setCreatorContractIds(
          new Set(rows.filter((r) => r.is_creator).map((r) => r.contract_id)),
        )
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Phase 13.67 — every read off `contract` must be null-safe; the
  // page renders a loading/not-found state when contract is null.
  const isCreator = contract
    ? creatorContractIds.has(contract.id)
    : false

  // Pass the contract OBJECT (not just id) so the distribution
  // helper computes from real DB data instead of the old mock match.
  const distribution = contract
    ? calculateContractDistribution(contract)
    : null

  const handleEndContract = async () => {
    if (!contract || !distribution) return
    if (!confirmCheck) {
      showError("أكّد رغبتك في إنهاء العقد أولاً")
      return
    }
    setSubmitting(true)
    const result = await endContract(contract.id)
    setSubmitting(false)
    if (result.success) {
      // Mirror to mock store too so any other mock-driven UI in the
      // same session reflects the change.
      endContractMock(contract.id)
      showSuccess(
        `تم إنهاء العقد + توزيع الحصص! 🎉${
          result.fee_deducted ? ` (خصم رسوم: ${fmtIQD(result.fee_deducted)})` : ""
        }`,
      )
      setShowEndModal(false)
      setTimeout(() => router.push("/contracts"), 600)
      return
    }
    // Failure paths.
    if (result.reason === "not_owner") {
      showError("فقط منشئ العقد يقدر ينهيه")
    } else if (result.reason === "not_active") {
      showError("العقد غير نشط")
    } else if (result.reason === "missing_table") {
      showError("الميزة غير متاحة على الخادم بعد")
    } else {
      showError(result.error || "تعذّر إنهاء العقد")
    }
    setShowEndModal(false)
  }

  // Phase 13.66 — partner-side accept invite (in-page).
  const handleAcceptInvite = async () => {
    if (!contract) return
    setRespondingInvite("accept")
    const r = await respondToContractInvite(contract.id, true)
    setRespondingInvite(null)
    if (!r.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        no_pending_invite: "الدعوة لم تعد متاحة",
        invalid_input: "مدخلات غير صحيحة",
      }
      showError(map[r.reason ?? ""] ?? r.reason ?? "فشلت الموافقة")
      return
    }
    showSuccess("✅ تمت الموافقة على عقد الشراكة")
    refreshMembers()
  }

  const handleDeclineInvite = async () => {
    if (!contract) return
    setRespondingInvite("decline")
    const r = await respondToContractInvite(
      contract.id,
      false,
      declineReason.trim() || undefined,
    )
    setRespondingInvite(null)
    if (!r.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        no_pending_invite: "الدعوة لم تعد متاحة",
      }
      showError(map[r.reason ?? ""] ?? "فشل الرفض")
      return
    }
    showSuccess("تم رفض الدعوة")
    setShowDeclineForm(false)
    setDeclineReason("")
    refreshMembers()
  }

  // Phase 13.66 — creator-side cancel a still-pending contract.
  const handleCancelPending = async () => {
    if (!contract) return
    setCancellingPending(true)
    const r = await cancelPendingContract(contract.id)
    setCancellingPending(false)
    if (!r.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        not_owner: "فقط منشئ العقد يقدر يلغيه",
        not_pending: "العقد ليس في حالة قيد الانتظار",
        not_found: "العقد غير موجود",
        missing_table: "الميزة غير منشورة على الخادم بعد",
      }
      showError(map[r.reason ?? ""] ?? r.error ?? "تعذّر إلغاء العقد")
      return
    }
    showSuccess("تم إلغاء العقد")
    setShowCancelPending(false)
    setTimeout(() => router.push("/contracts"), 500)
  }

  // Derived state for action buttons.
  const myMember = members.find((m) => m.user_id === currentUserId)
  const iAmPendingInvitee = !!myMember && myMember.invite_status === "pending"

  // Phase 13.67 — loading / not-found guards before the main render.
  // Previously the page seeded `contract` from mockContract, so a
  // failed fetch silently rendered the hardcoded 4-partner "Ahmed
  // Mohamed / Ali Hassan / ..." mock screen.
  if (contractLoading) {
    return (
      <AppLayout>
        <div className="relative">
          <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">
            <PageHeader title="تفاصيل العقد" subtitle="…" backHref="/contracts" />
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-12 text-center">
              <div className="text-xs text-neutral-500 animate-pulse">جاري تحميل العقد…</div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!contract) {
    return (
      <AppLayout>
        <div className="relative">
          <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">
            <PageHeader title="تفاصيل العقد" subtitle="—" backHref="/contracts" />
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-12 text-center">
              <FileText className="w-12 h-12 text-neutral-600 mx-auto mb-3" strokeWidth={1.5} />
              <div className="text-sm font-bold text-white mb-1">العقد غير موجود</div>
              <div className="text-xs text-neutral-500 mb-4">
                ربّما حُذف، أو ليست لديك صلاحية لعرضه.
              </div>
              <button
                onClick={() => router.push("/contracts")}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                العودة إلى قائمة العقود
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            title="تفاصيل العقد"
            subtitle={contract.title}
            backHref="/contracts"
          />

          {/* Phase 13.66 — partner-side accept/reject banner.
              Shown whenever the signed-in user is an invitee with
              invite_status='pending'. Lets them respond from this
              page (in case they dismissed the global popup). */}
          {iAmPendingInvitee && (
            <div className="bg-gradient-to-br from-green-400/[0.08] to-green-400/[0.03] border-2 border-green-400/[0.3] rounded-2xl p-5 mb-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-400/[0.12] border border-green-400/[0.3] flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-[#4ADE80]" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white mb-1">
                    📩 دعوة شراكة بانتظار ردّك
                  </div>
                  <div className="text-[11px] text-neutral-300 leading-relaxed">
                    أنت مدعوّ للانضمام إلى هذا العقد بحصّة{" "}
                    <span className="font-bold text-[#4ADE80] font-mono">{myMember?.share_percent}%</span>.
                    وافق للدخول أو ارفض الدعوة.
                  </div>
                </div>
              </div>

              {showDeclineForm ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-neutral-400 mb-1.5 block">
                      سبب الرفض (اختياري)
                    </label>
                    <textarea
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      rows={3}
                      placeholder="مثال: مشغول حالياً، حصّة غير مناسبة..."
                      className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowDeclineForm(false); setDeclineReason("") }}
                      disabled={respondingInvite !== null}
                      className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-xs hover:bg-white/[0.08] disabled:opacity-50"
                    >
                      تراجع
                    </button>
                    <button
                      onClick={handleDeclineInvite}
                      disabled={respondingInvite !== null}
                      className="flex-1 py-2.5 rounded-xl bg-red-500/[0.15] border border-red-500/[0.3] text-red-400 text-xs font-bold hover:bg-red-500/[0.2] disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <UserX className="w-3.5 h-3.5" strokeWidth={2.5} />
                      {respondingInvite === "decline" ? "جارٍ..." : "تأكيد الرفض"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeclineForm(true)}
                    disabled={respondingInvite !== null}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/[0.1] border border-red-500/[0.25] text-red-400 text-xs font-bold hover:bg-red-500/[0.15] disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <UserX className="w-3.5 h-3.5" strokeWidth={2.5} />
                    رفض
                  </button>
                  <button
                    onClick={handleAcceptInvite}
                    disabled={respondingInvite !== null}
                    className="flex-1 py-2.5 rounded-xl bg-[#4ADE80] text-black text-xs font-bold hover:bg-[#22c55e] disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" strokeWidth={2.5} />
                    {respondingInvite === "accept" ? "جارٍ..." : "الموافقة على الانضمام"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Contract info card */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-4">
            <div className="flex items-start justify-between mb-3 gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-white mb-1.5">{contract.title}</div>
                <div className="text-[11px] text-neutral-500">
                  منشئ العقد: <span className="text-white font-bold">{contract.creator}</span>
                </div>
              </div>
              <span className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold border", statusBadge(contract.status))}>
                {statusLabel(contract.status)}
              </span>
            </div>

            {contract.description && (
              <div className="text-xs text-neutral-300 leading-relaxed bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 mt-3">
                {contract.description}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-400 flex-shrink-0" strokeWidth={1.5} />
                <div className="min-w-0">
                  <div className="text-[10px] text-neutral-500 mb-0.5">قيمة الاستثمار</div>
                  <div className="text-xs font-bold text-yellow-400 font-mono truncate">{fmtIQD(contract.total_investment)}</div>
                </div>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400 flex-shrink-0" strokeWidth={1.5} />
                <div className="min-w-0">
                  <div className="text-[10px] text-neutral-500 mb-0.5">الأعضاء</div>
                  <div className="text-xs font-bold text-white">{contract.members.length} شركاء</div>
                </div>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400 flex-shrink-0" strokeWidth={1.5} />
                <div className="min-w-0">
                  <div className="text-[10px] text-neutral-500 mb-0.5">التاريخ</div>
                  <div className="text-xs font-bold text-white truncate">{contract.created_at}</div>
                </div>
              </div>
            </div>
          </div>

          {/* الحد الشهري الجماعي */}
          <div className="mb-4">
            <ContractLimitCard members={contract.members.map((m) => ({ name: m.name, level: m.level }))} />
          </div>

          {/* Phase 13.71 — Contract wallet (in-contract investments,
              activity log, source breakdown). Visible to creator +
              members + admin (RLS-enforced). */}
          <ContractWalletSection contractId={contract.id} />

          {/* قائمة الأعضاء التفصيلية */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
              <div className="text-sm font-bold text-white">الشركاء ({contract.members.length})</div>
            </div>
            {/* Phase 13.58 — status badge next to each partner, fed by
                the realtime `members` array (which has invite_status). */}
            <div className="space-y-2">
              {contract.members.map((m) => {
                const memberFull = members.find((x) => x.user_id === m.user_id)
                const status = memberFull?.invite_status ?? "accepted"
                const statusBadgeStyle =
                  status === "accepted"
                    ? "bg-green-400/[0.12] border-green-400/[0.3] text-green-400"
                    : status === "pending"
                      ? "bg-yellow-400/[0.12] border-yellow-400/[0.3] text-yellow-400"
                      : "bg-red-400/[0.12] border-red-400/[0.3] text-red-400"
                const statusIcon =
                  status === "accepted" ? "✓" : status === "pending" ? "⏳" : "✗"
                const statusLabel =
                  status === "accepted" ? "وافق" : status === "pending" ? "قيد الانتظار" : "رفض"
                return (
                  <div key={m.user_id} className="flex items-center gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-base font-bold text-white flex-shrink-0">
                      {m.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">{m.name}</span>
                        <span className="text-[10px]">{LEVEL_ICONS[m.level]}</span>
                        <span className="text-[10px] text-neutral-500">{LEVEL_LABELS[m.level]}</span>
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1",
                          statusBadgeStyle,
                        )}>
                          <span>{statusIcon}</span>
                          <span>{statusLabel}</span>
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">
                        حصة: <span className="text-yellow-400 font-mono font-bold">{m.share_percent}%</span>
                      </div>
                    </div>
                    <div className="text-base font-bold text-white font-mono flex-shrink-0">
                      {m.share_percent}%
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ═══ Member permissions (creator only) ═══ */}
          {isCreator && members.length > 0 && (
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-purple-400" strokeWidth={2} />
                <div className="text-sm font-bold text-white">صلاحيات الشركاء</div>
              </div>
              <div className="text-[11px] text-neutral-500 mb-3">
                تحكّم بما يستطيع كل شريك فعله من حساب العقد (الشراء/البيع/العرض فقط).
              </div>
              <div className="space-y-2">
                {members
                  .filter((m) => m.user_id !== currentUserId)
                  .map((m) => {
                    const isSaving = savingPermFor === m.id
                    return (
                      <div
                        key={m.id}
                        className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 flex items-center gap-3"
                      >
                        <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                          {m.user_name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white font-bold truncate">
                            {m.user_name}
                          </div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">
                            حصة <span className="text-yellow-400 font-mono">{m.share_percent}%</span>
                            {" · "}
                            <span
                              className={cn(
                                m.invite_status === "accepted"
                                  ? "text-green-400"
                                  : m.invite_status === "pending"
                                    ? "text-yellow-400"
                                    : "text-red-400",
                              )}
                            >
                              {m.invite_status === "accepted"
                                ? "قابل الدعوة"
                                : m.invite_status === "pending"
                                  ? "قيد الانتظار"
                                  : "رفض"}
                            </span>
                          </div>
                        </div>
                        <select
                          value={m.permission === "creator" ? "view_only" : m.permission}
                          disabled={isSaving || m.invite_status !== "accepted"}
                          onChange={(e) =>
                            handlePermissionChange(
                              m.id,
                              e.target.value as "view_only" | "buy_only" | "buy_and_sell",
                            )
                          }
                          className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none disabled:opacity-50 cursor-pointer"
                        >
                          <option value="view_only">عرض فقط</option>
                          <option value="buy_only">شراء فقط</option>
                          <option value="buy_and_sell">شراء وبيع</option>
                        </select>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* ═══ End contract button (creator + active only) ═══ */}
          {isCreator && contract.status === "active" && (
            <button
              onClick={() => setShowEndModal(true)}
              className="w-full bg-red-500/[0.1] border border-red-500/30 hover:bg-red-500/[0.15] text-red-400 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors mb-6"
            >
              <AlertTriangle className="w-4 h-4" strokeWidth={2} />
              إنهاء العقد وتوزيع الحصص
            </button>
          )}

          {/* Phase 13.66 — cancel pending contract (creator only).
              Used to withdraw invites + abort before activation. */}
          {isCreator && contract.status === "pending" && (
            <button
              onClick={() => setShowCancelPending(true)}
              className="w-full bg-red-500/[0.1] border border-red-500/30 hover:bg-red-500/[0.15] text-red-400 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors mb-6"
            >
              <Ban className="w-4 h-4" strokeWidth={2} />
              إنهاء العقد وسحب الدعوات
            </button>
          )}

        </div>
      </div>

      {/* ═══ End contract Modal ═══ */}
      {showEndModal && distribution && (
        <Modal
          isOpen={showEndModal}
          onClose={() => !submitting && setShowEndModal(false)}
          title="⚠️ إنهاء العقد وتوزيع الحصص"
          subtitle="هذا الإجراء لا يمكن التراجع عنه"
          variant="warning"
          size="lg"
          footer={
            <>
              <button
                onClick={() => setShowEndModal(false)}
                disabled={submitting}
                className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-2.5 rounded-xl text-sm hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleEndContract}
                disabled={!confirmCheck || submitting}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  confirmCheck && !submitting
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-white/[0.05] text-neutral-500 cursor-not-allowed",
                )}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري التوزيع...
                  </>
                ) : (
                  "إنهاء وتوزيع"
                )}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Summary */}
            <Card padding="md">
              <div className="text-xs font-bold text-white mb-3">ملخّص التوزيع</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">إجمالي الحصص</div>
                  <div className="text-lg font-bold text-yellow-400 font-mono">
                    {distribution.total_shares.toLocaleString("en-US")}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">عدد الأعضاء</div>
                  <div className="text-lg font-bold text-blue-400 font-mono">
                    {distribution.distribution.length}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">قيمة العقد</div>
                  <div className="text-sm font-bold text-white font-mono">
                    {fmtIQD(distribution.total_value)}
                  </div>
                </div>
              </div>
            </Card>

            {/* Distribution table */}
            <div>
              <div className="text-xs font-bold text-white mb-2">التوزيع المتوقّع</div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_60px_80px_100px] gap-2 px-3 py-2 bg-white/[0.04] border-b border-white/[0.06] text-[10px] text-neutral-500 font-bold">
                  <span>العضو</span>
                  <span className="text-center">النسبة</span>
                  <span className="text-center">الحصص</span>
                  <span className="text-left">القيمة</span>
                </div>
                {distribution.distribution.map((row) => (
                  <div
                    key={row.member_id}
                    className="grid grid-cols-[1fr_60px_80px_100px] gap-2 px-3 py-2.5 items-center border-b border-white/[0.04] last:border-0"
                  >
                    <span className="text-xs text-white truncate">{row.member_name}</span>
                    <span className="text-xs text-yellow-400 font-mono font-bold text-center">{row.percentage}%</span>
                    <span className="text-xs text-blue-400 font-mono font-bold text-center">{row.shares}</span>
                    <span className="text-xs text-white font-mono text-left">
                      {fmtIQD(row.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fee warning */}
            <Card variant="highlighted" color="yellow" padding="md">
              <div className="text-xs font-bold text-yellow-400 mb-2 flex items-center gap-1.5">
                📌 رسوم إنهاء العقد
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] text-neutral-300">{CONTRACT_END_FEE_PCT}% من قيمة العقد</span>
                <span className="text-base font-bold text-yellow-400 font-mono">
                  {fmtIQD(distribution.end_fee)} د.ع
                </span>
              </div>
              <div className="text-[10px] text-neutral-500">
                ستُخصم من رصيد وحدات الرسوم لمنشئ العقد
              </div>
            </Card>

            {/* Confirm checkbox */}
            <label className="flex items-start gap-3 cursor-pointer py-2 group">
              <button
                type="button"
                onClick={() => setConfirmCheck(!confirmCheck)}
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors mt-0.5",
                  confirmCheck
                    ? "bg-red-500 border-red-500"
                    : "bg-white/[0.04] border-white/[0.2] group-hover:border-white/[0.35]",
                )}
              >
                {confirmCheck && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
              </button>
              <span className="text-xs text-neutral-300 leading-relaxed select-none">
                أؤكد أنني أرغب في إنهاء العقد وتوزيع الحصص على جميع الأعضاء
              </span>
            </label>
          </div>
        </Modal>
      )}

      {/* Phase 13.66 — cancel pending contract confirmation */}
      {showCancelPending && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border-2 border-red-400/40 rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-red-400/[0.12] border border-red-400/[0.3] flex items-center justify-center">
                  <Ban className="w-5 h-5 text-red-400" strokeWidth={2} />
                </div>
                <div>
                  <div className="text-base font-bold text-white">إنهاء العقد المعلَّق</div>
                  <div className="text-[11px] text-neutral-400">سحب الدعوات وإلغاء العقد</div>
                </div>
              </div>
              <button
                onClick={() => setShowCancelPending(false)}
                disabled={cancellingPending}
                className="text-neutral-500 hover:text-white disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-xl p-3 mb-4 text-xs text-red-300 leading-relaxed">
              ⚠ سيتم إلغاء العقد "<b className="text-white">{contract.title}</b>" وسحب الدعوات
              المرسَلة. سيُخطَر كل من تلقّى دعوة بأنّك قمت بسحبها.
              <span className="block mt-1 text-red-300/80 text-[11px]">
                لا توجد رسوم — العقد لم يتفعّل بعد. الإجراء نهائي.
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelPending(false)}
                disabled={cancellingPending}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                تراجع
              </button>
              <button
                onClick={handleCancelPending}
                disabled={cancellingPending}
                className="flex-1 py-3 rounded-xl bg-red-500/[0.18] border border-red-500/[0.4] text-red-300 text-sm font-bold hover:bg-red-500/[0.25] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Ban className="w-4 h-4" strokeWidth={2.5} />
                {cancellingPending ? "جارٍ..." : "نعم، ألغِ العقد"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
