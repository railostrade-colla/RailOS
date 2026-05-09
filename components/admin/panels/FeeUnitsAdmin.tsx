"use client"

/**
 * Legacy alias — Phase 12.5 (2026-05-09).
 *
 * `FeeUnitsAdminPanel` used to be a hardcoded mock stub that rendered
 * an empty "وحدات الرسوم - الإدارة الكاملة" page with the comment
 * "Empty until the duplicate tab is removed". Admins landing on the
 * Fees hub clicked it, saw nothing, and reported lost requests.
 *
 * The real, DB-wired implementation has always been
 * `FeeUnitsRequestsPanel` (reads from `fee_unit_requests`, mutates via
 * `approve_fee_request` / `reject_fee_request` RPCs). This file now
 * simply re-exports that panel so any direct deep-link
 * (`/admin?tab=fee_units_admin`) keeps working and shows real data
 * instead of a misleading "لا توجد طلبات" empty state.
 *
 * If we ever build a separate "unit-pricing tier" config UI it will
 * live here under a new file/name; this alias stays so old links
 * never 404 to silence.
 */

export { FeeUnitsRequestsPanel as FeeUnitsAdminPanel } from "./FeeUnitsRequestsPanel"
