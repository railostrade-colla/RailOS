"use client"

/**
 * RaiseMarketPricePanel — Phase 14.05 (post V7 cleanup).
 *
 * After dropping the V7 engine (Migrations 14.01–14.04), this panel
 * is dramatically simpler than the Phase 12.9 original:
 *
 *   • No "natural rise" calculation — those rules now live entirely
 *     inside `trg_update_market_price_on_deal_complete`.
 *   • No conditions / blockers / override toggle — the founder picks
 *     a percentage and goes.
 *   • Accepts NEGATIVE percentages (range −100 .. +100), so the
 *     founder can correct an overshoot. Big drops get a red banner.
 *   • Reason is MANDATORY for every change (≥ 10 chars) — audit trail.
 *   • Confirmation modal previews old → new + pct + reason before
 *     firing the RPC.
 *
 * The whole thing is wired to `admin_force_market_rise(UUID, NUMERIC,
 * TEXT)` (Migration 14.02). Caller component is `MarketEnginePanelV2`.
 */

import { useEffect, useMemo, useState } from "react"
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Loader2,
  X,
  ShieldAlert,
  Info,
} from "lucide-react"
import { showSuccess, showError } from "@/lib/utils/toast"
import {
  forceMarketRise,
  previewNewPrice,
  REASON_MIN_LEN,
  REASON_MAX_LEN,
  RISE_PCT_MIN,
  RISE_PCT_MAX,
} from "@/lib/data/admin-rise"
import { getAllProjects } from "@/lib/data/projects"
import type { Project } from "@/lib/mock-data/types"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

/** UI tolerates a tiny epsilon below big-change threshold to avoid jitter. */
const BIG_CHANGE_PCT = 20

