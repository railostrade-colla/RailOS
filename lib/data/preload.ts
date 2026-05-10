"use client"

/**
 * Phase 11.31 — global app-data preloader.
 *
 * Goal: when the user lands on ANY authenticated page in the app, the
 * data they're going to need on the NEXT page they visit is already
 * sitting in the SWR cache. So when they tap a tile, the destination
 * renders instantly with cached data, and a silent background refresh
 * brings it up to date — they never see a loading spinner.
 *
 * This hook runs ONCE per AppLayout mount. It fires off every
 * commonly-needed read in parallel and writes to dedupCache. The
 * fetches are non-blocking — the layout renders immediately.
 *
 * Common reads warmed:
 *   • currentUser profile           → header, gating, level limits
 *   • all active projects           → market, exchange filter, dashboard
 *   • new + trending projects       → dashboard top sections
 *   • portfolio (holdings + summary) → portfolio + dashboard cards
 *   • fee balance                   → bottom-right badge, exchange create
 *   • notifications unread count    → bell badge
 *
 * Non-common reads (specific project pages, single-deal details,
 * admin lists) are not preloaded — they're cheap enough that the
 * page-level useEffect handles them with SWR.
 *
 * After the initial parallel burst, the hook re-runs every 60s in
 * the background to keep the cache warm without the user noticing.
 *
 * Failure handling: each fetcher is wrapped in try/catch — one
 * failed call never blocks the others.
 */

import { useEffect } from "react"
import {
  dedupCache,
  swrRevalidate,
} from "./cache"
import { getAllProjects, getNewProjects, getTrendingProjects } from "./projects"
import { getPortfolioData } from "./portfolio"
import { getCurrentFeeBalanceSimple } from "./wallet"
import { getCurrentUserProfile } from "./profile"
import {
  getNotifications,
  getUnreadCountForCurrentUser,
} from "./notifications"
import { getMyDealsEnriched } from "./deals"
import { getAllNews } from "./news"
import { getAllCompanies } from "./companies"
import { getExchangeListings, getMyExchangeListings } from "./listings"

// 60 s — the page-level reads have shorter TTLs (15-30s) which
// override this whenever a page is viewed. This longer interval is
// for tabs sitting idle in the background.
const PRELOAD_INTERVAL_MS = 60_000

async function preloadAll(): Promise<void> {
  // All fire in parallel — failures swallowed individually.
  const safe = <T>(p: Promise<T>) => p.catch(() => undefined)

  await Promise.all([
    // Profile (cache key matches what dashboard etc. read).
    safe(
      swrRevalidate("currentUser:profile", getCurrentUserProfile, 60_000),
    ),
    // Projects — three slices used across dashboard / market / exchange.
    safe(swrRevalidate("projects:active:all", getAllProjects, 30_000)),
    safe(swrRevalidate("projects:new:6", () => getNewProjects(6), 30_000)),
    safe(
      swrRevalidate("projects:trending:6", () => getTrendingProjects(6), 30_000),
    ),
    safe(swrRevalidate("projects:new:3", () => getNewProjects(3), 30_000)),
    safe(
      swrRevalidate("projects:trending:3", () => getTrendingProjects(3), 30_000),
    ),
    // Portfolio (matches the v3 cache key in portfolio.ts — Phase 13.15).
    safe(swrRevalidate("portfolio:data:v3", getPortfolioData, 15_000)),
    // Wallet fee balance (used on /exchange and exchange/create).
    safe(
      swrRevalidate("wallet:feeBalance", getCurrentFeeBalanceSimple, 30_000),
    ),
    // Notifications — list + unread count drive the bell + /notifications.
    safe(getNotifications(20)),
    safe(getUnreadCountForCurrentUser()),
    // Deals — /deals tabs read from cache for instant first paint.
    safe(getMyDealsEnriched()),
    // Market news + companies (used on /market).
    safe(getAllNews(12)),
    safe(getAllCompanies()),
    // Exchange listings — both market feed AND user's own log.
    safe(getExchangeListings()),
    safe(getMyExchangeListings()),
  ])
}

/**
 * Mount-once-per-shell hook. Wire into AppLayout (user-side) and the
 * admin shell so every authenticated page benefits.
 */
export function usePreloadAppData(): void {
  useEffect(() => {
    // Initial warm-up — fires immediately on mount.
    void preloadAll()

    // Background refresh — keeps the cache fresh while the tab is open
    // so a user who comes back after 5 minutes still gets instant
    // data on first paint.
    const id = window.setInterval(() => {
      // Skip when the tab is hidden — no point burning network on
      // a backgrounded tab. Browser will refresh on next focus.
      if (document.hidden) return
      void preloadAll()
    }, PRELOAD_INTERVAL_MS)

    // Refresh once when the tab regains focus (covers the
    // "user came back after laptop sleep" case).
    const onVisibility = () => {
      if (!document.hidden) void preloadAll()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])
}
