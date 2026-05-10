/**
 * Phase 13.45 — slimmed market layer.
 *
 * Old layer pulled in MarketEngine + DevelopmentIndex + StabilityFund
 * — none of which were wired to a real consumer. Now we re-export
 * only the types and the modules that production actually uses:
 *
 *   • types        — MarketState / MarketPhase / HealthStatus
 *                    consumed by mock data + admin overview
 *   • commissions  — get_commission_rate wrappers used by transfers
 *   • transfers    — execute_share_transfer wrapper used by /wallet/send
 *
 * Other modules (stability, sector caps, activity score, trust
 * score, engine mode, freezes, decisions log, daily run) were
 * removed — they were the duplicate "engine" the founder asked to
 * collapse.
 */
export type * from "./types"
