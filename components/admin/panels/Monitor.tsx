"use client"

/**
 * MonitorPanel — /admin?tab=monitor.
 *
 * Phase 13.3 — converted from a 7-section vertical scroll into a
 * tabbed hub. Founder feedback: "the page was a long wall and I had
 * to scroll past sections I didn't need." Now each concern lives in
 * its own tab; only the active tab's panel is mounted at a time, so
 * the heavy market-engine sub-panels don't all hit the DB on every
 * page load.
 *
 * Tabs:
 *   1. 📡 نظرة عامة         — KPIs + top movers + recent deals + health
 *   2. 📈 رفع السعر         — manual price-rise (founder's main action)
 *   3. ⚙️ المحرّك والقواعد    — engine state + sector caps
 *   4. 💰 العمولات          — commissions management
 *   5. 🛡️ الحماية والمراقبة  — freeze + transfers + protection
 *   6. 📜 سجلّ القرارات       — admin decisions audit trail
 *
 * Each tab keeps its own data fetch + clock so the overview tab
 * doesn't pay the cost of mounting freeze/transfer/protection panels
 * unless the admin actually opens them.
 */

import { useState, useEffect, useMemo } from "react"
import {
  KPI,
  Badge,
  SectionHeader,
} from "@/components/admin/ui"
import { StrategicAdvisorCard } from "@/components/admin/StrategicAdvisorCard"
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { ALL_PROJECTS } from "@/lib/mock-data/projects"
import {
  HEALTH_LEVEL_LABELS,
  LIQUIDITY_LABELS,
} from "@/lib/mock-data/marketAdvisor"
import {
  getMonitorOverview,
  computeHealth,
  type MonitorOverview,
} from "@/lib/data/admin-monitor"
import { getAllProjects } from "@/lib/data/projects"
import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
// Phase 13.45 — collapsed from 7 admin sub-panels to 1 unified
// MarketEnginePanelV2 (built in Phase 13.46) covering both the
// dynamic-mode toggle/conditions and the manual price rise.
import { MarketEnginePanelV2 } from "@/components/admin/market-engine/MarketEnginePanelV2"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const fmtTime = (iso: string) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

// ─────────────────────────────────────────────────────────────
// Tab 1 — Overview (KPIs + top movers + recent deals + health)
// ─────────────────────────────────────────────────────────────

