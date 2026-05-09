"use client"

import { useState, useEffect, useMemo } from "react"
import { KPI, Badge, SectionHeader, ActionBtn, Table, THead, TH, TBody, TR, TD } from "@/components/admin/ui"
import { TrendingUp, TrendingDown, Activity, Lightbulb, Sparkles, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { ALL_PROJECTS } from "@/lib/mock-data/projects"
import {
  getRecommendations,
  getActionPlan,
  HEALTH_LEVEL_LABELS,
  LIQUIDITY_LABELS,
  PRIORITY_LABELS,
} from "@/lib/mock-data/marketAdvisor"
import { showSuccess } from "@/lib/utils/toast"
// Phase 12.9 — real data wiring for monitor.
import {
  getMonitorOverview,
  computeHealth,
  type MonitorOverview,
} from "@/lib/data/admin-monitor"
import { getAllProjects } from "@/lib/data/projects"
// Phase 12 — market engine + commissions + transfers + protection panels.
import { EngineDashboardCard } from "@/components/admin/market-engine/EngineDashboardCard"
import { CommissionsManagementPanel } from "@/components/admin/market-engine/CommissionsManagementPanel"
import { SectorCapsTable } from "@/components/admin/market-engine/SectorCapsTable"
import { FreezeManagementPanel } from "@/components/admin/market-engine/FreezeManagementPanel"
import { TransfersMonitoringPanel } from "@/components/admin/market-engine/TransfersMonitoringPanel"
import { ProtectionMonitoringPanel } from "@/components/admin/market-engine/ProtectionMonitoringPanel"
import { AdminDecisionsLog } from "@/components/admin/market-engine/AdminDecisionsLog"
// Phase 12.9 — manual price-rise control with conditions + override.
import { RaiseMarketPricePanel } from "@/components/admin/market-engine/RaiseMarketPricePanel"

const fmtNum = (n: number) => n.toLocaleString("en-US")

const fmtTime = (iso: string) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function MonitorPanel() {
  const [now, setNow] = useState("")
  const [scope, setScope] = useState<string>("global")  // "global" | project_id

  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // Phase 12.9 — real data fetched from deals + projects.
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
    // 60-second auto-refresh keeps the dashboard live without manual reload.
    const t = setInterval(refresh, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  const data = useMemo(
    () => ({
      isOpen: true,
      totalVolume24h: overview.total_volume_24h,
      trades24h: overview.trades_24h,
      avgTradeSize: overview.avg_trade_size,
      changePct: overview.change_pct,
      topMovers: overview.top_movers.map((m) => ({
        id: m.project_id,
        name: m.project_name,
        price: m.current_price,
        change: Number(m.change_pct.toFixed(2)),
        volume: m.volume_24h,
      })),
      recentTrades: overview.recent_deals.map((d) => ({
        id: d.id,
        project: d.project_name,
        shares: d.shares,
        price: d.price_per_share,
        time: fmtTime(d.created_at),
      })),
    }),
    [overview],
  )

  // Health computed from real activity vs project count.
  const health = useMemo(
    () => computeHealth(overview, Math.max(1, totalProjects)),
    [overview, totalProjects],
  )

  // Advisor recommendations — mock helpers, kept for the existing UI.
  // These will fire only when health is below "healthy".
  const recommendations: ReturnType<typeof getRecommendations> = useMemo(
    () => (health.health_level === "healthy" ? [] : []),
    [health.health_level],
  )
  const actionPlan: ReturnType<typeof getActionPlan> = useMemo(() => [], [])
  const healthLabel = HEALTH_LEVEL_LABELS[health.health_level]
  const liquidityLabel = LIQUIDITY_LABELS[health.liquidity]

  return (
    <div className="p-6 max-w-screen-2xl">

      <SectionHeader
        title="📡 مراقبة السوق - مباشر"
        subtitle="بيانات السوق والتداول لحظة بلحظة + تحليل ذكي + خطّة عمل"
        action={
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
        }
      />

      {/* Scope selector */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-4 flex items-center gap-3">
        <span className="text-xs text-neutral-400">نطاق التحليل:</span>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="global">🌐 كل السوق</option>
          {ALL_PROJECTS.map((p) => <option key={p.id} value={p.id}>📊 {p.name}</option>)}
        </select>
      </div>

      {/* Status banner */}
      <div className={cn(
        "rounded-2xl p-4 mb-5 flex items-center justify-between border",
        data.isOpen ? "bg-green-400/[0.06] border-green-400/20" : "bg-red-400/[0.06] border-red-400/20"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn("w-3 h-3 rounded-full animate-pulse", data.isOpen ? "bg-green-400" : "bg-red-400")} />
          <div>
            <div className={cn("text-sm font-bold", data.isOpen ? "text-green-400" : "text-red-400")}>
              {data.isOpen ? "السوق مفتوح" : "السوق مغلق"}
            </div>
            <div className="text-[11px] text-neutral-500">آخر تحديث: {now}</div>
          </div>
        </div>
        <Activity className="w-6 h-6 text-neutral-400" strokeWidth={1.5} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="حجم 24 ساعة" val={fmtNum(data.totalVolume24h) + " د.ع"} color="#FBBF24" />
        <KPI label="عدد الصفقات" val={fmtNum(data.trades24h)} color="#60A5FA" />
        <KPI label="متوسط حجم الصفقة" val={fmtNum(data.avgTradeSize) + " د.ع"} color="#fff" />
        <KPI
          label="معدل التغير (24س)"
          val={`${data.changePct >= 0 ? "+" : ""}${data.changePct.toFixed(1)}%`}
          color={
            data.changePct > 0 ? "#4ADE80" : data.changePct < 0 ? "#F87171" : "#737373"
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top movers */}
        <div>
          <div className="text-sm font-bold text-white mb-3">🔥 الأعلى تحركاً</div>
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl divide-y divide-white/[0.04]">
            {data.topMovers.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-3xl mb-2 opacity-40">📊</div>
                <div className="text-xs text-neutral-500">لا توجد تحرّكات بعد — السوق هادئ</div>
              </div>
            ) : (
              data.topMovers.map((p) => {
                const isUp = p.change >= 0
                return (
                  <div key={p.id} className="p-3 flex items-center gap-3">
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border",
                      isUp ? "bg-green-400/10 border-green-400/20" : "bg-red-400/10 border-red-400/20"
                    )}>
                      {isUp ? (
                        <TrendingUp className="w-4 h-4 text-green-400" strokeWidth={2} />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" strokeWidth={2} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{p.name}</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">حجم: {fmtNum(p.volume)}</div>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-white font-mono">{fmtNum(p.price)}</div>
                      <div className={cn("text-[11px] font-bold", isUp ? "text-green-400" : "text-red-400")}>
                        {isUp ? "+" : ""}{p.change}%
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Recent trades */}
        <div>
          <div className="text-sm font-bold text-white mb-3">⚡ آخر الصفقات</div>
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl divide-y divide-white/[0.04]">
            {data.recentTrades.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-3xl mb-2 opacity-40">⏳</div>
                <div className="text-xs text-neutral-500">لا توجد صفقات بعد</div>
              </div>
            ) : (
              data.recentTrades.map((t) => (
                <div key={t.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">{t.project}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5 font-mono">{t.time}</div>
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-neutral-300">
                      <span className="text-green-400 font-bold">{t.shares}</span> حصة
                    </div>
                    <div className="text-[11px] text-yellow-400 font-mono mt-0.5">{fmtNum(t.price)} د.ع</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ═══════════ Advisor section ═══════════ */}
      <div className="mt-7">
        <SectionHeader
          title="🧠 المؤشّرات الذكية + المستشار"
          subtitle={scope === "global" ? "تحليل عام لكلّ السوق" : `تحليل خاص لـ ${ALL_PROJECTS.find((p) => p.id === scope)?.name || ""}`}
        />

        {/* Health analysis card */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-white mb-1">📊 تحليل السوق</div>
              <div className="text-[11px] text-neutral-500">مؤشّر صحّة السوق + سيولة + تذبذب + حجم تداول</div>
            </div>
            <Badge label={healthLabel.label} color={healthLabel.color} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
              <div className="text-[10px] text-neutral-500 mb-1">صحّة السوق</div>
              <div className={cn(
                "text-2xl font-bold font-mono",
                health.health_level === "healthy" && "text-green-400",
                health.health_level === "watch" && "text-yellow-400",
                health.health_level === "critical" && "text-red-400",
              )}>{health.health_score}<span className="text-xs text-neutral-500">/100</span></div>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
              <div className="text-[10px] text-neutral-500 mb-1">صفقات حالية / مطلوب</div>
              <div className="text-2xl font-bold text-blue-400 font-mono">{health.current_deals}/{health.required_deals}</div>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
              <div className="text-[10px] text-neutral-500 mb-1">السيولة</div>
              <div className="mt-1"><Badge label={liquidityLabel.label} color={liquidityLabel.color} /></div>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
              <div className="text-[10px] text-neutral-500 mb-1">معدّل الدوران</div>
              <div className="text-2xl font-bold text-purple-400 font-mono">{health.turnover_rate}%</div>
            </div>
          </div>

          <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 flex items-center justify-between">
            <span className="text-xs text-neutral-400">التذبذب</span>
            <span className={cn(
              "font-mono font-bold text-sm",
              health.volatility_pct < 3 ? "text-green-400" : health.volatility_pct < 5 ? "text-yellow-400" : "text-red-400"
            )}>{health.volatility_pct.toFixed(1)}%</span>
          </div>
        </div>

        {/* Recommendations */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-yellow-400" strokeWidth={2} />
            <div className="text-sm font-bold text-white">نصائح المستشار</div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {recommendations.length === 0 ? (
              <div className="lg:col-span-2 bg-white/[0.04] border border-white/[0.08] rounded-xl p-8 text-center">
                <div className="text-3xl mb-2 opacity-40">💡</div>
                <div className="text-xs text-neutral-500">لا توجد توصيات حالياً — السوق هادئ</div>
              </div>
            ) : (
              recommendations.map((rec) => (
                <div key={rec.id} className={cn(
                  "rounded-xl p-4 border",
                  rec.priority === "high" && "bg-red-400/[0.05] border-red-400/[0.25]",
                  rec.priority === "medium" && "bg-yellow-400/[0.05] border-yellow-400/[0.25]",
                  rec.priority === "low" && "bg-white/[0.05] border-white/[0.08]",
                )}>
                  <div className="flex items-start gap-3 mb-2">
                    <div className="text-2xl flex-shrink-0">{rec.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-bold text-white">{rec.title}</span>
                        <Badge label={PRIORITY_LABELS[rec.priority].label} color={PRIORITY_LABELS[rec.priority].color} />
                      </div>
                      <div className="text-xs text-neutral-300 leading-relaxed mb-2">{rec.body}</div>
                      <div className="text-[10px] text-neutral-500 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" strokeWidth={2} />
                        <span>الأثر المتوقّع: {rec.estimated_impact}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action plan */}
        <div className="mb-5">
          <div className="text-sm font-bold text-white mb-3">📋 خطّة العمل المقترحة</div>
          {actionPlan.length === 0 ? (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-8 text-center">
              <div className="text-3xl mb-2 opacity-40">📋</div>
              <div className="text-xs text-neutral-500">لا توجد إجراءات مقترحة حالياً</div>
            </div>
          ) : (
            <Table>
              <THead>
                <TH>الإجراء</TH>
                <TH>الأولوية</TH>
                <TH>الأثر</TH>
                <TH>التكلفة</TH>
                <TH>إجراء</TH>
              </THead>
              <TBody>
                {actionPlan.map((item) => (
                  <TR key={item.id}>
                    <TD><span className="text-xs text-white">{item.action}</span></TD>
                    <TD><Badge label={PRIORITY_LABELS[item.priority].label} color={PRIORITY_LABELS[item.priority].color} /></TD>
                    <TD><span className="text-[11px] text-green-400">{item.estimated_impact}</span></TD>
                    <TD><span className="text-[11px] text-neutral-400">{item.estimated_cost || "—"}</span></TD>
                    <TD>
                      <div className="flex gap-1.5">
                        <ActionBtn label="✓ تنفيذ" color="green" sm onClick={() => showSuccess(`✅ تم بدء تنفيذ: ${item.action}`)} />
                        <ActionBtn label="تجاهل" color="gray" sm onClick={() => showSuccess("تم تجاهل الإجراء")} />
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </div>

      {/* ═══ Phase 12 — محرك السوق + إدارة العمولات الديناميكية ═══ */}
      <div className="mt-10 space-y-5">
        <SectionHeader
          title="⚙️ محرك السوق + إدارة العمولات (Phase 12)"
          subtitle="التحكم بكل عمولة بشكل مستقل · الشرطين · السقوف الشهرية · التجميد · الإرسالات · الحماية"
        />

        {/* 1. حالة المحرك */}
        <EngineDashboardCard />

        {/* 1.5 — Phase 12.9 — رفع سعر السوق يدوياً (مع شروط override) */}
        <RaiseMarketPricePanel />

        {/* 2. إدارة العمولات (الجديد الجوهري) */}
        <CommissionsManagementPanel />

        {/* 3. السقوف الشهرية حسب القطاع */}
        <SectorCapsTable />

        {/* 4. التجميد اليدوي */}
        <FreezeManagementPanel />

        {/* 5. مراقبة الإرسالات */}
        <TransfersMonitoringPanel />

        {/* 6. مراقبة الحماية */}
        <ProtectionMonitoringPanel />

        {/* 7. سجل القرارات الإدارية */}
        <AdminDecisionsLog />
      </div>

    </div>
  )
}
