import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@/lib/supabase/server"
import { getUserEmail } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email/send"
import { renderNotificationEmail } from "@/lib/email/templates/notification"

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
  email_enabled: boolean
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

    const supabase = await createClient()

    // 4) Preferences gate — fetch once, derive flags for both channels.
    //    `urgent` priority overrides every preference (security/abuse).
    const isUrgent = record.priority === "urgent"
    const isLow = record.priority === "low"

    const { data: prefsRaw } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", record.user_id)
      .maybeSingle()
    const prefs = prefsRaw as PrefsRow | null

    const flag = categoryFlag(record.notification_type)
    const categoryAllowed = !flag || !prefs || prefs[flag] !== false
    const inQuietHours =
      !!prefs?.quiet_hours_enabled &&
      isWithinQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end)

    const pushAllowed =
      isUrgent ||
      ((!prefs || prefs.push_enabled !== false) &&
        categoryAllowed &&
        !inQuietHours)

    // Email is opt-in by default (email_enabled defaults TRUE in DB).
    // Don't email for `low` priority — not worth the inbox clutter.
    const emailAllowed =
      !isLow &&
      (isUrgent ||
        ((!prefs || prefs.email_enabled !== false) && categoryAllowed))

    let pushSent = 0
    let pushFailed = 0
    let pushTotal = 0
    let emailSent = false
    let emailSkippedReason: string | undefined

    // ─── PUSH BRANCH ──────────────────────────────────────────
    if (pushAllowed && configureWebPush()) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh_key, auth_key")
        .eq("user_id", record.user_id)
        .eq("is_active", true)

      if (subs && subs.length > 0) {
        pushTotal = subs.length
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
                await supabase
                  .from("push_subscriptions")
                  .update({ is_active: false })
                  .eq("id", sub.id)
              }
              throw err
            }
          }),
        )

        pushSent = results.filter((r) => r.status === "fulfilled").length
        pushFailed = results.filter((r) => r.status === "rejected").length

        if (pushSent > 0) {
          await supabase
            .from("notifications")
            .update({ sent_via_push: true })
            .eq("id", record.id)
        }
      }
    }

    // ─── EMAIL BRANCH ─────────────────────────────────────────
    if (emailAllowed) {
      // Skip cheaply if Resend isn't configured at all.
      if (!process.env.RESEND_API_KEY) {
        emailSkippedReason = "resend_not_configured"
      } else {
        const userEmail = await getUserEmail(record.user_id)
        if (!userEmail) {
          emailSkippedReason = "no_email"
        } else {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, username")
            .eq("id", record.user_id)
            .maybeSingle()
          const profileRow = profile as
            | { full_name?: string | null; username?: string | null }
            | null

          const { html, text } = renderNotificationEmail({
            name:
              profileRow?.full_name ??
              profileRow?.username ??
              undefined,
            title: record.title,
            message: record.message,
            actionUrl: record.link_url ?? undefined,
            actionLabel: getActionLabel(record.metadata) ?? undefined,
            priority: record.priority,
          })

          const result = await sendEmail({
            to: userEmail,
            subject: record.title,
            html,
            text,
          })

          if (result.success) {
            emailSent = true
            await supabase
              .from("notifications")
              .update({ sent_via_email: true })
              .eq("id", record.id)
          } else {
            emailSkippedReason = result.skipped
              ? "resend_skipped"
              : `resend_error: ${result.error ?? "unknown"}`
          }
        }
      }
    } else {
      emailSkippedReason = !emailAllowed
        ? isLow
          ? "low_priority"
          : "category_or_pref_disabled"
        : undefined
    }

    return NextResponse.json({
      success: true,
      push: {
        sent: pushSent,
        failed: pushFailed,
        total: pushTotal,
        skipped: !pushAllowed,
      },
      email: {
        sent: emailSent,
        skipped_reason: emailSkippedReason,
      },
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
