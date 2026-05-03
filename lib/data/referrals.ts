"use client"

/**
 * Referrals data layer (Phase 9.1).
 *
 * Wraps the link_referral_by_code + get_ambassador_by_code RPCs
 * from 20260503_phase9_link_referral_rpc.sql.
 *
 * Used by:
 *   - /register page → preview ambassador name before signup
 *   - /api/auth/callback → link the new Google user to their referrer
 */

import { createClient } from "@/lib/supabase/client"

// ─── Types ───────────────────────────────────────────────────

export interface AmbassadorPreview {
  found: boolean
  ambassador_name?: string
  expires_at?: string
}

export interface LinkReferralResult {
  success: boolean
  reason?: string
  error?: string
  already_linked?: boolean
  ambassador_user_id?: string
  referral_link_id?: string
}

// ─── Helpers ─────────────────────────────────────────────────

function isMissingFn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = error.code ?? ""
  const msg = error.message ?? ""
  return (
    code === "42883" ||
    code === "42P01" ||
    /function .* does not exist/i.test(msg) ||
    /relation .* does not exist/i.test(msg)
  )
}

// ─── Reads ───────────────────────────────────────────────────

/** Look up the ambassador name for a code (used on /register?ref=...). */
export async function getAmbassadorByCode(
  code: string,
): Promise<AmbassadorPreview> {
  if (!code) return { found: false }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_ambassador_by_code", {
      p_code: code,
    })
    if (error || !data) return { found: false }
    const r = data as AmbassadorPreview
    return {
      found: !!r.found,
      ambassador_name: r.ambassador_name,
      expires_at: r.expires_at,
    }
  } catch {
    return { found: false }
  }
}

// ─── Writes (RPC) ────────────────────────────────────────────

/** Attach the currently-signed-in user to the referrer identified by
 *  the code. Idempotent — calling twice is a no-op. */
export async function linkReferralByCode(
  code: string,
): Promise<LinkReferralResult> {
  if (!code) return { success: false, reason: "no_code" }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("link_referral_by_code", {
      p_code: code,
    })
    if (error) {
      if (isMissingFn(error)) {
        return { success: false, reason: "missing_table", error: error.message }
      }
      if (error.code === "42501") {
        return { success: false, reason: "rls", error: error.message }
      }
      return { success: false, reason: "unknown", error: error.message }
    }
    const result = (data ?? {}) as {
      success?: boolean
      error?: string
      already_linked?: boolean
      ambassador_user_id?: string
      referral_link_id?: string
    }
    if (!result.success) {
      return { success: false, reason: result.error ?? "unknown" }
    }
    return {
      success: true,
      already_linked: result.already_linked ?? false,
      ambassador_user_id: result.ambassador_user_id,
      referral_link_id: result.referral_link_id,
    }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
