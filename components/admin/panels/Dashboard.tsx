"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { KPI, ActionBtn, SectionHeader } from "@/components/admin/ui"
import { mockAdminStats } from "@/lib/admin/mock-data"
import { getDashboardStats, type DashboardStats } from "@/lib/data/admin-utilities"

const fmtNum = (n: number) => n.toLocaleString("en-US")

export function DashboardPanel() {
  const router = useRouter()

  // Phase 10 — pull real KPIs on mount, fall back to mock fields for
  // dimensions the RPC doesn't yet cover (market health, etc.).
  const [liveStats, setLiveStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    let cancelled = false
    getDashboardStats().then((s) => {
      if (!cancelled && s) setLiveStats(s)
    })
    return () => { cancelled = true }
  }, [])

  // Production mode: real DB drives every counter. UI-only fields
  // (marketHealth color, labels) come from the mock template, but
  // every metric the RPC reports overrides — and the rest reset to 0
  // until the corresponding feature is wired into get_dashboard_stats.
  const ZERO_OVERRIDES = {
    totalTrades: 0,
    pendingTrades: 0,
    cancelledTrades: 0,
    activeListings: 0,
    dailyVolume: 0,
    activeProjects: 0,
    pendingProjects: 0,
    closedProjects: 0,
    totalShares: 0,
    tradedShares: 0,
    frozenShares: 0,
    openAuctions: 0,
    closedAuctions: 0,
    activeContracts: 0,
    pendingContracts: 0,
    openDisputes: 0,
    publishedNews: 0,
    pendingKYC: 0,
    kycPending: 0,
    pendingFeeRequests: 0,
    totalUsers: 0,
  }
  const stats = liveStats
    ? {
        ...mockAdminStats,
        ...ZERO_OVERRIDES,
        totalTrades: liveStats.total_deals,
        pendingTrades: liveStats.pending_deals,
        activeProjects: liveStats.active_projects,
        activeContracts: liveStats.active_contracts,
        openAuctions: liveStats.active_auctions,
        openDisputes: liveStats.open_disputes,
        pendingKYC: liveStats.pending_kyc,
        pendingFeeRequests: liveStats.pending_fee_requests,
        totalUsers: liveStats.users,
      }
    : { ...mockAdminStats, ...ZERO_OVERRIDES }

  const healthColor =
    stats.marketHealth >= 75 ? "#4ADE80" :
    stats.marketHealth >= 50 ? "#FBBF24" : "#F87171"

  const goTo = (tab: string) => router.push(`/admin?tab=${tab}`)

  return (
    <div className="p-6 max-w-screen-2xl">

      <SectionHeader
        title="◈ لوحة التحكم"
        subtitle="نظرة عامة على المنصة والإحصائيات الأساسية"
      />

      {/* المالية */}
      <div className="mb-5">
        <SectionHeader
          title="💰 الإحصائيات المالية"
          action={<ActionBtn label="الصفقات" color="gray" sm onClick={() => goTo("trades")} />}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="إجمالي الصفقات" val={fmtNum(stats.totalTrades)} color="#fff" />
          <KPI label="صفقات معلقة" val={fmtNum(stats.pendingTrades)} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
          <KPI label="صفقات ملغاة" val={fmtNum(stats.cancelledTrades)} color="#F87171" />
          <KPI label="عروض نشطة" val={fmtNum(stats.activeListings)} color="#60A5FA" />
        </div>
        <div className="mt-3">
          <KPI label="حجم تداول اليوم" val={fmtNum(stats.dailyVolume) + " د.ع"} color="#FBBF24" />
        </div>
      </div>

      {/* المشاريع */}
      <div className="mb-5">
        <SectionHeader
          title="🏢 المشاريع والشركات"
          action={<ActionBtn label="إدارة" color="gray" sm onClick={() => goTo("projects")} />}
        />
        <div className="grid grid-cols-3 gap-3">
          <KPI label="مشاريع نشطة" val={fmtNum(stats.activeProjects)} color="#60A5FA" />
          <KPI label="معلقة - قيد المراجعة" val={fmtNum(stats.pendingProjects)} color="#FBBF24" />
          <KPI label="منتهية / مغلقة" val={fmtNum(stats.closedProjects)} color="rgba(255,255,255,0.4)" />
        </div>
      </div>

      {/* الحصص */}
      <div className="mb-5">
        <SectionHeader
          title="🧩 الحصص"
          action={<ActionBtn label="إدارة الحصص" color="gray" sm onClick={() => goTo("shares")} />}
        />
        <div className="grid grid-cols-3 gap-3">
          <KPI label="إجمالي الحصص" val={fmtNum(stats.totalShares)} color="#fff" />
          <KPI label="حصص متداولة" val={fmtNum(stats.tradedShares)} color="#4ADE80" />
          <KPI label="حصص مجمدة" val={fmtNum(stats.frozenShares)} color="#F87171" accent="rgba(248,113,113,0.06)" />
        </div>
      </div>

      {/* النشاط العام */}
      <div className="mb-5">
        <SectionHeader title="📊 النشاط العام" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <KPI label="مزادات مفتوحة" val={fmtNum(stats.openAuctions)} color="#C084FC" />
          <KPI label="مزادات مكتملة" val={fmtNum(stats.closedAuctions)} color="rgba(255,255,255,0.4)" />
          <KPI label="عقود نشطة" val={fmtNum(stats.activeContracts)} color="#2DD4BF" />
          <KPI label="عقود معلقة" val={fmtNum(stats.pendingContracts)} color="#FBBF24" />
          <KPI
            label="نزاعات مفتوحة"
            val={fmtNum(stats.openDisputes)}
            color="#F87171"
            accent={stats.openDisputes > 0 ? "rgba(248,113,113,0.1)" : undefined}
          />
          <KPI label="أخبار منشورة" val={fmtNum(stats.publishedNews)} color="#60A5FA" />
        </div>
      </div>

      {/* مؤشر صحة السوق */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-5">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-bold text-white">📊 مؤشر صحة السوق</span>
          <span className="text-2xl font-bold" style={{ color: healthColor }}>
            {stats.marketHealth}%
          </span>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${stats.marketHealth}%`, background: healthColor }}
          />
        </div>
        <div className="text-[10px] text-neutral-500">
          يعتمد على: حجم التداول · نسبة نجاح الصفقات · معدل النزاعات · السيولة
        </div>
      </div>

      {/* The "pending trades" + "pending KYC" preview tables that
          used to live here were stripped — they were the last
          consumers of mockPendingTrades / mockKYCPending. The real
          counts are surfaced in the KPI grid above and clicking
          "إدارة" jumps to the dedicated DB-backed panels. */}
    </div>
  )
}
