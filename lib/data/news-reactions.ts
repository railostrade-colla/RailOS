"use client"

/**
 * news_reactions data layer (Phase P).
 *
 * Wraps the `news_reactions` table from `supabase/06_notifications.sql`.
 * The schema's `reaction_type` enum has 5 values; we expose the same set.
 *
 * The companion `news.reactions_count` column is maintained by a DB
 * trigger (`update_news_reactions_count`), so we never have to compute
 * the aggregate ourselves — read it back from `news` when you need it.
 */

import { createClient } from "@/lib/supabase/client"

export type ReactionType = "like" | "love" | "celebrate" | "applause" | "fire"

const VALID_REACTIONS: ReadonlyArray<ReactionType> = [
  "like",
  "love",
  "celebrate",
  "applause",
  "fire",
]

function isReactionType(s: string | null | undefined): s is ReactionType {
  return !!s && (VALID_REACTIONS as ReadonlyArray<string>).includes(s)
}

/**
 * Returns the current user's reaction on a news item, or null when:
 *   • the user is unauthenticated
 *   • they haven't reacted yet
 *   • the table is unavailable (missing migration)
 */
export async function getMyReaction(
  newsId: string,
): Promise<ReactionType | null> {
  if (!newsId) return null
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from("news_reactions")
      .select("reaction_type")
      .eq("news_id", newsId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (error || !data) return null
    const row = data as { reaction_type?: string | null }
    return isReactionType(row.reaction_type) ? row.reaction_type : null
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[reactions] getMyReaction threw:", err)
    return null
  }
}

export interface SetReactionResult {
  success: boolean
  /** What the user's reaction is *after* the call. Null = removed. */
  reaction: ReactionType | null
  error?: string
}

/**
 * Toggle a user's reaction on a news item:
 *   • if they have no reaction → INSERT
 *   • if they have a different one → UPDATE
 *   • if they have the same one → DELETE (toggle-off)
 *
 * Done in three small queries instead of an UPSERT to keep the
 * idempotent-toggle semantics clear and avoid surprising the
 * `update_news_reactions_count` trigger.
 */
export async function setReaction(
  newsId: string,
  type: ReactionType,
): Promise<SetReactionResult> {
  if (!newsId) return { success: false, reaction: null, error: "missing news_id" }
  if (!isReactionType(type))
    return { success: false, reaction: null, error: "invalid reaction" }

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, reaction: null, error: "غير مسجَّل دخول" }
    }

    // 1) Read existing reaction.
    const { data: existing } = await supabase
      .from("news_reactions")
      .select("id, reaction_type")
      .eq("news_id", newsId)
      .eq("user_id", user.id)
      .maybeSingle()

    const existingRow = existing as
      | { id: string; reaction_type: string | null }
      | null

    // 2) Same type → delete (toggle-off).
    if (existingRow && existingRow.reaction_type === type) {
      const { error: delErr } = await supabase
        .from("news_reactions")
        .delete()
        .eq("id", existingRow.id)
      if (delErr) {
        // eslint-disable-next-line no-console
        console.error("[reactions] delete:", delErr.message)
        return { success: false, reaction: type, error: delErr.message }
      }
      return { success: true, reaction: null }
    }

    // 3) Different type or no row → upsert with onConflict on the
    //    UNIQUE(news_id, user_id) constraint.
    const { error: upErr } = await supabase
      .from("news_reactions")
      .upsert(
        { news_id: newsId, user_id: user.id, reaction_type: type },
        { onConflict: "news_id,user_id" },
      )
    if (upErr) {
      // eslint-disable-next-line no-console
      console.error("[reactions] upsert:", upErr.message)
      return { success: false, reaction: existingRow?.reaction_type as ReactionType ?? null, error: upErr.message }
    }
    return { success: true, reaction: type }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[reactions] setReaction threw:", err)
    return {
      success: false,
      reaction: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
