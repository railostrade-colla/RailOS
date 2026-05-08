"use client"

import { forwardRef } from "react"
import { parseIqdInput } from "@/lib/utils/money"

/**
 * IntegerInput — single source of truth for "user types an integer".
 *
 * Phase 11.27 — replaces every <input type="number"> for IQD amounts
 * (prices, shares, fees, totals). type="number" has been a recurring
 * source of "the value silently changed" bugs:
 *
 *   1. Mouse wheel over a focused number input decrements/increments
 *      the value. Users typing 25,000 then nudging the scroll wheel
 *      end up with 24,998 in seconds without noticing.
 *   2. Up/Down arrow keys do the same — even unintentional keypresses
 *      (e.g. holding Down while reaching for the price field below)
 *      change the value.
 *   3. The native spinner buttons are easy to misclick on mobile.
 *   4. Some browsers strip leading zeros, drop digits over a `max`
 *      attribute boundary, or normalize values via the locale.
 *
 * This component:
 *   • Uses type="text" + inputMode="numeric" so:
 *       - Mobile keyboards still show the digit keypad.
 *       - There's no spinner, no wheel-decrement, no arrow-key change.
 *   • Sanitizes every keystroke through parseIqdInput so non-digit
 *     characters (commas, د.ع, RTL marks, Arabic-Indic digits) are
 *     normalized to a clean integer.
 *   • Caps to an optional `max` ceiling using Math.floor on the
 *     ceiling so a fractional ceiling can't strip a dinar from a
 *     clean integer entry (defense in depth with lib/utils/money).
 *   • Blurs on wheel as a final defensive layer in case any consumer
 *     overrides type="text" via className tricks.
 *
 * Pass `value` and `onValueChange` (giving you a clean string of
 * digits, never with formatting noise). The wrapped <input> still
 * exposes className / placeholder / disabled etc. via standard props.
 */
export interface IntegerInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "value" | "onChange" | "min" | "max" | "step"
  > {
  /** Current value as a digit string (no formatting). Empty string allowed. */
  value: string
  /** Called with the sanitized digit-only string after every keystroke. */
  onValueChange: (next: string) => void
  /** Optional ceiling — caps via Math.floor(max) to dodge fractional drift. */
  max?: number | null
}

export const IntegerInput = forwardRef<HTMLInputElement, IntegerInputProps>(
  function IntegerInput({ value, onValueChange, max, ...rest }, ref) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      if (raw === "") {
        onValueChange("")
        return
      }
      const parsed = parseIqdInput(raw)
      if (
        parsed === 0 &&
        raw.replace(/[^0-9٠-٩]/g, "") === ""
      ) {
        onValueChange("")
        return
      }
      if (max != null && Number.isFinite(max) && max > 0) {
        const ceiling = Math.floor(max)
        onValueChange(String(parsed > ceiling ? ceiling : parsed))
        return
      }
      onValueChange(String(parsed))
    }

    return (
      <input
        ref={ref}
        // type="text" (not "number") so wheel/arrow-key/spinner
        // mutations are physically impossible — see component doc.
        type="text"
        inputMode="numeric"
        // pattern is informational on type=text — used by some
        // browsers' built-in form validation for visual hints.
        pattern="[0-9]*"
        autoComplete="off"
        // Even though type=text doesn't react to wheel events for
        // value mutation, blurring on wheel keeps page-scroll
        // behavior tidy and matches user intent.
        onWheel={(e) => {
          if (document.activeElement === e.currentTarget) {
            e.currentTarget.blur()
          }
        }}
        // Block Up/Down arrow keys from any custom handler that
        // might be added down the line — they should NEVER mutate
        // a money input.
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault()
          }
          rest.onKeyDown?.(e)
        }}
        value={value}
        onChange={handleChange}
        {...rest}
      />
    )
  },
)
