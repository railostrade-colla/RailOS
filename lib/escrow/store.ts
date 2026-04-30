/**
 * Escrow Store — In-memory mutable state for escrow deals + locked shares.
 *
 * في mock mode، نحفظ الحالة في Map للسماح بسيناريوهات تفاعلية بين الـ pages.
 * في production يُستبدَل هذا بـ Supabase tables.
 *
 * الجداول المتوقّعة في DB:
 *   - escrow_deals   (matches EscrowDeal interface)
 *   - locked_shares  (user_id, project_id, deal_id, amount)
 */

import type { EscrowDeal } from "./types"
import { MOCK_ESCROW_DEALS, MOCK_LOCKED_SHARES, type LockedShareEntry } from "./mock-data"

// ──────────────────────────────────────────────────────────────────────────
// State (mutable in dev, persists across HMR within same module)
// ──────────────────────────────────────────────────────────────────────────

const dealsStore = new Map<string, EscrowDeal>()
const lockedSharesStore: LockedShareEntry[] = []

// Hydrate from mock data (only once)
let hydrated = false
function hydrate() {
  if (hydrated) return
  for (const d of MOCK_ESCROW_DEALS) dealsStore.set(d.id, { ...d })
  for (const l of MOCK_LOCKED_SHARES) lockedSharesStore.push({ ...l })
  hydrated = true
}
hydrate()

// ──────────────────────────────────────────────────────────────────────────
// Deal accessors
// ──────────────────────────────────────────────────────────────────────────

export function getAllDeals(): EscrowDeal[] {
  return Array.from(dealsStore.values()).sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getDealById(id: string): EscrowDeal | undefined {
  return dealsStore.get(id)
}

export function getDealsByUser(userId: string): EscrowDeal[] {
  return getAllDeals().filter((d) => d.buyer_id === userId || d.seller_id === userId)
}

export function getActiveDealsByUser(userId: string): EscrowDeal[] {
  return getDealsByUser(userId).filter((d) =>
    d.status === "pending" ||
    d.status === "payment_confirmed" ||
    d.status === "cancellation_requested" ||
    d.status === "disputed"
  )
}

export function getActiveDealByUserAndListing(userId: string, listingId: string): EscrowDeal | undefined {
  return getActiveDealsByUser(userId).find((d) => d.listing_id === listingId)
}

export function setDeal(deal: EscrowDeal): void {
  dealsStore.set(deal.id, deal)
}

// ──────────────────────────────────────────────────────────────────────────
// Locked shares accessors
// ──────────────────────────────────────────────────────────────────────────

export function getLockedSharesEntries(userId: string, projectId?: string): LockedShareEntry[] {
  return lockedSharesStore.filter(
    (e) => e.user_id === userId && (projectId === undefined || e.project_id === projectId)
  )
}

export function getTotalLockedShares(userId: string, projectId: string): number {
  return getLockedSharesEntries(userId, projectId).reduce((s, e) => s + e.amount, 0)
}

export function addLockedShares(entry: LockedShareEntry): void {
  lockedSharesStore.push({ ...entry })
}

export function removeLockedShares(dealId: string): void {
  for (let i = lockedSharesStore.length - 1; i >= 0; i--) {
    if (lockedSharesStore[i].deal_id === dealId) {
      lockedSharesStore.splice(i, 1)
    }
  }
}
