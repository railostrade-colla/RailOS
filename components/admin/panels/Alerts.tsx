"use client"

import { useRouter } from "next/navigation"
import { AlertCircle, AlertTriangle, Info, ChevronLeft } from "lucide-react"
import { SectionHeader, AdminEmpty } from "@/components/admin/ui"
import { mockAlerts } from "@/lib/admin/mock-data"
import { cn } from "@/lib/utils/cn"

export function AlertsPanel() {
  const router = useRouter()

  const alertConfig = {
    critical: { Icon: AlertCircle, color: "text-red-400", bg: "bg-red-400/[0.06]", border: "border-red-400/30", label: "حرج" },
    warning: { Icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-400/[0.06]", border: "border-yellow-400/30", label: "تحذير" },
    info: { Icon: Info, color: "text-blue-400", bg: "bg-blue-400/[0.06]", border: "border-blue-400/30", label: "معلومة" },
  }

  const counts = {
    critical: mockAlerts.filter((a) => a.type === "critical").length,
    warning: mockAlerts.filter((a) => a.type === "warning").length,
    info: mockAlerts.filter((a) => a.type === "info").length,
  }

  return (
    <div className="p-6 max-w-4xl">

      <SectionHeader
        title="🚨 التنبيهات"
        subtitle={`${mockAlerts.length} تنبيه نشط في النظام`}
      />

      {/* Count cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {(["critical", "warning", "info"] as const).map((type) => {
          const cfg = alertConfig[type]
          const Icon = cfg.Icon
          return (
            <div key={type} className={cn("rounded-xl p-4 border", cfg.bg, cfg.border)}>
              <Icon className={cn("w-5 h-5 mb-2", cfg.color)} strokeWidth={1.5} />
              <div className={cn("text-2xl font-bold", cfg.color)}>{counts[type]}</div>
              <div className="text-[10px] text-neutral-500 mt-1">{cfg.label}</div>
            </div>
          )
        })}
      </div>

      {/* Alerts list */}
      {mockAlerts.length === 0 ? (
        <AdminEmpty title="لا توجد تنبيهات" body="كل شي على ما يرام ✓" />
      ) : (
        <div className="space-y-2.5">
          {mockAlerts.map((a) => {
            const cfg = alertConfig[a.type as keyof typeof alertConfig]
            const Icon = cfg.Icon
            return (
              <button
                key={a.id}
                onClick={() => router.push(a.action)}
                className={cn(
                  "w-full rounded-xl p-4 border hover:bg-white/[0.02] transition-colors flex items-start gap-3 text-right",
                  cfg.bg, cfg.border
                )}
              >
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", cfg.bg, "border", cfg.border)}>
                  <Icon className={cn("w-4 h-4", cfg.color)} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white">{a.title}</span>
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase border",
                      cfg.bg, cfg.border, cfg.color
                    )}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-400 leading-relaxed mb-1">{a.body}</div>
                  <div className="text-[10px] text-neutral-500">{a.time}</div>
                </div>
                <ChevronLeft className="w-4 h-4 text-neutral-500 flex-shrink-0" strokeWidth={1.5} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
