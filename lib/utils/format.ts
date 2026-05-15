/**
 * Phase 14.13 PART B — locale-aware formatters.
 *
 * Deliberately STANDALONE (no next-intl context dependency) so they
 * are safe to adopt incrementally today, before the full i18n rewire
 * lands. Pass an explicit `locale` or let it read the NEXT_LOCALE
 * cookie (client) / default to "ar".
 *
 * Currency stays IQD in both locales (the platform is Iraq-only);
 * only the suffix + digit grouping localize.
 */

export type AppLocale = "ar" | "en"

/** Read the chosen locale on the client (cookie). SSR-safe → "ar". */
export function getClientLocale(): AppLocale {
  if (typeof document === "undefined") return "ar"
  const m = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=(ar|en)/)
  return (m?.[1] as AppLocale) ?? "ar"
}

function intlLocale(locale: AppLocale): string {
  return locale === "ar" ? "ar-IQ" : "en-US"
}

export function formatNumber(value: number, locale: AppLocale = "ar"): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value)
}

export function formatCurrency(value: number, locale: AppLocale = "ar"): string {
  const n = formatNumber(value, locale)
  return locale === "ar" ? `${n} د.ع` : `${n} IQD`
}

export function formatPercent(value: number, locale: AppLocale = "ar"): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100)
}

export function formatDate(
  date: Date | string | number,
  locale: AppLocale = "ar",
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date))
}

export function formatDateTime(
  date: Date | string | number,
  locale: AppLocale = "ar",
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

export function formatRelativeTime(
  date: Date | string | number,
  locale: AppLocale = "ar",
): string {
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), {
    numeric: "auto",
  })
  const diffMs = Date.now() - new Date(date).getTime()
  const s = Math.round(diffMs / 1000)
  const m = Math.round(s / 60)
  const h = Math.round(m / 60)
  const d = Math.round(h / 24)
  if (Math.abs(d) >= 1) return rtf.format(-d, "day")
  if (Math.abs(h) >= 1) return rtf.format(-h, "hour")
  if (Math.abs(m) >= 1) return rtf.format(-m, "minute")
  return rtf.format(-s, "second")
}
