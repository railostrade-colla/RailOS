/**
 * Phase 12 — Daily market engine cron endpoint.
 *
 * Wakes up the permanent-mode rise calculation for every active project
 * once per day. Initial-mode rises happen automatically via the deal
 * triggers; only the permanent mode needs a daily kick.
 *
 * Trigger: Railway Scheduler (or any external cron) hitting:
 *   POST https://<host>/api/cron/run-market-engine
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Returns 401 without a valid bearer; 500 on RPC error; 200 on success
 * with `{ processed, date }`.
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on the server." },
      { status: 500 },
    )
  }
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if (token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: "Service-role client unavailable." },
      { status: 500 },
    )
  }

  const { data, error } = await supabase.rpc("run_daily_market_engine")
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// Allow GET as a diagnostic alias so a curl with no body still works.
export async function GET(req: Request): Promise<NextResponse> {
  return POST(req)
}
