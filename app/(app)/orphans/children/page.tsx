"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, BookOpen } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, Tabs, Badge, EmptyState } from "@/components/ui"
import {
  MOCK_ORPHAN_CHILDREN,
  CHILD_STATUS_LABELS,
  EDUCATION_LABELS,
  type ChildSponsorshipStatus,
} from "@/lib/mock-data/orphans"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type FilterTab = "all" | ChildSponsorshipStatus

export default function ChildrenPage() {
  const router = useRouter()
  const [tab, setTab] = useState<FilterTab>("needs_sponsor")
  const [search, setSearch] = useState("")

  const children = useMemo(() => {
    return MOCK_ORPHAN_CHILDREN
      .filter((c) => tab === "all" || c.status === tab)
      .filter((c) => !search || c.first_name.includes(search) || c.city.includes(search))
  }, [tab, search])

  const counts = {
    all:              MOCK_ORPHAN_CHILDREN.length,
    needs_sponsor:    MOCK_ORPHAN_CHILDREN.filter((c) => c.status === "needs_sponsor").length,
    partial:          MOCK_ORPHAN_CHILDREN.filter((c) => c.status === "partial").length,
    fully_sponsored:  MOCK_ORPHAN_CHILDREN.filter((c) => c.status === "fully_sponsored").length,
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-5xl mx-auto pb-20">

          <PageHeader title="👶 الأطفال" subtitle="تعرّف على الأطفال المنتظرين كفالتك" />

          <div className="relative mb-4">
            <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث (الاسم/المدينة)..."
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
            />
          </div>

          <div className="mb-5">
            <Tabs
              tabs={[
                { id: "needs_sponsor",    icon: "🆘", label: "يحتاجون كفالة", count: counts.needs_sponsor },
                { id: "partial",          icon: "⏳", label: "مكفولون جزئياً", count: counts.partial },
                { id: "fully_sponsored",  icon: "✅", label: "مكفولون",        count: counts.fully_sponsored },
                { id: "all",              icon: "📋", label: "الكل",          count: counts.all },
              ]}
              activeTab={tab}
              onChange={(id) => setTab(id as FilterTab)}
            />
          </div>

          {children.length === 0 ? (
            <EmptyState icon="👶" title="لا يوجد أطفال" description="جرّب تغيير التبويب" size="md" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {children.map((child) => {
                const pct = Math.round((child.sponsored_amount / child.needs_amount_monthly) * 100)
                const status = CHILD_STATUS_LABELS[child.status]
                return (
                  <Card key={child.id} padding="md" className="cursor-pointer hover:bg-white/[0.07]" onClick={() => router.push(`/orphans/children/${child.id}`)}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0",
                          child.gender === "male" ? "bg-blue-400/[0.1] border border-blue-400/[0.2]" : "bg-pink-400/[0.1] border border-pink-400/[0.2]"
                        )}>
                          {child.blur_photo ? "👤" : (child.gender === "male" ? "👦" : "👧")}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white">{child.first_name}</div>
                          <div className="text-[10px] text-neutral-500">{child.age} سنوات · {child.city}</div>
                        </div>
                      </div>
                      <Badge color={status.color}>{status.label}</Badge>
                    </div>

                    <div className="text-[11px] text-neutral-400 mb-3 line-clamp-3 leading-relaxed">{child.story}</div>

                    <div className="flex items-center gap-1 text-[10px] text-neutral-500 mb-2">
                      <BookOpen className="w-3 h-3" strokeWidth={1.5} />
                      <span>{EDUCATION_LABELS[child.education_level]}</span>
                      {child.health_status === "needs_care" && (
                        <span className="mr-auto text-orange-400">⚠️ يحتاج رعاية صحّية</span>
                      )}
                    </div>

                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-2">
                      <div
                        className={cn(
                          "h-full transition-all",
                          child.status === "fully_sponsored"
                            ? "bg-green-400"
                            : "bg-gradient-to-r from-teal-400 to-blue-400"
                        )}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-neutral-400 mb-3">
                      <span>{fmtNum(child.sponsored_amount)} / {fmtNum(child.needs_amount_monthly)} د.ع/شهر</span>
                      <span className={cn(
                        "font-bold",
                        child.status === "fully_sponsored" ? "text-green-400" : "text-teal-400"
                      )}>{pct}%</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                      <span className="text-[10px] text-neutral-500">{child.sponsors_count} مكفّل</span>
                      <span className="text-[10px] text-blue-400 font-bold">
                        {child.status === "fully_sponsored" ? "ساهم في تبرّع آخر ←" : "اكفل ←"}
                      </span>
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
