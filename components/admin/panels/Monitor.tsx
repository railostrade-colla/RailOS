"use client"

import { useState, useEffect, useMemo } from "react"
import { KPI, Badge, SectionHeader, ActionBtn, Table, THead, TH, TBody, TR, TD } from "@/components/admin/ui"
import { TrendingUp, TrendingDown, Activity, Lightbulb, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { ALL_PROJECTS } from "@/lib/mock-data/projects"
import {
  getMarketHealthScore,
  getRecommendations,
  getActionPlan,
  HEALTH_LEVEL_LABELS,
  LIQUIDITY_LABELS,
  PRIORITY_LABELS,
} from "@/lib/mock-data/marketAdvisor"
import { showSuccess } from "@/lib/utils/toast"

const fmtNum = (n: number) => n.toLocaleString("en-US")

const mockMarketData = {
  isOpen: true,
  totalVolume24h: 45200000,
  trades24h: 87,
  avgTradeSize: 519540,
  topMovers: [
    { id: "1", name: "مزرعة الواحة", price: 100000, change: 12.3, volume: 8500000 },
    { id: "2", name: "برج بغداد", price: 250000, change: 8.7, volume: 12000000 },
    { id: "3", name: "مجمع الكرخ", price: 175000, change: -3.2, volume: 5600000 },
    { id: "4", name: "صفا الذهبي", price: 120000, change: 5.4, volume: 4200000 },
    { id: "5", name: "مزرعة الواحة 2", price: 95000, change: -1.8, volume: 2300000 },
  ],
  recentTrades: [
    { id: "tr1", project: "مزرعة الواحة", shares: 50, price: 100000, time: "14:32:18" },
    { id: "tr2", project: "برج بغداد", shares: 20, price: 250000, time: "14:30:45" },
    { id: "tr3", project: "مجمع الكرخ", shares: 100, price: 175000, time: "14:28:12" },
    { id: "tr4", project: "صفا الذهبي", shares: 30, price: 120000, time: "14:25:00" },
    { id: "tr5", project: "مزرعة الواحة", shares: 15, price: 99500, time: "14:22:30" },
  ],
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

  const data = mockMarketData

  // Advisor data (recomputes when scope changes)
  const projectId = scope === "global" ? undefined : scope
  const health = useMemo(() => getMarketHealthScore(projectId), [projectId])
  const recommendations = useMemo(() => getRecommendations(projectId), [projectId])
  const actionPlan = useMemo(() => getActionPlan(projectId), [projectId])
  const healthLabel = HEALTH_LEVEL_LABELS[health.health_level]
  const liquidityLabel = LIQUIDITY_LABELS[health.liquidity]

  return (
    <div className="p-6 max-w-screen-2xl">

      <SectionHeader
        title="📡 مراقبة السوق - مباشر"
        subtitle="بيانات السوق والتداول لحظة بلحظة + تحليل ذكي + خطّة عمل"
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
        <KPI label="معدل التغير" val="+5.2%" color="#4ADE80" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top movers */}
        <div>
          <div className="text-sm font-bold text-white mb-3">🔥 الأعلى تحركاً</div>
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl divide-y divide-white/[0.04]">
            {data.topMovers.map((p) => {
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
            })}
          </div>
        </div>

        {/* Recent trades */}
        <div>
          <div className="text-sm font-bold text-white mb-3">⚡ آخر الصفقات</div>
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl divide-y divide-white/[0.04]">
            {data.recentTrades.map((t) => (
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
            ))}
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
            {recommendations.map((rec) => (
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
            ))}
          </div>
        </div>

        {/* Action plan */}
        <div className="mb-5">
          <div className="text-sm font-bold text-white mb-3">📋 خطّة العمل المقترحة</div>
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
        </div>
      </div>

    </div>
  )
}