export function RaiseMarketPricePanel() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [loadingList, setLoadingList] = useState(true)

  // Form state
  const [risePctStr, setRisePctStr] = useState<string>("")
  const [reason, setReason] = useState<string>("")

  // Submission state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ─── 1. Load projects once ───────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoadingList(true)
    getAllProjects()
      .then((rows) => {
        if (cancelled) return
        setProjects(rows)
        if (rows.length > 0 && !selectedId) {
          setSelectedId(rows[0].id)
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── 2. Selected-project lookup (synchronous from list) ──────
  const project = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  )

  const currentPrice = useMemo<number>(() => {
    if (!project) return 0
    return Number(project.current_market_price ?? project.share_price ?? 0)
  }, [project])

  // ─── 3. Parse + validate the input ──────────────────────────
  const parsedPct = useMemo<number | null>(() => {
    if (risePctStr.trim() === "" || risePctStr.trim() === "-") return null
    const n = parseFloat(risePctStr)
    return Number.isFinite(n) ? n : null
  }, [risePctStr])

  const pctInRange = useMemo<boolean>(() => {
    if (parsedPct === null) return false
    return parsedPct >= RISE_PCT_MIN && parsedPct <= RISE_PCT_MAX
  }, [parsedPct])

  const newPricePreview = useMemo<number>(() => {
    if (parsedPct === null || !pctInRange) return currentPrice
    return previewNewPrice(currentPrice, parsedPct)
  }, [currentPrice, parsedPct, pctInRange])

  const isDrop = (parsedPct ?? 0) < 0
  const isBigChange = Math.abs(parsedPct ?? 0) > BIG_CHANGE_PCT
  const isNoOp = parsedPct === 0 || newPricePreview === currentPrice

  const trimmedReason = reason.trim()
  const reasonOk =
    trimmedReason.length >= REASON_MIN_LEN &&
    trimmedReason.length <= REASON_MAX_LEN

  const canSubmit =
    !!project &&
    parsedPct !== null &&
    pctInRange &&
    !isNoOp &&
    reasonOk &&
    !submitting

  // ─── 4. Open + close modal ──────────────────────────────────
  const openConfirm = () => {
    if (!canSubmit) return
    setConfirmOpen(true)
  }
  const closeConfirm = () => {
    if (submitting) return
    setConfirmOpen(false)
  }

  // ─── 5. Fire the RPC after confirmation ─────────────────────
  const handleApply = async () => {
    if (!project || parsedPct === null) return
    setSubmitting(true)
    const result = await forceMarketRise({
      projectId: project.id,
      risePct: parsedPct,
      reason: trimmedReason,
    })
    setSubmitting(false)
    setConfirmOpen(false)

    if (!result.success) {
      showError(result.error ?? "تعذّر تطبيق التعديل")
      return
    }
    showSuccess(result.message ?? "تمّ تطبيق التعديل")

    // Refresh local project list so the new price reflects on the
    // stat cards without a page reload.
    if (result.data) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id
            ? { ...p, current_market_price: result.data!.new_price }
            : p,
        ),
      )
    }
    // Reset form (keep project selection).
    setRisePctStr("")
    setReason("")
  }

  // ─── 6. Render ──────────────────────────────────────────────
  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400/20 to-yellow-400/20 border border-green-400/30 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-green-400" strokeWidth={2} />
        </div>
        <div>
          <div className="text-base font-bold text-white">
            📊 تعديل سعر السوق يدوياً
          </div>
          <div className="text-[11px] text-neutral-500 leading-relaxed mt-0.5">
            رفع أو خفض يدوي للسعر المعروض في السوق — مع توثيق إجباري
          </div>
        </div>
      </div>

      {/* Project picker */}
      <div className="mb-4">
        <label className="block text-[11px] text-neutral-400 mb-1.5">
          المشروع
        </label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={loadingList || submitting}
          className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20 disabled:opacity-60"
        >
          {loadingList && <option value="">— جاري التحميل —</option>}
          {!loadingList && projects.length === 0 && (
            <option value="">— لا توجد مشاريع —</option>
          )}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.symbol && ` (${p.symbol})`}
            </option>
          ))}
        </select>
      </div>

      {!loadingList && project && (
        <div className="space-y-4">
          {/* Price stats — 2 cards */}
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="السعر الاسمي"
              value={`${fmtNum(Number(project.share_price ?? 0))} د.ع`}
            />
            <Stat
              label="السعر السوقي الحالي"
              value={`${fmtNum(currentPrice)} د.ع`}
              highlight="green"
            />
          </div>

          {/* Rise input */}
          <div>
            <label className="block text-[11px] text-neutral-400 mb-1.5">
              نسبة التعديل (%) — موجب للرفع، سالب للخفض، المدى{" "}
              {RISE_PCT_MIN} إلى {RISE_PCT_MAX}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min={RISE_PCT_MIN}
                max={RISE_PCT_MAX}
                value={risePctStr}
                onChange={(e) => setRisePctStr(e.target.value)}
                placeholder="مثلاً: 5 أو -3"
                dir="ltr"
                disabled={submitting}
                className={cn(
                  "flex-1 bg-black/40 border rounded-lg px-3 py-2.5 text-base text-white font-mono outline-none disabled:opacity-60",
                  parsedPct === null
                    ? "border-white/[0.08] focus:border-white/20"
                    : !pctInRange
                      ? "border-red-400/40 focus:border-red-400/60"
                      : isDrop
                        ? "border-red-400/30 focus:border-red-400/50"
                        : "border-green-400/30 focus:border-green-400/50",
                )}
              />
              <span className="text-sm text-neutral-400">%</span>
            </div>

            {/* Preview row */}
            {parsedPct !== null && pctInRange && currentPrice > 0 && (
              <div className="text-[11px] text-neutral-400 mt-2 leading-relaxed">
                السعر بعد التطبيق:{" "}
                <span
                  className={cn(
                    "font-mono font-bold",
                    isNoOp
                      ? "text-neutral-300"
                      : isDrop
                        ? "text-red-400"
                        : "text-green-400",
                  )}
                >
                  {fmtNum(newPricePreview)} د.ع
                </span>{" "}
                <span className="text-neutral-500">
                  ({parsedPct >= 0 ? "+" : ""}
                  {parsedPct.toFixed(2)}%)
                </span>
              </div>
            )}

            {/* Out-of-range error */}
            {parsedPct !== null && !pctInRange && (
              <div className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" strokeWidth={2.5} />
                النسبة خارج المدى المسموح ({RISE_PCT_MIN} إلى {RISE_PCT_MAX})
              </div>
            )}

            {/* No-op note */}
            {parsedPct !== null && pctInRange && isNoOp && (
              <div className="text-[11px] text-neutral-500 mt-1.5 flex items-center gap-1.5">
                <Info className="w-3 h-3" strokeWidth={2.5} />
                لا تغيير في السعر بهذه النسبة
              </div>
            )}
          </div>

          {/* Drop warning (any negative) */}
          {parsedPct !== null && pctInRange && isDrop && !isNoOp && (
            <div className="bg-red-400/[0.06] border border-red-400/30 rounded-xl p-3 flex items-start gap-2">
              <TrendingDown
                className="w-4 h-4 text-red-400 shrink-0 mt-0.5"
                strokeWidth={2}
              />
              <div className="flex-1 text-[11px] text-red-200 leading-relaxed">
                <strong className="font-bold">انتباه — خفض السعر:</strong> هذا
                إجراء عكسي يخفض القيمة المعروضة للمستثمرين. استخدمه فقط في
                حالات التصحيح الطارئ (مثل تعديل خطأ سابق).
              </div>
            </div>
          )}

          {/* Big-change warning (|pct| > 20) */}
          {parsedPct !== null && pctInRange && isBigChange && (
            <div className="bg-yellow-400/[0.06] border border-yellow-400/30 rounded-xl p-3 flex items-start gap-2">
              <ShieldAlert
                className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5"
                strokeWidth={2}
              />
              <div className="flex-1 text-[11px] text-yellow-200 leading-relaxed">
                <strong className="font-bold">تعديل كبير:</strong> النسبة
                المُدخلة ({Math.abs(parsedPct).toFixed(1)}%) أكبر من{" "}
                {BIG_CHANGE_PCT}%. تأكّد من السبب قبل المتابعة.
              </div>
            </div>
          )}

          {/* Reason input */}
          <div>
            <label className="block text-[11px] text-neutral-400 mb-1.5">
              سبب التعديل (إجباري — يُسجَّل في سجل الأسعار)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              disabled={submitting}
              placeholder="مثلاً: تطوّر حقيقي في المشروع رفع قيمته العادلة بناءً على تقرير الفريق…"
              maxLength={REASON_MAX_LEN}
              className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none disabled:opacity-60"
            />
            <div
              className={cn(
                "text-[10px] mt-1",
                trimmedReason.length === 0
                  ? "text-neutral-500"
                  : reasonOk
                    ? "text-green-500"
                    : "text-red-400",
              )}
            >
              {trimmedReason.length}/{REASON_MAX_LEN} — على الأقل{" "}
              {REASON_MIN_LEN} أحرف
            </div>
          </div>

          {/* Apply button → opens confirmation modal */}
          <button
            onClick={openConfirm}
            disabled={!canSubmit}
            className={cn(
              "w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors",
              !canSubmit
                ? "bg-white/[0.05] text-neutral-600 cursor-not-allowed"
                : isDrop
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-green-500 text-black hover:bg-green-600",
            )}
          >
            {isDrop ? (
              <>
                <TrendingDown className="w-4 h-4" strokeWidth={2.5} />
                مراجعة الخفض ({parsedPct?.toFixed(2)}%)
              </>
            ) : parsedPct !== null && pctInRange && !isNoOp ? (
              <>
                <TrendingUp className="w-4 h-4" strokeWidth={2.5} />
                مراجعة الرفع (+{parsedPct.toFixed(2)}%)
              </>
            ) : (
              "أدخل نسبة وسبب صالحَين للمتابعة"
            )}
          </button>
        </div>
      )}

      {/* ─── Confirmation modal ─────────────────────────────── */}
      {confirmOpen && project && parsedPct !== null && (
        <ConfirmModal
          projectName={project.name}
          oldPrice={currentPrice}
          newPrice={newPricePreview}
          pct={parsedPct}
          reason={trimmedReason}
          isDrop={isDrop}
          isBig={isBigChange}
          submitting={submitting}
          onCancel={closeConfirm}
          onConfirm={handleApply}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: "green" | "red" | "neutral"
}) {
  return (
    <div className="bg-black/30 border border-white/[0.05] rounded-lg p-2.5">
      <div className="text-[10px] text-neutral-500 mb-1">{label}</div>
      <div
        className={cn(
          "text-sm font-bold font-mono",
          highlight === "green" && "text-green-400",
          highlight === "red" && "text-red-400",
          (!highlight || highlight === "neutral") && "text-white",
        )}
      >
        {value}
      </div>
    </div>
  )
}

