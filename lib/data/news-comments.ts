"use client"

/**
 * news-comments — Phase 13.63.
 *
 * User-callable RPCs for the news comments feature. Reads list
 * comments (joining poster's safe display fields via profiles_public),
 * writes through SECURITY DEFINER RPCs that enforce ownership.
 */

import { createClient } from "@/lib/supabase/client"

export interface NewsComment {
  id: string
  news_id: string
  user_id: string
  content: string
  created_at: string
  author_name: string
  author_avatar: string | null
  is_mine: boolean
  is_deleted: boolean
}

export async function getNewsComments(
  newsId: string,
  limit: number = 200,
): Promise<NewsComment[]> {
  if (!newsId) return []
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const myId = user?.id ?? null

    const { data, error } = await supabase
      .from("news_comments")
      .select("id, news_id, user_id, content, created_at, is_deleted")
      .eq("news_id", newsId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error || !data) return []

    interface Row {
      id: string
      news_id: string
      user_id: string
      content: string
      created_at: string
      is_deleted: boolean
    }
    const rows = data as Row[]
    if (rows.length === 0) return []

    // Batch-fetch posters from the safe-columns view.
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)))
    const profileMap = new Map<string, { name: string; avatar: string | null }>()
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles_public")
        .select("id, full_name, username, avatar_url")
        .in("id", userIds)
      type ProfileRow = {
        id: string
        full_name: string | null
        username: string | null
        avatar_url: string | null
      }
      for (const p of (profiles ?? []) as ProfileRow[]) {
        profileMap.set(p.id, {
          name: p.full_name?.trim() || p.username?.trim() || "—",
          avatar: p.avatar_url,
        })
      }
    }

    return rows.map((r) => ({
      id: r.id,
      news_id: r.news_id,
      user_id: r.user_id,
      content: r.content,
      created_at: r.created_at,
      author_name: profileMap.get(r.user_id)?.name ?? "—",
      author_avatar: profileMap.get(r.user_id)?.avatar ?? null,
      is_mine: myId === r.user_id,
      is_deleted: r.is_deleted,
    }))
  } catch {
    return []
  }
}

export interface CommentRpcResult {
  success: boolean
  comment_id?: string
  error?: string
}

export async function submitNewsComment(
  newsId: string,
  content: string,
): Promise<CommentRpcResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("submit_news_comment", {
      p_news_id: newsId,
      p_content: content,
    })
    if (error) return { success: false, error: error.message }
    type R = { success?: boolean; comment_id?: string; error?: string }
    const r = (data ?? {}) as R
    if (!r.success) return { success: false, error: r.error ?? "unknown" }
    return { success: true, comment_id: r.comment_id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "unknown" }
  }
}

export async function deleteNewsComment(commentId: string): Promise<CommentRpcResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("delete_news_comment", {
      p_comment_id: commentId,
    })
    if (error) return { success: false, error: error.message }
    type R = { success?: boolean; error?: string }
    const r = (data ?? {}) as R
    if (!r.success) return { success: false, error: r.error ?? "unknown" }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "unknown" }
  }
}
