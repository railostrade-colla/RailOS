"use client"

/**
 * DealRequestNotifier — Phase 12.8.
 *
 * Lives at the AppLayout level so any signed-in seller sees a popup
 * **on whatever page they happen to be on** when a buyer initiates a
 * deal request. They can accept/reject without leaving their flow.
 *
 * Internals:
 *   • On mount: fetch every existing pending_seller_approval deal where
 *     I'm the seller. Queue them.
 *   • Subscribe to realtime INSERT on `deals` filtered by seller_id=me.
 *     New rows get pushed onto the queue.
 *   • Also listen for UPDATE so that if a deal flips out of
 *     pending_seller_approval (cancelled by buyer, expired, etc.) we
 *     drop it from the queue silently.
 *   • The popup shows the head of the queue. Accept/Reject mutates
 *     the DB; on success the head is removed and the next one shows.
 *
 * The popup is intentionally non-dismissable without a decision —
 * closing routes you to /deals/<id> so you have a parking spot.
 */

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  Check,
  X,
  ShoppingCart,
  Coins,
  ArrowLeft,
  Loader2,
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
import { UserPresenceLabel } from "@/components/presence/UserPresence"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type ActionMode = "view" | "rejecting"

export function DealRequestNotifier() {
  const router = useRouter()
  const [queue, setQueue] = useState<PendingDealRequest[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<ActionMode>("view")
  const [reason, setReason] = useState("")
  const [uid, setUid] = useState<string | null>(null)
  // Avoid double-prompts when realtime fires + initial fetch overlap.
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

  // ── Initial fetch ──
  const refresh = useCallback(async () => {
    const items = await listPendingDealRequestsForMe()
    setQueue((prev) => {
      // Merge: keep ordering, dedupe by id, prefer freshly fetched data.
      const map = new Map<string, PendingDealRequest>()
      for (const p of prev) map.set(p.id, p)
      for (const it of items) map.set(it.id, it)
      // Preserve newest-first order from `items`.
      const ordered: PendingDealRequest[] = []
      for (const it of items) {
        const x = map.get(it.id)
        if (x) {
          ordered.push(x)
          map.delete(it.id)
        }
      }
      // Append leftovers (items in prev but not in fresh — likely
      // cancelled, but err on the side of showing them once more).
      for (const v of map.values()) ordered.push(v)
      // Track seen so realtime doesn't re-add.
      for (const it of ordered) seenIds.current.add(it.id)
      return ordered
    })
  }, [])

  useEffect(() => {
    if (!uid) return
    void refresh()
  }, [uid, refresh])

  // ── Realtime subscription ──
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

          // Hydrate the row (we need names/totals the INSERT payload doesn't carry).
          const hydrated = await getPendingDealRequest(newRow.id)
          if (!hydrated) return
          setQueue((prev) => {
            if (prev.some((p) => p.id === hydrated.id)) return prev
            // Push to FRONT so the seller sees the freshest request first.
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
          // If the deal moved out of pending (buyer cancelled, expired, etc.),
          // drop it silently.
          if (updated.status !== "pending_seller_approval") {
            setQueue((prev) => prev.filter((p) => p.id !== updated.id))
          }
        },
      )
      .subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch { /* ignore */ }
    }
  }, [uid])

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
      showError(r.error ?? "تعذّر الموافقة")
      return
    }
    showSuccess(`✅ وافقت على صفقة ${head.buyer_name}`)
    popHead()
  }

  const handleReject = async () => {
    if (!head || submitting) return
    if (!reason.trim() || reason.trim().length < 5) {
      showError("اكتب سببَ رفضٍ موجز (٥ أحرف على الأقل)")
      return
    }
    setSubmitting(true)
    const r = await rejectDealRequest(head.id, reason.trim())
    setSubmitting(false)
    if (!r.success) {
      showError(r.error ?? "تعذّر الرفض")
      return
    }
    showSuccess("❌ تم رفض الطلب")
    popHead()
  }

  const handleOpenInPage = () => {
    if (!head) return
    const id = head.id
    popHead()
    router.push(`/deals/${id}`)
  }

  if (!head) return null

  // ─── UI ───────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="طلب فتح صفقة"
    >
      <div className="w-full max-w-md bg-[#0f0f0f] border border-blue-400/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-l from-blue-400/[0.12] to-transparent border-b border-blue-400/20 px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-400/[0.15] border border-blue-400/30 flex items-center justify-center text-blue-400">
            <Bell className="w-5 h-5" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white">🛒 طلب فتح صفقة</div>
            <div className="mt-0.5">
              <span className="text-[11px] text-blue-300">من </span>
              <UserPresenceLabel
                userId={head.buyer_id}
                name={head.buyer_name}
                showText
              />
            </div>
          </div>
          {queue.length > 1 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-400/[0.12] border border-blue-400/30 text-blue-300">
              +{queue.length - 1} في الانتظار
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          {mode === "view" && (
            <>
              {/* Project */}
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart
                    className="w-4 h-4 text-green-400"
                    strokeWidth={2}
                  />
                  <span className="text-xs text-neutral-400">المشروع</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white">
                      {head.project_name}
                    </div>
                    {head.project_symbol && (
                      <div
                        className="text-[10px] text-blue-400 font-mono mt-0.5"
                        dir="ltr"
                      >
                        ({head.project_symbol})
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-neutral-500">الكمية</div>
                    <div className="text-base font-bold text-white font-mono">
                      {fmtNum(head.shares)}{" "}
                      <span className="text-[10px] text-neutral-500">حصة</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Numbers */}
              <div className="bg-gradient-to-br from-green-400/[0.04] to-blue-400/[0.04] border border-green-400/15 rounded-xl p-3.5 space-y-2">
                <Row
                  label="السعر للحصة"
                  value={`${fmtNum(head.price_per_share)} د.ع`}
                />
                <Row
                  label="مبلغ الصفقة (يُدفع خارج التطبيق)"
                  value={`${fmtNum(head.total_amount)} د.ع`}
                  bold
                  color="text-green-400"
                />
                <div className="h-px bg-white/[0.05]" />
                <Row
                  label="عمولة المشتري (٢٪) — وحدات رسوم"
                  value={`${fmtNum(head.buyer_commission)} وحدة`}
                  color="text-blue-400"
                />
              </div>

              {/* Hint */}
              <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-400/[0.06] border border-blue-400/20 rounded-lg">
                <Coins
                  className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5"
                  strokeWidth={2}
                />
                <p className="text-[10px] text-blue-300 leading-relaxed">
                  بعد الموافقة تُفتح غرفة دردشة بينك والمشتري ١٥ دقيقة لإكمال
                  التحويل خارج التطبيق ثم رفع الإثبات.
                </p>
              </div>
            </>
          )}

          {mode === "rejecting" && (
            <div>
              <label className="block text-xs text-neutral-400 mb-2">
                سبب الرفض <span className="text-red-400">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="مثلاً: السعر تغيّر / لا أرغب بالبيع الآن / المشتري غير موثوق"
                maxLength={300}
                autoFocus
                className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-red-400/30 resize-none"
              />
              <div className="text-[10px] text-neutral-500 mt-1.5 leading-relaxed">
                سيُرسَل هذا السبب للمشتري ويُحفَظ في سجل الصفقة.
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
                  رفض
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
                  {submitting ? "جاري الموافقة..." : "موافقة + فتح الصفقة"}
                </button>
              </div>
              <button
                onClick={handleOpenInPage}
                disabled={submitting}
                className="w-full py-2 rounded-lg text-[11px] text-neutral-400 hover:text-white hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3 h-3" strokeWidth={2} />
                عرض في صفحة الصفقة (تأجيل القرار)
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
                رجوع
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
                {submitting ? "جاري الرفض..." : "تأكيد الرفض"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
  color = "text-white",
}: {
  label: string
  value: string
  bold?: boolean
  color?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-neutral-500">{label}</span>
      <span
        className={cn(
          "font-mono",
          bold ? "text-base font-bold" : "text-sm font-bold",
          color,
        )}
      >
        {value}
      </span>
    </div>
  )
}
