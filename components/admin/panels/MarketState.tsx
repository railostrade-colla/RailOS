"use client"

/**
 * System-wide market state panel (Phase 10.37).
 *
 * Replaces the all-mock implementation that surfaced fake numbers
 * (45.2M volume, 87 trades, 100K price). Now reads from the
 * `system_market_state` singleton + 24h aggregates from `deals` +
 * recent rows from `price_history` via the get_system_market_state
 * RPC. The "manual price override" was a per-project concern that
 * lived in the wrong panel; replaced with the proper system-wide
 * "open / close market" toggle.
 */

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, Activity, Power, X } from "lucide-react"
import { SectionHeader, KPI, Table, THead, TH, TBody, TR, TD, AdminEmpty } from "@/components/admin/ui"
import {
  getSystemMarketState,
  setSystemMarketOpen,
  type SystemMarketState,
} from "@/lib/data/system-market"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

const EMPTY_STATE: SystemMarketState = {
  market_open: true,
  updated_at: new Date().toISOString(),
  last_change_reason: null,
  trading_volume_24h: 0,
  trades_count_24h: 0,
  price_history: [],
}

export function MarketStatePanel() {
  const [state, setState] = useState<SystemMarketState>(EMPTY_STATE)
  const [loading, setLoading] = useState(true)

  // Toggle modal
  const [showToggle, setShowToggle] = useState(false)
  const [toggleReason, setToggleReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const reload = () => {
    setLoading(true)
    getSystemMarketState(20).then((s) => {
      setState(s)
      setLoading(false)
    })
  }

  useEffect(() => {
    reload()
  }, [])

  const handleToggle = async () => {
    if (!toggleReason.trim()) {
      showError("اكتب سبب التغيير")
      return
    }
    setSubmitting(true)
    const result = await setSystemMarketOpen(!state.market_open, toggleReason.trim())
    setSubmitting(false)
    if (!result.success) {
      const map: Record<string, string> = {
        not_admin: "صلاحياتك لا تسمح",
        invalid_input: "المدخلات غير صحيحة",
        missing_table: "الـ migration غير منشورة — طبّق Migration 10.37",
        rls: "ممنوع بسبب RLS",
      }
      showError(map[result.reason ?? ""] ?? "فشل التغيير")
      return
    }
    showSuccess(state.market_open ? "🔴 تم إغلاق السوق" : "🟢 تم فتح السوق")
    setShowToggle(false)
    setToggleReason("")
    reload()
  }

  const formattedTimestamp = (() => {
    try {
      return new Date(state.updated_at).toLocaleString("en-GB")
    } catch {
      return state.updated_at
    }
  })()

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader title="📡 حالة السوق التفصيلية" subtitle="مراقبة وتعديل بيانات السوق المباشرة" />

      {/* Status banner */}
      <div className={cn(
        "rounded-2xl p-4 mb-5 flex items-center justify-between border",
        state.market_open ? "bg-green-400/[0.06] border-green-400/20" : "bg-red-400/[0.06] border-red-400/20",
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-3 h-3 rounded-full animate-pulse",
            state.market_open ? "bg-green-400" : "bg-red-400",
          )} />
          <div>
            <div className={cn(
              "text-sm font-bold",
              state.market_open ? "text-green-400" : "text-red-400",
            )}>
              {loading ? "جاري التحميل..." : state.market_open ? "السوق مفتوح" : "السوق مغلق"}
            </div>
            <div className="text-[11px] text-neutral-500" dir="ltr">
              آخر تحديث: {formattedTimestamp}
            </div>
            {state.last_change_reason && (
              <div className="text-[11px] text-neutral-400 mt-0.5">
                السبب: {state.last_change_reason}
              </div>
            )}
          </div>
        </div>
        <Activity className="w-6 h-6 text-neutral-400" strokeWidth={1.5} />
      </div>

      {/* KPIs — only the metrics that have a real system-wide meaning */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
        <KPI
          label="حجم التداول 24س"
          val={fmtNum(state.trading_volume_24h) + " د.ع"}
          color="#60A5FA"
        />
        <KPI
          label="عدد الصفقات 24س"
          val={fmtNum(state.trades_count_24h)}
          color="#fff"
        />
      </div>

      {/* Open/close toggle card — replaces the per-project price override
          which never belonged here. */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-sm font-bold text-white mb-1">
              ⚡ {state.market_open ? "إغلاق السوق" : "فتح السوق"}
            </div>
            <div className="text-[11px] text-neutral-500 leading-relaxed max-w-md">
              {state.market_open
                ? "إيقاف كل الصفقات والمزادات على مستوى المنصة. يُستخدم للصيانة الطارئة أو في حال اكتشاف خلل في محرّك الأسعار."
                : "إعادة فتح السوق لجميع المستخدمين. تأكّد من حلّ السبب الذي أدّى للإغلاق قبل التفعيل."}
            </div>
          </div>
          <button
            onClick={() => setShowToggle(true)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border whitespace-nowrap",
              state.market_open
                ? "bg-red-500/[0.15] border-red-500/[0.3] text-red-400 hover:bg-red-500/[0.2]"
                : "bg-green-500/[0.15] border-green-500/[0.3] text-green-400 hover:bg-green-500/[0.2]",
            )}
          >
            <Power className="w-4 h-4" strokeWidth={2} />
            {state.market_open ? "إغلاق" : "فتح"}
          </button>
        </div>
      </div>

      {/* Price history — real rows joined to project names */}
      <div>
        <div className="text-sm font-bold text-white mb-3">📈 آخر تغيّرات الأسعار</div>
        {loading ? (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl py-12 text-center text-xs text-neutral-500">
            جاري التحميل...
          </div>
        ) : state.price_history.length === 0 ? (
          <AdminEmpty
            title="لا توجد تغيّرات أسعار بعد"
            body="بمجرد أن يبدأ التداول الفعلي على أي مشروع، ستظهر التحرّكات هنا."
          />
        ) : (
          <Table>
            <THead>
              <TH>التاريخ والوقت</TH>
              <TH>المشروع</TH>
              <TH>السعر السابق</TH>
              <TH>السعر الجديد</TH>
              <TH>التغيّر</TH>
            </THead>
            <TBody>
              {state.price_history.map((h) => {
                const isUpRow = Number(h.change_pct) >= 0
                return (
                  <TR key={h.id}>
                    <TD>
                      <span className="text-neutral-500 text-[11px]" dir="ltr">
                        {(() => {
                          try { return new Date(h.recorded_at).toLocaleString("en-GB") }
                          catch { return h.recorded_at }
                        })()}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-xs text-white">{h.project_name}</span>
                    </TD>
                    <TD>
                      <span className="font-mono text-neutral-400">{fmtNum(Number(h.old_price))}</span>
                    </TD>
                    <TD>
                      <span className="font-mono text-yellow-400 font-bold">{fmtNum(Number(h.new_price))}</span>
                    </TD>
                    <TD>
                      <span className={cn(
                        "flex items-center gap-1 font-mono",
                        isUpRow ? "text-green-400" : "text-red-400",
                      )}>
                        {isUpRow ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isUpRow ? "+" : ""}{Number(h.change_pct).toFixed(2)}%
                      </span>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </div>

      {/* Toggle confirmation modal */}
      {showToggle && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={cn(
            "bg-[#0a0a0a] border rounded-2xl p-6 w-full max-w-md",
            state.market_open ? "border-red-400/[0.3]" : "border-green-400/[0.3]",
          )}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <Power className={cn("w-5 h-5", state.market_open ? "text-red-400" : "text-green-400")} />
                <div className="text-base font-bold text-white">
                  {state.market_open ? "🔴 إغلاق السوق" : "🟢 فتح السوق"}
                </div>
              </div>
              <button onClick={() => setShowToggle(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={cn(
              "rounded-xl p-3 mb-4 text-xs leading-relaxed",
              state.market_open
                ? "bg-red-400/[0.05] border border-red-400/[0.2] text-red-300"
                : "bg-green-400/[0.05] border border-green-400/[0.2] text-green-300",
            )}>
              {state.market_open
                ? "⚠️ سيتم إيقاف كل الصفقات والمزادات على مستوى المنصة فوراً. كل المستخدمين سيرَون باناّر الإغلاق."
                : "✅ سيُعاد تفعيل التداول لجميع المستخدمين فوراً."}
            </div>

            <div className="mb-4">
              <label className="text-xs text-neutral-400 mb-1.5 block">
                سبب التغيير * (سيُسجَّل في سجلّ التدقيق)
              </label>
              <textarea
                value={toggleReason}
                onChange={(e) => setToggleReason(e.target.value)}
                rows={3}
                placeholder={state.market_open ? "مثال: صيانة طارئة لمحرّك الأسعار" : "مثال: انتهت الصيانة"}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/20 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowToggle(false)}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={handleToggle}
                disabled={submitting || !toggleReason.trim()}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold border disabled:opacity-50 disabled:cursor-not-allowed",
                  state.market_open
                    ? "bg-red-500/[0.15] border-red-500/[0.3] text-red-400 hover:bg-red-500/[0.2]"
                    : "bg-green-500/[0.15] border-green-500/[0.3] text-green-400 hover:bg-green-500/[0.2]",
                )}
              >
                {submitting ? "جارٍ..." : state.market_open ? "تأكيد الإغلاق" : "تأكيد الفتح"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
