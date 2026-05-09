"use client"

/**
 * PendingRequestsModal — Phase 12.12.
 *
 * Opens when the user clicks the "طلبات معلقة" pill on /portfolio.
 * Lists every pending item that touches their wallet:
 *   • صفقات معلقة (deals where they're buyer/seller, not completed/cancelled)
 *   • طلبات شحن وحدات pending (fee_unit_requests)
 *   • تحويلات حصص بانتظار (share_transfers)
 *
 * Each row has up to 3 actions:
 *   ✅ إكمال    → routes to the dedicated page (/deals/{id} | /wallet/...)
 *   ❌ إلغاء    → cancels in DB (supported for fee requests + via deal page)
 *   👁 تجاهل    → closes modal, item stays in queue
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  X,
  ArrowLeft,
  Trash2,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { Modal } from "@/components/ui"
import { showSuccess, showError } from "@/lib/utils/toast"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const fmtDate = (iso: string) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export interface PendingItem {
  /** Row kind so we can pick the right action set. */
  kind: "deal" | "fee_request" | "transfer"
  /** Original ID without prefix (deal id, fee_request id, transfer id). */
  id: string
  icon: string
  title: string
  subtitle?: string
  amount?: number
  statusLabel?: string
  created_at: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  items: PendingItem[]
  /** Called after a successful inline mutation so the parent can refresh. */
  onChanged?: () => void
}

export function PendingRequestsModal({
  isOpen,
  onClose,
  items,
  onChanged,
}: Props) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  const handleComplete = (item: PendingItem) => {
    if (item.kind === "deal") {
      onClose()
      router.push(`/deals/${item.id}`)
      return
    }
    if (item.kind === "fee_request") {
      // Fee requests are processed by an admin — there's no
      // user-side "complete" step. Direct them to the requests page
      // so they can see the full status thread.
      onClose()
      router.push(`/exchange?view=my_listings`)
      return
    }
    if (item.kind === "transfer") {
      onClose()
      router.push(`/wallet/sent`)
    }
  }

  const handleCancel = async (item: PendingItem) => {
    if (item.kind === "fee_request") {
      // Inline cancel — set status='rejected' on user's own row.
      // Uses a soft cancel (rejected with note) so admin still sees
      // the audit trail. Falls back to a DELETE if the UPDATE fails.
      setBusyId(item.id)
      try {
        const supabase = createClient()
        const { error } = await supabase
          .from("fee_unit_requests")
          .update({
            status: "rejected",
            rejection_reason: "ألغاه المستخدم",
          })
          .eq("id", item.id)
        if (error) {
          // RLS might forbid update; try delete as fallback (own row).
          const del = await supabase
            .from("fee_unit_requests")
            .delete()
            .eq("id", item.id)
          if (del.error) {
            showError("تعذّر إلغاء الطلب — تواصل مع الدعم")
            return
          }
        }
        showSuccess("✅ تم إلغاء طلب الشحن")
        onChanged?.()
      } catch {
        showError("تعذّر إلغاء الطلب")
      } finally {
        setBusyId(null)
      }
      return
    }

    // Deals + transfers — cancellation flow lives on the deal page
    // (it usually requires the counter-party's agreement).
    onClose()
    if (item.kind === "deal") {
      router.push(`/deals/${item.id}?action=cancel`)
    } else {
      router.push(`/wallet/sent`)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⏳ الطلبات المعلّقة"
      subtitle={
        items.length === 0
          ? "لا توجد طلبات معلّقة"
          : `${items.length} طلب بانتظار إجراء`
      }
      size="md"
    >
      {items.length === 0 ? (
        <div className="py-10 text-center">
          <Clock className="w-10 h-10 text-neutral-600 mx-auto mb-3" strokeWidth={1.5} />
          <div className="text-sm text-neutral-400">
            ليس لديك طلبات معلّقة حالياً.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <PendingItemRow
              key={`${item.kind}-${item.id}`}
              item={item}
              busy={busyId === item.id}
              onComplete={() => handleComplete(item)}
              onCancel={() => handleCancel(item)}
            />
          ))}

          {/* Hint */}
          <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-400/[0.06] border border-blue-400/20 rounded-lg mt-4">
            <AlertCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-300 leading-relaxed">
              <strong>إكمال</strong> ينقلك لصفحة الإجراء التفصيلية.{" "}
              <strong>إلغاء</strong> يُلغي الطلب نهائياً.{" "}
              <strong>تجاهل</strong> يبقي الطلب في القائمة.
            </p>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────

function PendingItemRow({
  item,
  busy,
  onComplete,
  onCancel,
}: {
  item: PendingItem
  busy: boolean
  onComplete: () => void
  onCancel: () => void
}) {
  const showCancel = item.kind !== "transfer" // transfers are admin-only
  const completeLabel =
    item.kind === "deal"
      ? "فتح الصفقة"
      : item.kind === "fee_request"
        ? "متابعة"
        : "عرض"

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3.5">
      {/* Top row */}
      <div className="flex items-start gap-2.5 mb-3">
        <div className="text-2xl shrink-0">{item.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-white truncate">
              {item.title}
            </span>
            {item.statusLabel && (
              <span className="bg-yellow-400/[0.12] border border-yellow-400/30 text-yellow-300 px-1.5 py-px rounded text-[9px] font-bold flex-shrink-0">
                {item.statusLabel}
              </span>
            )}
          </div>
          {item.subtitle && (
            <div className="text-[10px] text-neutral-500 truncate" dir="ltr">
              {item.subtitle}
            </div>
          )}
          <div className="text-[10px] text-neutral-500 mt-1 flex items-center gap-2">
            <span dir="ltr">{fmtDate(item.created_at)}</span>
            {item.amount != null && (
              <>
                <span className="text-neutral-700">·</span>
                <span
                  className={cn(
                    "font-mono font-bold",
                    item.amount >= 0 ? "text-green-400" : "text-red-400",
                  )}
                >
                  {item.amount >= 0 ? "+" : ""}
                  {fmtNum(item.amount)} د.ع
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        {showCancel && (
          <button
            onClick={onCancel}
            disabled={busy}
            className="py-2 rounded-lg bg-red-500/[0.1] border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/[0.18] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
            )}
            إلغاء
          </button>
        )}
        <button
          onClick={onComplete}
          disabled={busy}
          className={cn(
            "py-2 rounded-lg bg-green-500 text-black text-xs font-bold hover:bg-green-600 flex items-center justify-center gap-1.5",
            !showCancel && "col-span-2",
          )}
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
          {completeLabel}
        </button>
      </div>
    </div>
  )
}
