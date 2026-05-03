/**
 * Health check endpoint (Phase 10.1).
 *
 * GET /api/health → 200 with JSON status of:
 *   - DB: can we reach Supabase?
 *   - Auth: is the auth subsystem responding?
 *   - Build: commit + version metadata
 *
 * Used by uptime monitors / load balancers / Railway health probes.
 * Always returns 200 unless the runtime itself is broken — individual
 * subsystem failures are reported in the JSON body so a single
 * fetch returns full status.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface ComponentStatus {
  ok: boolean
  latency_ms?: number
  error?: string
}

interface HealthResponse {
  status: "ok" | "degraded"
  uptime_ms: number
  components: {
    db: ComponentStatus
    auth: ComponentStatus
  }
  build: {
    node_env: string
    has_supabase_url: boolean
    has_app_url: boolean
  }
}

const startedAt = Date.now()

async function checkDb(): Promise<ComponentStatus> {
  const t0 = Date.now()
  try {
    const supabase = await createClient()
    // Cheap "is the connection alive" probe — read 1 row count from a
    // tiny static table. Falls back to anything that responds.
    const { error } = await supabase
      .from("legal_pages")
      .select("id", { count: "exact", head: true })
      .limit(1)
    if (error) {
      // legal_pages may not exist yet — try profiles which always exists.
      const fallback = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .limit(1)
      if (fallback.error) {
        return { ok: false, error: fallback.error.message }
      }
    }
    return { ok: true, latency_ms: Date.now() - t0 }
  } catch (err) {
    return {
      ok: false,
      latency_ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function checkAuth(): Promise<ComponentStatus> {
  const t0 = Date.now()
  try {
    const supabase = await createClient()
    // getSession() never throws on missing session — only on broken
    // auth subsystem.
    await supabase.auth.getSession()
    return { ok: true, latency_ms: Date.now() - t0 }
  } catch (err) {
    return {
      ok: false,
      latency_ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function GET() {
  const [db, auth] = await Promise.all([checkDb(), checkAuth()])

  const allOk = db.ok && auth.ok
  const body: HealthResponse = {
    status: allOk ? "ok" : "degraded",
    uptime_ms: Date.now() - startedAt,
    components: { db, auth },
    build: {
      node_env: process.env.NODE_ENV ?? "unknown",
      has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      has_app_url: !!process.env.NEXT_PUBLIC_APP_URL,
    },
  }

  return NextResponse.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}
