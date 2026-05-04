import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database"

export type FollowTargetType = Database["public"]["Enums"]["follow_target_type"]

/** FollowRow mirrors the generated Row shape. */
export type FollowRow = Database["public"]["Tables"]["follows"]["Row"]

export interface FollowResult {
  success: boolean
  reason?: string
  error?: string
  id?: string
}

/** Fetch all of the current user's follows. Returns [] on failure. */
export async function getMyFollows(): Promise<FollowRow[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("follows")
      .select("*")
      .order("created_at", { ascending: false })
    if (error || !data) return []
    return data as FollowRow[]
  } catch {
    return []
  }
}

/** Filter follows by target type. */
export async function getMyFollowsByType(
  type: FollowTargetType,
): Promise<FollowRow[]> {
  const all = await getMyFollows()
  return all.filter((f) => f.target_type === type)
}

/** Returns true if the current user follows this target. */
export async function isFollowing(
  type: FollowTargetType,
  targetId: string,
): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("follows")
      .select("id")
      .eq("target_type", type)
      .eq("target_id", targetId)
      .maybeSingle()
    if (error) return false
    return !!data
  } catch {
    return false
  }
}

export async function followTarget(
  type: FollowTargetType,
  targetId: string,
): Promise<FollowResult> {
  if (!targetId) return { success: false, reason: "missing_target" }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("follow_target", {
      p_target_type: type,
      p_target_id: targetId,
    })
    if (error) {
      const code = error.code ?? ""
      if (code === "42P01" || code === "42883") {
        return { success: false, reason: "missing_table", error: error.message }
      }
      return { success: false, reason: "unknown", error: error.message }
    }
    const result = (data ?? {}) as FollowResult
    if (!result.success) {
      return { success: false, reason: result.reason ?? result.error ?? "unknown" }
    }
    return result
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function unfollowTarget(
  type: FollowTargetType,
  targetId: string,
): Promise<FollowResult> {
  if (!targetId) return { success: false, reason: "missing_target" }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("unfollow_target", {
      p_target_type: type,
      p_target_id: targetId,
    })
    if (error) {
      const code = error.code ?? ""
      if (code === "42P01" || code === "42883") {
        return { success: false, reason: "missing_table", error: error.message }
      }
      return { success: false, reason: "unknown", error: error.message }
    }
    return (data ?? { success: true }) as FollowResult
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
