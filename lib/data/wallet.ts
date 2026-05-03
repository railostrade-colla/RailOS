"use client"

/**
 * Real wallet data layer for /wallet/receive + /wallet/send.
 *
 * Phase 4.3 — READ-ONLY wiring:
 *   • getCurrentWalletInfo()         → user identity for receive screen
 *   • getMyHoldingsForSend()         → simplified holdings list for sender
 *   • getCurrentFeeBalanceSimple()   → fee balance number (with fallback)
 *   • verifyRecipient(query)         → lookup by username OR UUID
 *
 * The actual share-transfer write path is NOT implemented here — the
 * underlying schema doesn't have a transfers/gifts table yet. Submit
 * stays stubbed in /wallet/send and will be wired in Phase 4.X when
 * the schema gains a transfers table.
 *
 * Resilience pattern (matches Phase 4.1 / 4.2):
 *   Each fetcher has its own try/catch; missing rows or columns fall
 *   back to safe defaults instead of throwing to the caller.
 */

import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Types ─────────────────────────────────────────────────────

export interface WalletUserInfo {
  /** auth.users.id (UUID) — what gets encoded in the QR. */
  id: string
  email: string
  full_name: string | null
  username: string | null
  /** Derived: kyc_status === 'approved'. */
  is_verified: boolean
}

export interface WalletHolding {
  /** holdings row id */
  id: string
  project_id: string
  shares: number
  /** Alias of `shares` — keeps the page's existing UI shape happy. */
  shares_owned: number
  project: {
    id: string
    name: string
    sector: string
    share_price: number
  }
}

/**
 * Shape compatible with the legacy mock `MOCK_USERS_DB[string]`:
 *   { id, name, verified }
 */
export interface RecipientUser {
  id: string
  name: string
  verified: boolean
  /** Username when present (helpful for the UI; not in legacy shape). */
  username: string | null
}

export interface RecipientLookup {
  found: boolean
  user?: RecipientUser
  reason?: "not_found" | "banned" | "inactive" | "self"
}

// ─── Internal row types ─────────────────────────────────────────

interface ProfileRecipientRow {
  id: string
  full_name: string | null
  username: string | null
  kyc_status: string | null
  is_active: boolean | null
  is_banned: boolean | null
}

interface ProfileWalletRow {
  full_name?: string | null
  username?: string | null
  kyc_status?: string | null
}

interface HoldingRow {
  id: string
  project_id: string
  shares?: number | null
  project?: HoldingProjectRow | HoldingProjectRow[] | null
}

interface HoldingProjectRow {
  id?: string
  name?: string | null
  sector?: string | null
  share_price?: number | null
}

interface FeeBalanceRow {
  balance?: number | null
}

interface FeeUnitsBalanceFallback {
  fee_units_balance?: number | null
}

// ─── Helpers ────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function n(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = Number(v)
  return Number.isFinite(x) ? x : fallback
}

function unwrapJoined<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

// ─── Fetchers ───────────────────────────────────────────────────

export async function getCurrentWalletInfo(): Promise<WalletUserInfo | null> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
      .from("profiles")
      .select("full_name, username, kyc_status")
      .eq("id", user.id)
      .maybeSingle()

    const row = (data ?? {}) as ProfileWalletRow
    return {
      id: user.id,
      email: user.email ?? "",
      full_name: row.full_name ?? null,
      username: row.username ?? null,
      is_verified: row.kyc_status === "approved",
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[wallet] getCurrentWalletInfo failed:", err)
    return null
  }
}

export async function getMyHoldingsForSend(): Promise<WalletHolding[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from("holdings")
      .select(
        `
        id, project_id, shares,
        project:projects(id, name, sector, share_price)
      `,
      )
      .eq("user_id", user.id)
      .gt("shares", 0)
      .order("last_acquired_at", { ascending: false })

    if (error || !data) return []

    const out: WalletHolding[] = []
    for (const row of data as HoldingRow[]) {
      const project = unwrapJoined(row.project)
      if (!project || !project.id) continue
      const shares = n(row.shares)
      out.push({
        id: row.id,
        project_id: row.project_id,
        shares,
        shares_owned: shares,
        project: {
          id: project.id,
          name: project.name ?? "",
          sector: project.sector ?? "",
          share_price: n(project.share_price),
        },
      })
    }
    return out
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[wallet] getMyHoldingsForSend failed:", err)
    return []
  }
}

/**
 * Just the balance number — small, page-friendly variant.
 * Tries `fee_unit_balances`, falls back to `profiles.fee_units_balance`,
 * defaults to 0.
 */
export async function getCurrentFeeBalanceSimple(): Promise<number> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return 0

    // Primary
    try {
      const { data, error } = await supabase
        .from("fee_unit_balances")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle()
      if (!error && data) {
        return n((data as FeeBalanceRow).balance)
      }
    } catch {
      /* fall through */
    }

    // Fallback
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("fee_units_balance")
        .eq("id", user.id)
        .maybeSingle()
      if (!error && data) {
        return n((data as FeeUnitsBalanceFallback).fee_units_balance)
      }
    } catch {
      /* fall through */
    }

    return 0
  } catch {
    return 0
  }
}

/**
 * Look up a recipient by either:
 *   • their UUID (full auth.users.id), OR
 *   • their lowercased username.
 *
 * Refuses to return:
 *   • the calling user themselves (`self`)
 *   • banned or inactive accounts (`banned` / `inactive`)
 *
 * RLS on `profiles` is `SELECT USING(true)` so any authenticated user
 * can perform this lookup.
 */
export async function verifyRecipient(
  query: string,
): Promise<RecipientLookup> {
  const cleaned = query.trim()
  if (!cleaned) return { found: false, reason: "not_found" }

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let row: ProfileRecipientRow | null = null

    if (UUID_RE.test(cleaned)) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, username, kyc_status, is_active, is_banned")
        .eq("id", cleaned)
        .maybeSingle()
      row = (data ?? null) as ProfileRecipientRow | null
    } else {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, username, kyc_status, is_active, is_banned")
        .eq("username", cleaned.toLowerCase())
        .maybeSingle()
      row = (data ?? null) as ProfileRecipientRow | null
    }

    if (!row) return { found: false, reason: "not_found" }
    if (user && row.id === user.id) {
      return { found: false, reason: "self" }
    }
    if (row.is_banned) return { found: false, reason: "banned" }
    if (row.is_active === false) return { found: false, reason: "inactive" }

    return {
      found: true,
      user: {
        id: row.id,
        name: row.full_name ?? row.username ?? "مستخدم",
        verified: row.kyc_status === "approved",
        username: row.username,
      },
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[wallet] verifyRecipient failed:", err)
    return { found: false, reason: "not_found" }
  }
}

// Re-export the shared client type so callers can pin signatures if needed.
export type WalletSupabaseClient = SupabaseClient
