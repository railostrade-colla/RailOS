"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Heart, Users, Gift, BookOpen, ChevronLeft } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, StatCard, SectionHeader, Badge } from "@/components/ui"
import {
  getOrphansStats as getOrphansStatsMock,
  MOCK_TESTIMONIALS,
  MOCK_ORPHAN_CHILDREN,
  CHILD_STATUS_LABELS,
  EDUCATION_LABELS,
  type OrphanChild,
} from "@/lib/mock-data/orphans"
import {
  getOrphanChildren,
  getOrphansStats,
  type OrphansStats,
} from "@/lib/data/orphans"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

const QUICK_LINKS = [
  { label: "كفالة طفل",  href: "/orphans/sponsor",  icon: Heart,    color: "teal"   as const, desc: "اختر طفلاً وابدأ كفالة شهرية" },
  { label: "تبرّع عام",   href: "/orphans/donate",   icon: Gift,     color: "blue"   as const, desc: "ساهم في الصندوق العام" },
  { label: "الأطفال",      href: "/orphans/children", icon: Users,    color: "purple" as const, desc: "تصفّح الأطفال المحتاجين" },
  { label: "كيف يعمل",   href: "/orphans/about",    icon: BookOpen, color: "orange" as const, desc: "اعرف تفاصيل البرنامج" },
]

const COLOR_CLASSES = {
  teal:   { bg: "bg-teal-400/[0.05]",   border: "border-teal-400/[0.2]",   hover: "hover:bg-teal-400/[0.08]",   iconBg: "bg-teal-400/[0.1]",   iconBorder: "border-teal-400/[0.3]",   text: "text-teal-400" },
  blue:   { bg: "bg-blue-400/[0.05]",   border: "border-blue-400/[0.2]",   hover: "hover:bg-blue-400/[0.08]",   iconBg: "bg-blue-400/[0.1]",   iconBorder: "border-blue-400/[0.3]",   text: "text-blue-400" },
  purple: { bg: "bg-purple-400/[0.05]", border: "border-purple-400/[0.2]", hover: "hover:bg-purple-400/[0.08]", iconBg: "bg-purple-400/[0.1]", iconBorder: "border-purple-400/[0.3]", text: "text-purple-400" },
  orange: { bg: "bg-orange-400/[0.05]", border: "border-orange-400/[0.2]", hover: "hover:bg-orange-400/[0.08]", iconBg: "bg-orange-400/[0.1]", iconBorder: "border-orange-400/[0.3]", text: "text-orange-400" },
}

export default function OrphansPage() {
  const router = useRouter()
  // First-paint mock fallback so the section renders instantly;
  // real DB values swap in on mount.
  const [stats, setStats] = useState<OrphansStats>(() => getOrphansStatsMock())
  const [featured, setFeatured] = useState<OrphanChild[]>(
    MOCK_ORPHAN_CHILDREN.slice(0, 3),
  )

  useEffect(() => {
    let cancelled = false
    Promise.all([getOrphansStats(), getOrphanChildren()]).then(
      ([s, children]) => {
        if (cancelled) return
        if (s.total_children > 0) setStats(s)
        if (children.length > 0) setFeatured(children.slice(0, 3))
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-5xl mx-auto pb-20">

          <PageHeader title="👶 رعاية الأيتام" subtitle="برنامج رايلوس لكفالة الأيتام ودعم تعليمهم" />

          {/* Hero */}
          <Card variant="gradient" color="blue" padding="lg" className="mb-6 text-center">
            <div className="text-5xl mb-3">👶</div>
            <div className="text-lg font-bold text-white mb-2">كفالة طفل = حياة جديدة</div>
            <div className="text-xs text-neutral-300 max-w-xl mx-auto leading-relaxed">
              برنامج إنساني لرعاية الأطفال الأيتام في العراق — تعليم وصحّة وملبس وأمل.
            </div>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-6">
            <StatCard label="إجمالي الأطفال"   value={stats.total_children} color="blue"   size="sm" />
            <StatCard label="مكفولون بالكامل" value={stats.sponsored}      color="green"  size="sm" />
            <StatCard label="مكفّلون نشطون"   value={stats.sponsors_count} color="purple" size="sm" />
            <StatCard label="إجمالي التبرّعات" value={fmtNum(stats.total_donated)} color="orange" size="sm" />
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon
              const c = COLOR_CLASSES[link.color]
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn("group rounded-2xl p-4 border transition-all hover:scale-[1.02]", c.bg, c.border, c.hover)}
                >
                  <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center mb-3", c.iconBg, c.iconBorder)}>
                    <Icon className={cn("w-5 h-5", c.text)} strokeWidth={1.5} />
                  </div>
                  <div className="text-sm font-bold text-white mb-1">{link.label}</div>
                  <div className="text-[10px] text-neutral-500 leading-relaxed">{link.desc}</div>
                </Link>
              )
            })}
          </div>

          {/* Featured children */}
          <SectionHeader
            title="🌟 أطفال يحتاجون كفالتك"
            subtitle="ابدأ التغيير من طفل واحد"
            action={{ label: "كل الأطفال", href: "/orphans/children" }}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-7">
            {featured.map((child) => {
              const pct = Math.round((child.sponsored_amount / child.needs_amount_monthly) * 100)
              const status = CHILD_STATUS_LABELS[child.status]
              return (
                <Card key={child.id} padding="md" className="cursor-pointer hover:bg-white/[0.07]" onClick={() => router.push(`/orphans/children/${child.id}`)}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl",
                        child.gender === "male" ? "bg-blue-400/[0.1] border border-blue-400/[0.2]" : "bg-pink-400/[0.1] border border-pink-400/[0.2]"
                      )}>
                        {child.blur_photo ? "👤" : (child.gender === "male" ? "👦" : "👧")}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{child.first_name}</div>
                        <div className="text-[10px] text-neutral-500">{child.age} سنوات · {child.city}</div>
                      </div>
                    </div>
                    <Badge color={status.color}>{status.label}</Badge>
                  </div>

                  <div className="text-[11px] text-neutral-400 mb-3 line-clamp-2 leading-relaxed">{child.story}</div>

                  <div className="flex items-center gap-1 text-[10px] text-neutral-500 mb-2">
                    <BookOpen className="w-3 h-3" strokeWidth={1.5} />
                    <span>{EDUCATION_LABELS[child.education_level]}</span>
                  </div>

                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-gradient-to-r from-teal-400 to-blue-400" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-neutral-400">
                    <span>{fmtNum(child.sponsored_amount)} / {fmtNum(child.needs_amount_monthly)} د.ع/شهر</span>
                    <span className="text-teal-400 font-bold">{pct}%</span>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Testimonials */}
          <SectionHeader title="💬 شهادات المكفّلين" subtitle="تجارب إنسانية حقيقية" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-7">
            {MOCK_TESTIMONIALS.map((t) => (
              <Card key={t.id} variant="gradient" color="purple" padding="md">
                <div className="text-3xl text-purple-400 leading-none mb-2">&ldquo;</div>
                <div className="text-xs text-neutral-200 leading-relaxed mb-3">{t.text}</div>
                <div className="flex justify-between items-center pt-2 border-t border-white/[0.05]">
                  <div className="text-[11px] text-white font-bold">{t.sponsor_name}</div>
                  <div className="text-[10px] text-purple-400">{t.duration_months} شهر كفالة</div>
                </div>
              </Card>
            ))}
          </div>

          {/* About link */}
          <button
            onClick={() => router.push("/orphans/about")}
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
