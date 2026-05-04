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
//
// Two-tier strategy (Phase 10.35):
//   • localStorage holds an instant-load cache + an offline fallback.
//   • DB (entity_drafts table) is the source of truth so drafts move
//     across devices.
// The async helpers below merge both — they read/write localStorage
// for snappy UX and dispatch to the DB layer when the network is up.
// If the DB call fails (migration not applied, RLS denial, offline)
// we silently fall back to localStorage so the panel never breaks.

import {
  listDraftsDB,
  upsertDraftDB,
  deleteDraftDB,
  getDraftByIdDB,
} from "@/lib/data/entity-drafts"

/** Synchronous read of the local cache only — used for first paint. */
export function loadDraftsList(kind: DraftKind): SavedDraft[] {
  return readJson<SavedDraft[]>(listKey(kind)) ?? []
}

/**
 * Async: pulls the canonical drafts list from the DB and refreshes the
 * local cache. Falls back to the cache on failure.
 */
export async function loadDraftsListAsync(kind: DraftKind): Promise<SavedDraft[]> {
  const remote = await listDraftsDB(kind)
  if (remote.length > 0) {
    writeJson(listKey(kind), remote)
    return remote
  }
  // Empty remote could mean (a) genuinely no drafts, (b) migration not
  // applied. Fall back to cache so a fresh DB doesn't wipe the user's
  // local-only drafts.
  return loadDraftsList(kind)
}

/**
 * Insert or update a draft. Writes both to the DB and to localStorage.
 * The DB row wins if it returns successfully; otherwise we still keep
 * a local copy so nothing is lost.
 */
export async function saveDraft(
  kind: DraftKind,
  data: EntityFormData,
): Promise<SavedDraft> {
  // Try DB first. The DB assigns/preserves the id and timestamps.
  const remote = await upsertDraftDB(kind, data)
  const draft: SavedDraft =
    remote ?? {
      id: data.id ?? `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: data.name?.trim() || "بدون اسم",
      saved_at: new Date().toISOString(),
      data: { ...data },
    }
  if (!remote) draft.data = { ...data, id: draft.id }

  // Always update local cache so the next first-paint is snappy.
  const list = loadDraftsList(kind)
  const next = [draft, ...list.filter((d) => d.id !== draft.id)]
  writeJson(listKey(kind), next)
  return draft
}

export async function deleteDraft(kind: DraftKind, id: string): Promise<void> {
  await deleteDraftDB(id) // best-effort
  const next = loadDraftsList(kind).filter((d) => d.id !== id)
  writeJson(listKey(kind), next)
}

export async function getDraftById(
  kind: DraftKind,
  id: string,
): Promise<SavedDraft | null> {
  const remote = await getDraftByIdDB(id)
  if (remote) return remote
  return loadDraftsList(kind).find((d) => d.id === id) ?? null
}
