"use client"

/**
 * Read-only details view for a project/company row.
 * Used inline by Projects.tsx when user clicks a row.
 */

import { useEffect, useState } from "react"
import { ArrowRight, Edit2, Wallet as WalletIcon, MapPin, Calendar, TrendingUp, TrendingDown, Users, AlertTriangle } from "lucide-react"
import { Badge, ActionBtn, KPI } from "@/components/admin/ui"
import { getAllProjectWalletsAdmin } from "@/lib/data/admin-utilities"
import { getProjectByIdAdmin } from "@/lib/data/projects"
import { cn } from "@/lib/utils/cn"

interface ProjectWalletAggregate {
  balance: number
  total_inflow: number
  total_outflow: number
  status: "active" | "frozen" | "closed"
}

interface ProjectPrices {
  launch_price: number       // Initial price at creation (immutable)
  market_price: number       // Current dynamic price
  change_pct: number         // (market - launch) / launch × 100
}

// Loose entity-detail row shape — matches Projects.tsx EntityRow.
// Kept here so this component doesn't import from a panel that
// imports it (would create a cycle).
interface EntityDetailRow {
  id: string
  name: string
  sector: string
  entity_type: "project" | "company"
  status: "active" | "pending" | "paused"
  quality: "low" | "medium" | "high"
  share_price: number
  total_shares: number
  available_shares: number
  project_value: number
  /** Optional metadata — populated when row came from a richer DB query. */
  description?: string
  city?: string
  created_at?: string
  founded_year?: number | string
  offering_start?: string
  offering_end?: string
}

const fmtNum = (n: number) => n.toLocaleString("en-US")

const sectorIcon = (s: string) => {
  if (s?.includes("زراع")) return "🌾"
  if (s?.includes("تجار")) return "🏪"
  if (s?.includes("عقار")) return "🏢"
  if (s?.includes("صناع")) return "🏭"
  if (s?.includes("تقن")) return "💻"
  return "🏢"
}

export interface EntityDetailsViewProps {
  entity: EntityDetailRow
  onEdit: () => void
  onBack: () => void
}

