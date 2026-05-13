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
} from "lucide-react"
import {
  getProjectLayers,
  getRecentRuns,
  getMonthlyRiseTable,
  manualTriggerDailyEngine,
  type AllLayers,
  type EngineDailyRun,
  type MonthlyRiseRow,
} from "@/lib/data/engine-monitor"
import { showError, showSuccess } from "@/lib/utils/toast"
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

  // ─── Manual trigger ───────────────────────────────────────────
  const handleManualTrigger = async (projectId?: string) => {
    if (firing) return
    setFiring(true)
    const result = await manualTriggerDailyEngine(projectId)
    setFiring(false)
    if (!result.success) {
      showError(result.error ?? "تعذّر التشغيل اليدوي")
      return
    }
    showSuccess(
      projectId
        ? "✅ تم تشغيل المحرّك على المشروع المحدد"
        : "✅ تم تشغيل المحرّك على كل المشاريع النشطة",
    )
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
            title="تشغيل المحرّك يدوياً على كل المشاريع (للاختبار)"
          >
            {firing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" strokeWidth={2.5} />
            )}
            تشغيل يدوي (الكل)
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
              <thead className="bg-white/[0.03] border-b border-white/[0.06]">
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleManualTrigger(r.project_id)
                        }}
                        disabled={firing}
                        className="text-[10px] text-green-400 hover:text-green-300 underline underline-offset-2 disabled:opacity-50"
                      >
                        تشغيل لهذا المشروع
                      </button>
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
              <thead className="bg-white/[0.03] border-b border-white/[0.06]">
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

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex items-start gap-2 text-[11px] text-neutral-400">
        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" strokeWidth={2} />
        <span>
          الـ Cron التلقائي يعمل يومياً في الساعة المُحددة في <code className="font-mono">market_settings.cron_job_hour</code>.
          استخدم زر التشغيل اليدوي للاختبار فقط.
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
