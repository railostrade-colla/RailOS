"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Heart, BookOpen, Activity, Users } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, StatCard, SectionHeader, Badge, EmptyState } from "@/components/ui"
import {
  getChildById,
  CHILD_STATUS_LABELS,
  EDUCATION_LABELS,
  type OrphanChild,
} from "@/lib/mock-data/orphans"
import { getOrphanChildById } from "@/lib/data/orphans"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

export default function ChildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  // Mock first-paint, real DB on mount.
  const [child, setChild] = useState<OrphanChild | null>(getChildById(id) ?? null)
  useEffect(() => {
    let cancelled = false
    getOrphanChildById(id).then((c) => {
      if (cancelled) return
      if (c) setChild(c)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (!child) {
    return (
      <AppLayout>
        <div className="relative">
          <GridBackground showCircles={false} />
          <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">
            <PageHeader title="غير موجود" />
            <EmptyState icon="🔍" title="لم نعثر على هذا الطفل" action={{ label: "العودة للأطفال", onClick: () => router.push("/orphans/children") }} />
          </div>
        </div>
      </AppLayout>
    )
  }

  const pct = Math.round((child.sponsored_amount / child.needs_amount_monthly) * 100)
  const remaining = Math.max(0, child.needs_amount_monthly - child.sponsored_amount)
  const status = CHILD_STATUS_LABELS[child.status]
  // Sponsorships per child are not exposed publicly (privacy);
  // only the sponsor sees their own. Hide the breakdown for now —
  // shape kept in sync with the mock so JSX continues to compile.
  const sponsors: {
    id: string
    sponsor_name: string
    amount: number
    type: string
    is_anonymous: boolean
    started_at: string
  }[] = []

  const healthLabel = child.health_status === "good" ? "صحّة جيدة" : child.health_status === "monitoring" ? "تحت متابعة" : "يحتاج رعاية"
  const healthColor = child.health_status === "good" ? "green" as const : child.health_status === "monitoring" ? "yellow" as const : "red" as const

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader title={child.first_name} subtitle={`${child.age} سنوات · ${child.city}`} />

          {/* Hero */}
          <Card variant="gradient" color="blue" padding="lg" className="mb-5 text-center">
            <div className={cn(
              "w-24 h-24 rounded-3xl mx-auto mb-4 flex items-center justify-center text-5xl",
              child.gender === "male" ? "bg-blue-400/[0.1] border-2 border-blue-400/[0.2]" : "bg-pink-400/[0.1] border-2 border-pink-400/[0.2]"
            )}>
              {child.blur_photo ? "👤" : (child.gender === "male" ? "👦" : "👧")}
            </div>
            <Badge color={status.color}>{status.label}</Badge>
            <div className="text-base font-bold text-white mt-3 mb-1">{child.first_name}</div>
            <div className="text-xs text-neutral-400">{child.age} سنوات · {child.city}</div>
            {child.blur_photo && (
              <div className="text-[10px] text-neutral-500 mt-3">
                🔒 صور الطفل محمية لخصوصيته
              </div>
            )}
          </Card>

          {/* Story */}
          <SectionHeader title="📖 قصّة الطفل" />
          <Card padding="md" className="mb-3">
            <div className="text-xs text-neutral-200 leading-relaxed">{child.story}</div>
          </Card>

          {/* Needs */}
          <SectionHeader title="🎯 احتياجاته" />
          <Card padding="md" className="mb-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <BookOpen className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                <div>
                  <div className="text-[10px] text-neutral-500 mb-0.5">المرحلة الدراسية</div>
                  <div className="text-xs text-white font-bold">{EDUCATION_LABELS[child.education_level]}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Activity className={cn(
                  "w-4 h-4 flex-shrink-0 mt-0.5",
                  healthColor === "green" && "text-green-400",
                  healthColor === "yellow" && "text-yellow-400",
                  healthColor === "red" && "text-red-400"
                )} strokeWidth={1.5} />
                <div>
                  <div className="text-[10px] text-neutral-500 mb-0.5">الحالة الصحّية</div>
                  <div className={cn(
                    "text-xs font-bold",
                    healthColor === "green" && "text-green-400",
                    healthColor === "yellow" && "text-yellow-400",
                    healthColor === "red" && "text-red-400",
                  )}>{healthLabel}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Funding progress */}
          <SectionHeader title="💰 الكفالة المطلوبة" />
          <Card padding="lg" className="mb-3">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold text-white font-mono">{pct}%</span>
              <span className="text-xs text-neutral-500">من الكفالة الشهرية</span>
            </div>
            <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden mb-3">
              <div
                className={cn(
                  "h-full transition-all",
                  child.status === "fully_sponsored" ? "bg-green-400" : "bg-gradient-to-r from-teal-400 to-blue-400"
                )}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="مكفول"   value={fmtNum(child.sponsored_amount)}      color="green"  size="sm" />
              <StatCard label="المتبقّي" value={fmtNum(remaining)}                  color="yellow" size="sm" />
              <StatCard label="المطلوب" value={fmtNum(child.needs_amount_monthly)}  color="neutral" size="sm" />
            </div>
            <div className="text-[10px] text-neutral-500 mt-3 text-center">
              الكفالة الشهرية = {fmtNum(child.needs_amount_monthly)} د.ع/شهر
            </div>
          </Card>

          {/* Sponsors */}
          <SectionHeader title="❤️ المكفّلون" subtitle={`${sponsors.length} مكفّل/مكفّلة`} />
          {sponsors.length === 0 ? (
            <Card padding="md" className="mb-5 text-center">
              <div className="text-xs text-neutral-400">لا يوجد مكفّلون بعد — كن أوّل من يساهم!</div>
            </Card>
          ) : (
            <Card padding="sm" className="mb-5">
              <div className="divide-y divide-white/[0.05]">
                {sponsors.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-2.5">
                    <div className="w-8 h-8 rounded-full bg-teal-400/[0.1] border border-teal-400/[0.2] flex items-center justify-center text-xs font-bold text-teal-400">
                      <Users className="w-4 h-4" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white font-bold">{s.is_anonymous ? "مكفّل مجهول" : s.sponsor_name}</div>
                      <div className="text-[10px] text-neutral-500">منذ {s.started_at}</div>
                    </div>
                    <div className="text-sm font-bold text-teal-400 font-mono">+{fmtNum(s.amount)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* CTA */}
          {child.status !== "fully_sponsored" && (
            <button
              onClick={() => router.push(`/orphans/sponsor?child=${child.id}`)}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-teal-500 to-blue-500 text-white text-base font-bold hover:from-teal-600 hover:to-blue-600 transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              <Heart className="w-5 h-5" fill="currentColor" />
              اكفل {child.first_name}
            </button>
          )}
          {child.status === "fully_sponsored" && (
            <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-xl p-4 text-center">
              <div className="text-sm text-green-400 font-bold mb-1">✅ {child.first_name} مكفول بالكامل</div>
              <div className="text-[11px] text-neutral-400">شكراً للمكفّلين — يمكنك المساهمة في تبرّع عام</div>
              <button
                onClick={() => router.push("/orphans/donate")}
                className="mt-3 bg-blue-400/[0.08] border border-blue-400/[0.25] text-blue-400 px-5 py-2 rounded-lg text-xs font-bold hover:bg-blue-400/[0.12] transition-colors"
              >
                تبرّع عام
              </button>
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  )
}
