/**
 * Centralized mock-data barrel.
 *
 * Import named exports from this single path:
 *   import { PROJECTS, mockHoldings, mockNotifications } from "@/lib/mock-data"
 *
 * Each domain file keeps both canonical and legacy-aliased exports so
 * existing pages can switch over without changing local references.
 */

// Types
export * from "./types"

// Domain data
export * from "./projects"
export * from "./companies"
export * from "./holdings"
export * from "./users"
export * from "./profile"
export * from "./contracts"
export * from "./trades"
export * from "./notifications"
export * from "./auctions"
export * from "./ads"
export * from "./listings"
export * from "./ambassador"
export * from "./support"
export * from "./deal"
export * from "./news"
export * from "./market"
export * from "./feeUnits"
export * from "./following"
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
export * from "./adminUsers"
