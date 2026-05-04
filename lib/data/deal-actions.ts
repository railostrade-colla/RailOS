import { createClient } from "@/lib/supabase/client"

/**
 * Deal lifecycle action wrappers — calls the SECURITY DEFINER RPCs
 * defined by `20260504_phase10_deal_lifecycle.sql`.
 *
 * All return a stable Result shape: { success, reason?, error? }.
 * Reasons map to Arabic messages on the page.
 */

export interface DealActionResult {
  success: boolean
  reason?: string
  error?: string
  current_status?: string
  accepted?: boolean
}

interface RpcError {
  code?: string
  message?: string
}

function classifyError(error: RpcError): DealActionResult {
  const code = error.code ?? ""
  const msg = error.message ?? ""
  if (code === "42883" || code === "42P01" || /function .* does not exist/i.test(msg)) {
    return { success: false, reason: "missing_table", error: msg }
  }
  if (code === "42501") return { success: false, reason: "rls", error: msg }
  return { success: false, reason: "unknown", error: msg }
}

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<DealActionResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc(fn, args)
    if (error) return classifyError(error)
    const r = (data ?? {}) as DealActionResult
    if (!r.success) {
      return {
        success: false,
        reason: r.reason ?? r.error ?? "unknown",
        current_status: r.current_status,
      }
    }
    return r
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export const sellerAcceptDeal = (id: string) =>
  callRpc("seller_accept_deal", { p_deal_id: id })

export const sellerRejectDeal = (id: string, reason?: string) =>
  callRpc("seller_reject_deal", { p_deal_id: id, p_reason: reason ?? null })

export const buyerConfirmPayment = (id: string) =>
  callRpc("buyer_confirm_payment", { p_deal_id: id })

export const sellerReleaseShares = (id: string) =>
  callRpc("seller_release_shares", { p_deal_id: id })

export const requestDealCancellation = (id: string, reason: string) =>
  callRpc("request_deal_cancellation", { p_deal_id: id, p_reason: reason })

export const respondDealCancellation = (id: string, accept: boolean) =>
  callRpc("respond_deal_cancellation", { p_deal_id: id, p_accept: accept })

export const openDealDispute = (id: string, reason: string) =>
  callRpc("open_deal_dispute", { p_deal_id: id, p_reason: reason })

/** Maps RPC reasons → Arabic UI messages. */
export const DEAL_ACTION_ERROR_AR: Record<string, string> = {
  unauthenticated: "يجب تسجيل الدخول أولاً",
  deal_not_found: "الصفقة غير موجودة",
  not_seller: "هذا الإجراء للبائع فقط",
  not_buyer: "هذا الإجراء للمشتري فقط",
  not_party: "أنت لست طرفاً في هذه الصفقة",
  wrong_status: "حالة الصفقة لا تسمح بهذا الإجراء",
  reason_required: "السبب مطلوب (5 أحرف على الأقل)",
  already_requested: "تم تقديم طلب إلغاء سابقاً",
  no_request: "لا يوجد طلب إلغاء معلّق",
  cant_respond_own_request: "لا يمكنك الرد على طلبك الخاص",
  missing_table: "الميزة غير مفعّلة بعد على الخادم",
  rls: "ليس لديك صلاحية لهذا الإجراء",
}

export function dealActionErrorAr(reason?: string): string {
  return DEAL_ACTION_ERROR_AR[reason ?? ""] ?? "تعذّر تنفيذ الإجراء"
}
