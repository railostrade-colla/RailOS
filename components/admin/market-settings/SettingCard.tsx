"use client"

/**
 * SettingCard — Phase 14.06 step 3.
 *
 * One card per market_settings row. Handles:
 *   • Live numeric input with range validation (red border when invalid).
 *   • Boolean toggle render-path for `engine_enabled`-shaped knobs.
 *   • Save / Reset actions, each with its own loading state.
 *   • Optimistic UI update via the `onApplied` callback after a
 *     successful RPC — the parent then refreshes the audit log.
 *   • ConfirmDialog popup for "big changes" (numeric ≥ 20%) and for
 *     every boolean flip (engine toggle is always critical).
 *
 * Save button is disabled when:
 *   - value === current (no change),
 *   - or value is out of [min_value, max_value],
 *   - or any save/reset RPC is currently running.
 */

import { useEffect, useState, useMemo } from "react"
import {
  Save,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Loader2,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { showError, showSuccess } from "@/lib/utils/toast"
import {
  updateMarketSetting,
  resetMarketSetting,
  validateSettingValue,
  isSettingModified,
  isBooleanSetting,
  isBigChange,
  formatSettingValue,
  type MarketSetting,
} from "@/lib/data/market-settings"
import { BooleanToggle } from "./BooleanToggle"
import { ConfirmDialog } from "./ConfirmDialog"

export interface SettingCardProps {
  setting: MarketSetting
  /** Called with the fresh setting (after server-side success) so the
   *  parent can replace it in its `settings` array without refetching
   *  the whole list. */
  onApplied: (updated: MarketSetting) => void
  /** Called after any successful change so the parent can refresh
   *  the audit log panel. */
  onAuditChanged?: () => void
}

const BIG_CHANGE_PCT = 20

export function SettingCard({
  setting,
  onApplied,
  onAuditChanged,
}: SettingCardProps) {
  const isBool = isBooleanSetting(setting)
  const modified = isSettingModified(setting)

  // ─── Numeric input state ─────────────────────────────────────
  const [inputStr, setInputStr] = useState<string>(() => String(setting.value))
  const [savingNumeric, setSavingNumeric] = useState(false)
  const [resetting, setResetting] = useState(false)

  // ─── Boolean confirmation state ──────────────────────────────
  const [pendingBoolValue, setPendingBoolValue] = useState<number | null>(null)
  const [savingBool, setSavingBool] = useState(false)

  // ─── Numeric big-change confirmation state ───────────────────
  const [pendingNumericValue, setPendingNumericValue] = useState<number | null>(
    null,
  )

  // Re-sync input when the live value changes externally (after save).
  useEffect(() => {
    setInputStr(String(setting.value))
  }, [setting.value])

  // ─── Parse + validate the numeric input ─────────────────────
  const parsed = useMemo<number | null>(() => {
    if (inputStr.trim() === "" || inputStr.trim() === "-") return null
    const n = parseFloat(inputStr)
    return Number.isFinite(n) ? n : null
  }, [inputStr])

  const validation = useMemo(() => {
    if (parsed === null) return { valid: false, error: "أدخل قيمة" }
    return validateSettingValue(parsed, setting.min_value, setting.max_value)
  }, [parsed, setting.min_value, setting.max_value])

  const hasChange = parsed !== null && parsed !== setting.value
  const canSave =
    !savingNumeric && !resetting && validation.valid && hasChange

  const bigChange = useMemo(() => {
    if (parsed === null) return false
    return isBigChange(setting.value, parsed, BIG_CHANGE_PCT)
  }, [parsed, setting.value])

  // ─── Numeric save (entry point) ─────────────────────────────
  const handleNumericSave = () => {
    if (!canSave || parsed === null) return
    if (bigChange) {
      setPendingNumericValue(parsed)
      return
    }
    // Small change → save directly without confirmation.
    void persistNumeric(parsed, "")
  }

  // ─── Numeric save (after confirm dialog) ────────────────────
  const handleNumericConfirm = (reason: string) => {
    if (pendingNumericValue === null) return
    void persistNumeric(pendingNumericValue, reason)
  }

  const persistNumeric = async (value: number, reason: string) => {
    setSavingNumeric(true)
    const result = await updateMarketSetting(setting.key, value, reason)
    setSavingNumeric(false)
    setPendingNumericValue(null)

    if (!result.success) {
      showError(result.error ?? "تعذّر الحفظ")
      return
    }
    showSuccess(result.message ?? "تم الحفظ")
    onApplied({
      ...setting,
      value: result.data?.new_value ?? value,
      updated_at: new Date().toISOString(),
      is_modified: (result.data?.new_value ?? value) !== setting.default_value,
    })
    onAuditChanged?.()
  }

  // ─── Boolean toggle (entry point) ───────────────────────────
  const handleBoolClick = (newValue: number) => {
    if (savingBool || newValue === setting.value) return
    setPendingBoolValue(newValue)
  }

  const handleBoolConfirm = async (reason: string) => {
    if (pendingBoolValue === null) return
    setSavingBool(true)
    const result = await updateMarketSetting(setting.key, pendingBoolValue, reason)
    setSavingBool(false)
    setPendingBoolValue(null)

    if (!result.success) {
      showError(result.error ?? "تعذّر الحفظ")
      return
    }
    showSuccess(result.message ?? "تم الحفظ")
    onApplied({
      ...setting,
      value: result.data?.new_value ?? pendingBoolValue,
      updated_at: new Date().toISOString(),
      is_modified:
        (result.data?.new_value ?? pendingBoolValue) !== setting.default_value,
    })
    onAuditChanged?.()
  }

  // ─── Reset to default ───────────────────────────────────────
  const handleReset = async () => {
    if (resetting || savingNumeric || savingBool) return
    setResetting(true)
    const result = await resetMarketSetting(setting.key)
    setResetting(false)
    if (!result.success) {
      showError(result.error ?? "تعذّر الاستعادة")
      return
    }
    showSuccess(result.message ?? "تمت الاستعادة")
    onApplied({
      ...setting,
      value: result.data?.new_value ?? setting.default_value,
      updated_at: new Date().toISOString(),
      is_modified: false,
    })
    onAuditChanged?.()
  }

  // ─── Render ──────────────────────────────────────────────────
  const updatedAgo = formatRelativeTime(setting.updated_at)

  return (
    <>
      <div
        className={cn(
          "bg-white/[0.04] border rounded-2xl p-4 transition-colors",
          modified
            ? "border-yellow-400/30 bg-yellow-400/[0.02]"
            : "border-white/[0.08]",
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white truncate">
                {setting.label_ar}
              </h3>
              {modified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400/15 border border-yellow-400/30 text-yellow-300">
                  <Sparkles className="w-2.5 h-2.5" strokeWidth={2.5} />
                  معدّل
                </span>
              )}
            </div>
            {setting.description_ar && (
              <p className="text-[11px] text-neutral-400 leading-relaxed mt-1">
                {setting.description_ar}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-neutral-500">
              <span>
                المدى: <span className="font-mono text-neutral-400">
                  {setting.min_value}
                </span>{" "}
                –{" "}
                <span className="font-mono text-neutral-400">
                  {setting.max_value}
                </span>
              </span>
              <span>·</span>
              <span>
                الافتراضي:{" "}
                <span className="font-mono text-neutral-400">
                  {formatSettingValue(setting.default_value, setting.value_type)}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Control row */}
        {isBool ? (
          <div className="admin-input flex items-center justify-between gap-3 bg-black/30 border border-white/[0.05] rounded-xl p-3">
            <BooleanToggle
              value={setting.value}
              onToggle={handleBoolClick}
              submitting={savingBool}
              disabled={resetting}
            />
            {/* Reset button */}
            {modified && (
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting || savingBool}
                title="استعادة الافتراضي"
                className="text-[11px] text-neutral-400 hover:text-yellow-400 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                {resetting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3" strokeWidth={2} />
                )}
                <span>افتراضي</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min={setting.min_value}
                max={setting.max_value}
                value={inputStr}
                onChange={(e) => setInputStr(e.target.value)}
                disabled={savingNumeric || resetting}
                dir="ltr"
                className={cn(
                  "admin-input flex-1 bg-black/40 border rounded-lg px-3 py-2 text-sm text-white font-mono outline-none disabled:opacity-60",
                  !validation.valid && parsed !== null
                    ? "border-red-400/40 focus:border-red-400/60"
                    : hasChange
                      ? "border-yellow-400/30 focus:border-yellow-400/50"
                      : "border-white/[0.08] focus:border-white/20",
                )}
              />
              <span className="text-xs text-neutral-500 min-w-[3rem]">
                {setting.value_type === "percent" && "%"}
                {setting.value_type === "days" && "يوم"}
                {setting.value_type === "hour" && "ساعة"}
                {setting.value_type === "ratio" && "نسبة"}
                {setting.value_type === "count" && "—"}
              </span>
            </div>

            {/* Inline validation message */}
            {parsed !== null && !validation.valid && (
              <div className="text-[10px] text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" strokeWidth={2.5} />
                {validation.error}
              </div>
            )}
            {bigChange && validation.valid && (
              <div className="text-[10px] text-yellow-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" strokeWidth={2.5} />
                تغيير كبير ({" > "}{BIG_CHANGE_PCT}%) — سيُطلب تأكيد
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleNumericSave}
                disabled={!canSave}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors",
                  !canSave
                    ? "bg-white/[0.04] text-neutral-600 cursor-not-allowed"
                    : "bg-green-500 text-black hover:bg-green-600",
                )}
              >
                {savingNumeric ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    حفظ...
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" strokeWidth={2.5} />
                    حفظ
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={!modified || resetting || savingNumeric}
                title="استعادة الافتراضي"
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors",
                  !modified
                    ? "bg-white/[0.02] text-neutral-700 border-white/[0.04] cursor-not-allowed"
                    : "bg-white/[0.04] text-neutral-300 border-white/[0.08] hover:text-yellow-400 hover:border-yellow-400/30",
                )}
              >
                {resetting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3" strokeWidth={2} />
                )}
                <span>افتراضي</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer — last updated */}
        {updatedAgo && (
          <div className="flex items-center gap-1 text-[10px] text-neutral-600 mt-3 pt-2 border-t border-white/[0.04]">
            <Clock className="w-2.5 h-2.5" strokeWidth={2} />
            <span>آخر تعديل: {updatedAgo}</span>
          </div>
        )}
      </div>

      {/* Confirmation dialogs (only one can be open at a time) */}
      <ConfirmDialog
        open={pendingNumericValue !== null}
        onCancel={() => setPendingNumericValue(null)}
        onConfirm={handleNumericConfirm}
        submitting={savingNumeric}
        settingLabel={setting.label_ar}
        oldValue={setting.value}
        newValue={pendingNumericValue ?? setting.value}
        valueType={setting.value_type}
        isBigNumericChange
      />
      <ConfirmDialog
        open={pendingBoolValue !== null}
        onCancel={() => setPendingBoolValue(null)}
        onConfirm={handleBoolConfirm}
        submitting={savingBool}
        settingLabel={setting.label_ar}
        oldValue={setting.value}
        newValue={pendingBoolValue ?? setting.value}
        valueType={setting.value_type}
        isBoolean
      />
    </>
  )
}

/** Short Arabic "X minutes/hours/days ago" helper. Pure function — not a hook. */
function formatRelativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const diffMs = Date.now() - d.getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "الآن"
  if (minutes < 60) return `قبل ${minutes} دقيقة`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `قبل ${hours} ساعة`
  const days = Math.floor(hours / 24)
  if (days < 30) return `قبل ${days} يوم`
  return d.toLocaleDateString("ar-IQ", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}