function MonitorOverviewTab() {
  const [scope, setScope] = useState<string>("global")
  const [overview, setOverview] = useState<MonitorOverview>({
    total_volume_24h: 0,
    trades_24h: 0,
    avg_trade_size: 0,
    change_pct: 0,
    top_movers: [],
    recent_deals: [],
  })
  const [totalProjects, setTotalProjects] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState("")

  // Live clock for "آخر تحديث".
  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      )
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  const refresh = async () => {
    setRefreshing(true)
    try {
      const scopeId = scope === "global" ? null : scope
      const [ov, projs] = await Promise.all([
        getMonitorOverview(scopeId, 10),
        scope === "global" ? getAllProjects() : Promise.resolve(null),
      ])
      setOverview(ov)
      if (projs) setTotalProjects(projs.length)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void refresh()
    const t = setInterval(refresh, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  const data = useMemo(
    () => ({
      totalVolume24h: overview.total_volume_24h,
      trades24h: overview.trades_24h,
      avgTradeSize: overview.avg_trade_size,
      changePct: overview.change_pct,
      topMovers: overview.top_movers,
      recentTrades: overview.recent_deals,
    }),
    [overview],
  )

  const health = useMemo(
    () => computeHealth(overview, Math.max(1, totalProjects)),
    [overview, totalProjects],
  )
  const healthLabel = HEALTH_LEVEL_LABELS[health.health_level]
  const liquidityLabel = LIQUIDITY_LABELS[health.liquidity]
  const scopeName =
    scope === "global"
      ? "كلّ السوق"
      : ALL_PROJECTS.find((p) => p.id === scope)?.name || "—"

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="📡 نظرة عامة"
        subtitle={`بيانات السوق آخر 24 ساعة · ${scopeName} · آخر تحديث ${now}`}
        action={
          <div className="flex items-center gap-2">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-white/20"
            >
              <option value="global">🌐 كلّ السوق</option>
              {ALL_PROJECTS.map((p) => (
                <option key={p.id} value={p.id}>
                  📊 {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => refresh()}
              disabled={refreshing}
              className="bg-white/[0.05] border border-white/[0.08] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white/[0.08] flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw
                className={cn(
                  "w-3.5 h-3.5",
                  refreshing && "animate-spin",
                )}
              />
              تحديث
            </button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="حجم 24 ساعة" val={fmtNum(data.totalVolume24h) + " د.ع"} color="#FBBF24" />
        <KPI label="عدد الصفقات" val={fmtNum(data.trades24h)} color="#60A5FA" />
        <KPI label="متوسط حجم الصفقة" val={fmtNum(data.avgTradeSize) + " د.ع"} color="#fff" />
        <KPI
          label="معدل التغير (24س)"
          val={`${data.changePct >= 0 ? "+" : ""}${data.changePct.toFixed(1)}%`}
          color={
            data.changePct > 0
              ? "#4ADE80"
              : data.changePct < 0
                ? "#F87171"
                : "#737373"
          }
        />
      </div>

      {/* Top movers + recent deals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-7">
        {/* Top movers */}
        <div>
          <div className="text-sm font-bold text-white mb-3">🔥 الأعلى تحركاً</div>
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl divide-y divide-white/[0.04] min-h-[200px]">
            {data.topMovers.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-3xl mb-2 opacity-40">📊</div>
                <div className="text-xs text-neutral-500">
                  لا توجد تحرّكات بعد — السوق هادئ
                </div>
              </div>
            ) : (
              data.topMovers.map((p) => {
                const isUp = p.change_pct >= 0
                return (
                  <div key={p.project_id} className="p-3 flex items-center gap-3">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border",
                        isUp
                          ? "bg-green-400/10 border-green-400/20"
                          : "bg-red-400/10 border-red-400/20",
                      )}
                    >
                      {isUp ? (
                        <TrendingUp className="w-4 h-4 text-green-400" strokeWidth={2} />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" strokeWidth={2} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">
                        {p.project_name}
                        {p.project_symbol && (
                          <span className="text-[10px] text-blue-400 mr-1.5 font-mono" dir="ltr">
                            ({p.project_symbol})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">
                        حجم: {fmtNum(p.volume_24h)} د.ع · {p.trades_count} صفقة
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-white font-mono">
                        {fmtNum(p.current_price)}
                      </div>
                      <div
                        className={cn(
                          "text-[11px] font-bold",
                          isUp ? "text-green-400" : "text-red-400",
                        )}
                      >
                        {isUp ? "+" : ""}
                        {p.change_pct.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Recent deals */}
        <div>
          <div className="text-sm font-bold text-white mb-3">⚡ آخر الصفقات</div>
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl divide-y divide-white/[0.04] min-h-[200px]">
            {data.recentTrades.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-3xl mb-2 opacity-40">⏳</div>
                <div className="text-xs text-neutral-500">لا توجد صفقات بعد</div>
              </div>
            ) : (
              data.recentTrades.map((t) => (
                <div key={t.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">{t.project_name}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      {t.buyer_name} ← {t.seller_name}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-neutral-300">
                      <span className="text-green-400 font-bold">{t.shares}</span> حصة
                    </div>
                    <div className="text-[10px] text-yellow-400 font-mono mt-0.5">
                      {fmtNum(t.price_per_share)} د.ع · {fmtTime(t.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Health strip */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-bold text-white">🩺 صحة السوق</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              مؤشّر مُجمَّع على بيانات الـ 24 ساعة الأخيرة
            </div>
          </div>
          <Badge label={healthLabel.label} color={healthLabel.color} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <StatCell
            label="نقاط الصحة"
            value={`${health.health_score}`}
            unit="/100"
            tone={
              health.health_level === "healthy"
                ? "green"
                : health.health_level === "watch"
                  ? "yellow"
                  : "red"
            }
          />
          <StatCell
            label="صفقات / مطلوب"
            value={`${health.current_deals}/${health.required_deals}`}
            tone="blue"
          />
          <StatCell
            label="السيولة"
            value={liquidityLabel.label}
            tone={
              health.liquidity === "high"
                ? "green"
                : health.liquidity === "medium"
                  ? "yellow"
                  : "red"
            }
          />
          <StatCell
            label="معدّل الدوران"
            value={`${health.turnover_rate}%`}
            tone="purple"
          />
          <StatCell
            label="التذبذب"
            value={`${health.volatility_pct.toFixed(1)}%`}
            tone={
              health.volatility_pct < 3
                ? "green"
                : health.volatility_pct < 5
                  ? "yellow"
                  : "red"
            }
          />
        </div>
      </div>

      {/* Phase 13.56 — strategic advisor compact card directly under
          the health strip. Reads the same RPC as the full version in
          the Market Engine panel; auto-refreshes every 30s. Gives the
          admin actionable next-steps right where they see the health
          numbers. */}
      <div className="mb-3">
        <StrategicAdvisorCard variant="compact" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Tab 2 — Market Engine (unified, Phase 13.45+)
// ─────────────────────────────────────────────────────────────

function MonitorEngineTab() {
  return (
    <div className="p-6 max-w-screen-2xl">
      <MarketEnginePanelV2 />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Hub — Phase 13.45 collapsed from 6 tabs to 2
// ─────────────────────────────────────────────────────────────

export function MonitorPanel() {
  return (
    <EmbeddedTabsHub
      title="📡 مراقبة السوق"
      subtitle="نظرة عامة على السوق + محرّك التسعير (يدوي + ديناميكي)"
      tabs={[
        {
          key: "overview",
          label: "📡 نظرة عامة",
          hint: "حجم 24 ساعة + الأعلى تحركاً + آخر الصفقات + صحة السوق",
          Panel: MonitorOverviewTab,
        },
        {
          key: "engine",
          label: "⚙️ محرّك التسعير",
          hint: "تشغيل/إيقاف الديناميكي + الشروط + الرفع اليدوي",
          Panel: MonitorEngineTab,
        },
      ]}
    />
  )
}

// ─────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  unit,
  tone = "white",
}: {
  label: string
  value: string
  unit?: string
  tone?: "green" | "yellow" | "red" | "blue" | "purple" | "white"
}) {
  const toneClass = {
    green: "text-green-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
    blue: "text-blue-400",
    purple: "text-purple-400",
    white: "text-white",
  }[tone]
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
      <div className="text-[10px] text-neutral-500 mb-1">{label}</div>
      <div className={cn("text-lg font-bold font-mono", toneClass)}>
        {value}
        {unit && <span className="text-[10px] text-neutral-500 mr-0.5">{unit}</span>}
      </div>
    </div>
  )
}