function ConfirmModal({
  projectName,
  oldPrice,
  newPrice,
  pct,
  reason,
  isDrop,
  isBig,
  submitting,
  onCancel,
  onConfirm,
}: {
  projectName: string
  oldPrice: number
  newPrice: number
  pct: number
  reason: string
  isDrop: boolean
  isBig: boolean
  submitting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="bg-neutral-950 border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-rise-title"
      >
        {/* Modal header */}
        <div className="flex items-start justify-between p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center border",
                isDrop
                  ? "bg-red-400/15 border-red-400/30"
                  : "bg-green-400/15 border-green-400/30",
              )}
            >
              {isDrop ? (
                <TrendingDown
                  className="w-4 h-4 text-red-400"
                  strokeWidth={2.5}
                />
              ) : (
                <TrendingUp
                  className="w-4 h-4 text-green-400"
                  strokeWidth={2.5}
                />
              )}
            </div>
            <div>
              <div
                id="confirm-rise-title"
                className="text-sm font-bold text-white"
              >
                تأكيد {isDrop ? "خفض" : "رفع"} السعر
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">
                {projectName}
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

        {/* Modal body */}
        <div className="p-4 space-y-3">
          {/* Big-change inline warning */}
          {isBig && (
            <div className="bg-yellow-400/[0.06] border border-yellow-400/30 rounded-xl p-2.5 flex items-start gap-2">
              <ShieldAlert
                className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5"
                strokeWidth={2.5}
              />
              <div className="text-[11px] text-yellow-200 leading-relaxed">
                هذا تعديل كبير ({Math.abs(pct).toFixed(2)}%). سيُسجَّل في سجل
                الأسعار ويُعرَض لجميع المستخدمين.
              </div>
            </div>
          )}

          {/* Price transition */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] text-neutral-500 mb-2">
              تغيير السعر
            </div>
            <div className="flex items-center gap-2 text-base font-mono">
              <span className="text-neutral-400">
                {fmtNum(oldPrice)} د.ع
              </span>
              <span className="text-neutral-600">←</span>
              <span
                className={cn(
                  "font-bold",
                  isDrop ? "text-red-400" : "text-green-400",
                )}
              >
                {fmtNum(newPrice)} د.ع
              </span>
            </div>
            <div
              className={cn(
                "text-[11px] mt-1 font-mono",
                isDrop ? "text-red-400" : "text-green-400",
              )}
            >
              {pct >= 0 ? "+" : ""}
              {pct.toFixed(2)}%
            </div>
          </div>

          {/* Reason readback */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] text-neutral-500 mb-1.5">السبب</div>
            <div className="text-[12px] text-white leading-relaxed whitespace-pre-wrap">
              {reason}
            </div>
          </div>

          <div className="text-[10px] text-neutral-500 leading-relaxed flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 shrink-0" strokeWidth={2.5} />
            بعد التأكيد، يُسجَّل التعديل في{" "}
            <code className="font-mono bg-white/[0.05] px-1 rounded">
              price_history
            </code>{" "}
            ويظهر فوراً لجميع المستخدمين.
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center gap-2 p-4 border-t border-white/[0.06]">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-white/[0.05] text-neutral-300 hover:bg-white/[0.08] transition-colors disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
              isDrop
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-green-500 text-black hover:bg-green-600",
              submitting && "opacity-70 cursor-wait",
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري التطبيق...
              </>
            ) : (
              <>تأكيد {isDrop ? "الخفض" : "الرفع"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
