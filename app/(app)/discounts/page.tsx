"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, Gift, Ticket, Sparkles } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, StatCard, Badge, EmptyState } from "@/components/ui"
import {
  getActiveDiscounts,
  CATEGORY_LABELS,
  LEVEL_LABELS,
  getDiscountsStats,
  type DiscountCategory,
} from "@/lib/mock-data/discounts"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type SortKey = "newest" | "most_used" | "highest_value"

export default function DiscountsPage() {
  const router = useRouter()
  const stats = getDiscountsStats()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<DiscountCategory | "all">("all")
  const [minDiscount, setMinDiscount] = useState<number>(0)
  const [sort, setSort] = useState<SortKey>("highest_value")

  const discounts = useMemo(() => {
    const active = getActiveDiscounts()
    let filtered = active.filter((d) => {
      if (category !== "all" && d.category !== category) return false
      if (d.discount_percent < minDiscount) return false
      if (search && !d.brand_name.includes(search) && !d.description.includes(search)) return false
      return true
    })
    if (sort === "newest")        filtered = [...filtered].sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1))
    if (sort === "most_used")     filtered = [...filtered].sort((a, b) => b.used_count - a.used_count)
    if (sort === "highest_value") filtered = [...filtered].sort((a, b) => b.discount_percent - a.discount_percent)
    return filtered
  }, [search, category, minDiscount, sort])

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-5xl mx-auto pb-20">

          <PageHeader
            title="🎁 خصومات حصرية"
            subtitle="خصومات في أفضل الماركات لمشتركي رايلوس"
            rightAction={
              <button
                onClick={() => router.push("/discounts/my-coupons")}
                className="bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <Ticket className="w-3.5 h-3.5" />
                قسائمي
              </button>
            }
          />

          <Card variant="gradient" color="orange" padding="lg" className="mb-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-orange-400/[0.15] border border-orange-400/[0.3] flex items-center justify-center mx-auto mb-3">
              <Gift className="w-7 h-7 text-orange-400" strokeWidth={1.5} />
            </div>
            <div className="text-base font-bold text-white mb-1">احصل على خصومات في أفضل الماركات</div>
            <div className="text-xs text-neutral-300 max-w-md mx-auto leading-relaxed mb-3">
              خصومات حصرية للمشتركين تصل لـ 50% على المطاعم والملابس والإلكترونيات والمزيد.
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
              <StatCard label="ماركات" value={stats.total_brands} color="orange" size="sm" />
              <StatCard label="خصومات نشطة" value={stats.active_discounts} color="purple" size="sm" />
            </div>
          </Card>

          {/* Filters */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-3">
            <div className="relative lg:col-span-1">
              <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن ماركة..."
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DiscountCategory | "all")}
              className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
            >
              <option value="all">كل الفئات</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
            >
              <option value="highest_value">الأعلى قيمة</option>
              <option value="most_used">الأكثر استخداماً</option>
              <option value="newest">الأحدث</option>
            </select>
          </div>

          <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
            {[
              { val: 0,  label: "كل الخصومات" },
              { val: 10, label: "10%+" },
              { val: 20, label: "20%+" },
              { val: 30, label: "30%+" },
              { val: 50, label: "50%+" },
            ].map((opt) => (
              <button
                key={opt.val}
                onClick={() => setMinDiscount(opt.val)}
                className={cn(
                  "flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap",
                  minDiscount === opt.val
                    ? "bg-orange-400/[0.15] border-orange-400/[0.4] text-orange-400"
                    : "bg-white/[0.04] border-white/[0.08] text-neutral-400"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {discounts.length === 0 ? (
            <EmptyState icon="🎁" title="لا توجد خصومات" description="جرّب تغيير الفلترة" size="md" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {discounts.map((d) => {
                const cat = CATEGORY_LABELS[d.category]
                const lvl = LEVEL_LABELS[d.required_level]
                return (
                  <Card
                    key={d.id}
                    padding="md"
                    className="cursor-pointer hover:bg-white/[0.07] relative overflow-hidden"
                    onClick={() => router.push(`/discounts/${d.id}`)}
                  >
                    {/* Gradient corner */}
                    <div className={cn(
                      "absolute top-0 left-0 w-32 h-32 -translate-x-12 -translate-y-12 rounded-full blur-3xl opacity-40",
                      d.cover_color === "red"    && "bg-red-400",
                      d.cover_color === "blue"   && "bg-blue-400",
                      d.cover_color === "purple" && "bg-purple-400",
                      d.cover_color === "orange" && "bg-orange-400",
                      d.cover_color === "green"  && "bg-green-400",
                      d.cover_color === "yellow" && "bg-yellow-400",
                    )} />

                    <div className="relative z-10">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl",
                            d.cover_color === "red"    && "bg-red-400/[0.1] border border-red-400/[0.25]",
                            d.cover_color === "blue"   && "bg-blue-400/[0.1] border border-blue-400/[0.25]",
                            d.cover_color === "purple" && "bg-purple-400/[0.1] border border-purple-400/[0.25]",
                            d.cover_color === "orange" && "bg-orange-400/[0.1] border border-orange-400/[0.25]",
                            d.cover_color === "green"  && "bg-green-400/[0.1] border border-green-400/[0.25]",
                            d.cover_color === "yellow" && "bg-yellow-400/[0.1] border border-yellow-400/[0.25]",
                          )}>
                            {d.brand_logo_emoji}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">{d.brand_name}</div>
                            <div className="text-[10px] text-neutral-500 flex items-center gap-1">
                              <span>{cat.icon}</span>
                              <span>{cat.label}</span>
                            </div>
                          </div>
                        </div>
                        <div className={cn(
                          "px-2.5 py-1.5 rounded-xl text-base font-bold flex-shrink-0",
                          d.cover_color === "red"    && "bg-red-400/[0.15] border border-red-400/[0.4] text-red-400",
                          d.cover_color === "blue"   && "bg-blue-400/[0.15] border border-blue-400/[0.4] text-blue-400",
                          d.cover_color === "purple" && "bg-purple-400/[0.15] border border-purple-400/[0.4] text-purple-400",
                          d.cover_color === "orange" && "bg-orange-400/[0.15] border border-orange-400/[0.4] text-orange-400",
                          d.cover_color === "green"  && "bg-green-400/[0.15] border border-green-400/[0.4] text-green-400",
                          d.cover_color === "yellow" && "bg-yellow-400/[0.15] border border-yellow-400/[0.4] text-yellow-400",
                        )}>
                          -{d.discount_percent}%
                        </div>
                      </div>

                      <div className="text-xs text-neutral-300 leading-relaxed mb-3 line-clamp-2 min-h-[2.5em]">{d.description}</div>

                      <div className="flex items-center justify-between text-[10px] text-neutral-500 mb-3">
                        <span className="flex items-center gap-1">
                          <span>{lvl.icon}</span>
                          <span>{lvl.label}+</span>
                        </span>
                        <span>{fmtNum(d.used_count)} استخدام</span>
                      </div>

                      <button className="w-full bg-neutral-100 text-black py-2 rounded-lg text-xs font-bold hover:bg-neutral-200 transition-colors flex items-center justify-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
                        احصل على القسيمة
                      </button>
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
