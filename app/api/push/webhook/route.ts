import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

/**
 * Supabase Database Webhook receiver — called by Supabase whenever a
 * row is INSERTed into `public.notifications`. Responsibilities:
 *
 *   1. Verify the optional shared secret (`SUPABASE_WEBHOOK_SECRET`).
 *   2. Filter to INSERT-on-notifications events only.
 *   3. Skip rows flagged `is_internal_only` or already pushed.
 *   4. Honour the recipient's `notification_preferences`
 *      (push_enabled + per-category + quiet hours; urgent bypasses).
 *   5. Fan out via web-push to every active row in
 *      `push_subscriptions` for that user.
 *   6. Auto-deactivate endpoints returning 410/404 (Gone).
 *   7. Mark the notification row as `sent_via_push = TRUE` on success.
 *
 * This endpoint is intentionally separate from `/api/push/send`:
 *   • `/api/push/send`  — manual fan-out, called from app code/admin
 *                         tools, expects `{ userId, title, message, ... }`.
 *   • `/api/push/webhook` — DB-event-driven, expects Supabase's
 *                           `{ type, table, record }` envelope.
 *
 * Configure in Supabase: Database → Webhooks → +Create →
 *   Table:    notifications
 *   Events:   Insert
 *   URL:      https://<your-app>/api/push/webhook
 *   Headers:  Authorization: Bearer <SUPABASE_WEBHOOK_SECRET>
 */

interface NotificationRecord {
  id: string
  user_id: string
  notification_type: string
  title: string
  message: string
  priority: "low" | "normal" | "high" | "urgent"
  link_url: string | null
  metadata: Record<string, unknown> | null
  is_read: boolean
  sent_via_push: boolean
  is_internal_only: boolean
}

interface WebhookPayload {
  type?: string // "INSERT" | "UPDATE" | "DELETE"
  table?: string
  record?: NotificationRecord
  schema?: string
  old_record?: NotificationRecord | null
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
  if (
    type.startsWith("deal_") ||
    type === "shares_received" ||
    type === "shares_sold" ||
    type === "payment_submitted" ||
    type === "payment_received"
  )
    return "deals_enabled"
  if (type.startsWith("project_")) return "projects_enabled"
  if (type.startsWith("kyc_")) return "kyc_enabled"
  if (type === "level_upgraded") return "level_enabled"
  if (type.startsWith("auction_")) return "auctions_enabled"
  if (type === "council_announcement") return "council_enabled"
  if (type === "support_reply") return "support_enabled"
  if (type.startsWith("dispute_")) return "disputes_enabled"
  if (type === "system" || type === "system_announcement") return "system_enabled"
  return null
}

/** True when `now` falls within [start, end] (handles wrap past midnight). */
function isWithinQuietHours(start: string, end: string): boolean {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")
  const cur = `${hh}:${mm}`
  const s = (start ?? "").slice(0, 5)
  const e = (end ?? "").slice(0, 5)
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

function getActionLabel(meta: Record<string, unknown> | null | undefined): string | undefined {
  if (!meta || typeof meta !== "object") return undefined
  const v = (meta as { action_label?: unknown }).action_label
  return typeof v === "string" ? v : undefined
}

export async function POST(req: NextRequest) {
  try {
    // 1) Optional shared-secret auth.
    const expectedSecret = process.env.SUPABASE_WEBHOOK_SECRET
    if (expectedSecret) {
      const authHeader = req.headers.get("authorization") ?? ""
      if (authHeader !== `Bearer ${expectedSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    // 2) Filter to INSERT-on-notifications.
    const payload = (await req.json()) as WebhookPayload
    const { type, table, record } = payload

    if (type !== "INSERT" || table !== "notifications") {
      return NextResponse.json({ skipped: true, reason: "not_relevant" })
    }
    if (!record || !record.user_id) {
      return NextResponse.json({ skipped: true, reason: "invalid_record" })
    }

    // 3) Skip flagged rows.
    if (record.is_internal_only === true) {
      return NextResponse.json({ skipped: true, reason: "internal_only" })
    }
    if (record.sent_via_push === true) {
      return NextResponse.json({ skipped: true, reason: "already_sent" })
    }

    // 4) Configure web-push.
    if (!configureWebPush()) {
      return NextResponse.json(
        { error: "VAPID keys are not configured on the server" },
        { status: 500 },
      )
    }

    const supabase = await createClient()

    // 5) Preferences gate (urgent bypasses every gate below).
    const isUrgent = record.priority === "urgent"

    if (!isUrgent) {
      const { data: prefsRaw } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", record.user_id)
        .maybeSingle()

      const prefs = prefsRaw as PrefsRow | null
      if (prefs && !prefs.push_enabled) {
        return NextResponse.json({ skipped: true, reason: "push_disabled" })
      }

      const flag = categoryFlag(record.notification_type)
      if (prefs && flag && prefs[flag] === false) {
        return NextResponse.json({ skipped: true, reason: "category_disabled" })
      }

      if (
        prefs?.quiet_hours_enabled &&
        isWithinQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end)
      ) {
        return NextResponse.json({ skipped: true, reason: "quiet_hours" })
      }
    }

    // 6) Fetch active subscriptions.
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh_key, auth_key")
      .eq("user_id", record.user_id)
      .eq("is_active", true)

    if (!subs || subs.length === 0) {
      return NextResponse.json({ skipped: true, reason: "no_subscriptions" })
    }

    // 7) Fan out.
    const pushPayload = JSON.stringify({
      title: record.title,
      message: record.message,
      type: record.notification_type,
      action_url: record.link_url ?? undefined,
      action_label: getActionLabel(record.metadata),
      priority: record.priority,
      notification_id: record.id,
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
            pushPayload,
          )
          return { ok: true, id: sub.id }
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode ?? 0
          if (status === 404 || status === 410) {
            // Endpoint gone — deactivate.
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
    const failed = results.filter((r) => r.status === "rejected").length

    // 8) Idempotency marker — flip sent_via_push so reruns/duplicate
    //    webhooks don't double-send.
    if (sent > 0) {
      await supabase
        .from("notifications")
        .update({ sent_via_push: true })
        .eq("id", record.id)
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: subs.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Reject anything that isn't a POST. */
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
