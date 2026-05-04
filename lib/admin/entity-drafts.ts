/**
 * Local-storage backed drafts for the admin entity (project/company)
 * creation form. Two purposes:
 *
 *  1. Persistence: if the admin navigates away mid-form (or refreshes),
 *     their typed data isn't lost. The form auto-saves to localStorage
 *     on every change.
 *
 *  2. Drafts list: when the admin clicks "💾 حفظ كمسودّة" we promote
 *     the in-progress entry into a saved-drafts collection so they
 *     can return to it later from the Drafts tab in /admin → Projects.
 *
 * Storage layout:
 *   railos.admin.entityDraft.<kind>.current  → in-progress autosave
 *   railos.admin.entityDraft.<kind>.list     → array of saved drafts
 * where <kind> is "project" or "company".
 */

import type { EntityFormData } from "@/components/admin/panels/EntityFormPanel"

export type DraftKind = "project" | "company"

export interface SavedDraft {
  /** UUID-ish so the list can dedupe + delete by id. */
  id: string
  /** Free-text title; defaults to entity name or "بدون اسم". */
  title: string
  /** ISO timestamp of last save. */
  saved_at: string
  /** The form payload — same shape as initialData. */
  data: EntityFormData
}

const PREFIX = "railos.admin.entityDraft"
const currentKey = (kind: DraftKind) => `${PREFIX}.${kind}.current`
const listKey = (kind: DraftKind) => `${PREFIX}.${kind}.list`

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function readJson<T>(key: string): T | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exceeded etc — silent fail; admin can still publish.
  }
}

// ─── Current (autosave) ──────────────────────────────────────────

export function loadCurrentDraft(kind: DraftKind): EntityFormData | null {
  return readJson<EntityFormData>(currentKey(kind))
}

export function saveCurrentDraft(kind: DraftKind, data: EntityFormData): void {
  writeJson(currentKey(kind), data)
}

export function clearCurrentDraft(kind: DraftKind): void {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(currentKey(kind))
  } catch {
    // ignore
  }
}

// ─── Saved drafts list ───────────────────────────────────────────

export function loadDraftsList(kind: DraftKind): SavedDraft[] {
  return readJson<SavedDraft[]>(listKey(kind)) ?? []
}

/** Insert or update a draft by id. Returns the saved row. */
export function saveDraft(kind: DraftKind, data: EntityFormData): SavedDraft {
  const list = loadDraftsList(kind)
  const id = data.id ?? `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const draft: SavedDraft = {
    id,
    title: data.name?.trim() || "بدون اسم",
    saved_at: new Date().toISOString(),
    data: { ...data, id },
  }
  const next = [draft, ...list.filter((d) => d.id !== id)]
  writeJson(listKey(kind), next)
  return draft
}

export function deleteDraft(kind: DraftKind, id: string): void {
  const next = loadDraftsList(kind).filter((d) => d.id !== id)
  writeJson(listKey(kind), next)
}

export function getDraftById(kind: DraftKind, id: string): SavedDraft | null {
  return loadDraftsList(kind).find((d) => d.id === id) ?? null
}
