"use client"

import { useState } from "react"
import { TrendingUp, TrendingDown, Activity, Save } from "lucide-react"
import { SectionHeader, KPI, Table, THead, TH, TBody, TR, TD, AdminEmpty } from "@/components/admin/ui"
import { mockMarketStateAdvanced, mockMarketPriceHistory } from "@/lib/admin/mock-data"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

export function MarketStatePanel() {
  const [state, setState] = useState(mockMarketStateAdvanced)
  const [newPrice, setNewPrice] = useState(String(state.current_price))
  const [saving, setSaving] = useState(false)

  const overridePrice = () => {
    const p = parseInt(newPrice)
    if (!p || p <= 0) {
      showError("أدخل سعراً صحيحاً")
      return
    }
    if (!confirm(`تغيير السعر الحالي إلى ${fmtNum(p)} د.ع؟`)) return

    setSaving(true)
    setTimeout(() => {
      setState({ ...state, current_price: p, last_updated: new Date().toISOString() })
      showSuccess("تم تحديث السعر")
      setSaving(false)
    }, 800)
  }

  const isUp = state.daily_change_pct >= 0

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader title="📡 حالة السوق التفصيلية" subtitle="مراقبة وتعديل بيانات السوق المباشرة" />

      {/* Status banner */}
      <div className={cn(
        "rounded-2xl p-4 mb-5 flex items-center justify-between border",
        state.market_open ? "bg-green-400/[0.06] border-green-400/20" : "bg-red-400/[0.06] border-red-400/20"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn("w-3 h-3 rounded-full animate-pulse", state.market_open ? "bg-green-400" : "bg-red-400")} />
          <div>
            <div className={cn("text-sm font-bold", state.market_open ? "text-green-400" : "text-red-400")}>
              {state.market_open ? "السوق مفتوح" : "السوق مغلق"}
            </div>
            <div className="text-[11px] text-neutral-500">آخر تحديث: {state.last_updated}</div>
          </div>
        </div>
        <Activity className="w-6 h-6 text-neutral-400" strokeWidth={1.5} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="السعر الحالي" val={fmtNum(state.current_price) + " د.ع"} color="#FBBF24" />
        <KPI
          label="تغيّر اليوم"
          val={(isUp ? "+" : "") + state.daily_change_pct + "%"}
          color={isUp ? "#4ADE80" : "#F87171"}
        />
        <KPI label="حجم 24 ساعة" val={fmtNum(state.trading_volume_24h)} color="#60A5FA" />
        <KPI label="عدد الصفقات 24س" val={fmtNum(state.trades_count_24h)} color="#fff" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Override price */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-1">⚡ تعديل السعر يدوياً</div>
          <div className="text-[11px] text-neutral-500 mb-4">استخدم هذا لتجاوز السعر التلقائي في حالات الطوارئ</div>

          <label className="text-xs text-neutral-400 mb-1.5 block font-bold">السعر الجديد (د.ع)</label>
          <input
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 font-mono text-center mb-3"
            dir="ltr"
          />

          {parseInt(newPrice) > 0 && parseInt(newPrice) !== state.current_price && (
            <div className="text-[11px] text-yellow-400 mb-3">
              ⚠️ التغيير: <span className="font-mono">{state.current_price.toLocaleString("en-US")}</span> → <span className="font-mono">{parseInt(newPrice).toLocaleString("en-US")}</span>
              {" "}({((parseInt(newPrice) - state.current_price) / state.current_price * 100).toFixed(2)}%)
            </div>
          )}

          <button
            onClick={overridePrice}
            disabled={saving || parseInt(newPrice) === state.current_price}
            className={cn(
              "w-full py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
              parseInt(newPrice) !== state.current_price && !saving
                ? "bg-neutral-100 text-black hover:bg-neutral-200"
                : "bg-white/[0.05] text-neutral-600 cursor-not-allowed"
            )}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "جاري التحديث..." : "تأكيد التغيير"}
          </button>
        </div>

        {/* Market info */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">📊 معلومات السوق</div>
          <div className="space-y-2.5">
            {[
              { label: "السعر الأساسي", value: fmtNum(state.base_price) + " د.ع" },
              { label: "القيمة السوقية", value: fmtNum(state.market_cap) + " د.ع" },
              { label: "حجم التداول 24س", value: fmtNum(state.trading_volume_24h) + " د.ع" },
              { label: "عدد الصفقات 24س", value: fmtNum(state.trades_count_24h) },
            ].map((item, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-white/[0.04] last:border-0">
                <span className="text-xs text-neutral-500">{item.label}</span>
                <span className="text-xs font-bold text-white font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Price History */}
      <div className="mt-5">
        <div className="text-sm font-bold text-white mb-3">📈 سجل تاريخي للأسعار</div>
        {mockMarketPriceHistory.length === 0 ? (
          <AdminEmpty title="لا يوجد سجل" />
        ) : (
          <Table>
            <THead>
              <TH>التاريخ والوقت</TH>
              <TH>السعر</TH>
              <TH>التغيير</TH>
            </THead>
            <TBody>
              {mockMarketPriceHistory.map((h) => {
                const isUpRow = h.change >= 0
                return (
                  <TR key={h.id}>
                    <TD><span className="text-neutral-500 text-[11px]">{h.recorded_at}</span></TD>
                    <TD><span className="font-mono text-yellow-400 font-bold">{fmtNum(h.price)} د.ع</span></TD>
                    <TD>
                      <span className={cn(
                        "flex items-center gap-1 font-mono",
                        isUpRow ? "text-green-400" : "text-red-400"
                      )}>
                        {isUpRow ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isUpRow ? "+" : ""}{h.change}%
                      </span>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  )
}
