/**
 * Centralized mock-data barrel.
 *
 * Import named exports from this single path:
 *   import { PROJECTS, mockHoldings, mockNotifications } from "@/lib/mock-data"
 *
 * Each domain file keeps both canonical and legacy-aliased exports so
 * existing pages can switch over without changing local references.
 *
 * Phase 14.07g — eight domain files were removed entirely (0 importers
 * after the Phase 14.07.1 / .e / .f cleanups):
 *   adminUsers, ads, ambassador, deal, following,
 *   notifications, trades, users
 * Their re-exports are gone from this barrel. The 21 remaining modules
 * still have real consumers (admin panels, social-program pages whose
 * routes are hidden from navigation, type imports, …).
 */

// Types
export * from "./types"

// Domain data
export * from "./projects"
export * from "./companies"
export * from "./holdings"
export * from "./profile"
export * from "./contracts"
export * from "./auctions"
export * from "./listings"
export * from "./support"
export * from "./news"
export * from "./market"
export * from "./feeUnits"
export * from "./council"
export * from "./kyc"
export * from "./disputes"
export * from "./payments"
export * from "./ambassadors"
export * from "./auditLog"
export * from "./healthcare"
export * from "./orphans"
export * from "./discounts"
export * from "./projectWallets"
export * from "./marketAdvisor"
export * from "./legalPages"
