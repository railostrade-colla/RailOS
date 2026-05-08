/**
 * Money helpers (Iraqi Dinar — IQD).
 *
 * Phase 11.25 — single source of truth for dinar coercion.
 *
 * Why this exists:
 *   IQD has no fractional units in this app. Every dinar value should be
 *   a clean integer end-to-end. Past bugs have shown that a single
 *   fractional value sneaking through the data layer (e.g. a `numeric`
 *   column with hidden decimals, a JS float operation, or a future RPC
 *   that returns a string with trailing zeros) cascades into:
 *
 *     • A price-cap input handler that says "25000 > 24999.9999"
 *       and snaps the user's typed 25,000 down to 24,999 because the
 *       fractional ceiling came from the DB.
 *     • A dropdown that displays "25,000" via toLocaleString's default
 *       3-decimal rounding while the underlying value is 24,999.9999,
 *       so the user can't even see the discrepancy.
 *     • Totals that drift by a dinar per share × N shares.
 *
 *   The fix: coerce every dinar value to a clean integer at the data
 *   layer boundary AND on every user input. No fractional dinars
 *   anywhere in the app. Period.
 *
 *  All helpers below are safe to call on `unknown` — they never throw.
 */

/**
 * Coerce any DB / JSON value to a clean integer dinar amount.
 * - null/undefined/NaN → fallback (default 0)
 * - "25000.00" → 25000
 * - "24999.9999" → 25000   (rounded — see note below)
 * - "24999.4999" → 24999
 *
 * Why ROUND, not FLOOR or TRUNC: a value like 24999.9999 in the DB
 * is _almost certainly_ a 25000 that got nicked by some prior float
 * arithmetic. Rounding restores the human-intended integer. FLOOR
 * would silently lock in the off-by-one. The DB itself has no
 * legitimate fractional dinars in this app.
 */
export function iqd(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "number" ? v : Number(v)
  if (!Number.isFinite(x)) return fallback
  return Math.round(x)
}

/**
 * Parse a user-typed price/share string into a clean integer.
 * Strips anything that isn't a digit before parsing, so accidental
 * pastes like "25,000" or "25 000" or "25000د.ع" still resolve to
 * 25000 instead of NaN/0.
 *
 * Returns 0 for empty / unparseable input.
 */
export function parseIqdInput(raw: string): number {
  if (!raw) return 0
  // Keep only ASCII + Arabic digits.
  const ascii = raw.replace(/[٠-٩]/g, (d) =>
    String(d.charCodeAt(0) - 0x0660),
  )
  const digits = ascii.replace(/[^0-9]/g, "")
  if (!digits) return 0
  const n = parseInt(digits, 10)
  return Number.isFinite(n) ? n : 0
}

/**
 * Clamp a user-typed value against a max ceiling, returning a clean
 * integer STRING suitable for `setX(...)` of a controlled input.
 *
 * Behavior:
 *   - "" → ""
 *   - "abc" → ""           (reject non-numeric input gracefully)
 *   - "25000" with max 25000 → "25000"   (allows equality)
 *   - "30000" with max 25000 → "25000"   (clamped)
 *   - max = 0 / null → no clamp, returns parsed integer string
 *
 * Crucially, the clamp uses Math.floor on the max ceiling so that
 * a fractional ceiling (e.g. 24999.9999 from a float-drifted DB
 * value) can never strip a dinar from a user's clean integer entry
 * — see the iqd() rationale above.
 */
export function clampIqdInputToMax(
  raw: string,
  max: number | null | undefined,
): string {
  if (raw === "") return ""
  const parsed = parseIqdInput(raw)
  if (parsed === 0 && raw.replace(/[^0-9٠-٩]/g, "") === "") return ""
  if (max == null || !Number.isFinite(max) || max <= 0) {
    return String(parsed)
  }
  const ceiling = Math.floor(max)
  return String(parsed > ceiling ? ceiling : parsed)
}
