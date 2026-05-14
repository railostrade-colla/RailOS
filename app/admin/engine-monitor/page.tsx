"use client"

/**
 * /admin/engine-monitor — Phase 14.08f.
 *
 * Read-only window into the new 3-layer engine:
 *   • Monthly rise table (one row per project, sorted by % used)
 *   • Selected-project: live layer progress + cap preview
 *   • Recent daily-cron runs (last 50) with which caps fired
 *   • Manual cron trigger for super_admin (Phase 14.08g)
 *
 * Auth: the /admin layout enforces role gating. The manual-trigger
 * RPC also enforces super_admin server-side.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Play,
  RefreshCw,
  Loader2,
  Zap,
  Siren,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import {
  getProjectLayers,
  getRecentRuns,
  getMonthlyRiseTable,
  manualTriggerDailyEngine,
  forceEmergencyRise,
  EMERGENCY_RISE_MAX_PERCENT,
  EMERGENCY_REASON_MIN_LEN,
  type AllLayers,
  type EngineDailyRun,
  type MonthlyRiseRow,
} from "@/lib/data/engine-monitor"
import { showError, showSuccess, showInfo } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtPct = (n: number, digits = 2) => `${n.toFixed(digits)}%`
const fmtNum = (n: number) => n.toLocaleString("en-US")

export default function EngineMonitorPage() {
  const [rows, setRows] = useState<MonthlyRiseRow[]>([])
  const [runs, setRuns] = useState<EngineDailyRun[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [layers, setLayers] = useState<AllLayers | null>(null)
  const [loadingRows, setLoadingRows] = useState(true)
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [loadingLayers, setLoadingLayers] = useState(false)
  const [firing, setFiring] = useState(false)

  // ─── Emergency-rise state (Phase 14.08.2) ──────────────────────
  // Hidden behind a collapsible section so it doesn't crowd the
  // read-only monitor. Default-closed; only super-admins will open it.
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [emergencyRiseInput, setEmergencyRiseInput] = useState("")
  const [emergencyReason, setEmergencyReason] = useState("")
  const [emergencyFiring, setEmergencyFiring] = useState(false)

  // ─── Initial loads ────────────────────────────────────────────
  const reloadRows = useCallback(async () => {
    setLoadingRows(true)
    const r = await getMonthlyRiseTable()
    setRows(r)
    setLoadingRows(false)
    if (r.length > 0 && !selectedId) setSelectedId(r[0].project_id)
  }, [selectedId])

  const reloadRuns = useCallback(async () => {
    setLoadingRuns(true)
    const r = await getRecentRuns(50)
    setRuns(r)
    setLoadingRuns(false)
  }, [])

  useEffect(() => {
    void reloadRows()
    void reloadRuns()
  }, [reloadRows, reloadRuns])

  // ─── Selected-project layer compute ───────────────────────────
  useEffect(() => {
    if (!selectedId) {
      setLayers(null)
      return
    }
    let cancelled = false
    setLoadingLayers(true)
    getProjectLayers(selectedId)
      .then((l) => {
        if (!cancelled) setLayers(l)
      })
      .finally(() => {
        if (!cancelled) setLoadingLayers(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const selectedRow = useMemo(
    () => rows.find((r) => r.project_id === selectedId) ?? null,
    [rows, selectedId],
  )

  // ─── Emergency-rise handler ───────────────────────────────────
  const handleEmergencyRise = async () => {
    if (emergencyFiring) return
    if (!selectedId) {
      showError("اختر مشروعاً من الجدول أعلاه أوّلاً")
      return
    }
    const risePct = Number(emergencyRiseInput)
    if (!Number.isFinite(risePct) || risePct <= 0) {
      showError("النسبة يجب أن تكون رقماً موجباً")
      return
    }
    if (risePct > EMERGENCY_RISE_MAX_PERCENT) {
      showError(`الحدّ الأقصى ${EMERGENCY_RISE_MAX_PERCENT}%`)
      return
    }
    const trimmedReason = emergencyReason.trim()
    if (trimmedReason.length < EMERGENCY_REASON_MIN_LEN) {
      showError(`السبب يجب أن يكون ${EMERGENCY_REASON_MIN_LEN} أحرف على الأقل`)
      return
    }
    const projName = selectedRow?.project_name ?? "المشروع المحدّد"
    const oldPrice = selectedRow?.current_price ?? 0
    const projectedNew = Math.max(1, Math.round(oldPrice * (1 + risePct / 100)))
    const confirmMsg =
      `🚨 رفع طوارئ على «${projName}»\n\n` +
      `النسبة: +${risePct.toFixed(2)}%\n` +
      `السعر الحالي: ${oldPrice.toLocaleString("en-US")} د.ع\n` +
      `السعر المتوقَّع: ${projectedNew.toLocaleString("en-US")} د.ع\n\n` +
      `السبب: ${trimmedReason}\n\n` +
      `هذا الإجراء يتجاوز المحرّك ويُسجَّل دائماً في سجلّ القرارات. متأكّد؟`
    if (!window.confirm(confirmMsg)) return

    setEmergencyFiring(true)
    const result = await forceEmergencyRise(selectedId, risePct, trimmedReason)
    setEmergencyFiring(false)
    if (!result.success) {
      showError(result.error ?? "فشل تنفيذ الرفع")
      return
    }
    showSuccess(
      `✅ تمّ — السعر ${result.oldPrice?.toLocaleString("en-US")} → ${result.newPrice?.toLocaleString("en-US")} د.ع`,
    )
    // Refresh all surfaces so the new price reflects everywhere.
    setEmergencyRiseInput("")
    setEmergencyReason("")
    void reloadRows()
    void reloadRuns()
    if (selectedId) {
      const l = await getProjectLayers(selectedId)
      setLayers(l)
    }
  }

  // ─── Manual trigger ───────────────────────────────────────────
  // Phase 14.08.1 — `force` bypasses the one-run-per-day idempotency
  // guard. Only the dedicated "Force" buttons set it to true; the
  // natural-path buttons stay safe.
  const handleManualTrigger = async (projectId?: string, force = false) => {
    if (firing) return
    setFiring(true)
    const result = await manualTriggerDailyEngine(projectId, force)
    setFiring(false)
    if (!result.success) {
      showError(result.error ?? "تعذّر التشغيل اليدوي")
      return
    }
    if (result.skipped) {
      // Server returned skipped='already_ran_today' and force was off.
      // Surface as info (not success) so the operator sees why nothing
      // happened. They can press the Force button to override.
      showInfo(
        projectId
          ? "ℹ️ هذا المشروع شُغِّل اليوم بالفعل — استخدم «تشغيل قسري» للتجاوز"
          : "ℹ️ بعض المشاريع شُغِّلت اليوم بالفعل — استخدم «تشغيل قسري» للتجاوز",
      )
    } else if (force) {
      showSuccess(
        projectId
          ? "⚡ تشغيل قسري ناجح على المشروع المحدد"
          : "⚡ تشغيل قسري ناجح على كل المشاريع النشطة",
      )
    } else {
      showSuccess(
        projectId
          ? "✅ تم تشغيل المحرّك على المشروع المحدد"
          : "✅ تم تشغيل المحرّك على كل المشاريع النشطة",
      )
    }
    void reloadRows()
    void reloadRuns()
    if (selectedId) {
      const l = await getProjectLayers(selectedId)
      setLayers(l)
    }
  }

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-7">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-green-400/20 to-blue-400/20 border border-green-400/30 flex items-center justify-center">
            <Activity className="w-5 h-5 text-green-400" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">📊 مراقبة محرّك التسعير</h1>
            <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
              الطبقات الثلاث + السقوف + سجل التشغيل اليومي
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void reloadRows()
              void reloadRuns()
            }}
            disabled={loadingRows || loadingRuns}
            className="text-xs text-neutral-400 hover:text-white bg-white/[0.04] border border-white/[0.08] hover:border-white/20 rounded-xl px-3 py-2 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {loadingRows || loadingRuns ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
            )}
            تحديث
          </button>
          <button
            type="button"
            onClick={() => handleManualTrigger()}
            disabled={firing}
            className={cn(
              "text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 transition-colors",
              firing
                ? "bg-white/[0.04] text-neutral-500 cursor-wait"
                : "bg-green-500 text-black hover:bg-green-600",
            )}
            title="تشغيل المحرّك يدوياً على كل المشاريع (مرة واحدة لكل يوم لكل مشروع)"
          >
            {firing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" strokeWidth={2.5} />
            )}
            تشغيل يدوي (الكل)
          </button>
          {/* Phase 14.08.1 — Force re-run: bypasses idempotency guard.
              Clearly styled as a destructive/testing-only action. */}
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "⚡ تشغيل قسري على كل المشاريع النشطة؟\n\nهذا الزر يتجاوز حماية «مرة واحدة باليوم» ويُفعّل المحرّك مرة أخرى حتى لو شُغِّل اليوم. للاختبار فقط.",
                )
              ) {
                void handleManualTrigger(undefined, true)
              }
            }}
            disabled={firing}
            className={cn(
              "text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 transition-colors border",
              firing
                ? "bg-white/[0.04] text-neutral-500 border-white/[0.08] cursor-wait"
                : "bg-orange-400/15 text-orange-300 border-orange-400/30 hover:bg-orange-400/25",
            )}
            title="تجاوز الحماية اليومية وإعادة التشغيل — للاختبار فقط"
          >
            {firing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" strokeWidth={2.5} />
            )}
            قسري (تجاوز)
          </button>
        </div>
      </header>

      {/* Monthly rise table */}
      <section>
        <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-400" strokeWidth={2} />
          ارتفاع كل مشروع هذا الشهر
        </h2>
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
          {loadingRows ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              جاري التحميل...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              لا توجد مشاريع نشطة بعد
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-white/[0.04] border-b border-white/[0.08]">
                <tr className="text-neutral-500">
                  <th className="text-right px-3 py-2 font-bold">المشروع</th>
                  <th className="text-right px-3 py-2 font-bold">القطاع</th>
                  <th className="text-right px-3 py-2 font-bold">السعر الحالي</th>
                  <th className="text-right px-3 py-2 font-bold">رفعة الشهر</th>
                  <th className="text-right px-3 py-2 font-bold">عدد الرفعات</th>
                  <th className="text-right px-3 py-2 font-bold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {rows.map((r) => (
                  <tr
                    key={r.project_id}
                    onClick={() => setSelectedId(r.project_id)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedId === r.project_id
                        ? "bg-white/[0.06]"
                        : "hover:bg-white/[0.03]",
                    )}
                  >
                    <td className="px-3 py-2 text-white font-bold truncate max-w-[200px]">
                      {r.project_name}
                    </td>
                    <td className="px-3 py-2 text-neutral-400">{r.sector ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-white">
                      {fmtNum(r.current_price)} د.ع
                    </td>
                    <td className="px-3 py-2 font-mono text-green-400">
                      +{fmtPct(r.monthly_rise_pct)}
                    </td>
                    <td className="px-3 py-2 font-mono text-neutral-400">
                      {fmtNum(r.rise_events_count)}
                    </td>
                    <td className="px-3 py-2 text-left">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleManualTrigger(r.project_id)
                          }}
                          disabled={firing}
                          className="text-[10px] text-green-400 hover:text-green-300 underline underline-offset-2 disabled:opacity-50"
                        >
                          تشغيل
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (
                              window.confirm(
                                `⚡ تشغيل قسري على «${r.project_name}»؟\n\nيتجاوز حماية «مرة واحدة باليوم». للاختبار فقط.`,
                              )
                            ) {
                              void handleManualTrigger(r.project_id, true)
                            }
                          }}
                          disabled={firing}
                          className="text-[10px] text-orange-300 hover:text-orange-200 underline underline-offset-2 disabled:opacity-50"
                          title="تجاوز حماية اليوم — للاختبار فقط"
                        >
                          قسري
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Selected project — layer details */}
      {selectedRow && (
        <section>
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" strokeWidth={2} />
            طبقات الرفع — {selectedRow.project_name}
          </h2>

          {loadingLayers ? (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center text-xs text-neutral-500">
              جاري حساب الطبقات...
            </div>
          ) : !layers ? (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center text-xs text-neutral-500">
              تعذّر حساب الطبقات لهذا المشروع
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <LayerCard
                index={1}
                title="🤝 أزواج البائع/المشتري"
                progress={layers.layer1.progress}
                reward={layers.layer1_reward_pct}
                detail={`${layers.layer1.distinct_pairs} زوج / ${layers.layer1.active_users} نشط`}
                target={`الهدف: ${layers.layer1.target_pct.toFixed(1)}%`}
              />
              <LayerCard
                index={2}
                title="⚖ توازن العرض/الطلب"
                progress={layers.layer2.progress}
                reward={layers.layer2_reward_pct}
                detail={`عرض: ${fmtNum(Math.round(layers.layer2.supply_value))} / طلب: ${fmtNum(Math.round(layers.layer2.demand_value))}`}
                target="الهدف: توازن 1:1"
              />
              <LayerCard
                index={3}
                title="✨ تجديد المشاركين"
                progress={layers.layer3.progress}
                reward={layers.layer3_reward_pct}
                detail={`${layers.layer3.new_dealers} جديد / ${layers.layer3.returning_dealers} قديم`}
                target={`نافذة: ${layers.layer3.window_days} يوم`}
              />
            </div>
          )}

          {layers && (
            <div className="mt-3 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-neutral-400">إجمالي الرفع المُقترح:</span>
                <span className="text-green-400 font-bold font-mono">
                  +{fmtPct(layers.raw_rise_pct)}
                </span>
              </div>
              <div className="text-[10px] text-neutral-500">
                هذا قبل تطبيق سقوف القطاع / اليوم / السنة
              </div>
            </div>
          )}
        </section>
      )}

      {/* Recent runs */}
      <section>
        <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-yellow-400" strokeWidth={2} />
          سجل التشغيل اليومي (آخر 50)
        </h2>
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
          {loadingRuns ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              جاري التحميل...
            </div>
          ) : runs.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              لم تُسجَّل أي عمليات تشغيل بعد. شغّل المحرّك يدوياً لتجربته.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-white/[0.04] border-b border-white/[0.08]">
                <tr className="text-neutral-500">
                  <th className="text-right px-3 py-2 font-bold">الوقت</th>
                  <th className="text-right px-3 py-2 font-bold">المشروع</th>
                  <th className="text-right px-3 py-2 font-bold">L1 / L2 / L3</th>
                  <th className="text-right px-3 py-2 font-bold">خام</th>
                  <th className="text-right px-3 py-2 font-bold">مُطبَّق</th>
                  <th className="text-right px-3 py-2 font-bold">السقوف المُفعَّلة</th>
                  <th className="text-right px-3 py-2 font-bold">السعر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {runs.map((r) => {
                  const proj = rows.find((p) => p.project_id === r.project_id)
                  return (
                    <tr key={r.id}>
                      <td className="px-3 py-2 text-neutral-400 font-mono text-[10px]" dir="ltr">
                        {new Date(r.run_at).toLocaleString("en-GB")}
                      </td>
                      <td className="px-3 py-2 text-white truncate max-w-[140px]">
                        {proj?.project_name ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-neutral-300">
                        {(r.layer1_progress * 100).toFixed(0)}/
                        {(r.layer2_progress * 100).toFixed(0)}/
                        {(r.layer3_progress * 100).toFixed(0)}
                      </td>
                      <td className="px-3 py-2 font-mono text-neutral-400">
                        {fmtPct(r.raw_rise_pct)}
                      </td>
                      <td className="px-3 py-2 font-mono text-green-400 font-bold">
                        +{fmtPct(r.applied_rise_pct)}
                      </td>
                      <td className="px-3 py-2">
                        {r.capped_by.length === 0 ? (
                          <span className="text-[10px] text-neutral-600">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {r.capped_by.map((c) => (
                              <span
                                key={c}
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded font-bold border",
                                  c === "engine_off"
                                    ? "bg-red-400/15 border-red-400/30 text-red-300"
                                    : c === "sector"
                                      ? "bg-yellow-400/15 border-yellow-400/30 text-yellow-300"
                                      : c === "daily"
                                        ? "bg-blue-400/15 border-blue-400/30 text-blue-300"
                                        : c === "yearly"
                                          ? "bg-purple-400/15 border-purple-400/30 text-purple-300"
                                          : "bg-white/[0.05] border-white/[0.08] text-neutral-400",
                                )}
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-neutral-400" dir="ltr">
                        {fmtNum(r.old_price)} → {fmtNum(r.new_price)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ─── Emergency Rise (Phase 14.08.2) ──────────────────────
          Collapsible section, default-closed. Calls the rewritten
          admin_force_market_rise RPC directly. Server-side rules:
            • admin or super_admin role required
            • rise > 0 and ≤ 50%
            • reason ≥ 10 chars
            • writes price_history + admin_decisions_log
       */}
      <section className="border border-red-400/20 bg-red-400/[0.04] rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setEmergencyOpen((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-red-400/[0.06] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Siren className="w-4 h-4 text-red-400" strokeWidth={2} />
            <h2 className="text-sm font-bold text-white">رفع طوارئ — تجاوز يدويّ</h2>
            <span className="text-[10px] text-red-300/80 bg-red-400/10 border border-red-400/20 rounded-full px-2 py-0.5">
              للسوبر-أدمن فقط
            </span>
          </div>
          {emergencyOpen ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </button>

        {emergencyOpen && (
          <div className="px-4 pb-4 pt-1 border-t border-red-400/15 space-y-3">
            <div className="text-[11px] text-neutral-400 leading-relaxed bg-white/[0.02] rounded-lg p-3">
              <strong className="text-red-300">⚠ تحذير:</strong> هذا الإجراء يتجاوز
              المحرّك التلقائي ويُطبّق رفعاً يدوياً على
              <strong className="text-white"> {selectedRow?.project_name ?? "المشروع المحدّد"}</strong>.
              يُسجَّل في <code className="font-mono">price_history</code> بعلامة
              <code className="font-mono text-red-300"> admin_force_rise</code> وفي
              <code className="font-mono"> admin_decisions_log</code>. لا يُستخدم
              إلّا في حالات طارئة (تصحيح خطأ، حدث استثنائي).
            </div>

            {!selectedRow && (
              <div className="text-[11px] text-yellow-300 bg-yellow-400/[0.08] border border-yellow-400/20 rounded-lg p-3">
                اختر مشروعاً من جدول «ارتفاع كل مشروع هذا الشهر» أعلاه أوّلاً.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-neutral-500 mb-1 font-bold">
                  النسبة (%) — أكبر من 0 وأقل أو يساوي {EMERGENCY_RISE_MAX_PERCENT}
                </label>
                <input
                  type="number"
                  min="0.01"
                  max={EMERGENCY_RISE_MAX_PERCENT}
                  step="0.01"
                  value={emergencyRiseInput}
                  onChange={(e) => setEmergencyRiseInput(e.target.value)}
                  placeholder="مثل: 1.5"
                  disabled={!selectedRow || emergencyFiring}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-red-400/40 disabled:opacity-50"
                  dir="ltr"
                />
                {selectedRow && Number(emergencyRiseInput) > 0 && (
                  <div className="text-[10px] text-neutral-500 mt-1" dir="ltr">
                    {fmtNum(selectedRow.current_price)} → {" "}
                    {fmtNum(
                      Math.max(
                        1,
                        Math.round(
                          selectedRow.current_price *
                            (1 + Number(emergencyRiseInput) / 100),
                        ),
                      ),
                    )}{" "}
                    د.ع
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-neutral-500 mb-1 font-bold">
                  السبب — {EMERGENCY_REASON_MIN_LEN} أحرف على الأقل
                </label>
                <input
                  type="text"
                  value={emergencyReason}
                  onChange={(e) => setEmergencyReason(e.target.value)}
                  placeholder="مثل: تصحيح بعد تأخّر صفقة كبيرة"
                  disabled={!selectedRow || emergencyFiring}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-400/40 disabled:opacity-50"
                />
                <div className="text-[10px] text-neutral-500 mt-1">
                  {emergencyReason.trim().length} / {EMERGENCY_REASON_MIN_LEN} حرف
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleEmergencyRise}
              disabled={
                !selectedRow ||
                emergencyFiring ||
                !Number(emergencyRiseInput) ||
                emergencyReason.trim().length < EMERGENCY_REASON_MIN_LEN
              }
              className={cn(
                "text-xs font-bold rounded-xl px-4 py-2.5 flex items-center gap-2 transition-colors",
                emergencyFiring
                  ? "bg-white/[0.04] text-neutral-500 cursor-wait"
                  : "bg-red-500/20 text-red-300 border border-red-400/30 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {emergencyFiring ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Siren className="w-3.5 h-3.5" strokeWidth={2.5} />
              )}
              تنفيذ الرفع الطارئ
            </button>
          </div>
        )}
      </section>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex items-start gap-2 text-[11px] text-neutral-400">
        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" strokeWidth={2} />
        <span>
          الـ Cron التلقائي يعمل يومياً في الساعة المُحددة في <code className="font-mono">market_settings.cron_job_hour</code>.
          كل مشروع يُشغَّل <strong className="text-neutral-300">مرة واحدة في اليوم</strong>؛
          زر «تشغيل يدوي» يحترم هذه الحماية، أمّا <strong className="text-orange-300">«قسري (تجاوز)»</strong> فيتخطّاها للاختبار فقط.
        </span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function LayerCard({
  index,
  title,
  progress,
  reward,
  detail,
  target,
}: {
  index: 1 | 2 | 3
  title: string
  progress: number
  reward: number
  detail: string
  target: string
}) {
  const pct = Math.round(progress * 100)
  const color = index === 1 ? "green" : index === 2 ? "blue" : "purple"
  const tone =
    color === "green"
      ? { bar: "bg-green-400", text: "text-green-400", bg: "bg-green-400/[0.04]", border: "border-green-400/20" }
      : color === "blue"
        ? { bar: "bg-blue-400", text: "text-blue-400", bg: "bg-blue-400/[0.04]", border: "border-blue-400/20" }
        : { bar: "bg-purple-400", text: "text-purple-400", bg: "bg-purple-400/[0.04]", border: "border-purple-400/20" }

  return (
    <div className={cn("rounded-2xl border p-4", tone.bg, tone.border)}>
      <div className="flex items-start justify-between mb-2">
        <div className="text-sm font-bold text-white truncate">{title}</div>
        <div className={cn("text-base font-mono font-bold", tone.text)}>{pct}%</div>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-2">
        <div
          className={cn("h-full transition-all", tone.bar)}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <div className="text-[10px] text-neutral-500">{detail}</div>
      <div className="text-[10px] text-neutral-600 mt-1">{target}</div>
      <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between">
        <span className="text-[10px] text-neutral-500">مساهمة في الرفع</span>
        <span className={cn("text-sm font-bold font-mono", tone.text)}>
          +{reward.toFixed(2)}%
        </span>
      </div>
    </div>
  )
}