export function EntityDetailsView({ entity, onEdit, onBack }: EntityDetailsViewProps) {
  const isProject = entity.entity_type === "project"
  const soldShares = entity.total_shares - entity.available_shares
  const soldPct = entity.total_shares > 0 ? Math.round((soldShares / entity.total_shares) * 100) : 0

  // Fetch real wallet aggregate from DB. Empty until the async fetch
  // resolves; if no wallets exist for this project, stays null.
  const [wallet, setWallet] = useState<ProjectWalletAggregate | null>(null)
  // Phase 10.58: fetch project's launch + current prices
  const [prices, setPrices] = useState<ProjectPrices | null>(null)

  useEffect(() => {
    if (!isProject) return
    let cancelled = false
    getAllProjectWalletsAdmin(500).then((rows) => {
      if (cancelled) return
      const match = rows.find((r) => r.project_id === entity.id || r.id === entity.id)
      if (match) {
        setWallet({
          balance: match.balance,
          total_inflow: match.total_inflow,
          total_outflow: match.total_outflow,
          status: match.status,
        })
      } else {
        setWallet(null)
      }
    })
    // Fetch full project for launch_price (share_price) + market_price (current_market_price)
    getProjectByIdAdmin(entity.id).then((row) => {
      if (cancelled || !row) return
      const launch = Number(row.share_price ?? 0)
      const market = Number(row.current_market_price ?? row.share_price ?? 0)
      const change = launch > 0 ? ((market - launch) / launch) * 100 : 0
      setPrices({ launch_price: launch, market_price: market, change_pct: change })
    })
    return () => { cancelled = true }
  }, [entity.id, isProject])

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <button
          onClick={onBack}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
          العودة لقائمة المشاريع
        </button>
        <ActionBtn label="✏️ تعديل" color="blue" onClick={onEdit} />
      </div>

      {/* Hero */}
      <div className={cn(
        "rounded-2xl p-5 mb-5 border",
        isProject
          ? "bg-gradient-to-br from-blue-500/[0.08] to-transparent border-blue-400/[0.25]"
          : "bg-gradient-to-br from-purple-500/[0.08] to-transparent border-purple-400/[0.25]"
      )}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "w-14 h-14 rounded-2xl border flex items-center justify-center text-3xl flex-shrink-0",
              isProject ? "bg-blue-400/[0.1] border-blue-400/[0.3]" : "bg-purple-400/[0.1] border-purple-400/[0.3]"
            )}>
              {sectorIcon(entity.sector)}
            </div>
            <div className="min-w-0">
              <div className="text-xl font-bold text-white">{entity.name}</div>
              <div className="text-xs text-neutral-400 mt-0.5 flex items-center gap-2 flex-wrap">
                <Badge label={isProject ? "مشروع" : "شركة"} color={isProject ? "blue" : "purple"} />
                <span>•</span>
                <span>{entity.sector}</span>
                <span>•</span>
                <span className="font-mono">#{entity.id}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge
              label={entity.status === "active" ? "نشط" : entity.status === "pending" ? "مراجعة" : "متوقف"}
              color={entity.status === "active" ? "green" : entity.status === "pending" ? "yellow" : "gray"}
            />
            <Badge
              label={entity.quality === "high" ? "★ عالية" : entity.quality === "medium" ? "متوسطة" : "منخفضة"}
              color={entity.quality === "high" ? "purple" : entity.quality === "medium" ? "blue" : "gray"}
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="سعر الإطلاق" val={prices ? fmtNum(prices.launch_price) : (entity.share_price ? fmtNum(entity.share_price) : "—")} color="#FBBF24" />
        <KPI label="إجمالي الحصص" val={fmtNum(entity.total_shares)} color="#fff" />
        <KPI label="حصص متاحة" val={fmtNum(entity.available_shares)} color="#4ADE80" />
        <KPI label="القيمة الإجمالية" val={fmtNum(entity.project_value) + " د.ع"} color="#60A5FA" />
      </div>

      {/* Phase 10.58 — Launch vs Market price comparison */}
      {isProject && prices && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            {prices.change_pct >= 0
              ? <TrendingUp className="w-4 h-4 text-green-400" strokeWidth={1.5} />
              : <TrendingDown className="w-4 h-4 text-red-400" strokeWidth={1.5} />
            }
            <div className="text-sm font-bold text-white">سعر الإطلاق مقابل سعر السوق</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-lg p-3 text-center">
              <div className="text-[10px] text-neutral-500 mb-1">سعر الإطلاق (مرجعي)</div>
              <div className="text-base font-bold text-yellow-400 font-mono">{fmtNum(prices.launch_price)} د.ع</div>
              <div className="text-[9px] text-neutral-600 mt-1">ثابت — وقت الإنشاء</div>
            </div>
            <div className="bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-lg p-3 text-center">
              <div className="text-[10px] text-neutral-500 mb-1">سعر السوق الحالي</div>
              <div className="text-base font-bold text-blue-400 font-mono">{fmtNum(prices.market_price)} د.ع</div>
              <div className="text-[9px] text-neutral-600 mt-1">ديناميكي — يتحدّث مع السوق</div>
            </div>
            <div className={cn(
              "rounded-lg p-3 text-center border",
              prices.change_pct > 0 && "bg-green-400/[0.05] border-green-400/[0.2]",
              prices.change_pct < 0 && "bg-red-400/[0.05] border-red-400/[0.2]",
              prices.change_pct === 0 && "bg-neutral-400/[0.05] border-neutral-400/[0.2]",
            )}>
              <div className="text-[10px] text-neutral-500 mb-1">نسبة التغيّر</div>
              <div className={cn(
                "text-base font-bold font-mono",
                prices.change_pct > 0 && "text-green-400",
                prices.change_pct < 0 && "text-red-400",
                prices.change_pct === 0 && "text-neutral-400",
              )}>
                {prices.change_pct > 0 ? "+" : ""}{prices.change_pct.toFixed(2)}%
              </div>
              <div className="text-[9px] text-neutral-600 mt-1">منذ الإطلاق</div>
            </div>
          </div>
        </div>
      )}

      {/* Shares progress */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-green-400" strokeWidth={1.5} />
          <div className="text-sm font-bold text-white">تقدّم البيع</div>
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-white font-mono">{soldPct}%</span>
          <span className="text-xs text-neutral-500">من الحصص بِيعت</span>
        </div>
        <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-blue-400 to-green-400 transition-all"
            style={{ width: `${Math.min(100, soldPct)}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-lg p-3 text-center">
            <div className="text-[10px] text-neutral-500 mb-1">حصص مُباعة</div>
            <div className="text-base font-bold text-green-400 font-mono">{fmtNum(soldShares)}</div>
          </div>
          <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-lg p-3 text-center">
            <div className="text-[10px] text-neutral-500 mb-1">حصص متاحة</div>
            <div className="text-base font-bold text-yellow-400 font-mono">{fmtNum(entity.available_shares)}</div>
          </div>
        </div>
      </div>

      {/* Wallet */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <WalletIcon className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
          <div className="text-sm font-bold text-white">المحفظة المرتبطة</div>
        </div>
        {wallet ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-lg p-3 text-center">
              <div className="text-[10px] text-neutral-500 mb-1">الرصيد</div>
              <div className="text-base font-bold text-blue-400 font-mono">{fmtNum(wallet.balance)}</div>
            </div>
            <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-lg p-3 text-center">
              <div className="text-[10px] text-neutral-500 mb-1">إيرادات</div>
              <div className="text-base font-bold text-green-400 font-mono">+{fmtNum(wallet.total_inflow)}</div>
            </div>
            <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-lg p-3 text-center">
              <div className="text-[10px] text-neutral-500 mb-1">مصروفات</div>
              <div className="text-base font-bold text-red-400 font-mono">-{fmtNum(wallet.total_outflow)}</div>
            </div>
          </div>
        ) : isProject && entity.status === "active" ? (
          <div className="bg-orange-400/[0.05] border border-orange-400/[0.25] rounded-xl p-3 flex items-start gap-2 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-orange-400 mt-0.5" strokeWidth={1.5} />
            <div>
              <div className="text-orange-400 font-bold mb-1">⚠ المحافظ غير منشَأة بعد</div>
              <div className="text-neutral-300 leading-relaxed">
                المشروع منشور لكن محافظه الـ 3 (عرض / سفير / احتياطي) لم تُنشَأ.
                طبّق <span className="font-mono bg-black/30 px-1 rounded">Migration 10.52</span> في
                Supabase SQL Editor لإنشائها تلقائياً.
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-xl p-3 flex items-center gap-2 text-xs text-yellow-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
            <span>لا توجد محفظة مرتبطة بعد. ستُنشأ تلقائياً عند نشر {isProject ? "المشروع" : "الشركة"}.</span>
          </div>
        )}
      </div>

      {/* Meta info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-purple-400" strokeWidth={1.5} />
            <div className="text-sm font-bold text-white">معلومات إضافية</div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-500">تاريخ الإنشاء</span>
              <span className="text-white font-mono">{entity.created_at}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">القطاع</span>
              <span className="text-white">{sectorIcon(entity.sector)} {entity.sector}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">الجودة</span>
              <span className="text-white">{entity.quality === "high" ? "★ عالية" : entity.quality === "medium" ? "متوسطة" : "منخفضة"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">{isProject ? "المشروع" : "الشركة"}</span>
              <span className="text-white">{isProject ? "تابع لشركة" : "كيان مستقلّ"}</span>
            </div>
          </div>
        </div>

        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-orange-400" strokeWidth={1.5} />
            <div className="text-sm font-bold text-white">التداول</div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-500">حالة التداول</span>
              <Badge
                label={entity.status === "active" ? "متاح" : "معلّق"}
                color={entity.status === "active" ? "green" : "yellow"}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">حصص قابلة للتداول</span>
              <span className="text-white font-mono">{fmtNum(entity.available_shares)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">القيمة السوقية</span>
              <span className="text-yellow-400 font-mono font-bold">{fmtNum(entity.share_price * entity.total_shares)} د.ع</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
        >
          العودة للقائمة
        </button>
        <ActionBtn label="✏️ تعديل البيانات" color="blue" onClick={onEdit} />
      </div>
    </div>
  )
}
