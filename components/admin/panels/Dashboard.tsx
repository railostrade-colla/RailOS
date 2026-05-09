"use client"

/**
 * Admin Dashboard — Phase 13.1 (clean rebuild).
 *
 * Replaces the previous 316-line panel that mixed mock/real data and
 * showed too many disconnected blocks.
 *
 * New layout (top → bottom):
 *
 *   1. Welcome strip   — "أهلاً <name>" + super-admin badge + clock
 *   2. KPI strip       — 4 headline numbers (users / deals / volume / pending)
 *   3. Pending queue   — 6 cells (KYC, fees, proofs, disputes, deals, support)
 *      — counts tick up live via admin:badge-bump events
 *   4. Live feed       — streaming Supabase Realtime events
 *      |
 *      | Quick actions — 6 most-used admin shortcuts
 *
 * Every number is sourced from real DB (get_dashboard_overview RPC)
 * or pushed via Realtime. No mocks. No polling >30s. Zero refresh
 * required for any of the live numbers.
 */

import { useEffect, useState } from "react"
import { Clock, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { KpiStrip } from "@/components/admin/dashboard-v2/KpiStrip"
import { PendingQueueCard } from "@/components/admin/dashboard-v2/PendingQueueCard"
import { LiveActivityFeed } from "@/components/admin/dashboard-v2/LiveActivityFeed"
import { QuickActions } from "@/components/admin/dashboard-v2/QuickActions"

export function DashboardPanel() {
  const [adminName, setAdminName] = useState<string>("")
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [now, setNow] = useState("")

  // Resolve identity once.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled || !data?.user?.id) return
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, username, role")
          .eq("id", data.user.id)
          .maybeSingle()
        if (cancelled) return
        const p = prof as
          | { full_name?: string; username?: string; role?: string }
          | null
        setAdminName(
          p?.full_name?.trim() || p?.username?.trim() || "أيها المسؤول",
        )
        setIsSuperAdmin(p?.role === "super_admin")
      } catch { /* ignore */ }
    })
    return () => { cancelled = true }
  }, [])

  // Live clock — header decoration.
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

  return (
    <div className="p-6 max-w-screen-2xl space-y-5">
      {/* ─── 1. Welcome strip ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white">
              أهلاً، {adminName} 👋
            </h1>
            {isSuperAdmin && (
              <span className="bg-purple-400/[0.12] border border-purple-400/30 text-purple-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" strokeWidth={2.5} />
                مدير عام
              </span>
            )}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            نظرة عامة على نشاط المنصة لحظياً
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono" dir="ltr">{now}</span>
        </div>
      </div>

      {/* ─── 2. KPI strip ─── */}
      <KpiStrip />

      {/* ─── 3. Pending queue ─── */}
      <PendingQueueCard />

      {/* ─── 4. Live feed + Quick actions ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <LiveActivityFeed />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>
    </div>
  )
}
