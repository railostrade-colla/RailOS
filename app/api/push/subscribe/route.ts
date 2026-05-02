import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

/**
 * Server-side subscription endpoint — alternative to the client-side
 * `subscribeToPush` flow when you want to persist via API instead of
 * direct Supabase calls.
 *
 * POST body: PushSubscription.toJSON()
 *   { endpoint: string, keys: { p256dh: string, auth: string } }
 *
 * Returns 200 with `{ success: true }` on upsert, 401 if unauthenticated,
 * 400 on bad payload, 500 on DB error.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json()) as {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
      user_agent?: string
      device_type?: string
    }

    if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        { error: "Invalid subscription payload" },
        { status: 400 },
      )
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: body.endpoint,
        p256dh_key: body.keys.p256dh,
        auth_key: body.keys.auth,
        user_agent: body.user_agent ?? null,
        device_type: body.device_type ?? null,
        is_active: true,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
