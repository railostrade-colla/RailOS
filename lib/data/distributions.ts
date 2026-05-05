"use client"

/**
 * distributions — orphan table reader. The schema is unknown to this
 * repo (the table exists in production but its CREATE TABLE was never
 * checked in), so we use a defensive SECURITY DEFINER RPC that returns
 * raw rows scoped to the caller (or any user, for admins).
 */

import { createClient } from "@/lib/supabase/client"

export interface Distribution {
  id: string
  user_id?: string
  project_id?: string
  amount?: number
  recorded_at?: string
  // We expose the unknown columns via index signature so consumers
  // can render whatever was returned without needing column-by-column
  // typing.
  [k: string]: unknown
}

export async function getMyDistributions(): Promise<Distribution[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_user_distributions")
    if (error || !Array.isArray(data)) return []
    return data as Distribution[]
  } catch {
    return []
  }
}

export async function getUserDistributions(userId: string): Promise<Distribution[]> {
  if (!userId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_user_distributions", {
      p_user_id: userId,
    })
    if (error || !Array.isArray(data)) return []
    return data as Distribution[]
  } catch {
    return []
  }
}
