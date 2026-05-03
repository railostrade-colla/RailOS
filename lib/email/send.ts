/**
 * Email send helper — wraps the Resend SDK.
 *
 * Server-only. Reads two env vars:
 *   RESEND_API_KEY    — secret API key from resend.com
 *   RESEND_FROM       — verified sender ("Railos <noreply@your-domain.com>")
 *
 * Behaviour with no API key:
 *   sendEmail() returns { success: false, skipped: true } — never
 *   throws, never blocks the calling code path. This lets the rest of
 *   the app (webhook handlers etc.) keep working before Resend is wired
 *   up on Railway.
 */

import { Resend } from "resend"

export interface SendEmailParams {
  to: string
  subject: string
  /** Either pre-rendered HTML, or both html + plain text. */
  html: string
  text?: string
}

export interface SendEmailResult {
  success: boolean
  /** True when we deliberately did not call Resend (e.g. missing key). */
  skipped?: boolean
  /** Resend message id when success. */
  id?: string
  error?: string
}

const FALLBACK_FROM = "Railos <onboarding@resend.dev>"

/**
 * Sends a single email via Resend. Always resolves; never throws.
 *
 * Failure modes — all return a SendEmailResult with success=false:
 *   • RESEND_API_KEY missing       → skipped: true
 *   • Resend API error (4xx/5xx)   → skipped: false, error: <message>
 *   • Network / unexpected throw   → skipped: false, error: <message>
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { success: false, skipped: true }
  }

  const from = process.env.RESEND_FROM || FALLBACK_FROM

  try {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    })

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[email] resend error:", error.message ?? error)
      return { success: false, error: error.message ?? "Resend API error" }
    }

    return { success: true, id: data?.id }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] sendEmail threw:", err)
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}
