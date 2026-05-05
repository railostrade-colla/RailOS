"use client"

/**
 * Admin Dashboard panel — Phase 10.62 expansion.
 *
 * Top row added per founder request:
 *   • عدد المستخدمين المشتركين
 *   • النشطون (آخر 7 أيام)
 *   • الجدد هذا الأسبوع
 *   • عدد المستثمرين
 *   • القيمة الإجمالية لاستثمار المستخدمين
 *
 * Plus extras for monitoring: KYC verified, today's signups,
 * today's deals, daily volume, completion rate, dispute rate.
 *
 * Backed by `get_dashboard_overview()` RPC (single round-trip).
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Users, UserCheck, UserPlus, TrendingUp, Wallet } from "lucide-react"
import { KPI, ActionBtn, SectionHeader } from "@/components/admin/ui"
import { mockAdminStats } from "@/lib/admin/mock-data"
import {
  getDashboardStats,
  getDashboardOverview,
  type DashboardStats,
  type DashboardOverview,
} from "@/lib/data/admin-utilities"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const fmtMoney = (n: number) => fmtNum(n) + " د.ع"

export function DashboardPanel() {
  const router = useRouter()

  const [liveStats, setLiveStats] = useState<DashboardStats | null>(null)
  const [overview, setOverview] = useState<DashboardOverview | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getDashboardStats(), getDashboardOverview()]).then(([s, o]) => {
      if (cancelled) return
      if (s) setLiveStats(s)
      if (o) setOverview(o)
    })
    return () => { cancelled = true }
  }, [])

  // Mock baseline for fields the legacy dashboard cared about that
  // aren't in the new RPC yet.
  const ZERO_OVERRIDES = {
    totalTrades: 0, pendingTrades: 0, cancelledTrades: 0,
    activeListings: 0, dailyVolume: 0,
    activeProjects: 0, pendingProjects: 0, closedProjects: 0,
    totalShares: 0, tradedShares: 0, frozenShares: 0,
    openAuctions: 0, closedAuctions: 0,
    activeContracts: 0, pendingContracts: 0,
    openDisputes: 0, publishedNews: 0,
    pendingKYC: 0, kycPending: 0,
    pendingFeeRequests: 0, totalUsers: 0,
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

  // The overview RPC is preferred — its numbers override the legacy
  // ones whenever it's loaded. Fields not in `overview` fall back.
  if (overview) {
    stats.totalUsers = overview.users_total
    stats.totalTrades = overview.deals_total
    stats.pendingTrades = overview.deals_pending
    stats.activeProjects = overview.projects_active
    stats.pendingProjects = overview.projects_pending
    stats.activeListings = overview.listings_active
    stats.openAuctions = overview.auctions_active
    stats.openDisputes = overview.disputes_open
    stats.pendingKYC = overview.kyc_pending
    stats.totalShares = overview.shares_total
    stats.tradedShares = overview.shares_traded
    stats.dailyVolume = overview.deals_volume_today
  }

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

      {/* ═══ Row 1 — المستخدمون والاستثمارات (الصف الأول حسب طلب المؤسس) ═══ */}
      <div className="mb-5">
        <SectionHeader
          title="👥 المستخدمون والاستثمارات"
          action={<ActionBtn label="إدارة المستخدمين" color="gray" sm onClick={() => goTo("users")} />}
        />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KPI
            label="إجمالي المشتركين"
            val={fmtNum(overview?.users_total ?? 0)}
            color="#fff"
          />
          <KPI
            label="نشطون (آخر 7 أيام)"
            val={fmtNum(overview?.users_active_7d ?? 0)}
            color="#4ADE80"
          />
          <KPI
            label="مسجَّلون هذا الأسبوع"
            val={fmtNum(overview?.users_new_this_week ?? 0)}
            color="#60A5FA"
            accent="rgba(96,165,250,0.05)"
          />
          <KPI
            label="عدد المستثمرين"
            val={fmtNum(overview?.investors_count ?? 0)}
            color="#C084FC"
          />
          <KPI
            label="قيمة الاستثمارات"
            val={fmtMoney(overview?.investors_value ?? 0)}
            color="#FBBF24"
            accent="rgba(251,191,36,0.05)"
          />
        </div>
      </div>

      {/* ═══ Row 2 — تفاصيل المستخدمين والتفاعل ═══ */}
      <div className="mb-5">
        <SectionHeader title="📈 التفاعل والتحقّق" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI
            label="مسجَّلون اليوم"
            val={fmtNum(overview?.users_new_today ?? 0)}
            color="#60A5FA"
          />
          <KPI
            label="نشطون (30 يوم)"
            val={fmtNum(overview?.users_active_30d ?? 0)}
            color="#2DD4BF"
          />
          <KPI
            label="موثَّقون (KYC)"
            val={fmtNum(overview?.users_verified ?? 0) + (overview && overview.users_total > 0 ? ` · ${overview.kyc_rate}%` : "")}
            color="#4ADE80"
          />
          <KPI
            label="محظورون"
            val={fmtNum(overview?.users_banned ?? 0)}
            color="#F87171"
            accent={overview && overview.users_banned > 0 ? "rgba(248,113,113,0.05)" : undefined}
          />
        </div>
      </div>

      {/* ═══ Row 3 — التداول والصفقات ═══ */}
      <div className="mb-5">
        <SectionHeader
          title="💰 التداول والصفقات"
          action={<ActionBtn label="الصفقات" color="gray" sm onClick={() => goTo("shares")} />}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="إجمالي الصفقات" val={fmtNum(overview?.deals_total ?? stats.totalTrades)} color="#fff" />
          <KPI label="مكتملة" val={fmtNum(overview?.deals_completed ?? 0) + (overview && overview.deals_total > 0 ? ` · ${overview.completion_rate}%` : "")} color="#4ADE80" />
          <KPI label="معلقة" val={fmtNum(overview?.deals_pending ?? 0)} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
          <KPI label="نزاعات" val={fmtNum(overview?.deals_disputed ?? 0) + (overview && overview.deals_total > 0 ? ` · ${overview.dispute_rate}%` : "")} color="#F87171" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          <KPI label="صفقات اليوم" val={fmtNum(overview?.deals_today ?? 0)} color="#60A5FA" />
          <KPI label="حجم تداول اليوم" val={fmtMoney(overview?.deals_volume_today ?? 0)} color="#FBBF24" />
          <KPI label="إجمالي حجم التداول" val={fmtMoney(overview?.deals_volume_total ?? 0)} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
        </div>
      </div>

      {/* ═══ Row 4 — المشاريع والشركات ═══ */}
      <div className="mb-5">
        <SectionHeader
          title="🏢 المشاريع والشركات"
          action={<ActionBtn label="إدارة" color="gray" sm onClick={() => goTo("projects")} />}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="إجمالي" val={fmtNum(overview?.projects_total ?? 0)} color="#fff" />
          <KPI label="مشاريع نشطة" val={fmtNum(overview?.projects_active ?? stats.activeProjects)} color="#60A5FA" />
          <KPI label="قيد المراجعة" val={fmtNum(overview?.projects_pending ?? 0)} color="#FBBF24" />
          <KPI label="القيمة الإجمالية" val={fmtMoney(overview?.projects_value ?? 0)} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
        </div>
      </div>

      {/* ═══ Row 5 — الحصص والسوق ═══ */}
      <div className="mb-5">
        <SectionHeader title="🧩 الحصص والسوق" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="إجمالي الحصص" val={fmtNum(overview?.shares_total ?? 0)} color="#fff" />
          <KPI label="حصص متداولة" val={fmtNum(overview?.shares_traded ?? 0)} color="#4ADE80" />
          <KPI label="عروض نشطة" val={fmtNum(overview?.listings_active ?? 0)} color="#60A5FA" />
          <KPI label="مزادات نشطة" val={fmtNum(overview?.auctions_active ?? 0)} color="#C084FC" />
        </div>
      </div>

      {/* ═══ Row 6 — صندوق الإجراءات (Operations queue) ═══ */}
      <div className="mb-5">
        <SectionHeader
          title="📥 صندوق الإجراءات"
          action={<ActionBtn label="مركز الطلبات" color="gray" sm onClick={() => goTo("alerts")} />}
        />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <KPI
            label="طلبات KYC"
            val={fmtNum(overview?.kyc_pending ?? stats.pendingKYC)}
            color="#FBBF24"
            accent={overview && overview.kyc_pending > 0 ? "rgba(251,191,36,0.08)" : undefined}
          />
          <KPI
            label="نزاعات مفتوحة"
            val={fmtNum(overview?.disputes_open ?? stats.openDisputes)}
            color="#F87171"
            accent={overview && overview.disputes_open > 0 ? "rgba(248,113,113,0.08)" : undefined}
          />
          <KPI
            label="طلبات سفير"
            val={fmtNum(overview?.ambassador_pending ?? 0)}
            color="#a855f7"
          />
          <KPI
            label="طلبات شحن وحدات"
            val={fmtNum(overview?.fee_requests_pending ?? 0)}
            color="#60A5FA"
          />
          <KPI
            label="تذاكر دعم"
            val={fmtNum(overview?.support_open ?? 0)}
            color="#2DD4BF"
          />
          <KPI
            label="طلبات تعديل حصص"
            val={fmtNum(overview?.share_mods_pending ?? 0)}
            color="#C084FC"
          />
        </div>
      </div>

      {/* ═══ مؤشر صحة السوق ═══ */}
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

      {/* Snapshot meta */}
      {overview?.snapshot_at && (
        <div className="text-[10px] text-neutral-600 text-center" dir="ltr">
          آخر تحديث: {new Date(overview.snapshot_at).toLocaleString("en-US")}
        </div>
      )}
    </div>
  )
}
