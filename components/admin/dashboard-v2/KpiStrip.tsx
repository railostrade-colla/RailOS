"use client"

/**
 * KpiStrip — Phase 13.1 / 13.6.
 *
 * The 5 numbers an admin glances at first thing in the morning:
 * users · deals · volume · pending decisions · collected fees.
 *
 * Phase 13.6 — added "إجمالي الرسوم المحصلة" (collected commission
 * units across every completed deal). Also subscribes to the `deals`
 * table via Realtime, so volume + collected-fees + pending-deals
 * counts tick up the moment a deal lands without waiting for the
 * next 30 s poll.
 */

import { useCallback, useEffect, useState } from "react"
import {
  Users,
  Briefcase,
  Wallet,
  AlertCircle,
  Coins,
} from "lucide-react"
import { getDashboardOverview } from "@/lib/data/admin-utilities"
import { getTotalCollectedFees } from "@/lib/data/deal-fees-admin"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

interface Stats {
  users: number
  deals_today: number
  volume_today: number
  pending_total: number
  collected_fees: number
}

const ZERO: Stats = {
  users: 0,
  deals_today: 0,
  volume_today: 0,
  pending_total: 0,
  collected_fees: 0,
}

export function KpiStrip() {
  const [stats, setStats] = useState<Stats>(ZERO)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [ov, fees] = await Promise.all([
        getDashboardOverview(),
        getTotalCollectedFees(),
      ])
      if (!ov) return
      const pending =
        (ov.kyc_pending ?? 0) +
        (ov.fee_requests_pending ?? 0) +
        (ov.disputes_open ?? 0) +
        (ov.deals_pending ?? 0)
      setStats({
        users: ov.users_total ?? 0,
        deals_today: ov.deals_total ?? 0,
        volume_today: ov.deals_volume_total ?? 0,
        pending_total: pending,
        collected_fees: fees,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void refresh()
    const t = setInterval(() => { if (!cancelled) void refresh() }, 30_000)

    // Phase 13.6 — realtime: any change on `deals` triggers an instant
    // refresh of every KPI (volume, total deals, pending, collected
    // fees all derive from the deals table).
    const supabase = createClient()
    const channel = supabase
      .channel("kpi-strip-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals" },
        () => { if (!cancelled) void refresh() },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => { if (!cancelled) void refresh() },
      )
      .subscribe()

    return () => {
      cancelled = true
      clearInterval(t)
      try { supabase.removeChannel(channel) } catch { /* ignore */ }
    }
  }, [refresh])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Card
        icon={<Users className="w-4 h-4" />}
        label="إجمالي المستخدمين"
        value={fmtNum(stats.users)}
        tone="blue"
        loading={loading}
      />
      <Card
        icon={<Briefcase className="w-4 h-4" />}
        label="إجمالي الصفقات"
        value={fmtNum(stats.deals_today)}
        tone="green"
        loading={loading}
      />
      <Card
        icon={<Wallet className="w-4 h-4" />}
        label="إجمالي الحجم"
        value={fmtNum(stats.volume_today)}
        unit="د.ع"
        tone="yellow"
        loading={loading}
      />
      <Card
        icon={<Coins className="w-4 h-4" />}
        label="إجمالي الرسوم المحصلة"
        value={fmtNum(stats.collected_fees)}
        unit="وحدة"
        tone="purple"
        loading={loading}
      />
      <Card
        icon={<AlertCircle className="w-4 h-4" />}
        label="بانتظار قرار"
        value={fmtNum(stats.pending_total)}
        tone={stats.pending_total > 0 ? "red" : "neutral"}
        loading={loading}
      />
    </div>
  )
}

function Card({
  icon,
  label,
  value,
  unit,
  tone,
  loading,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit?: string
  tone: "blue" | "green" | "yellow" | "red" | "purple" | "neutral"
  loading: boolean
}) {
  const toneClass = {
    blue: "bg-blue-400/[0.06] border-blue-400/20 text-blue-400",
    green: "bg-green-400/[0.06] border-green-400/20 text-green-400",
    yellow: "bg-yellow-400/[0.06] border-yellow-400/20 text-yellow-400",
    red: "bg-red-400/[0.06] border-red-400/20 text-red-400",
    purple: "bg-purple-400/[0.06] border-purple-400/20 text-purple-400",
    neutral: "bg-white/[0.04] border-white/[0.08] text-white",
  }[tone]

  return (
    <div className={cn("rounded-2xl p-4 border transition-all", toneClass)}>
      <div className="flex items-center gap-2 text-[11px] opacity-70 mb-2">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold font-mono text-white">
          {loading ? "—" : value}
        </span>
        {unit && (
          <span className="text-[10px] text-neutral-500">{unit}</span>
        )}
      </div>
    </div>
  )
}
