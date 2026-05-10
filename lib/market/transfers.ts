"use client"

/**
 * Phase 12 — Share-transfers data layer.
 *
 * Wraps the SECURITY DEFINER `execute_share_transfer` RPC. The RPC
 * itself reads the live commission rate via get_commission_rate(),
 * so callers never compute the rate locally.
 */

import { createClient } from "@/lib/supabase/client"
import { invalidateCache } from "@/lib/data/cache"
import type { CommissionType, ShareTransferRow } from "./phase12-types"

export async function determineTransferCategory(params: {
  senderId: string
  recipientId: string
}): Promise<CommissionType | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("determine_transfer_category", {
      p_sender_id: params.senderId,
      p_recipient_id: params.recipientId,
    })
    if (error) return null
    return (data as CommissionType) ?? null
  } catch {
    return null
  }
}

export async function executeShareTransfer(params: {
  senderId: string
  recipientId: string
  projectId: string
  shares: number
  notes?: string | null
}): Promise<{ success: boolean; reason?: string; transferId?: string }> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("execute_share_transfer", {
      p_sender_id: params.senderId,
      p_recipient_id: params.recipientId,
      p_project_id: params.projectId,
      p_shares: params.shares,
      p_notes: params.notes ?? null,
    })
    if (error) return { success: false, reason: error.message }
    invalidateCache("portfolio:data:v3")
    invalidateCache("phase12:transfers:recent")
    return { success: true, transferId: data as string }
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : String(err) }
  }
}

export async function listRecentTransfers(limit = 50): Promise<ShareTransferRow[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("share_transfers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data as ShareTransferRow[]
  } catch {
    return []
  }
}

export async function listSuspiciousTransfers(): Promise<ShareTransferRow[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("share_transfers")
      .select("*")
      .eq("is_mutual_pattern_penalty", true)
      .order("created_at", { ascending: false })
      .limit(50)
    if (error || !data) return []
    return data as ShareTransferRow[]
  } catch {
    return []
  }
}
