"use client"

/**
 * Legal pages data layer (Phase 10.1).
 *
 * Wraps the legal_pages table from 20260504_phase10_hardening.sql.
 * Public reads are gated by `is_published`; admins see everything
 * and can upsert via admin_upsert_legal_page().
 */

import { createClient } from "@/lib/supabase/client"

export interface LegalPageRow {
  id: string
  slug: string
  title: string
  content: string
  version: number
  is_published: boolean
  published_at: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface LegalPageRpcResult {
  success: boolean
  reason?: string
  error?: string
  id?: string
  version?: number
}

/** Public — fetch a published page by slug. */
export async function getPublishedLegalPage(
  slug: string,
): Promise<LegalPageRow | null> {
  if (!slug) return null
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from("legal_pages")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle()
    return (data as LegalPageRow | null) ?? null
  } catch {
    return null
  }
}

/** Admin — list all pages (published + drafts). */
export async function getAllLegalPages(): Promise<LegalPageRow[]> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from("legal_pages")
      .select("*")
      .order("slug", { ascending: true })
    return (data as LegalPageRow[] | null) ?? []
  } catch {
    return []
  }
}

/** Admin — fetch one page (published or draft) for editing. */
export async function getLegalPageBySlug(
  slug: string,
): Promise<LegalPageRow | null> {
  if (!slug) return null
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from("legal_pages")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()
    return (data as LegalPageRow | null) ?? null
  } catch {
    return null
  }
}

export async function adminUpsertLegalPage(input: {
  slug: string
  title: string
  content: string
  publish?: boolean
}): Promise<LegalPageRpcResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_upsert_legal_page", {
      p_slug: input.slug,
      p_title: input.title,
      p_content: input.content,
      p_publish: input.publish ?? false,
    })
    if (error) {
      const code = error.code ?? ""
      if (code === "42883" || code === "42P01") {
        return { success: false, reason: "missing_table", error: error.message }
      }
      if (code === "42501") return { success: false, reason: "rls", error: error.message }
      return { success: false, reason: "unknown", error: error.message }
    }
    const result = (data ?? {}) as LegalPageRpcResult & { id?: string; version?: number }
    if (!result.success) {
      return { success: false, reason: result.reason ?? "unknown" }
    }
    return { success: true, id: result.id, version: result.version }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
