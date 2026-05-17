"use client"

/**
 * DealRequestNotifier — Phase 12.8 v3 (rich buyer classification).
 *
 * Lives at the AppLayout level so any signed-in seller sees the popup
 * **on whatever page they happen to be on** when a buyer opens a deal
 * request. Now shows the buyer's full profile classification so the
 * seller can decide before approving:
 *
 *   • avatar (with realtime online dot anchored to it)
 *   • name + @handle
 *   • KYC badge (verified / pending / rejected / not submitted)
 *   • star rating (X.X · N تقييم)
 *   • trades completed
 *   • ambassador badge
 *   • presence: "متّصل الآن" / "قبل ٥ د"
 *   • new-buyer warning when trades_completed = 0
 *
 * Internals unchanged: realtime INSERT/UPDATE on deals (filter
 * seller_id=me), queue, accept/reject mutations.
 */

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Bell,
  Check,
  X,
  ShoppingCart,
  Coins,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Star,
  AlertTriangle,
  Sparkles,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  listPendingDealRequestsForMe,
  getPendingDealRequest,
  acceptDealRequest,
  rejectDealRequest,
  type PendingDealRequest,
} from "@/lib/data/seller-deal-actions"
import { showSuccess, showError } from "@/lib/utils/toast"
import { UserPresenceDot, UserPresenceText } from "@/components/presence/UserPresence"
// Phase 12.8 — synth sounds on approve / reject actions + on the
// arrival of a new request so the seller hears the popup land.
import {
  playApproval,
  playRejection,
  playIncomingDealRequest,
} from "@/lib/sounds"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type ActionMode = "view" | "rejecting"

