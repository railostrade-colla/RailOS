/**
 * Phase 14.13 Batch 0 — DB bilingual fallback.
 *
 * User-authored content (projects / news / discount_brands) has
 * optional `<field>_en` columns (migration
 * 20260515_phase14_13_i18n_columns.sql). In English, prefer the
 * `_en` value but ALWAYS fall back to the Arabic original when it is
 * empty/missing — never show a blank. In Arabic, return the original.
 *
 * Pure + null-safe; usable on server or client. No next-intl
 * dependency so it's adoptable today.
 *
 * @example
 *   getLocalized(project, "name", locale)            // name / name_en
 *   getLocalized(news, "title", "en")                // title_en ?? title
 */
export type AppLocale = "ar" | "en"

export function getLocalized<
  T extends Record<string, unknown>,
  K extends keyof T & string,
>(record: T | null | undefined, field: K, locale: AppLocale): string {
  if (!record) return ""
  const base = record[field]
  const baseStr = base == null ? "" : String(base)
  if (locale !== "en") return baseStr
  const en = record[`${field}_en` as keyof T]
  const enStr = en == null ? "" : String(en).trim()
  return enStr.length > 0 ? enStr : baseStr
}
