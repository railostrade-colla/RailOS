/**
 * lib/data — Supabase-backed data layer.
 *
 * Functions return DB-shape arrays (or empty array on error).
 * Pages use:
 *   const data = await getXxx()
 *   if (data.length === 0) → fall back to lib/mock-data
 *
 * Single import path:
 *   import { getAllProjects, getAllNews, ... } from "@/lib/data"
 */

export * from "./projects"
export * from "./companies"
export * from "./holdings"
export * from "./council"
export * from "./auctions-real"
export * from "./follows"
export * from "./notifications"
export * from "./news"
export * from "./ads"
export * from "./listings"
export * from "./deals"
export * from "./support"
export * from "./friendships"

// Re-export shared types from mock-data so callers can use the same shapes.
export type { Project, Company, Holding, Trade, AppNotification, Auction, Listing, Ad } from "@/lib/mock-data/types"
