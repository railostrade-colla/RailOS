"use client"

/**
 * DB-backed admin entity drafts (Phase 10.35).
 *
 * This module is the *server-side* half of the entity drafts feature.
 * The fast localStorage autosave still lives in lib/admin/entity-drafts.ts —
 * we only touch the network when the admin explicitly:
 *
 *   • Saves a named draft ("💾 حفظ كمسودّة")  → upsertDraftDB
 *   • Opens the drafts tab                      → listDraftsDB
 *   • Deletes a draft                           → deleteDraftDB
 *
 * Every function returns a `null` / `false` on failure so callers can
 * silently fall back to localStorage when the table doesn't exist yet
 * (migration not applied) or RLS blocks the request.
 */

import { createClient } from "@/lib/supabase/client"
import type { EntityFormData } from "@/components/admin/panels/EntityFormPanel"
import type { DraftKind, SavedDraft } from "@/lib/admin/entity-drafts"

interface DraftRow {
  id: string
  owner_id: string
  kind: DraftKind
  title: string
  data: EntityFormData
  created_at: string
  updated_at: string
}

function rowToSavedDraft(r: DraftRow): SavedDraft {
  return {
    id: r.id,
    title: r.title,
    saved_at: r.updated_at,
    data: { ...r.data, id: r.id },
  }
}

/** List the caller's saved drafts of a given kind. Returns [] on any failure. */
export async function listDraftsDB(kind: DraftKind): Promise<SavedDraft[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("entity_drafts")
      .select("*")
      .eq("kind", kind)
      .order("updated_at", { ascending: false })
      .limit(100)
    if (error || !data) return []
    return (data as DraftRow[]).map(rowToSavedDraft)
  } catch {
    return []
  }
}

/**
 * Insert or update a draft. The id on `data` (if any) becomes the row id.
 * Returns the saved row, or null on failure.
 */
export async function upsertDraftDB(
  kind: DraftKind,
  data: EntityFormData,
): Promise<SavedDraft | null> {
  try {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) return null

    const id = data.id || crypto.randomUUID()
    const title = data.name?.trim() || "بدون اسم"

    const payload = {
      id,
      owner_id: uid,
      kind,
      title,
      data: { ...data, id },
    }

    const { data: row, error } = await supabase
      .from("entity_drafts")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single()
    if (error || !row) return null
    return rowToSavedDraft(row as DraftRow)
  } catch {
    return null
  }
}

/** Delete a draft by id. Returns true on success. */
export async function deleteDraftDB(id: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from("entity_drafts").delete().eq("id", id)
    return !error
  } catch {
    return false
  }
}

/** Fetch a single draft by id (mostly for "resume" deep-links). */
export async function getDraftByIdDB(id: string): Promise<SavedDraft | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("entity_drafts")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return rowToSavedDraft(data as DraftRow)
  } catch {
    return null
  }
}
