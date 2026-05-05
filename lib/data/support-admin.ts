"use client"

/**
 * Support admin — DB-backed data layer (Phase 7).
 *
 * Wraps support_tickets / ticket_messages from the admin perspective:
 * lists ALL tickets (RLS allows admins), assigns them, replies, closes.
 *
 * Reuses the existing user-facing RPCs (reply_to_ticket /
 * close_support_ticket) where possible — they already handle the
 * admin path via is_admin() inside the function.
 */

import { createClient } from "@/lib/supabase/client"

export type AdminTicketCategory =
  | "technical" | "billing" | "kyc" | "complaint" | "feature_request" | "other"
export type AdminTicketPriority = "low" | "medium" | "high"
export type AdminTicketStatus = "new" | "in_progress" | "replied" | "closed"

export interface AdminTicketRow {
  id: string
  user_id: string
  user_name: string
  user_email: string
  user_level: "basic" | "advanced" | "pro" | "elite"
  user_kyc_status: "approved" | "pending" | "rejected" | "not_submitted"
  subject: string
  body: string
  category: AdminTicketCategory
  priority: AdminTicketPriority
  status: AdminTicketStatus
  assigned_to?: string | null
  assigned_to_name?: string | null
  created_at: string
  updated_at: string
  closed_at?: string | null
  closed_reason?: string | null
}

interface ProfileRef {
  id?: string | null
  full_name?: string | null
  username?: string | null
  email?: string | null
  level?: string | null
  kyc_status?: string | null
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function levelKind(s: string | null | undefined): AdminTicketRow["user_level"] {
  if (s === "advanced") return "advanced"
  if (s === "pro") return "pro"
  if (s === "elite") return "elite"
  return "basic"
}

function kycKind(s: string | null | undefined): AdminTicketRow["user_kyc_status"] {
  if (s === "approved") return "approved"
  if (s === "pending") return "pending"
  if (s === "rejected") return "rejected"
  return "not_submitted"
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ""
  return iso.replace("T", " ").slice(0, 16)
}

// ─── Reads ───────────────────────────────────────────────────

export async function getAllTickets(): Promise<AdminTicketRow[]> {
  try {
    const supabase = createClient()
    // Two-step manual join (Phase 10.41).
    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        `id, user_id, subject, body, category, priority, status,
         assigned_to, last_message_at, closed_at, closed_reason,
         created_at, updated_at`,
      )
      .order("created_at", { ascending: false })

    if (error || !data) return []

    interface Row {
      id: string
      user_id: string
      subject: string
      body: string
      category: AdminTicketCategory
      priority: AdminTicketPriority
      status: AdminTicketStatus
      assigned_to?: string | null
      created_at: string
      updated_at: string
      closed_at?: string | null
      closed_reason?: string | null
    }

    const rows = data as Row[]

    // Profiles (ticket user + optional assignee). The shared helper
    // only fetches full_name/username/level — for support we also
    // need email + kyc_status, so query manually here.
    const userIds = Array.from(
      new Set(
        [
          ...rows.map((r) => r.user_id),
          ...rows.map((r) => r.assigned_to).filter((x): x is string => Boolean(x)),
        ].filter((x): x is string => Boolean(x)),
      ),
    )
    interface SupportProfile {
      id: string
      full_name: string | null
      username: string | null
      email: string | null
      level: string | null
      kyc_status: string | null
    }
    const profileMap = new Map<string, SupportProfile>()
    if (userIds.length > 0) {
      try {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, username, email, level, kyc_status")
          .in("id", userIds)
        for (const p of (profs ?? []) as SupportProfile[]) profileMap.set(p.id, p)
      } catch { /* leave empty */ }
    }

    return rows.map((r) => {
      const u = profileMap.get(r.user_id) ?? null
      const a = r.assigned_to ? profileMap.get(r.assigned_to) ?? null : null
      return {
        id: r.id,
        user_id: r.user_id,
        user_name: u?.full_name?.trim() || u?.username?.trim() || "—",
        user_email: u?.email ?? "",
        user_level: levelKind(u?.level),
        user_kyc_status: kycKind(u?.kyc_status),
        subject: r.subject,
        body: r.body,
        category: r.category,
        priority: r.priority,
        status: r.status,
        assigned_to: r.assigned_to ?? null,
        assigned_to_name: a
          ? a.full_name?.trim() || a.username?.trim() || null
          : null,
        created_at: fmtDate(r.created_at),
        updated_at: fmtDate(r.updated_at),
        closed_at: r.closed_at ? fmtDate(r.closed_at) : null,
        closed_reason: r.closed_reason ?? null,
      }
    })
  } catch {
    return []
  }
}