export function DealRequestNotifier() {
  const router = useRouter()
  const t = useTranslations("deals")
  const [queue, setQueue] = useState<PendingDealRequest[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<ActionMode>("view")
  const [reason, setReason] = useState("")
  const [uid, setUid] = useState<string | null>(null)
  const seenIds = useRef<Set<string>>(new Set())

  const head = queue[0] ?? null

  // Resolve current user once.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      setUid(data?.user?.id ?? null)
    })
    return () => { cancelled = true }
  }, [])

  // Initial fetch
  const refresh = useCallback(async () => {
    const items = await listPendingDealRequestsForMe()
    setQueue((prev) => {
      const map = new Map<string, PendingDealRequest>()
      for (const p of prev) map.set(p.id, p)
      for (const it of items) map.set(it.id, it)
      const ordered: PendingDealRequest[] = []
      for (const it of items) {
        const x = map.get(it.id)
        if (x) {
          ordered.push(x)
          map.delete(it.id)
        }
      }
      for (const v of map.values()) ordered.push(v)
      for (const it of ordered) seenIds.current.add(it.id)
      return ordered
    })
  }, [])

  useEffect(() => {
    if (!uid) return
    void refresh()
  }, [uid, refresh])

  // Realtime + safety-net polling. Realtime is preferred (latency
  // < 1s) but it can silently drop in three edge-cases the founder
  // saw in production:
  //   1. The seller's `deals` row isn't in supabase_realtime publication.
  //   2. WebSocket got dropped by a flaky network and didn't reconnect.
  //   3. Browser tab was throttled (mobile Safari) and missed events.
  //
  // The 10-second polling fallback below catches all three so the
  // popup ALWAYS appears within 10 s without the user refreshing.
  useEffect(() => {
    if (!uid) return
    const supabase = createClient()
    const channel = supabase
      .channel(`deal-requests-${uid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "deals",
          filter: `seller_id=eq.${uid}`,
        },
        async (payload) => {
          const newRow = payload.new as { id: string; status: string }
          if (newRow.status !== "pending_seller_approval") return
          if (seenIds.current.has(newRow.id)) return
          seenIds.current.add(newRow.id)
          const hydrated = await getPendingDealRequest(newRow.id)
          if (!hydrated) return
          // Phone-style ringtone — stronger than the soft "sent" blip
          // so the seller hears it from across the room.
          playIncomingDealRequest()
          setQueue((prev) => {
            if (prev.some((p) => p.id === hydrated.id)) return prev
            return [hydrated, ...prev]
          })
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "deals",
          filter: `seller_id=eq.${uid}`,
        },
        (payload) => {
          const updated = payload.new as { id: string; status: string }
          if (updated.status !== "pending_seller_approval") {
            setQueue((prev) => prev.filter((p) => p.id !== updated.id))
          }
        },
      )
      .subscribe((status) => {
        // Log subscription state so we can diagnose if realtime is
        // silently failing in prod (Supabase reports CHANNEL_ERROR
        // when the table isn't in the publication, for example).
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          // eslint-disable-next-line no-console
          console.warn("[deal-requests] realtime status:", status)
        }
      })

    // Safety net: poll every 10 seconds. Cheap (single SELECT, indexed
    // on seller_id+status). Pauses while tab is hidden to save battery.
    const pollInterval = setInterval(() => {
      if (document.visibilityState !== "visible") return
      void refresh()
    }, 10_000)

    // Refresh immediately whenever the tab regains focus — catches
    // any events that happened while the tab was throttled.
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh()
      }
    }
    const onFocus = () => {
      void refresh()
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", onFocus)

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch { /* ignore */ }
      clearInterval(pollInterval)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onFocus)
    }
  }, [uid, refresh])

  const popHead = () => {
    setQueue((prev) => prev.slice(1))
    setMode("view")
    setReason("")
  }

  const handleAccept = async () => {
    if (!head || submitting) return
    setSubmitting(true)
    const r = await acceptDealRequest(head.id)
    setSubmitting(false)
    if (!r.success) {
      showError(r.error ?? t("errApprove"))
      return
    }
    playApproval()
    showSuccess(t("approvedDeal", { name: head.buyer_name }))
    // Phase 12.8: redirect the seller straight to the deal page so
    // they can see the buyer's payment proof when it lands. The buyer
    // is already there waiting (the realtime status flip + toast tells
    // them the seller approved).
    const dealId = head.id
    popHead()
    router.push(`/deals/${dealId}`)
  }

  const handleReject = async () => {
    if (!head || submitting) return
    if (!reason.trim() || reason.trim().length < 5) {
      showError(t("errRejectReason"))
      return
    }
    setSubmitting(true)
    const r = await rejectDealRequest(head.id, reason.trim())
    setSubmitting(false)
    if (!r.success) {
      showError(r.error ?? t("errReject"))
      return
    }
    playRejection()
    showSuccess(t("requestRejectedX"))
    popHead()
  }

  const handleOpenInPage = () => {
    if (!head) return
    const id = head.id
    popHead()
    router.push(`/deals/${id}`)
  }

  if (!head) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={t("dialogLabel")}
    >
      <div className="w-full max-w-md bg-[#0f0f0f] border border-blue-400/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header strip */}
        <div className="bg-gradient-to-l from-blue-400/[0.12] to-transparent border-b border-blue-400/20 px-5 py-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-400/[0.15] border border-blue-400/30 flex items-center justify-center text-blue-400">
            <Bell className="w-4.5 h-4.5" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-white">{t("newOpenDeal")}</div>
            <div className="text-[10px] text-blue-300 mt-0.5">
              {t("buyerWantsComplete")}
            </div>
          </div>
          {queue.length > 1 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-400/[0.12] border border-blue-400/30 text-blue-300">
              +{queue.length - 1}
            </span>
          )}
        </div>

        <div className="p-5 space-y-3">
          {mode === "view" && (
            <>
              {/* Buyer identity card */}
              <BuyerCard request={head} />

              {/* Project + numbers */}
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5">
                <div className="flex items-center gap-2 mb-2.5">
                  <ShoppingCart className="w-4 h-4 text-green-400" strokeWidth={2} />
                  <span className="text-xs font-bold text-white">
                    {head.project_name}
                  </span>
                  {head.project_symbol && (
                    <span
                      className="text-[10px] text-blue-400 font-mono"
                      dir="ltr"
                    >
                      ({head.project_symbol})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label={t("qty")} value={`${fmtNum(head.shares)}`} unit={t("sharesUnit")} />
                  <Stat
                    label={t("pricePerShare")}
                    value={fmtNum(head.price_per_share)}
                    unit={t("iqd")}
                  />
                  <Stat
                    label={t("total")}
                    value={fmtNum(head.total_amount)}
                    unit={t("iqd")}
                    highlight="green"
                  />
                </div>
              </div>

              {/* Commission */}
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-blue-400/[0.05] border border-blue-400/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Coins
                    className="w-3.5 h-3.5 text-blue-400 shrink-0"
                    strokeWidth={2}
                  />
                  <span className="text-[10px] text-blue-300">
                    {t("buyerCommission")}
                  </span>
                </div>
                <span className="text-sm font-bold font-mono text-blue-400">
                  {fmtNum(head.buyer_commission)}
                </span>
              </div>

              {/* New-buyer warning */}
              {head.buyer_trades_completed === 0 && (
                <div className="flex items-start gap-2 px-3 py-2 bg-yellow-400/[0.08] border border-yellow-400/30 rounded-lg">
                  <AlertTriangle
                    className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5"
                    strokeWidth={2}
                  />
                  <p className="text-[10px] text-yellow-200 leading-relaxed">
                    <strong>{t("newBuyerStrong")}</strong>{t("newBuyerWarn")}
                  </p>
                </div>
              )}
            </>
          )}

          {mode === "rejecting" && (
            <div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-3">
                <div className="text-[10px] text-neutral-500 mb-0.5">{t("rejectRequestFrom")}</div>
                <div className="text-sm font-bold text-white">
                  {head.buyer_name}
                </div>
              </div>
              <label className="block text-xs text-neutral-400 mb-2">
                {t("rejectReason")} <span className="text-red-400">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder={t("rejectReasonPlaceholder")}
                maxLength={300}
                autoFocus
                className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-red-400/30 resize-none"
              />
              <div className="text-[10px] text-neutral-500 mt-1.5 leading-relaxed">
                {t("rejectReasonNote")}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.06] p-3.5 space-y-2">
          {mode === "view" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode("rejecting")}
                  disabled={submitting}
                  className="py-2.5 rounded-xl bg-red-500/[0.1] border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/[0.18] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <X className="w-4 h-4" strokeWidth={2.5} />
                  {t("reject")}
                </button>
                <button
                  onClick={handleAccept}
                  disabled={submitting}
                  className="py-2.5 rounded-xl bg-green-500 text-black text-sm font-bold hover:bg-green-600 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                  )}
                  {submitting ? t("working") : t("approveOpen")}
                </button>
              </div>
              <button
                onClick={handleOpenInPage}
                disabled={submitting}
                className="w-full py-2 rounded-lg text-[11px] text-neutral-400 hover:text-white hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3 h-3" strokeWidth={2} />
                {t("openInDealPage")}
              </button>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setMode("view")
                  setReason("")
                }}
                disabled={submitting}
                className="py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                {t("back")}
              </button>
              <button
                onClick={handleReject}
                disabled={submitting}
                className="py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" strokeWidth={2.5} />
                )}
                {submitting ? t("rejecting") : t("confirmReject")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

function BuyerCard({ request }: { request: PendingDealRequest }) {
  const t = useTranslations("deals")
  const stars = Math.max(0, Math.min(5, Math.round(request.buyer_rating_average)))

  return (
    <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.02] border border-white/[0.08] rounded-xl p-3.5">
      <div className="flex items-start gap-3">
        {/* Avatar with online dot */}
        <div className="relative flex-shrink-0">
          {request.buyer_avatar_url ? (
            <img
              src={request.buyer_avatar_url}
              alt=""
              className="w-12 h-12 rounded-full object-cover border border-white/[0.1]"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border border-white/[0.1] flex items-center justify-center text-base font-bold text-white">
              {request.buyer_name.charAt(0)}
            </div>
          )}
          <UserPresenceDot
            userId={request.buyer_id}
            size="md"
            className="absolute -bottom-0.5 -left-0.5"
          />
        </div>

        {/* Identity + classification */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-white truncate">
              {request.buyer_name}
            </span>
            <KycBadge status={request.buyer_kyc_status} />
            {request.buyer_is_ambassador && (
              <span className="bg-purple-400/[0.12] border border-purple-400/30 text-purple-300 px-1.5 py-px rounded text-[9px] font-bold flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" strokeWidth={2} />
                {t("ambassador")}
              </span>
            )}
          </div>

          {request.buyer_handle && (
            <div className="text-[10px] text-neutral-500 font-mono mt-0.5" dir="ltr">
              @{request.buyer_handle}
            </div>
          )}

          {/* Stats line */}
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            {/* Rating */}
            <div className="flex items-center gap-0.5" title={t("ratingTitle", { avg: request.buyer_rating_average.toFixed(1) })}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "w-3 h-3",
                    i < stars ? "text-yellow-400" : "text-neutral-700",
                  )}
                  strokeWidth={2}
                  fill={i < stars ? "currentColor" : "none"}
                />
              ))}
              <span className="text-[10px] text-neutral-500 mr-1">
                {request.buyer_rating_average > 0
                  ? `${request.buyer_rating_average.toFixed(1)}`
                  : "—"}
                {request.buyer_rating_count > 0 && (
                  <span className="text-neutral-600">
                    {" "}({request.buyer_rating_count})
                  </span>
                )}
              </span>
            </div>

            {/* Trades */}
            <span className="text-[10px] text-neutral-400">
              <span className="text-white font-bold font-mono">
                {fmtNum(request.buyer_trades_completed)}
              </span>{" "}
              {t("dealsUnit")}
            </span>
          </div>

          {/* Presence text */}
          <div className="mt-1.5">
            <UserPresenceText userId={request.buyer_id} />
          </div>
        </div>
      </div>
    </div>
  )
}

function KycBadge({
  status,
}: {
  status: PendingDealRequest["buyer_kyc_status"]
}) {
  const t = useTranslations("deals")
  if (status === "verified") {
    return (
      <span className="bg-green-400/[0.12] border border-green-400/30 text-green-400 px-1.5 py-px rounded text-[9px] font-bold flex items-center gap-0.5">
        <ShieldCheck className="w-2.5 h-2.5" strokeWidth={2.5} />
        {t("kycVerified")}
      </span>
    )
  }
  if (status === "pending") {
    return (
      <span className="bg-yellow-400/[0.10] border border-yellow-400/30 text-yellow-400 px-1.5 py-px rounded text-[9px] font-bold">
        {t("kycPending")}
      </span>
    )
  }
  if (status === "rejected") {
    return (
      <span className="bg-red-400/[0.10] border border-red-400/30 text-red-400 px-1.5 py-px rounded text-[9px] font-bold flex items-center gap-0.5">
        <ShieldAlert className="w-2.5 h-2.5" strokeWidth={2.5} />
        {t("kycRejected")}
      </span>
    )
  }
  return (
    <span className="bg-neutral-500/[0.10] border border-neutral-500/30 text-neutral-400 px-1.5 py-px rounded text-[9px] font-bold">
      {t("kycNone")}
    </span>
  )
}

function Stat({
  label,
  value,
  unit,
  highlight,
}: {
  label: string
  value: string
  unit?: string
  highlight?: "green"
}) {
  return (
    <div className="bg-black/30 border border-white/[0.05] rounded-lg p-2">
      <div className="text-[9px] text-neutral-500 mb-1">{label}</div>
      <div
        className={cn(
          "text-sm font-bold font-mono",
          highlight === "green" ? "text-green-400" : "text-white",
        )}
      >
        {value}
      </div>
      {unit && <div className="text-[9px] text-neutral-600 mt-0.5">{unit}</div>}
    </div>
  )
}
