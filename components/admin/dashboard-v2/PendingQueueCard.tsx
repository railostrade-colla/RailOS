"use client"

/**
 * PendingQueueCard — Phase 13.1.
 *
 * The "needs your attention" panel on the dashboard home. Replaces
 * the long list of section cards with a single row of compact cells:
 *   KYC | شحن وحدات | إثباتات | نزاعات | صفقات | دعم
 *
 * Each cell shows the count + opens the dedicated tab on click.
 * Listens to admin:badge-bump so counts tick up live.
 */

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ShieldCheck,
  CreditCard,
  Receipt,
  AlertTriangle,
  Briefcase,
  HelpCircle,
} from "lucide-react"
import { getDashboardOverview } from "@/lib/data/admin-utilities"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"

interface Counts {
  kyc: number
  fee_requests: number
  payment_proofs: number
  disputes: number
  deals: number
  support: number
}

const ZERO: Counts = {
  kyc: 0,
  fee_requests: 0,
  payment_proofs: 0,
  disputes: 0,
  deals: 0,
  support: 0,
}

export function PendingQueueCard() {
  const router = useRouter()
  const [counts, setCounts] = useState<Counts>(ZERO)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const ov = await getDashboardOverview()
    if (!ov) return
    // Phase 13.6 — payment_proofs + support are not in the dashboard
    // overview RPC; query them directly so the cell shows real counts.
    // Failures silently fall back to 0.
    const [proofsRes, supportRes] = await Promise.all([
      supabase
        .from("payment_proofs")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "in_progress"]),
    ])
    setCounts({
      kyc: ov.kyc_pending ?? 0,
      fee_requests: ov.fee_requests_pending ?? 0,
      payment_proofs: proofsRes?.count ?? 0,
      disputes: ov.disputes_open ?? 0,
      deals: ov.deals_pending ?? 0,
      support: supportRes?.count ?? ov.support_open ?? 0,
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    void refresh()
    const t = setInterval(() => { if (!cancelled) void refresh() }, 30_000)

    // Phase 13.6 — direct realtime subscriptions on every queue table.
    // Any INSERT/UPDATE/DELETE on these tables refreshes the counts
    // immediately, so when an admin processes something (e.g. flips
    // a kyc status from pending → approved) the cell ticks DOWN
    // without waiting for the 30s poll.
    const supabase = createClient()
    const channel = supabase
      .channel("pending-queue-card-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_submissions" },   () => { if (!cancelled) void refresh() })
      .on("postgres_changes", { event: "*", schema: "public", table: "fee_unit_requests" }, () => { if (!cancelled) void refresh() })
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_proofs" },    () => { if (!cancelled) void refresh() })
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" },          () => { if (!cancelled) void refresh() })
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" },             () => { if (!cancelled) void refresh() })
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" },   () => { if (!cancelled) void refresh() })
      .subscribe()

    // Optimistic bump when AdminRealtimeNotifier emits a toast — gives
    // an instant tick UP before the realtime channel round-trips.
    const onBump = (e: Event) => {
      const detail = (e as CustomEvent).detail as { kind?: string }
      if (!detail) return
      setCounts((prev) => {
        const next = { ...prev }
        switch (detail.kind) {
          case "kyc":           next.kyc++; break
          case "fee_request":   next.fee_requests++; break
          case "payment_proof": next.payment_proofs++; break
          case "dispute":       next.disputes++; break
          case "support":       next.support++; break
        }
        return next
      })
    }
    window.addEventListener("admin:badge-bump", onBump)

    return () => {
      cancelled = true
      clearInterval(t)
      try { supabase.removeChannel(channel) } catch { /* ignore */ }
      window.removeEventListener("admin:badge-bump", onBump)
    }
  }, [refresh])

  const items = [
    {
      key: "kyc",
      label: "KYC جديد",
      count: counts.kyc,
      icon: ShieldCheck,
      tone: "blue" as const,
      href: "/admin?tab=kyc",
    },
    {
      key: "fee_requests",
      label: "شحن وحدات",
      count: counts.fee_requests,
      icon: CreditCard,
      tone: "yellow" as const,
      href: "/admin?tab=fees",
    },
    {
      key: "payment_proofs",
      label: "إثباتات دفع",
      count: counts.payment_proofs,
      icon: Receipt,
      tone: "blue" as const,
      href: "/admin?tab=fees",
    },
    {
      key: "disputes",
      label: "نزاعات",
      count: counts.disputes,
      icon: AlertTriangle,
      tone: "red" as const,
      href: "/admin?tab=disputes",
    },
    {
      key: "deals",
      label: "صفقات معلّقة",
      count: counts.deals,
      icon: Briefcase,
      tone: "green" as const,
      href: "/admin?tab=shares",
    },
    {
      key: "support",
      label: "دعم فنّي",
      count: counts.support,
      icon: HelpCircle,
      tone: "purple" as const,
      href: "/admin?tab=support_inbox",
    },
  ]

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-white">📥 صندوق الإجراءات</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">
            كل ما يحتاج قراراً — يُحدَّث لحظياً
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {items.map((it) => {
          const Icon = it.icon
          const has = it.count > 0
          const toneClass = {
            blue:    has ? "bg-blue-400/[0.08] border-blue-400/30 text-blue-300"     : "bg-white/[0.03] border-white/[0.06] text-neutral-500",
            yellow:  has ? "bg-yellow-400/[0.08] border-yellow-400/30 text-yellow-300" : "bg-white/[0.03] border-white/[0.06] text-neutral-500",
            red:     has ? "bg-red-400/[0.08] border-red-400/30 text-red-300"         : "bg-white/[0.03] border-white/[0.06] text-neutral-500",
            green:   has ? "bg-green-400/[0.08] border-green-400/30 text-green-300"   : "bg-white/[0.03] border-white/[0.06] text-neutral-500",
            purple:  has ? "bg-purple-400/[0.08] border-purple-400/30 text-purple-300" : "bg-white/[0.03] border-white/[0.06] text-neutral-500",
          }[it.tone]

          return (
            <button
              key={it.key}
              onClick={() => router.push(it.href)}
              className={cn(
                "rounded-xl p-3 border flex items-center justify-between gap-2 transition-colors hover:opacity-80 text-right",
                toneClass,
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
                <span className="text-xs font-medium truncate">{it.label}</span>
              </div>
              <span
                className={cn(
                  "text-xl font-bold font-mono shrink-0",
                  has ? "" : "opacity-40",
                )}
              >
                {it.count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
