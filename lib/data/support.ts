"use client"

/**
 * Support — DB-backed data layer (Phase 6.3).
 *
 * Wraps support_tickets + ticket_messages tables created by
 * 20260503_phase6_support_schema.sql. Mutations go through
 * SECURITY DEFINER RPCs:
 *   - create_support_ticket
 *   - reply_to_ticket
 *   - close_support_ticket
 *
 * FAQs intentionally remain in `lib/mock-data/support.ts` (static
 * content — no DB needed).
 */

import { createClient } from "@/lib/supabase/client"

// ─── Types ───────────────────────────────────────────────────

export type DBTicketCategory =
  | "technical"
  | "billing"
  | "kyc"
  | "complaint"
  | "feature_request"
  | "other"

export type DBTicketPriority = "low" | "medium" | "high"

export type DBTicketStatus = "new" | "in_progress" | "replied" | "closed"

export interface DBSupportTicket {
  id: string
  user_id: string
  subject: string
  body: string
  category: DBTicketCategory
  priority: DBTicketPriority
  status: DBTicketStatus
  assigned_to?: string | null
  last_message_at: string
  closed_at?: string | null
  closed_reason?: string | null
  created_at: string
  updated_at: string
}

export interface DBTicketMessage {
  id: string
  ticket_id: string
  sender_id: string
  sender_type: "user" | "admin"
  sender_name: string
  body: string
  created_at: string
}

interface ProfileRef {
  full_name?: string | null
  username?: string | null
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

// ─── Reads ───────────────────────────────────────────────────

export async function getMyTickets(): Promise<DBSupportTicket[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false })

    if (error || !data) return []
    return data as DBSupportTicket[]
  } catch {
    return []
  }
}

export async function getTicketById(
  id: string,
): Promise<DBSupportTicket | null> {
  if (!id) return null
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return data as DBSupportTicket
  } catch {
    return null
  }
}

export async function getTicketMessages(
  ticketId: string,
): Promise<DBTicketMessage[]> {
  if (!ticketId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("ticket_messages")
      .select(
        `id, ticket_id, sender_id, sender_type, body, created_at,
         sender:profiles!sender_id ( full_name, username )`,
      )
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })

    if (error || !data) return []

    interface MsgRow {
      id: string
      ticket_id: string
      sender_id: string
      sender_type: "user" | "admin"
      body: string
      created_at: string
      sender?: ProfileRef | ProfileRef[] | null
    }

    return (data as MsgRow[]).map((m) => {
      const s = unwrap(m.sender)
      const name =
        m.sender_type === "admin"
          ? s?.full_name?.trim() || s?.username?.trim() || "فريق الدعم"
          : s?.full_name?.trim() || s?.username?.trim() || "أنت"
      return {
        id: m.id,
        ticket_id: m.ticket_id,
        sender_id: m.sender_id,
        sender_type: m.sender_type,
        sender_name: name,
        body: m.body,
        created_at: m.created_at,
      }
    })
  } catch {
    return []
  }
}

// ─── Writes (RPC) ────────────────────────────────────────────

export interface SupportRpcResult {
  success: boolean
  reason?: string
  error?: string
  ticket_id?: string
}

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<SupportRpcResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc(fn, args)
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
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    const result = (data ?? {}) as {
      success?: boolean
      error?: string
      ticket_id?: string
    }
    if (!result.success) {
      return { success: false, reason: result.error ?? "unknown" }
    }
    return { success: true, ticket_id: result.ticket_id }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function createSupportTicket(input: {
  subject: string
  body: string
  category?: DBTicketCategory
  priority?: DBTicketPriority
}): Promise<SupportRpcResult> {
  return callRpc("create_support_ticket", {
    p_subject: input.subject,
    p_body: input.body,
    p_category: input.category ?? "other",
    p_priority: input.priority ?? "medium",
  })
}

export async function replyToTicket(
  ticketId: string,
  body: string,
): Promise<SupportRpcResult> {
  return callRpc("reply_to_ticket", {
    p_ticket_id: ticketId,
    p_body: body,
  })
}

export async function closeTicket(
  ticketId: string,
  reason?: string,
): Promise<SupportRpcResult> {
  return callRpc("close_support_ticket", {
    p_ticket_id: ticketId,
    p_reason: reason ?? null,
  })
}
