"use client"

import { useState, useMemo } from "react"
import { Activity, TrendingUp, TrendingDown, Users, X, Search } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD, KPI, AdminEmpty,
} from "@/components/admin/ui"
import {
  analyzeAllProjects,
  getMarketHealthStats,
  RECOMMENDATION_META,
  concentrationColor,
  type MarketHealth,
  type MarketRecommendation,
} from "@/lib/data/market-analysis"
import { showSuccess } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type ReleaseModalState = {
  isOpen: boolean
  project: MarketHealth | null
  amount: number
  pricePerShare: number
}

export function MarketHealthPanel() {
  const [filter, setFilter] = useState<"all" | MarketRecommendation>("all")
  const [search, setSearch] = useState("")
  const [release, setRelease] = useState<ReleaseModalState>({
    isOpen: false,
    project: null,
    amount: 0,
    pricePerShare: 0,
  })

  const allHealth = useMemo(() => analyzeAllProjects(), [])
  const stats = useMemo(() => getMarketHealthStats(), [])

  const filtered = useMemo(() => {
    return allHealth
      .filter((m) => filter === "all" || m.recommendation === filter)
      .filter(
        (m) =>
          !search ||
          m.project_name.includes(search) ||
          (m.symbol && m.symbol.toLowerCase().includes(search.toLowerCase()))
      )
  }, [allHealth, filter, search])

  const openReleaseModal = (m: MarketHealth) => {
    setRelease({
      isOpen: true,
      project: m,
      amount: m.suggested_release,
      pricePerShare: 0, // 0 = نفس السعر الحالي
    })
  }

  const closeReleaseModal = () => {
    setRelease({ isOpen: false, project: null, amount: 0, pricePerShare: 0 })
  }

  const handleConfirmRelease = () => {
    if (!release.project) return
    showSuccess(
      `✅ تم إطلاق ${fmtNum(release.amount)} حصة من ${release.project.project_name} للسوق`
    )
    closeReleaseModal()
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2.5 mb-1">
          <Activity className="w-5 h-5 text-blue-400" strokeWidth={2} />
          <div className="text-lg font-bold text-white">📊 مراقبة صحّة السوق</div>
        </div>
        <div className="text-xs text-neutral-500">
          تحليل ضغط الشراء/البيع + الاحتكار + اقتراح إطلاق حصص جديدة عند الحاجة
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="مشاريع تحتاج إطلاق حصص" val={stats.needRelease} color="#F87171" accent="rgba(248,113,113,0.05)" />
        <KPI label="مشاريع باحتكار خطِر" val={stats.monopolyRisk} color="#FB923C" accent="rgba(251,146,60,0.05)" />
        <KPI label="مشاريع متوازنة" val={stats.healthy} color="#4ADE80" />
        <KPI label="مشاريع بضغط بيع" val={stats.lowDemand} color="#60A5FA" />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-2 mb-3">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث (اسم المشروع أو الرمز)..."
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="all">كل التوصيات</option>
          <option value="release_shares">🔥 يحتاج إطلاق حصص</option>
          <option value="monopoly_risk">⚠️ خطر احتكار</option>
          <option value="healthy">✅ متوازن</option>
          <option value="low_demand">📉 قلة طلب</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <AdminEmpty title="لا توجد مشاريع تطابق الفلتر" />
      ) : (
        <Table>
          <THead>
            <TH>المشروع</TH>
            <TH>ضغط السوق (شراء/بيع)</TH>
            <TH>الاحتكار</TH>
            <TH>الحاملون</TH>
            <TH>التوصية</TH>
            <TH>إجراء</TH>
          </THead>
          <TBody>
            {filtered.map((m) => {
              const meta = RECOMMENDATION_META[m.recommendation]
              const concColor = concentrationColor(m.concentration)
              return (
                <TR key={m.project_id}>
                  {/* Project */}
                  <TD>
                    <div>
                      <div className="text-xs text-white font-bold">{m.project_name}</div>
                      {m.symbol && (
                        <div className="text-[10px] text-blue-400 font-mono mt-0.5" dir="ltr">
                          {m.symbol}
                        </div>
                      )}
                    </div>
                  </TD>

                  {/* Pressure bars */}
                  <TD>
                    <div className="space-y-1.5 min-w-[140px]">
                      <div>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-green-400 font-bold flex items-center gap-1">
                            <TrendingUp className="w-2.5 h-2.5" />
                            شراء {m.buy_pressure}%
                          </span>
                          <span className="text-neutral-500">{m.buyers_count} مشتري</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-400 transition-all"
                            style={{ width: `${m.buy_pressure}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-red-400 font-bold flex items-center gap-1">
                            <TrendingDown className="w-2.5 h-2.5" />
                            بيع {m.sell_pressure}%
                          </span>
                          <span className="text-neutral-500">{m.sellers_count} بائع</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-400 transition-all"
                            style={{ width: `${m.sell_pressure}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </TD>

                  {/* Concentration */}
                  <TD>
                    <div className="space-y-1 min-w-[100px]">
                      <div className="flex justify-between text-[10px]">
                        <span
                          className={cn(
                            "font-bold",
                            concColor === "green" && "text-green-400",
                            concColor === "yellow" && "text-yellow-400",
                            concColor === "orange" && "text-orange-400",
                            concColor === "red" && "text-red-400"
                          )}
                        >
                          {m.concentration}%
                        </span>
                        <span className="text-neutral-600">من 10%</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            concColor === "green" && "bg-green-400",
                            concColor === "yellow" && "bg-yellow-400",
                            concColor === "orange" && "bg-orange-400",
                            concColor === "red" && "bg-red-400"
                          )}
                          style={{ width: `${m.concentration}%` }}
                        />
                      </div>
                    </div>
                  </TD>

                  {/* Holders */}
                  <TD>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Users className="w-3 h-3 text-neutral-500" />
                      <span className="font-mono text-white font-bold">{m.holders_count}</span>
                    </div>
                  </TD>

                  {/* Recommendation */}
                  <TD>
                    <div className="space-y-1">
                      <Badge label={`${meta.icon} ${meta.label}`} color={meta.color as "red" | "yellow" | "green" | "blue"} />
                      <div className="text-[10px] text-neutral-500 leading-tight max-w-[180px]">
                        {m.reason}
                      </div>
                    </div>
                  </TD>

                  {/* Action */}
                  <TD>
                    {m.suggested_release > 0 ? (
                      <ActionBtn
                        label={meta.actionLabel ?? "إطلاق حصص"}
                        color={meta.color === "red" ? "red" : "blue"}
                        sm
                        onClick={() => openReleaseModal(m)}
                      />
                    ) : (
                      <span className="text-[10px] text-neutral-500">—</span>
                    )}
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {/* Release Modal */}
      {release.isOpen && release.project && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-base font-bold text-white">🔥 اقتراح إطلاق حصص</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">{release.project.project_name}</div>
              </div>
              <button onClick={closeReleaseModal} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reason */}
            <div className="bg-orange-400/[0.05] border border-orange-400/[0.2] rounded-xl p-3 mb-4 text-xs text-orange-400 leading-relaxed">
              <div className="font-bold mb-1">السبب:</div>
              {release.project.reason}
            </div>

            {/* Form */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">عدد الحصص المُقترحة</label>
                <input
                  type="number"
                  value={release.amount}
                  onChange={(e) => setRelease((r) => ({ ...r, amount: Number(e.target.value) || 0 }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
                />
                <div className="text-[10px] text-neutral-500 mt-1">
                  المُقترح: {fmtNum(release.project.suggested_release)} حصة (≈ 5-10% من الإجمالي)
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">سعر الحصة (د.ع)</label>
                <input
                  type="number"
                  value={release.pricePerShare}
                  onChange={(e) =>
                    setRelease((r) => ({ ...r, pricePerShare: Number(e.target.value) || 0 }))
                  }
                  placeholder="اتركه فارغاً للسعر الحالي"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
                />
                <div className="text-[10px] text-neutral-500 mt-1">
                  0 = نفس السعر السوقي الحالي
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={closeReleaseModal}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmRelease}
                className="flex-1 py-3 rounded-xl bg-red-500/[0.15] border border-red-500/[0.3] text-red-400 text-sm font-bold hover:bg-red-500/[0.2]"
              >
                ✅ تنفيذ الإطلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="mt-6 text-[10px] text-neutral-600 leading-relaxed">
        التحليل يُحدَّث آلياً بناءً على آخر بيانات السوق + holdings + listings. التوصيات اقتراحية —
        القرار النهائي للأدمن مع مراعاة عوامل أخرى.
      </div>
    </div>
  )
}
