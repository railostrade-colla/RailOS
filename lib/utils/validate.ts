/**
 * Tiny input-validation primitives (Phase 14.12 S3).
 *
 * Deliberately NOT zod — the project keeps a lean 15-dependency
 * footprint and the API surface is only 6 small routes. These are
 * the handful of guards those routes actually need, in one place so
 * new routes don't reinvent regexes / length checks.
 *
 * All functions are pure + synchronous + side-effect free.
 */

export function isNonEmptyString(v: unknown, minLen = 1): v is string {
  return typeof v === "string" && v.trim().length >= minLen
}

export function isEmail(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) &&
    v.trim().length <= 254
  )
}

/** RFC-4122-ish UUID shape (any version). */
export function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      v.trim(),
    )
  )
}

export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string")
}

export function withinLen(v: string, min: number, max: number): boolean {
  const n = v.trim().length
  return n >= min && n <= max
}

/**
 * Strong-enough password policy for privileged (admin) accounts.
 * Phase 14.12 S3 raised this from the old `length >= 6` which was
 * far too weak for an account that can create other admins.
 *
 * Rules: 8–128 chars, at least one letter AND at least one digit.
 * (Intentionally not forcing symbols/case — usability vs. the real
 * threat here, which is trivial guessing, not offline cracking.)
 */
export function isStrongAdminPassword(v: unknown): v is string {
  if (typeof v !== "string") return false
  if (v.length < 8 || v.length > 128) return false
  return /[A-Za-z]/.test(v) && /[0-9]/.test(v)
}
