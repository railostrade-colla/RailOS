import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

/**
 * Server-side push fan-out.
 * — Honours the recipient's `notification_preferences`
 *   (push_enabled + per-category + quiet hours)
 * — Sends to every active row in `push_subscriptions` for the user
 * — Auto-deactivates rows that return HTTP 410 (Gone)
 *
 * Auth model: this endpoint is called by your own backend / cron / RPC
 * trigger. It does NOT validate `auth.uid()` against `userId` because
 * it's expected to be invoked with a service-role context (or a Vercel
 * cron). For a tighter setup, gate this behind an internal `secret`
 * header before deployment.
 *
 * POST body:
 *   {
 *     userId: UUID,
 *     title: string,
 *     message: string,
 *     type?: string,            // notification_type → category mapping
 *     action_url?: string,
 *     action_label?: string,
 *     priority?: 'low'|'normal'|'high'|'urgent',
 *     notification_id?: UUID
 *   }
 */

interface SendBody {
  userId: string
  title: string
  message: string
  type?: string
  action_url?: string
  action_label?: string
  priority?: "low" | "normal" | "high" | "urgent"
  notification_id?: string
}

interface PrefsRow {
  push_enabled: boolean
  deals_enabled: boolean
  projects_enabled: boolean
  kyc_enabled: boolean
  level_enabled: boolean
  auctions_enabled: boolean
  council_enabled: boolean
  support_enabled: boolean
  disputes_enabled: boolean
  system_enabled: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start: string
  quiet_hours_end: string
}

/** Maps a notification_type to its preferences category flag. */
function categoryFlag(type: string | undefined): keyof PrefsRow | null {
  if (!type) return null
  if (type.startsWith("deal_") || type === "shares_received" || type === "shares_sold")
    return "deals_enabled"
  if (type.startsWith("project_")) return "projects_enabled"
  if (type.startsWith("kyc_")) return "kyc_enabled"
  if (type === "level_upgraded") return "level_enabled"
  if (type.startsWith("auction_")) return "auctions_enabled"
  if (type === "council_announcement") return "council_enabled"
  if (type === "support_reply") return "support_enabled"
  if (type.startsWith("dispute_")) return "disputes_enabled"
  if (type === "system") return "system_enabled"
  return null
}

/** True when `now` falls within [start, end] (handles wrap past midnight). */
function isWithinQuietHours(start: string, end: string): boolean {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")
  const cur = `${hh}:${mm}`
  const s = start.slice(0, 5)
  const e = end.slice(0, 5)
  return s > e ? cur >= s || cur < e : cur >= s && cur < e
}

function configureWebPush(): boolean {
  const subj = process.env.VAPID_SUBJECT
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!subj || !pub || !priv) return false
  webpush.setVapidDetails(subj, pub, priv)
  return true
}

export async function POST(req: NextRequest) {
  try {
    if (!configureWebPush()) {
      return NextResponse.json(
        { error: "VAPID keys are not configured on the server" },
        { status: 500 },
      )
    }

    const body = (await req.json()) as SendBody
    const { userId, title, message, type, action_url, action_label, priority } = body

    if (!userId || !title || !message) {
      return NextResponse.json(
        { error: "userId, title and message are required" },
        { status: 400 },
      )
    }

    const supabase = await createClient()

    // 1) Preferences gate
    const { data: prefsRaw } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    const prefs = prefsRaw as PrefsRow | null
    if (prefs && !prefs.push_enabled) {
      return NextResponse.json({ skipped: true, reason: "push_disabled" })
    }

    const flag = categoryFlag(type)
    if (prefs && flag && prefs[flag] === false) {
      return NextResponse.json({ skipped: true, reason: "category_disabled" })
    }

    if (
      prefs?.quiet_hours_enabled &&
      priority !== "urgent" &&
      isWithinQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end)
    ) {
      return NextResponse.json({ skipped: true, reason: "quiet_hours" })
    }

    // 2) Fetch active subscriptions
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh_key, auth_key")
      .eq("user_id", userId)
      .eq("is_active", true)

    if (!subs || subs.length === 0) {
      return NextResponse.json({ skipped: true, reason: "no_subscriptions" })
    }

    // 3) Fan out
    const payload = JSON.stringify({
      title,
      message,
      type,
      action_url,
      action_label,
      priority,
      notification_id: body.notification_id ?? null,
    })

    type SubRow = {
      id: string
      endpoint: string
      p256dh_key: string
      auth_key: string
    }

    const results = await Promise.allSettled(
      (subs as SubRow[]).map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
            },
            payload,
          )
          return { ok: true }
        } catch (err) {
          const status =
            (err as { statusCode?: number })?.statusCode ?? 0
          if (status === 404 || status === 410) {
            // Endpoint gone — deactivate row.
            await supabase
              .from("push_subscriptions")
              .update({ is_active: false })
              .eq("id", sub.id)
          }
          throw err
        }
      }),
    )

    const sent = results.filter((r) => r.status === "fulfilled").length
    return NextResponse.json({
      success: true,
      sent,
      total: subs.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
