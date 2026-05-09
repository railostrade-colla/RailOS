"use client"

/**
 * RaiseMarketPricePanel — Phase 12.9.
 *
 * Lets an admin manually raise a project's `current_market_price`:
 *   • Picks a project from a dropdown.
 *   • Sees the live engine mode + conditions + blockers (if any).
 *   • Sees what the engine would naturally apply NOW.
 *   • Can either:
 *       - Apply the natural rise (button disabled if conditions block it).
 *       - Override the conditions and force a custom rise (super-admin
 *         pattern with a mandatory reason).
 *
 * The whole panel is wired to the Phase 12 engine helpers — no mocks.
 */

import { useEffect, useMemo, useState } from "react"
import {
  TrendingUp,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Lock,
  Unlock,
  Zap,
} from "lucide-react"
import { showSuccess, showError } from "@/lib/utils/toast"
import {
  getRiseStatus,
  forceMarketRise,
  type RiseStatus,
} from "@/lib/data/admin-rise"
import { getAllProjects } from "@/lib/data/projects"
import type { Project } from "@/lib/mock-data/types"

type ProjectListRow = Pick<Project, "id" | "name" | "symbol">

import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const fmtPct = (n: number, digits = 1) =>
  `${(n * 100).toFixed(digits)}%`

export function RaiseMarketPricePanel() {
  const [projects, setProjects] = useState<ProjectListRow[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [status, setStatus] = useState<RiseStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [override, setOverride] = useState(false)
  const [customRiseStr, setCustomRiseStr] = useState<string>("") // percentage like "5"
  const [reason, setReason] = useState("")

  // 1. Load projects once.
  useEffect(() => {
    let cancelled = false
    getAllProjects().then((rows) => {
      if (cancelled) return
      setProjects(rows)
      if (rows.length > 0 && !selectedId) {
        setSelectedId(rows[0].id)
      }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2. Load status whenever the project changes.
  const loadStatus = async (projectId: string) => {
    if (!projectId) return
    setLoadingStatus(true)
    const s = await getRiseStatus(projectId)
    setStatus(s)
    setLoadingStatus(false)
  }

  useEffect(() => {
    if (!selectedId) return
    void loadStatus(selectedId)
  }, [selectedId])

  // 3. Compute effective rise to apply.
  const effectiveRise = useMemo<number>(() => {
    if (override) {
      const pct = parseFloat(customRiseStr)
      if (!Number.isFinite(pct)) return 0
      return Math.max(0, Math.min(50, pct)) / 100
    }
    return status?.allowed_natural_rise ?? 0
  }, [override, customRiseStr, status])

  const canApply = useMemo(() => {
    if (!status) return false
    if (submitting) return false
    if (override) {
      if (effectiveRise <= 0) return false
      if (!reason.trim() || reason.trim().length < 10) return false
      return true
    }
    return status.can_rise_naturally && effectiveRise > 0
  }, [status, override, effectiveRise, reason, submitting])

  const handleApply = async () => {
    if (!selectedId || !canApply) return
    setSubmitting(true)
    const r = await forceMarketRise({
      projectId: selectedId,
      risePct: override ? effectiveRise : null,
      override,
      reason: reason.trim() || undefined,
    })
    setSubmitting(false)
    if (!r.success) {
      showError(r.error ?? "تعذّر تطبيق الرفع")
      return
    }
    showSuccess(r.message ?? "تمّ تطبيق الرفع")
    setReason("")
    setCustomRiseStr("")
    setOverride(false)
    await loadStatus(selectedId)
  }

  const project = status?.project

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400/20 to-yellow-400/20 border border-green-400/30 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-green-400" strokeWidth={2} />
        </div>
        <div>
          <div className="text-base font-bold text-white">📈 رفع سعر السوق</div>
          <div className="text-[11px] text-neutral-500 leading-relaxed mt-0.5">
            رفع يدوي للسعر المعروض في السوق (مع إظهار الشروط الطبيعية + خيار override)
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
          className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20"
        >
          {projects.length === 0 && <option value="">— لا توجد مشاريع —</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.symbol && ` (${p.symbol})`}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loadingStatus && (
        <div className="py-8 flex items-center justify-center text-xs text-neutral-500 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          جاري قراءة الشروط...
        </div>
      )}

      {/* Status */}
      {status && project && !loadingStatus && (
        <div className="space-y-4">
          {/* Price + mode summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Stat
              label="السعر الاسمي"
              value={`${fmtNum(project.share_price)} د.ع`}
            />
            <Stat
              label="السعر السوقي الحالي"
              value={`${fmtNum(project.current_market_price)} د.ع`}
              highlight="green"
            />
            <Stat
              label="فوق الاسمي"
              value={`${project.percent_above_par.toFixed(2)}%`}
              highlight={
                project.percent_above_par > 0
                  ? "green"
                  : project.percent_above_par < 0
                    ? "red"
                    : "neutral"
              }
            />
            <Stat
              label="وضع المحرّك"
              value={
                status.is_frozen
                  ? "🧊 مُجمَّد"
                  : status.engine_mode === "initial"
                    ? "🚀 ابتدائي"
                    : status.engine_mode === "permanent"
                      ? "⚖ دائم"
                      : status.engine_mode
              }
            />
          </div>

          {/* Conditions panel */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
            <div className="text-xs font-bold text-white">
              📋 شروط الرفع الطبيعي
            </div>

            <ConditionRow
              label="شرط 1 — أزواج بائع/مشتري متميّزة"
              score={status.conditions.c1_score}
              detail={`${status.conditions.distinct_pairs} زوج / ${status.conditions.total_holders} مالك (${fmtPct(status.conditions.pair_ratio, 0)})`}
            />
            <ConditionRow
              label="شرط 2.أ — احتفاظ المالكين"
              score={status.conditions.hold_score}
              detail={`نسبة من لم يبيع آخر 3 أيام`}
            />
            <ConditionRow
              label="شرط 2.ب — توازن العرض/الطلب"
              score={status.conditions.balance_score}
              detail={`اختلال شراء/بيع في الإعلانات النشطة`}
            />
            <div className="h-px bg-white/[0.05]" />
            <ConditionRow
              label="نقاط شرط 2 الإجمالية"
              score={status.conditions.c2_score}
              detail="متوسّط 2.أ + 2.ب"
              bold
            />

            <div className="h-px bg-white/[0.05]" />
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-black/40 rounded-lg p-2">
                <div className="text-neutral-500 mb-0.5">السقف الشهري</div>
                <div className="font-mono text-white">
                  {fmtPct(status.monthly_accumulated, 2)} / {fmtPct(status.monthly_cap, 2)}
                </div>
              </div>
              <div className="bg-black/40 rounded-lg p-2">
                <div className="text-neutral-500 mb-0.5">رفعات اليوم</div>
                <div className="font-mono text-white">{status.today_rises}</div>
              </div>
            </div>
          </div>

          {/* Blockers */}
          {status.blockers.length > 0 && (
            <div className="bg-yellow-400/[0.06] border border-yellow-400/30 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-yellow-400">
                <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} />
                موانع للرفع الطبيعي ({status.blockers.length})
              </div>
              {status.blockers.map((b, i) => (
                <div
                  key={i}
                  className="text-[11px] text-yellow-200/90 leading-relaxed"
                >
                  {b}
                </div>
              ))}
            </div>
          )}

          {/* Natural rise quick-apply */}
          {status.can_rise_naturally && !override && (
            <div className="bg-green-400/[0.05] border border-green-400/30 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2
                  className="w-4 h-4 text-green-400 shrink-0 mt-0.5"
                  strokeWidth={2}
                />
                <div className="flex-1 text-[11px] text-green-200 leading-relaxed">
                  الشروط مستوفاة. الرفع الطبيعي المسموح:{" "}
                  <strong className="font-mono">
                    {fmtPct(status.allowed_natural_rise, 2)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Override toggle */}
          <div>
            <button
              onClick={() => setOverride((v) => !v)}
              className={cn(
                "w-full p-3 rounded-xl border transition-colors text-right flex items-center gap-3",
                override
                  ? "bg-red-400/[0.06] border-red-400/30 text-red-300"
                  : "bg-white/[0.04] border-white/[0.08] text-neutral-300 hover:text-white",
              )}
            >
              {override ? (
                <Unlock className="w-4 h-4" strokeWidth={2} />
              ) : (
                <Lock className="w-4 h-4" strokeWidth={2} />
              )}
              <div className="flex-1">
                <div className="text-xs font-bold">
                  {override
                    ? "🔓 وضع التجاوز (Override) مُفعَّل"
                    : "🔒 تجاوز الشروط (super-admin)"}
                </div>
                <div className="text-[10px] mt-0.5 leading-relaxed opacity-80">
                  {override
                    ? "ستُطبَّق نسبة مخصّصة بصرف النظر عن الموانع. يجب كتابة سبب."
                    : "اضغط لتفعيل الوضع الذي يتجاوز الشروط الطبيعية."}
                </div>
              </div>
            </button>
          </div>

          {/* Override controls (only when active) */}
          {override && (
            <div className="bg-red-400/[0.04] border border-red-400/20 rounded-xl p-3 space-y-3">
              <div>
                <label className="block text-[11px] text-neutral-400 mb-1.5">
                  نسبة الرفع المخصّصة (%) — حتى 50%
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    max="50"
                    value={customRiseStr}
                    onChange={(e) => setCustomRiseStr(e.target.value)}
                    placeholder="مثلاً: 5"
                    dir="ltr"
                    className="flex-1 bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-base text-white font-mono outline-none focus:border-red-400/30"
                  />
                  <span className="text-sm text-neutral-400">%</span>
                </div>
                {effectiveRise > 0 && project && (
                  <div className="text-[10px] text-neutral-500 mt-1.5">
                    الجديد:{" "}
                    <span className="font-mono text-white">
                      {fmtNum(
                        Math.round(project.current_market_price * (1 + effectiveRise)),
                      )}{" "}
                      د.ع
                    </span>{" "}
                    (+{fmtPct(effectiveRise, 2)})
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] text-neutral-400 mb-1.5">
                  سبب التجاوز (إجباري — يُسجَّل في سجل القرارات)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="مثلاً: قرار مجلس السوق بتعديل السعر بناءً على تطوّر المشروع"
                  maxLength={300}
                  className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-red-400/30 resize-none"
                />
                <div className="text-[10px] text-neutral-500 mt-1">
                  {reason.length}/300 — على الأقل 10 أحرف
                </div>
              </div>
            </div>
          )}

          {/* Apply button */}
          <button
            onClick={handleApply}
            disabled={!canApply}
            className={cn(
              "w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors",
              !canApply
                ? "bg-white/[0.05] text-neutral-600 cursor-not-allowed"
                : override
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-green-500 text-black hover:bg-green-600",
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري التطبيق...
              </>
            ) : override ? (
              <>
                <Zap className="w-4 h-4" strokeWidth={2.5} />
                تطبيق رفع مُجاوِز للشروط (+{fmtPct(effectiveRise, 1)})
              </>
            ) : status.can_rise_naturally ? (
              <>
                <TrendingUp className="w-4 h-4" strokeWidth={2.5} />
                تطبيق الرفع الطبيعي (+{fmtPct(effectiveRise, 2)})
              </>
            ) : (
              "الشروط غير مستوفاة — فعّل التجاوز للمتابعة"
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

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

function ConditionRow({
  label,
  score,
  detail,
  bold,
}: {
  label: string
  score: number
  detail: string
  bold?: boolean
}) {
  const pct = Math.round(score * 100)
  const tone =
    score >= 0.85
      ? "text-green-400"
      : score >= 0.5
        ? "text-yellow-400"
        : "text-red-400"
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-[11px]",
            bold ? "text-white font-bold" : "text-neutral-300",
          )}
        >
          {label}
        </div>
        <div className="text-[10px] text-neutral-500 mt-0.5">{detail}</div>
      </div>
      <div className="text-left">
        <div className={cn("text-sm font-bold font-mono", tone)}>{pct}%</div>
        <div className="w-12 h-1 bg-white/[0.08] rounded-full overflow-hidden mt-1">
          <div
            className={cn(
              "h-full transition-all",
              score >= 0.85
                ? "bg-green-400"
                : score >= 0.5
                  ? "bg-yellow-400"
                  : "bg-red-400",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
