"use client"

/**
 * deal-messages — chat between buyer + seller for a single deal.
 * Phase 10.63 wires the orphaned `deal_messages` table.
 *
 * Read path: `get_deal_messages` RPC (RLS-aware — only the parties +
 * admins see rows). Realtime subscriptions live on the `deal_messages`
 * table, scoped by deal_id, so the chat updates instantly.
 *
 * Write path: `post_deal_message` RPC. Validates the caller is a party.
 */

import { createClient } from "@/lib/supabase/client"

export interface DealMessage {
  id: string
  deal_id: string
  sender_id: string
  sender_name: string
  message_type: string
  content: string | null
  attachment_url: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export async function getDealMessages(dealId: string): Promise<DealMessage[]> {
  if (!dealId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_deal_messages", {
      p_deal_id: dealId,
    })
    if (error || !Array.isArray(data)) return []
    return data as DealMessage[]
  } catch {
    return []
  }
}

export interface PostDealMessageResult {
  success: boolean
  id?: string
  error?: string
}

export async function postDealMessage(
  dealId: string,
  content: string,
  attachmentUrl?: string | null,
): Promise<PostDealMessageResult> {
  if (!dealId) return { success: false, error: "deal_id_missing" }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("post_deal_message", {
      p_deal_id: dealId,
      p_content: content ?? "",
      p_attachment_url: attachmentUrl ?? null,
    })
    if (error) return { success: false, error: error.message }
    const r = (data ?? {}) as { success?: boolean; id?: string; error?: string }
    if (!r.success) return { success: false, error: r.error ?? "unknown" }
    return { success: true, id: r.id }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "unknown",
    }
  }
}
