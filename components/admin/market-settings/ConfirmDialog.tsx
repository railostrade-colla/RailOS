"use client"

/**
 * ConfirmDialog — Phase 14.06 step 3.
 *
 * Centred modal (Phase 13.72 pattern — no bottom-sheet on mobile).
 * Used by SettingCard to confirm "big changes":
 *
 *   • Numeric settings: change > 20% relative to current value
 *     (handled by `isBigChange` in lib/data/market-settings).
 *   • Boolean settings: any toggle (engine_enabled flips are
 *     ALWAYS critical, so the card always opens this dialog).
 *
 * Reason field is OPTIONAL (matches founder spec: "السبب اختياري
 * لكن مُسجَّل إذا أُدخل"). When provided, it's trimmed and saved to
 * `market_settings_audit.reason`; when empty, the column stays NULL.
 */

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  X,
  Loader2,
  ShieldAlert,
  Info,
  Power,
  PowerOff,
} from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { formatSettingValue, type SettingValueType } from "@/lib/data/market-settings"

const REASON_MAX_LEN = 300

export interface ConfirmDialogProps {
  open: boolean
  /** Cancel handler (X / backdrop / Cancel button). */
  onCancel: () => void
  /** Confirm handler — receives the trimmed reason (or empty string). */
  onConfirm: (reason: string) => void
  /** True while the parent's RPC is in flight. */
  submitting: boolean

  // ─── Content ────────────────────────────────────────────────
  /** Setting label_ar. */
  settingLabel: string
  oldValue: number
  newValue: number
  valueType: SettingValueType
  /** When true, render the boolean-engine variant instead of the numeric one. */
  isBoolean?: boolean
  /** Pre-computed sign of the change (only matters for numeric). */
  isBigNumericChange?: boolean
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  submitting,
  settingLabel,
  oldValue,
  newValue,
  valueType,
  isBoolean = false,
  isBigNumericChange = false,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("")

  // Reset reason when the dialog opens.
  useEffect(() => {
    if (open) setReason("")
  }, [open])

