"use client"

import { useState } from "react"
import { Search, Filter } from "lucide-react"
import { Badge, SectionHeader, AdminEmpty, InnerTabBar } from "@/components/admin/ui"
import { mockDecisionLog, actionLabels } from "@/lib/admin/mock-data"

export function LogPanel() {
  const [search, setSearch] = useState("")
  const [filterAction, setFilterAction] = useState<string>("all")

  const actionTypes = Array.from(new Set(mockDecisionLog.map((l) => l.action)))

  const filtered = mockDecisionLog.filter((l) => {
    if (filterAction !== "all" && l.action !== filterAction) return false
    if (search && !`${l.admin} ${l.target} ${l.details}`.includes(search)) return false
    return true
  })

  const tabs = [
    { key: "all", label: "الكل", count: mockDecisionLog.length },
    ...actionTypes.map((a) => ({
      key: a,
      label: actionLabels[a]?.label || a,
      count: mockDecisionLog.filter((l) => l.action === a).length,
    })),
  ]

  return (
    <div className="p-6 max-w-screen-xl">

      <SectionHeader
        title="📋 سجل القرارات"
        subtitle={`${mockDecisionLog.length} قرار مسجَّل من فريق الإدارة`}
      />

      {/* Search */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث في السجل..."
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      {/* Filter tabs */}
      <InnerTabBar tabs={tabs} active={filterAction} onSelect={setFilterAction} />

      {/* Log entries */}
      {filtered.length === 0 ? (
        <AdminEmpty title="لا توجد سجلات" body="جرب تغيير الفلترة أو البحث" />
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => {
            const cfg = actionLabels[entry.action] || { label: entry.action, color: "gray" as const }
            return (
              <div
                key={entry.id}
                className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3.5 flex gap-3 items-start"
              >
                <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 text-sm font-bold text-white">
                  {entry.admin.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-bold text-white">{entry.admin}</span>
                    <Badge label={cfg.label} color={cfg.color as any} />
                  </div>
                  <div className="text-sm text-white mb-1">
                    <span className="text-neutral-500">الهدف: </span>
                    <span className="font-bold">{entry.target}</span>
                  </div>
                  <div className="text-xs text-neutral-400 leading-relaxed mb-1.5">{entry.details}</div>
                  <div className="text-[10px] text-neutral-500 font-mono">{entry.timestamp}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