export interface AdminTicketsStats {
  new_count: number
  in_progress: number
  replied: number
  closed: number
  total: number
}

export function computeTicketsStats(rows: AdminTicketRow[]): AdminTicketsStats {
  return {
    new_count: rows.filter((r) => r.status === "new").length,
    in_progress: rows.filter((r) => r.status === "in_progress").length,
    replied: rows.filter((r) => r.status === "replied").length,
    closed: rows.filter((r) => r.status === "closed").length,
    total: rows.length,
  }
}

export interface TicketReply {
  id: string
  sender_type: "user" | "admin"
  sender_name: string
  sender_role?: string
  body: string
  created_at: string
}

export async function getTicketReplies(ticketId: string): Promise<TicketReply[]> {
  if (!ticketId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("ticket_messages")
      .select(
        `id, sender_id, sender_type, body, created_at,
         sender:profiles!sender_id ( full_name, username )`,
      )
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })

    if (error || !data) return []

    interface MsgRow {
      id: string
      sender_id: string
      sender_type: "user" | "admin"
      body: string
      created_at: string
      sender?: ProfileRef | ProfileRef[] | null
    }

    // Skip the very first message (it duplicates support_tickets.body)
    return (data as MsgRow[]).slice(1).map((m) => {
      const s = unwrap(m.sender)
      const name =
        s?.full_name?.trim() || s?.username?.trim() ||
        (m.sender_type === "admin" ? "أدمن" : "مستخدم")
      return {
        id: m.id,
        sender_type: m.sender_type,
        sender_name: name,
        sender_role: m.sender_type === "admin" ? "admin" : undefined,
        body: m.body,
        created_at: fmtDate(m.created_at),
      }
    })
  } catch {
    return []
  }
}

export async function getAdminList(): Promise<{ id: string; name: string }[]> {
  try {
    const supabase = createClient()
    // is_admin BOOLEAN column on profiles (added by 20260503_is_admin_helper.sql)
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, username, is_admin")
      .eq("is_admin", true)
      .limit(100)

    if (error || !data) return []
    return (data as Array<ProfileRef & { is_admin?: boolean }>).map((p) => ({
      id: p.id ?? "",
      name: p.full_name?.trim() || p.username?.trim() || "أدمن",
    }))
  } catch {
    return []
  }
}

// ─── Writes (RPC) ────────────────────────────────────────────

export interface AdminRpcResult {
  success: boolean
  reason?: string
  error?: string
}

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<AdminRpcResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc(fn, args)
    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (code === "42883" || code === "42P01" ||
          /function .* does not exist/i.test(msg) ||
          /relation .* does not exist/i.test(msg)) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    const result = (data ?? {}) as { success?: boolean; error?: string }
    if (!result.success) return { success: false, reason: result.error ?? "unknown" }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function assignTicket(
  ticketId: string,
  assigneeId: string | null,
): Promise<AdminRpcResult> {
  return callRpc("admin_assign_ticket", {
    p_ticket_id: ticketId,
    p_assignee_id: assigneeId,
  })
}

export async function setTicketStatus(
  ticketId: string,
  status: AdminTicketStatus,
): Promise<AdminRpcResult> {
  return callRpc("admin_set_ticket_status", {
    p_ticket_id: ticketId,
    p_status: status,
  })
}

export async function adminReplyToTicket(
  ticketId: string,
  body: string,
): Promise<AdminRpcResult> {
  return callRpc("reply_to_ticket", {
    p_ticket_id: ticketId,
    p_body: body,
  })
}

export async function adminCloseTicket(
  ticketId: string,
  reason?: string,
): Promise<AdminRpcResult> {
  return callRpc("close_support_ticket", {
    p_ticket_id: ticketId,
    p_reason: reason ?? null,
  })
}
