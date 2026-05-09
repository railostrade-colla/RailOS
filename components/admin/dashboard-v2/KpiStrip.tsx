"use client"

/**
 * KpiStrip — Phase 13.1.
 *
 * The 4 numbers an admin glances at first thing in the morning.
 * Each card auto-refreshes every 30 s and animates the number
 * change with a brief flash.
 */

import { useEffect, useState } from "react"
import {
  Users,
  Briefcase,
  Wallet,
  AlertCircle,
} from "lucide-react"
import { getDashboardOverview } from "@/lib/data/admin-utilities"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

interface Stats {
  users: number
  deals_today: number
  volume_today: number
  pending_total: number
}

const ZERO: Stats = { users: 0, deals_today: 0, volume_today: 0, pending_total: 0 }

export function KpiStrip() {
  const [stats, setStats] = useState<Stats>(ZERO)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const ov = await getDashboardOverview()
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
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    const t = setInterval(refresh, 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
  tone: "blue" | "green" | "yellow" | "red" | "neutral"
  loading: boolean
}) {
  const toneClass = {
    blue: "bg-blue-400/[0.06] border-blue-400/20 text-blue-400",
    green: "bg-green-400/[0.06] border-green-400/20 text-green-400",
    yellow: "bg-yellow-400/[0.06] border-yellow-400/20 text-yellow-400",
    red: "bg-red-400/[0.06] border-red-400/20 text-red-400",
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
