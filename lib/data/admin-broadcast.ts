"use client"

/**
 * Admin broadcast notification helper (Phase DD).
 *
 * Wraps the `admin_broadcast_notification` RPC. The RPC does the
 * audience-filtering + bulk INSERT; push/email fan-out is handled by
 * the existing notifications realtime channel + /api/push/webhook,
 * so we don't have to fire those from the client.
 */

import { createClient } from "@/lib/supabase/client"

export type BroadcastPriority = "low" | "normal" | "high" | "urgent"

export type BroadcastAudience =
  | "all"
  | "kyc_verified"
  | "advanced_plus"
  | "pro_only"
  | "specific_user"
  | "by_city"

/** Subtype tag stored in metadata.subtype so the UI can show
 *  the right icon when it later renders the notification.
 *  Mirrors the panel's internal NotifType. */
export type BroadcastSubtype =
  | "announcement"
  | "feature"
  | "alert"
  | "maintenance"
  | "promo"

export interface BroadcastInput {
  title: string
  message: string
  priority: BroadcastPriority
  audience: BroadcastAudience
  /** UUID for specific_user; city name for by_city; ignored otherwise. */
  audience_param?: string
  /** Subtype for the UI badge — stored in metadata.subtype. */
  subtype?: BroadcastSubtype
  /** Optional CTA route inside the app (or external URL). */
  link_url?: string
  /** Optional CTA label — stored in metadata.action_label so the
   *  push webhook can surface it. */
  link_text?: string
}

export interface BroadcastResult {
  success: boolean
  recipients_count?: number
  reason?:
    | "unauthenticated"
    | "rls"
    | "missing_table"
    | "not_admin"
    | "title_required"
    | "message_required"
    | "audience_param_required"
    | "unknown"
  error?: string
}

export async function sendBroadcast(
  input: BroadcastInput,
): Promise<BroadcastResult> {
  if (!input.title?.trim()) {
    return { success: false, reason: "title_required" }
  }
  if (!input.message?.trim()) {
    return { success: false, reason: "message_required" }
  }
  if (
    (input.audience === "specific_user" || input.audience === "by_city") &&
    !input.audience_param?.trim()
  ) {
    return { success: false, reason: "audience_param_required" }
  }

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: "unauthenticated" }

    const metadata: Record<string, unknown> = {}
    if (input.subtype) metadata.subtype = input.subtype
    if (input.link_text?.trim()) metadata.action_label = input.link_text.trim()

    const { data, error } = await supabase.rpc("admin_broadcast_notification", {
      p_title: input.title.trim(),
      p_message: input.message.trim(),
      p_priority: input.priority,
      p_audience: input.audience,
      p_audience_param: input.audience_param ?? null,
      p_link_url: input.link_url?.trim() || null,
      p_metadata: metadata,
    })

    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (
        code === "42883" ||
        code === "42P01" ||
        /function .* does not exist/i.test(msg) ||
        /relation .* does not exist/i.test(msg)
      ) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501" || /permission/i.test(msg)) {
        return { success: false, reason: "rls", error: msg }
      }
      // eslint-disable-next-line no-console
      console.error("[admin-broadcast] rpc:", msg)
      return { success: false, reason: "unknown", error: msg }
    }

    const result = (data ?? {}) as {
      success?: boolean
      error?: string
      recipients_count?: number
    }
    if (!result.success) {
      return {
        success: false,
        reason: (result.error as BroadcastResult["reason"]) ?? "unknown",
        error: result.error,
      }
    }
    return {
      success: true,
      recipients_count: result.recipients_count ?? 0,
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[admin-broadcast] threw:", err)
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
