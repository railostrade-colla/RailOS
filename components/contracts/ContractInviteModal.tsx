"use client"

/**
 * ContractInviteModal — Phase 13.58.
 *
 * Global popup mounted in `app/layout.tsx`. Subscribes to
 * `contract_members` realtime; whenever a row INSERTs with the
 * signed-in user as `user_id` and `invite_status='pending'` (or any
 * row UPDATEs back to pending — rare), we fetch the full invite
 * details via getMyPendingContractInvite and render the modal.
 *
 * Pattern mirrors DealRequestModal (Phase 12.8) — sits above the
 * app no matter which route is active.
 */

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { X, FileText, Banknote, Percent, UserCheck, UserX } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  getMyPendingContractInvite,
  respondToContractInvite,
  type PendingContractInvite,
} from "@/lib/data/contract-invites"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtIqd = (n: number) => Math.round(n || 0).toLocaleString("en-US")

export function ContractInviteModal() {
  const router = useRouter()
  const [invite, setInvite] = useState<PendingContractInvite | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showDecline, setShowDecline] = useState(false)
  const [declineReason, setDeclineReason] = useState("")
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const refreshInvite = useCallback(async () => {
    const next = await getMyPendingContractInvite()
    if (!next) {
      setInvite(null)
      return
    }
    // Don't re-pop a contract the user already dismissed this session.
    if (dismissed.has(next.contract_id)) return
    setInvite(next)
  }, [dismissed])

  // Initial check + realtime subscription.
  useEffect(() => {
    let cancelled = false
    let userId: string | null = null

    refreshInvite()

    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (!cancelled) refreshInvite()
      }, 200)
    }

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return
      userId = user.id

      channel = supabase
        .channel(`contract-invites:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "contract_members",
            filter: `user_id=eq.${userId}`,
          },
          () => scheduleRefresh(),
        )
        .subscribe()
    }
    init()

    return () => {
      cancelled = true
      if (debounceTimer) clearTimeout(debounceTimer)
      if (channel) supabase.removeChannel(channel).catch(() => {})
    }
  }, [refreshInvite])

  if (!invite) return null

  const handleAccept = async () => {
    setSubmitting(true)
    const r = await respondToContractInvite(invite.contract_id, true)
    setSubmitting(false)
    if (!r.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        no_pending_invite: "الدعوة لم تعد متاحة",
        invalid_input: "مدخلات غير صحيحة",
      }
      showError(map[r.reason ?? ""] ?? "فشلت الموافقة")
      return
    }
    showSuccess("✅ تمت الموافقة على عقد الشراكة")
    setDismissed((prev) => new Set([...prev, invite.contract_id]))
    setInvite(null)
    router.push(`/contracts/${invite.contract_id}`)
  }

  const handleDeclineClick = () => {
    setShowDecline(true)
  }

  const submitDecline = async () => {
    setSubmitting(true)
    const r = await respondToContractInvite(
      invite.contract_id,
      false,
      declineReason.trim() || undefined,
    )
    setSubmitting(false)
    if (!r.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        no_pending_invite: "الدعوة لم تعد متاحة",
      }
      showError(map[r.reason ?? ""] ?? "فشل الرفض")
      return
    }
    showSuccess("تم رفض الدعوة")
    setDismissed((prev) => new Set([...prev, invite.contract_id]))
    setShowDecline(false)
    setDeclineReason("")
    setInvite(null)
  }

  const myShareValue = Math.round(
    (invite.total_investment * invite.share_percent) / 100,
  )

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] border-2 border-[#4ADE80]/40 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#4ADE80]/[0.12] border border-[#4ADE80]/[0.3] flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-[#4ADE80]" strokeWidth={2} />
            </div>
            <div>
              <div className="text-base font-bold text-white">📄 دعوة شراكة جديدة</div>
              <div className="text-[10px] text-neutral-400">
                {invite.creator_name} يدعوك للانضمام
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setDismissed((prev) => new Set([...prev, invite.contract_id]))
              setInvite(null)
            }}
            className="text-neutral-500 hover:text-white"
            disabled={submitting}
            title="إغلاق (يمكنك الرد لاحقاً من /contracts)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contract details */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 mb-4">
          <div className="text-sm font-bold text-white mb-1">{invite.contract_title}</div>
          {invite.contract_description && (
            <div className="text-[11px] text-neutral-400 leading-relaxed mb-3 line-clamp-3">
              {invite.contract_description}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5">
              <div className="flex items-center gap-1 mb-1">
                <Banknote className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-neutral-500">إجمالي الاستثمار</span>
              </div>
              <div className="text-sm font-bold text-white font-mono">
                {fmtIqd(invite.total_investment)} <span className="text-[9px] text-neutral-500 font-sans">IQD</span>
              </div>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5">
              <div className="flex items-center gap-1 mb-1">
                <Percent className="w-3 h-3 text-[#4ADE80]" />
                <span className="text-[10px] text-neutral-500">حصّتك المقترَحة</span>
              </div>
              <div className="text-sm font-bold text-[#4ADE80] font-mono">
                {invite.share_percent.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="mt-3 bg-blue-400/[0.05] border border-blue-400/[0.15] rounded-lg p-2.5 text-[11px] text-blue-300 leading-relaxed">
            قيمة حصّتك ≈ <span className="font-mono font-bold">{fmtIqd(myShareValue)} IQD</span>.
            {invite.end_fee_pct != null && (
              <span className="block mt-1">
                رسوم إنهاء العقد: <span className="font-mono">{invite.end_fee_pct}%</span> من قيمة حصّتك.
              </span>
            )}
          </div>
        </div>

        {/* Decline reason input — shown after clicking رفض */}
        {showDecline ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">
                سبب الرفض (اختياري)
              </label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
                placeholder="مثال: مشغول حالياً، حصّة غير مناسبة، إلخ..."
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDecline(false); setDeclineReason("") }}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                تراجع
              </button>
              <button
                onClick={submitDecline}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-red-500/[0.15] border border-red-500/[0.3] text-red-400 text-sm font-bold hover:bg-red-500/[0.2] disabled:opacity-50"
              >
                {submitting ? "جارٍ..." : "تأكيد الرفض"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleDeclineClick}
              disabled={submitting}
              className={cn(
                "flex-1 py-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2",
                "bg-red-500/[0.1] border-red-500/[0.25] text-red-400 hover:bg-red-500/[0.15]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              <UserX className="w-4 h-4" strokeWidth={2.5} />
              رفض
            </button>
            <button
              onClick={handleAccept}
              disabled={submitting}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2",
                "bg-[#4ADE80] text-black hover:bg-[#22c55e] active:scale-[0.98]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              <UserCheck className="w-4 h-4" strokeWidth={2.5} />
              {submitting ? "جارٍ..." : "الموافقة على الانضمام"}
            </button>
          </div>
        )}

        <div className="text-[10px] text-neutral-600 text-center mt-3">
          يمكنك الرد لاحقاً من <span className="text-blue-400">/contracts</span> إذا أغلقت هذه النافذة.
        </div>
      </div>
    </div>
  )
}
