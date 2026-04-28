"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, Heart } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, Tabs, Badge, EmptyState } from "@/components/ui"
import {
  MOCK_HEALTHCARE_CASES,
  CASE_STATUS_LABELS,
  DISEASE_LABELS,
  type CaseStatus,
} from "@/lib/mock-data/healthcare"

const fmtNum = (n: number) => n.toLocaleString("en-US")

export default function HealthcareCasesPage() {
  const router = useRouter()
  const [tab, setTab] = useState<CaseStatus>("urgent")
  const [search, setSearch] = useState("")

  const cases = useMemo(() => {
    return MOCK_HEALTHCARE_CASES
      .filter((c) => c.status === tab)
      .filter((c) =>
        !search ||
        c.patient_display_name.includes(search) ||
        c.diagnosis.includes(search) ||
        c.city.includes(search)
      )
  }, [tab, search])

  const counts = {
    urgent:    MOCK_HEALTHCARE_CASES.filter((c) => c.status === "urgent").length,
    active:    MOCK_HEALTHCARE_CASES.filter((c) => c.status === "active").length,
    completed: MOCK_HEALTHCARE_CASES.filter((c) => c.status === "completed").length,
  }

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-5xl mx-auto pb-20">

          <PageHeader
            title="🏥 الحالات الطبّية"
            subtitle="تصفّح الحالات وساهم في إنقاذ حياة"
          />

          <div className="relative mb-4">
            <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث (الاسم/المرض/المدينة)..."
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
            />
          </div>

          <div className="mb-5">
            <Tabs
              tabs={[
                { id: "urgent",    icon: "🚨", label: "عاجلة",    count: counts.urgent },
                { id: "active",    icon: "⏳", label: "نشطة",     count: counts.active },
                { id: "completed", icon: "✅", label: "مُكتملة", count: counts.completed },
              ]}
              activeTab={tab}
              onChange={(id) => setTab(id as CaseStatus)}
            />
          </div>

          {cases.length === 0 ? (
            <EmptyState
              icon="🏥"
              title="لا توجد حالات"
              description="جرّب تغيير التبويب أو البحث"
              size="md"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {cases.map((c) => {
                const pct = Math.round((c.amount_collected / c.total_required) * 100)
                const disease = DISEASE_LABELS[c.disease_type]
                return (
                  <Card key={c.id} padding="md" className="cursor-pointer hover:bg-white/[0.07]" onClick={() => router.push(`/healthcare/cases/${c.id}`)}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="text-sm font-bold text-white">{c.patient_display_name}</div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">{c.patient_age} سنة · {c.city}</div>
                      </div>
                      <Badge color={CASE_STATUS_LABELS[c.status].color}>{CASE_STATUS_LABELS[c.status].label}</Badge>
                    </div>

                    <div className="flex items-start gap-1.5 text-xs text-neutral-300 leading-snug mb-3 min-h-[2.5em]">
                      <span className="flex-shrink-0">{disease.icon}</span>
                      <span className="line-clamp-2">{c.diagnosis}</span>
                    </div>

                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full transition-all ${
                          c.status === "completed" ? "bg-green-400" :
                          c.status === "urgent"    ? "bg-gradient-to-r from-red-400 to-orange-400" :
                                                     "bg-gradient-to-r from-yellow-400 to-orange-400"
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-neutral-400 mb-3">
                      <span>{fmtNum(c.amount_collected)} / {fmtNum(c.total_required)} د.ع</span>
                      <span className={c.status === "completed" ? "text-green-400 font-bold" : "text-yellow-400 font-bold"}>{pct}%</span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-white/[0.05]">
                      <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                        <Heart className="w-3 h-3 text-red-400" fill="currentColor" />
                        {fmtNum(c.donors_count)} متبرّع
                      </span>
                      <span className="mr-auto text-[10px] text-blue-400 font-bold">عرض ←</span>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  )
}
