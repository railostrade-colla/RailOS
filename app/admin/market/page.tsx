"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Snowflake, Eye, ChevronLeft, AlertTriangle } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader, StatCard, Badge, Modal } from "@/components/ui"
import {
  MOCK_MARKET_STATES,
  MOCK_DEVELOPMENT_DATA,
  getMarketStats,
} from "@/lib/mock-data/market"
import { ALL_PROJECTS } from "@/lib/mock-data"
import { showSuccess } from "@/lib/utils/toast"
import type { MarketState, HealthStatus, MarketPhase } from "@/lib/market/types"
import { cn } from "@/lib/utils/cn"

const HEALTH_META: Record<HealthStatus, { label: string; color: "green" | "yellow" | "red" | "blue" }> = {
  healthy:  { label: "صحي",          color: "green" },
  watch:    { label: "تحت المراقبة", color: "yellow" },
  critical: { label: "حرج",          color: "red" },
  frozen:   { label: "مجمد",         color: "blue" },
}

const PHASE_META: Record<MarketPhase, { label: string; emoji: string }> = {
  launch:           { label: "انطلاق",      emoji: "🚀" },
  active:           { label: "نشط",         emoji: "⚡" },
  frozen:           { label: "مجمد",        emoji: "❄️" },
  committee_review: { label: "تحت المراجعة", emoji: "🔍" },
}

const fmt = (n: number) => n.toLocaleString("en-US")

export default function AdminMarketPage() {
  const router = useRouter()
  const [freezeTarget, setFreezeTarget] = useState<MarketState | null>(null)

  const stats = useMemo(() => getMarketStats(), [])

  const handleFreezeToggle = () => {
    if (!freezeTarget) return
    showSuccess(freezeTarget.is_frozen ? "تم فك التجميد" : "تم تجميد المشروع")
    setFreezeTarget(null)
  }

  const projectName = (id: string) => ALL_PROJECTS.find((p) => p.id === id)?.name ?? "—"

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-6xl mx-auto pb-20">

          <PageHeader
            title="📊 مراقبة السوق"
            subtitle="نظرة على صحة المشاريع"
            backHref="/admin"
          />

          {/* ═══ Stats ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 mb-6">
            <StatCard label="إجمالي المشاريع" value={stats.total} />
            <StatCard label="صحي" value={stats.healthy} color="green" />
            <StatCard label="تحت المراقبة" value={stats.watch} color="yellow" />
            <StatCard label="حرج" value={stats.critical} color="red" />
            <StatCard label="مجمد" value={stats.frozen} color="blue" />
          </div>

          {/* ═══ Projects list ═══ */}
          <SectionHeader title="🏗️ المشاريع" subtitle={`${MOCK_MARKET_STATES.length} مشروع`} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {MOCK_MARKET_STATES.map((m) => {
              const dev = MOCK_DEVELOPMENT_DATA.find((d) => d.project_id === m.project_id)
              const health = HEALTH_META[m.health_status]
              const phase = PHASE_META[m.market_phase]
              const ratioPct = dev ? Math.min(dev.price_to_development_ratio * 60, 100) : 50
              const ratioColor =
                !dev ? "bg-neutral-600" :
                dev.price_to_development_ratio < 1.10 ? "bg-green-400" :
                dev.price_to_development_ratio < 1.25 ? "bg-yellow-400" :
                "bg-red-400"

              return (
                <Card key={m.project_id}>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">
                        {projectName(m.project_id)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge color={health.color} variant="soft" size="xs">{health.label}</Badge>
                        <Badge color="neutral" variant="soft" size="xs" icon={phase.emoji}>{phase.label}</Badge>
                        <span className="text-[10px] text-neutral-500">
                          {m.total_deals_count} صفقة
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Prices grid */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <StatCard size="sm" label="سعر الإطلاق" value={fmt(m.initial_price)} />
                    <StatCard size="sm" label="السعر الحالي" value={fmt(m.current_price)} color="green" />
                    <StatCard
                      size="sm"
                      label="نمو السعر"
                      value={(m.total_growth_pct >= 0 ? "+" : "") + m.total_growth_pct + "%"}
                      color={m.total_growth_pct >= 10 ? "yellow" : m.total_growth_pct >= 0 ? "green" : "red"}
                    />
                  </div>

                  {/* P/D ratio bar */}
                  {dev && (
                    <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-2.5 mb-3">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-[10px] text-neutral-500">سعر / تطوير</span>
                        <Badge color={
                          dev.price_to_development_ratio < 1.10 ? "green" :
                          dev.price_to_development_ratio < 1.25 ? "yellow" : "red"
                        } variant="soft" size="xs">
                          P/D: {dev.price_to_development_ratio.toFixed(2)}
                        </Badge>
                      </div>
                      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className={cn("h-full transition-all", ratioColor)} style={{ width: ratioPct + "%" }} />
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFreezeTarget(m)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-[11px] font-bold border transition-colors flex items-center justify-center gap-1",
                        m.is_frozen
                          ? "bg-blue-400/[0.1] border-blue-400/30 text-blue-400 hover:bg-blue-400/[0.15]"
                          : "bg-white/[0.05] border-white/[0.08] text-neutral-300 hover:bg-white/[0.08]",
                      )}
                    >
                      <Snowflake className="w-3.5 h-3.5" strokeWidth={2} />
                      {m.is_frozen ? "فك التجميد" : "تجميد"}
                    </button>
                    <button
                      onClick={() => router.push("/project/" + m.project_id)}
                      className="flex-1 bg-neutral-100 text-black py-2 rounded-lg text-[11px] font-bold hover:bg-neutral-200 transition-colors flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" strokeWidth={2} />
                      التفاصيل
                      <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>

        </div>
      </div>

      {/* Freeze confirmation Modal */}
      {freezeTarget && (
        <Modal
          isOpen={!!freezeTarget}
          onClose={() => setFreezeTarget(null)}
          title={freezeTarget.is_frozen ? "فك تجميد المشروع" : "تجميد المشروع"}
          subtitle={projectName(freezeTarget.project_id)}
          variant="warning"
          size="sm"
          footer={
            <>
              <button
                onClick={() => setFreezeTarget(null)}
                className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-2.5 rounded-xl text-sm hover:bg-white/[0.08] transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleFreezeToggle}
                className="flex-1 bg-yellow-400/[0.1] border border-yellow-400/30 text-yellow-400 py-2.5 rounded-xl text-sm font-bold hover:bg-yellow-400/[0.15] transition-colors"
              >
                تأكيد
              </button>
            </>
          }
        >
          <p className="text-sm text-neutral-300 leading-relaxed">
            {freezeTarget.is_frozen
              ? "سيُعاد تفعيل حركة السعر لهذا المشروع."
              : "ستتوقف حركة السعر مؤقتاً حتى مراجعة الإدارة."}
          </p>
        </Modal>
      )}
    </AppLayout>
  )
}
