/**
 * Generic notification email template.
 *
 * One template covers every notification type — title + message + an
 * optional CTA button. Renders RTL Arabic-first, dark-themed to match
 * the app, but with tasteful colour and proper email-client fallbacks
 * (table layout, inline styles, hex colours).
 *
 * Email clients ignore most modern CSS — keep the markup simple.
 */

export type NotificationPriority = "low" | "normal" | "high" | "urgent"

export interface NotificationEmailData {
  /** The user's display name, e.g. "أحمد محمد". Falls back to "مستخدم". */
  name?: string | null
  /** Notification title (becomes the email subject and headline). */
  title: string
  /** Notification body. */
  message: string
  /**
   * Absolute URL the recipient should land on. The CTA button is hidden
   * if this is empty/undefined.
   */
  actionUrl?: string | null
  /** Button label — defaults to "فتح التطبيق". */
  actionLabel?: string | null
  /** Affects the accent colour of the headline. */
  priority?: NotificationPriority
  /** Defaults to "Railos" — used in footer. */
  appName?: string
}

/** Hex accent per priority — same family as the in-app palette. */
const PRIORITY_COLORS: Record<NotificationPriority, string> = {
  low:    "#a1a1aa",
  normal: "#60a5fa",
  high:   "#fbbf24",
  urgent: "#f87171",
}

/**
 * Renders the notification template.
 * Returns both `html` and a plain-`text` fallback (some clients prefer it).
 */
export function renderNotificationEmail(data: NotificationEmailData): {
  html: string
  text: string
} {
  const name = (data.name ?? "").trim() || "مستخدم"
  const priority = data.priority ?? "normal"
  const accent = PRIORITY_COLORS[priority]
  const appName = data.appName ?? "Railos"
  const showCta = !!data.actionUrl
  const actionLabel = (data.actionLabel ?? "").trim() || "فتح التطبيق"

  // Plain-text fallback first — easy.
  const text = [
    `مرحباً ${name},`,
    "",
    data.title,
    "",
    data.message,
    "",
    showCta ? `${actionLabel}: ${data.actionUrl}` : "",
    "",
    "---",
    `${appName} — منصّة الاستثمار العراقية`,
  ]
    .filter(Boolean)
    .join("\n")

  // HTML — table-based for old email clients.
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(data.title)}</title>
</head>
<body style="margin:0;padding:0;background:#050505;color:#f4f4f5;font-family:Tajawal,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#050505;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#0a0a0a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 0 28px;text-align:right;">
              <div style="font-size:11px;color:#71717a;letter-spacing:0.06em;">${escapeHtml(appName)}</div>
              <h1 style="margin:6px 0 0 0;font-size:20px;font-weight:700;color:${accent};line-height:1.4;">
                ${escapeHtml(data.title)}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 0 28px;text-align:right;">
              <p style="margin:0 0 12px 0;font-size:14px;color:#d4d4d8;line-height:1.7;">
                مرحباً <strong style="color:#fafafa;">${escapeHtml(name)}</strong>،
              </p>
              <p style="margin:0;font-size:14px;color:#d4d4d8;line-height:1.7;white-space:pre-wrap;">
                ${escapeHtml(data.message)}
              </p>
            </td>
          </tr>
          ${
            showCta
              ? `
          <tr>
            <td style="padding:24px 28px 0 28px;text-align:right;">
              <a href="${escapeHtmlAttr(data.actionUrl as string)}"
                 style="display:inline-block;padding:12px 28px;background:#fafafa;color:#0a0a0a;font-weight:700;font-size:14px;text-decoration:none;border-radius:10px;">
                ${escapeHtml(actionLabel)}
              </a>
            </td>
          </tr>`
              : ""
          }
          <tr>
            <td style="padding:32px 28px 28px 28px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);margin-top:24px;">
              <p style="margin:0;font-size:11px;color:#52525b;line-height:1.7;">
                هذا الإشعار وُصِل لك لأنك مشترك في تنبيهات ${escapeHtml(appName)}.<br />
                يمكنك ضبط تفضيلاتك من <strong style="color:#a1a1aa;">الإعدادات → الإشعارات</strong>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { html, text }
}

// ─── HTML escaping ────────────────────────────────────────────

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeHtmlAttr(s: string): string {
  // Same as escapeHtml — keep separate for clarity at call sites.
  return escapeHtml(s)
}
