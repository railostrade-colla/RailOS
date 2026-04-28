"use client"

import { useState, useMemo } from "react"
import { Calendar, Vote } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, Badge, Tabs } from "@/components/ui"
import { COUNCIL_MEMBERS, type CouncilRole } from "@/lib/mock-data"
import { cn } from "@/lib/utils/cn"

type TabId = "all" | "admin" | "elected"

const ROLE_META: Record<CouncilRole, { label: string; color: "purple" | "blue" | "green"; icon: string }> = {
  founder:   { label: "مؤسس",       color: "purple", icon: "👑" },
  appointed: { label: "معيّن",       color: "blue",   icon: "🛡️" },
  elected:   { label: "منتخب",       color: "green",  icon: "🗳️" },
}

export default function CouncilMembersPage() {
  const [tab, setTab] = useState<TabId>("all")

  const filtered = useMemo(() => {
    if (tab === "all") return COUNCIL_MEMBERS
    if (tab === "admin") return COUNCIL_MEMBERS.filter((m) => m.role === "founder" || m.role === "appointed")
    return COUNCIL_MEMBERS.filter((m) => m.role === "elected")
  }, [tab])

  const counts = {
    all: COUNCIL_MEMBERS.length,
    admin: COUNCIL_MEMBERS.filter((m) => m.role === "founder" || m.role === "appointed").length,
    elected: COUNCIL_MEMBERS.filter((m) => m.role === "elected").length,
  }

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-4xl mx-auto pb-20">

          <PageHeader
            title="👥 أعضاء المجلس"
            subtitle={`${COUNCIL_MEMBERS.length} أعضاء — الدورة الحالية`}
            backHref="/council"
          />

          {/* ═══ Tabs ═══ */}
          <div className="mb-6">
            <Tabs
              tabs={[
                { id: "all",     icon: "✨", label: "الكل",      count: counts.all },
                { id: "admin",   icon: "👑", label: "الإدارة",    count: counts.admin },
                { id: "elected", icon: "🗳️", label: "المنتخبون", count: counts.elected },
              ]}
              activeTab={tab}
              onChange={(id) => setTab(id as TabId)}
            />
          </div>

          {/* ═══ Members grid ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map((m) => {
              const meta = ROLE_META[m.role]
              return (
                <Card key={m.id} variant={m.role === "founder" ? "gradient" : "default"} color={m.role === "founder" ? "purple" : "neutral"}>
                  <div className="flex items-start gap-4 mb-3">
                    <div className={cn(
                      "w-16 h-16 rounded-2xl border flex items-center justify-center text-2xl font-bold text-white flex-shrink-0",
                      m.role === "founder" ? "bg-gradient-to-br from-purple-400/[0.3] to-blue-400/[0.2] border-purple-400/30" :
                      m.role === "appointed" ? "bg-gradient-to-br from-blue-400/[0.2] to-blue-500/[0.1] border-blue-400/30" :
                      "bg-gradient-to-br from-neutral-700 to-neutral-900 border-white/[0.1]",
                    )}>
                      {m.avatar_initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <h3 className="text-sm font-bold text-white truncate">{m.name}</h3>
                        <Badge color={meta.color} variant="soft" size="xs" icon={meta.icon}>
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-neutral-400">{m.position_title}</p>
                    </div>
                  </div>

                  {/* Stats row (for elected) */}
                  {m.role === "elected" && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 flex items-center gap-2">
                        <Vote className="w-3.5 h-3.5 text-green-400 flex-shrink-0" strokeWidth={2} />
                        <div className="min-w-0">
                          <div className="text-[10px] text-neutral-500">أصوات</div>
                          <div className="text-xs font-bold text-white font-mono">{(m.votes_received ?? 0).toLocaleString("en-US")}</div>
                        </div>
                      </div>
                      <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" strokeWidth={2} />
                        <div className="min-w-0">
                          <div className="text-[10px] text-neutral-500">نهاية الدورة</div>
                          <div className="text-xs font-bold text-white" dir="ltr">{m.term_ends_at?.slice(0, 7) ?? "—"}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Joined date */}
                  <div className="text-[10px] text-neutral-500 mb-2 flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    انضم: <span dir="ltr" className="font-mono">{m.joined_at}</span>
                  </div>

                  {/* Bio */}
                  {m.bio && (
                    <p className="text-[11px] text-neutral-300 leading-relaxed line-clamp-3">{m.bio}</p>
                  )}
                </Card>
              )
            })}
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
