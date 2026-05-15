import { getRequestConfig } from "next-intl/server"
import { cookies } from "next/headers"

/**
 * Phase 14.13 Batch 0 — next-intl request config.
 *
 * Cookie-based locale, NO i18n routing (no [locale] URL segment, no
 * next-intl middleware). The locale comes from the NEXT_LOCALE
 * cookie; the language switcher sets that cookie + router.refresh().
 * Default = Arabic so behaviour is unchanged until the user switches.
 *
 * Single JSON per locale (messages/<locale>.json) holding all 19
 * namespaces — simplest, lowest-risk structure; next-intl merges
 * nothing so there's no folder-merge layer to break.
 */
export const LOCALES = ["ar", "en"] as const
export type AppLocale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: AppLocale = "ar"

export default getRequestConfig(async () => {
  const store = await cookies()
  const raw = store.get("NEXT_LOCALE")?.value
  const locale: AppLocale = raw === "en" ? "en" : "ar"

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: "Asia/Baghdad",
  }
})
