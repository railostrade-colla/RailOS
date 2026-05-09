"use client"

/**
 * QuickActions — Phase 13.1.
 *
 * 6 most-frequent admin actions, one click away from the dashboard.
 * Reduces "where do I do X?" friction.
 */

import { useRouter } from "next/navigation"
import {
  Plus,
  TrendingUp,
  Snowflake,
  Megaphone,
  Users,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils/cn"

export function QuickActions() {
  const router = useRouter()

  const actions = [
    {
      label: "إضافة مشروع",
      icon: Plus,
      tone: "blue" as const,
      onClick: () => router.push("/admin?tab=create_project"),
    },
    {
      label: "رفع سعر السوق",
      icon: TrendingUp,
      tone: "green" as const,
      onClick: () => router.push("/admin?tab=monitor"),
    },
    {
      label: "تجميد مشروع",
      icon: Snowflake,
      tone: "cyan" as const,
      onClick: () => router.push("/admin?tab=monitor"),
    },
    {
      label: "إذاعة إشعار",
      icon: Megaphone,
      tone: "yellow" as const,
      onClick: () => router.push("/admin?tab=broadcaster"),
    },
    {
      label: "إدارة المستخدمين",
      icon: Users,
      tone: "purple" as const,
      onClick: () => router.push("/admin?tab=users"),
    },
    {
      label: "سجل القرارات",
      icon: FileText,
      tone: "neutral" as const,
      onClick: () => router.push("/admin?tab=log"),
    },
  ]

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
      <div className="text-sm font-bold text-white mb-4">⚡ إجراءات سريعة</div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {actions.map((a) => {
          const Icon = a.icon
          const tones = {
            blue: "bg-blue-400/[0.06] border-blue-400/20 hover:bg-blue-400/[0.12] text-blue-300",
            green: "bg-green-400/[0.06] border-green-400/20 hover:bg-green-400/[0.12] text-green-300",
            cyan: "bg-cyan-400/[0.06] border-cyan-400/20 hover:bg-cyan-400/[0.12] text-cyan-300",
            yellow: "bg-yellow-400/[0.06] border-yellow-400/20 hover:bg-yellow-400/[0.12] text-yellow-300",
            purple: "bg-purple-400/[0.06] border-purple-400/20 hover:bg-purple-400/[0.12] text-purple-300",
            neutral: "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-neutral-300",
          }[a.tone]
          return (
            <button
              key={a.label}
              onClick={a.onClick}
              className={cn(
                "p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-colors",
                tones,
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={2} />
              <span className="text-[11px] font-medium">{a.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
