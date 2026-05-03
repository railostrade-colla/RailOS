"use client"

/**
 * Deal ratings data layer (Phase R).
 *
 * Wraps the `ratings` table from `supabase/03_deals.sql`.
 * The `update_user_rating` trigger keeps profiles.rating_average +
 * rating_count fresh whenever a row is inserted, so we never have to
 * recompute either ourselves.
 *
 * Constraints enforced by the DB:
 *   • UNIQUE(deal_id, rater_id) — one rating per user per deal
 *   • CHECK(rater_id != rated_user_id) — no self-ratings
 *   • CHECK(stars BETWEEN 1 AND 5)
 *
 * Surface them as friendly messages so the page can show the user
 * what happened without leaking PostgREST error codes.
 */

import { createClient } from "@/lib/supabase/client"

export interface SubmitRatingParams {
  /** Foreign key into deals.id. */
  deal_id: string
  /** The user being rated — typically the other party in the deal. */
  rated_user_id: string
  /** 1..5. */
  stars: number
  /** Optional plaintext comment. Max ~500 chars by convention. */
  comment?: string
  /** Optional bag of preset tags ("سريع", "موثوق", …). */
  quick_tags?: string[]
}

export interface SubmitRatingResult {
  success: boolean
  /** Set to a stable code so the UI can branch on it. */
  reason?:
    | "unauthenticated"
    | "self_rating"
    | "already_rated"
    | "invalid_stars"
    | "invalid_input"
    | "missing_table"
    | "rls"
    | "unknown"
  error?: string
}

/**
 * Inserts a rating row from the signed-in user toward `rated_user_id`
 * on a specific deal. Returns a structured result so the page can
 * tailor the toast (e.g. distinguish "already rated" from "RLS").
 */
export async function submitRating(
  params: SubmitRatingParams,
): Promise<SubmitRatingResult> {
  if (!params.deal_id) {
    return { success: false, reason: "invalid_input", error: "deal_id missing" }
  }
  if (!params.rated_user_id) {
    return { success: false, reason: "invalid_input", error: "rated_user_id missing" }
  }
  const stars = Math.round(Number(params.stars))
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return { success: false, reason: "invalid_stars", error: "stars must be 1..5" }
  }

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: "unauthenticated" }
    if (user.id === params.rated_user_id) {
      return { success: false, reason: "self_rating", error: "لا يمكنك تقييم نفسك" }
    }

    const { error } = await supabase.from("ratings").insert({
      deal_id: params.deal_id,
      rater_id: user.id,
      rated_user_id: params.rated_user_id,
      stars,
      comment: params.comment?.trim() || null,
      quick_tags: params.quick_tags ?? [],
    })

    if (error) {
      // 23505 = unique violation → already rated this deal.
      if (error.code === "23505") {
        return {
          success: false,
          reason: "already_rated",
          error: "قمت بتقييم هذه الصفقة من قبل",
        }
      }
      // 23514 = check violation → CHECK constraint failed (no_self_rating
      // or stars range, but we already gate those above).
      if (error.code === "23514") {
        return { success: false, reason: "invalid_input", error: error.message }
      }
      // 42P01 = relation doesn't exist (migration not applied).
      if (
        error.code === "42P01" ||
        /relation .* does not exist/i.test(error.message)
      ) {
        return { success: false, reason: "missing_table", error: error.message }
      }
      // 42501 = permission denied (RLS).
      if (error.code === "42501" || /permission/i.test(error.message)) {
        return { success: false, reason: "rls", error: error.message }
      }
      // eslint-disable-next-line no-console
      console.error("[ratings] submit:", error.message)
      return { success: false, reason: "unknown", error: error.message }
    }

    return { success: true }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[ratings] submit threw:", err)
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Returns the current user's existing rating for a deal, or null when
 * they haven't rated yet / aren't authenticated / the table is missing.
 * Useful when re-opening the rate modal — the form can pre-fill.
 */
export async function getMyRatingForDeal(
  dealId: string,
): Promise<{ stars: number; comment: string | null; quick_tags: string[] } | null> {
  if (!dealId) return null
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from("ratings")
      .select("stars, comment, quick_tags")
      .eq("deal_id", dealId)
      .eq("rater_id", user.id)
      .maybeSingle()

    if (error || !data) return null
    const row = data as { stars: number; comment: string | null; quick_tags: string[] | null }
    return {
      stars: row.stars,
      comment: row.comment,
      quick_tags: Array.isArray(row.quick_tags) ? row.quick_tags : [],
    }
  } catch {
    return null
  }
}