  // Edit 1 — Escape key dismisses the dialog (but never while a save
  // is in flight, so a slow network doesn't strand the user mid-RPC).
  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) {
        onCancel()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [open, submitting, onCancel])

  if (!open) return null

  const handleBackdropClick = () => {
    if (submitting) return
    onCancel()
  }
  const handleConfirm = () => {
    onConfirm(reason.trim())
  }

  // Boolean variant — special copy for engine toggle.
  const turningOn = isBoolean && newValue === 1
  const turningOff = isBoolean && newValue === 0

  const numericDelta = newValue - oldValue
  const numericPct =
    oldValue !== 0
      ? Math.abs((numericDelta / oldValue) * 100)
      : null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="bg-neutral-950 border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-setting-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center border",
                isBoolean
                  ? turningOn
                    ? "bg-green-400/15 border-green-400/30"
                    : "bg-red-400/15 border-red-400/30"
                  : "bg-yellow-400/15 border-yellow-400/30",
              )}
            >
              {isBoolean ? (
                turningOn ? (
                  <Power className="w-4 h-4 text-green-400" strokeWidth={2.5} />
                ) : (
                  <PowerOff className="w-4 h-4 text-red-400" strokeWidth={2.5} />
                )
              ) : (
                <ShieldAlert
                  className="w-4 h-4 text-yellow-400"
                  strokeWidth={2.5}
                />
              )}
            </div>
            <div>
              <div
                id="confirm-setting-title"
                className="text-sm font-bold text-white"
              >
                {isBoolean
                  ? turningOn
                    ? "تأكيد تفعيل المحرك"
                    : "تأكيد إيقاف المحرك"
                  : "تأكيد التغيير الكبير"}
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">
                {settingLabel}
              </div>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="text-neutral-500 hover:text-white transition-colors disabled:opacity-50"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Critical-action warning */}
          {turningOff && (
            <div className="bg-red-400/[0.06] border border-red-400/30 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle
                className="w-4 h-4 text-red-400 shrink-0 mt-0.5"
                strokeWidth={2}
              />
              <div className="flex-1 text-[11px] text-red-200 leading-relaxed">
                <strong className="font-bold">إيقاف المحرك بالكامل:</strong>{" "}
                لن يتم تطبيق أي تعديل تلقائي على الأسعار حتى يُعاد تفعيله.
                التعديلات اليدوية تبقى متاحة.
              </div>
            </div>
          )}
          {isBigNumericChange && !isBoolean && (
            <div className="bg-yellow-400/[0.06] border border-yellow-400/30 rounded-xl p-3 flex items-start gap-2">
              <ShieldAlert
                className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5"
                strokeWidth={2}
              />
              <div className="flex-1 text-[11px] text-yellow-200 leading-relaxed">
                <strong className="font-bold">تغيير كبير:</strong> النسبة
                المئوية للتغيير{" "}
                {numericPct !== null
                  ? `${numericPct.toFixed(1)}%`
                  : "كبيرة"}{" "}
                ما قد يؤثر على سلوك المحرك بشكل ملحوظ.
              </div>
            </div>
          )}

          {/* Value transition card */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] text-neutral-500 mb-2">
              تغيير القيمة
            </div>
            <div className="flex items-center gap-2 text-base font-mono">
              <span className="text-neutral-400">
                {isBoolean
                  ? oldValue === 1
                    ? "🟢 مفعّل"
                    : "🔴 موقّف"
                  : formatSettingValue(oldValue, valueType)}
              </span>
              <span className="text-neutral-600">←</span>
              <span
                className={cn(
                  "font-bold",
                  isBoolean
                    ? turningOn
                      ? "text-green-400"
                      : "text-red-400"
                    : numericDelta >= 0
                      ? "text-green-400"
                      : "text-red-400",
                )}
              >
                {isBoolean
                  ? newValue === 1
                    ? "🟢 مفعّل"
                    : "🔴 موقّف"
                  : formatSettingValue(newValue, valueType)}
              </span>
            </div>
            {!isBoolean && numericPct !== null && (
              <div
                className={cn(
                  "text-[11px] mt-1 font-mono",
                  numericDelta >= 0 ? "text-green-400" : "text-red-400",
                )}
              >
                {numericDelta >= 0 ? "+" : "−"}
                {numericPct.toFixed(2)}%
              </div>
            )}
            {/* Edit 3 — explicit message for the from-zero case (instead
                of silently hiding the pct row when oldValue === 0). */}
            {!isBoolean && numericPct === null && numericDelta !== 0 && (
              <div className="text-[11px] mt-1 font-mono text-yellow-400">
                تغيير من صفر → {formatSettingValue(newValue, valueType)}
              </div>
            )}
          </div>

          {/* Reason — optional */}
          <div>
            <label className="block text-[11px] text-neutral-400 mb-1.5">
              سبب التعديل (اختياري — يُسجَّل في سجل التغييرات)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={REASON_MAX_LEN}
              placeholder="اكتب سبب التعديل (اختياري)"
              disabled={submitting}
              className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none disabled:opacity-60"
            />
            <div className="text-[10px] text-neutral-500 mt-1">
              {reason.length}/{REASON_MAX_LEN}
            </div>
          </div>

          <div className="text-[10px] text-neutral-500 leading-relaxed flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 shrink-0" strokeWidth={2.5} />
            بعد التأكيد، يُسجَّل التغيير في{" "}
            <code className="font-mono bg-white/[0.05] px-1 rounded">
              market_settings_audit
            </code>
            .
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 p-4 border-t border-white/[0.06]">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-white/[0.05] text-neutral-300 hover:bg-white/[0.08] transition-colors disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
              turningOff
                ? "bg-red-500 text-white hover:bg-red-600"
                : turningOn
                  ? "bg-green-500 text-black hover:bg-green-600"
                  : numericDelta >= 0
                    ? "bg-green-500 text-black hover:bg-green-600"
                    : "bg-red-500 text-white hover:bg-red-600",
              submitting && "opacity-70 cursor-wait",
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري الحفظ...
              </>
            ) : turningOff ? (
              "تأكيد الإيقاف"
            ) : turningOn ? (
              "تأكيد التفعيل"
            ) : (
              "تأكيد التغيير"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
