"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { HeartPulse, FileText, Shield, Heart, ChevronLeft, BookOpen } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, StatCard, SectionHeader, Badge } from "@/components/ui"
import {
  getHealthcareStats,
  getUrgentCases,
  MOCK_SUCCESS_STORIES,
  MOCK_AWARENESS_ARTICLES,
  CASE_STATUS_LABELS,
  DISEASE_LABELS,
} from "@/lib/mock-data/healthcare"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

const QUICK_LINKS = [
  { label: "طلب علاج",   href: "/healthcare/apply",     icon: FileText,    color: "blue"   as const, desc: "قدّم طلب دعم لعلاجك أو علاج قريب" },
  { label: "التأمين",     href: "/healthcare/insurance", icon: Shield,      color: "green"  as const, desc: "اشترك في خطّة تأمين شهرية" },
  { label: "تبرّع",        href: "/healthcare/donate",    icon: Heart,       color: "red"    as const, desc: "ساهم في إنقاذ حياة" },
  { label: "الحالات",     href: "/healthcare/cases",     icon: HeartPulse,  color: "purple" as const, desc: "تصفّح الحالات المحتاجة" },
]

export default function HealthcarePage() {
  const router = useRouter()
  const stats = getHealthcareStats()
  const urgent = getUrgentCases(5)

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-5xl mx-auto pb-20">

          <PageHeader
            title="🏥 الرعاية الصحية"
            subtitle="برنامج رايلوس للرعاية الصحية — دعم العلاج وتمكين الحياة"
          />

          {/* Hero */}
          <Card variant="gradient" color="red" padding="lg" className="mb-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-400/[0.15] border border-red-400/[0.3] flex items-center justify-center mx-auto mb-3">
              <HeartPulse className="w-8 h-8 text-red-400" strokeWidth={1.5} />
            </div>
            <div className="text-lg font-bold text-white mb-2">معاً ننقذ حياة</div>
            <div className="text-xs text-neutral-300 max-w-xl mx-auto leading-relaxed">
              برنامج إنساني يدعم المرضى المحتاجين ويوفّر تأميناً صحياً ميسّراً لمستثمري رايلوس.
            </div>
          </Card>

          {/* 4 stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-6">
            <StatCard label="إجمالي التبرّعات" value={fmtNum(stats.total_donated) + " د.ع"} color="red"    size="sm" />
            <StatCard label="حالات مُعالَجة"     value={stats.cases_completed}                color="green"  size="sm" />
            <StatCard label="مشتركو التأمين"   value={stats.insurance_subscribers}          color="blue"   size="sm" />
            <StatCard label="متبرّعون"          value={stats.donors_count}                   color="purple" size="sm" />
          </div>

          {/* 4 quick links */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "group rounded-2xl p-4 border transition-all hover:scale-[1.02]",
                    link.color === "blue"   && "bg-blue-400/[0.05] border-blue-400/[0.2] hover:bg-blue-400/[0.08]",
                    link.color === "green"  && "bg-green-400/[0.05] border-green-400/[0.2] hover:bg-green-400/[0.08]",
                    link.color === "red"    && "bg-red-400/[0.05] border-red-400/[0.2] hover:bg-red-400/[0.08]",
                    link.color === "purple" && "bg-purple-400/[0.05] border-purple-400/[0.2] hover:bg-purple-400/[0.08]",
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl border flex items-center justify-center mb-3",
                    link.color === "blue"   && "bg-blue-400/[0.1] border-blue-400/[0.3]",
                    link.color === "green"  && "bg-green-400/[0.1] border-green-400/[0.3]",
                    link.color === "red"    && "bg-red-400/[0.1] border-red-400/[0.3]",
                    link.color === "purple" && "bg-purple-400/[0.1] border-purple-400/[0.3]",
                  )}>
                    <Icon className={cn(
                      "w-5 h-5",
                      link.color === "blue"   && "text-blue-400",
                      link.color === "green"  && "text-green-400",
                      link.color === "red"    && "text-red-400",
                      link.color === "purple" && "text-purple-400",
                    )} strokeWidth={1.5} />
                  </div>
                  <div className="text-sm font-bold text-white mb-1">{link.label}</div>
                  <div className="text-[10px] text-neutral-500 leading-relaxed">{link.desc}</div>
                </Link>
              )
            })}
          </div>

          {/* Urgent cases slider */}
          <SectionHeader
            title="🚨 حالات عاجلة"
            subtitle="حالات تحتاج دعمكم عاجلاً"
            action={{ label: "عرض الكل", href: "/healthcare/cases" }}
          />
          {urgent.length === 0 ? (
            <Card padding="lg" className="text-center mb-7">
              <div className="text-sm text-neutral-400">لا توجد حالات عاجلة حالياً</div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-7">
              {urgent.map((c) => {
                const pct = Math.round((c.amount_collected / c.total_required) * 100)
                const disease = DISEASE_LABELS[c.disease_type]
                return (
                  <Card key={c.id} padding="md" onClick={() => router.push(`/healthcare/cases/${c.id}`)} className="cursor-pointer hover:bg-white/[0.07]">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-bold text-white">{c.patient_display_name}</div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">{c.patient_age} سنة · {c.city}</div>
                      </div>
                      <Badge color={CASE_STATUS_LABELS[c.status].color}>{CASE_STATUS_LABELS[c.status].label}</Badge>
                    </div>
                    <div className="text-[11px] text-neutral-300 mb-3 line-clamp-2 flex items-start gap-1">
                      <span>{disease.icon}</span>
                      <span>{c.diagnosis}</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-gradient-to-r from-red-400 to-orange-400 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>{fmtNum(c.amount_collected)} / {fmtNum(c.total_required)} د.ع</span>
                      <span className="text-yellow-400 font-bold">{pct}%</span>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Success stories */}
          <SectionHeader title="🌟 قصص نجاح" subtitle="حياة أُنقذت بفضل تبرّعاتكم" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-7">
            {MOCK_SUCCESS_STORIES.map((s) => (
              <Card key={s.id} variant="gradient" color="green" padding="md">
                <div className="text-2xl mb-2">✅</div>
                <div className="text-sm font-bold text-white mb-1">{s.patient_initial}</div>
                <div className="text-[11px] text-green-400 mb-2">{s.disease}</div>
                <div className="text-[11px] text-neutral-300 leading-relaxed mb-3">{s.story}</div>
                <div className="text-[10px] text-neutral-500 font-mono">
                  {fmtNum(s.amount_raised)} د.ع · {s.date}
                </div>
              </Card>
            ))}
          </div>

          {/* Awareness articles */}
          <SectionHeader
            title="📚 التوعية الصحية"
            subtitle="مقالات من فريق طبي مختصّ"
            action={{ label: "كل المقالات", onClick: () => router.push("/healthcare/about") }}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-7">
            {MOCK_AWARENESS_ARTICLES.map((a) => (
              <Card key={a.id} padding="md" className="cursor-pointer hover:bg-white/[0.07]">
                <div className="flex items-center gap-1.5 text-[10px] text-blue-400 mb-2">
                  <BookOpen className="w-3 h-3" strokeWidth={2} />
                  <span>{a.category}</span>
                  <span className="text-neutral-600">·</span>
                  <span className="text-neutral-500">{a.read_time_min} دقائق</span>
                </div>
                <div className="text-sm font-bold text-white mb-2 leading-snug">{a.title}</div>
                <div className="text-[11px] text-neutral-400 leading-relaxed line-clamp-2 mb-2">{a.excerpt}</div>
                <div className="text-[10px] text-neutral-500">{a.published_at}</div>
              </Card>
            ))}
          </div>

          {/* Footer link to about */}
          <button
            onClick={() => router.push("/healthcare/about")}
            className="w-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] rounded-xl py-3 text-xs text-neutral-300 flex items-center justify-center gap-2 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
            تعرّف على البرنامج بالتفصيل
            <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
          </button>

        </div>
      </div>
    </AppLayout>
  )
}
