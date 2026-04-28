"use client"

import { useState, useEffect } from "react"
import { Bell, X, Check, Clock, User, Package, DollarSign } from "lucide-react"
import { useRealtime } from "@/lib/realtime/RealtimeProvider"
import { showSuccess, showInfo } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

export function DealRequestModal() {
  const { pendingDealAsSeller, acceptDeal, rejectDeal } = useRealtime()
  const [timeLeft, setTimeLeft] = useState(0)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!pendingDealAsSeller?.expires_at) return

    const calc = () => {
      const diff = new Date(pendingDealAsSeller.expires_at!).getTime() - Date.now()
      setTimeLeft(Math.max(0, Math.floor(diff / 1000)))
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [pendingDealAsSeller])

  // Auto-reject عند انتهاء الوقت
  useEffect(() => {
    if (pendingDealAsSeller && timeLeft === 0 && !processing) {
      rejectDeal(pendingDealAsSeller.id)
      showInfo("انتهى وقت الرد على الطلب")
    }
  }, [timeLeft, pendingDealAsSeller, rejectDeal, processing])

  if (!pendingDealAsSeller) return null

  const m = Math.floor(timeLeft / 60)
  const s = timeLeft % 60
  const countdown = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  const isUrgent = timeLeft < 60

  const handleAccept = async () => {
    setProcessing(true)
    showSuccess("✅ تمت الموافقة! جارٍ فتح الدردشة...")
    await acceptDeal(pendingDealAsSeller.id)
    setProcessing(false)
  }

  const handleReject = async () => {
    setProcessing(true)
    await rejectDeal(pendingDealAsSeller.id)
    showInfo("تم رفض الطلب")
    setProcessing(false)
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] border-2 border-yellow-400/40 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300">

        {/* Header with countdown */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-yellow-400/15 border border-yellow-400/40 flex items-center justify-center animate-pulse">
              <Bell className="w-5 h-5 text-yellow-400" strokeWidth={2} />
            </div>
            <div>
              <div className="text-base font-bold text-white">طلب صفقة جديد!</div>
              <div className="text-[11px] text-neutral-500">يحتاج ردك خلال 5 دقائق</div>
            </div>
          </div>
          <div className={cn(
            "px-3 py-1.5 rounded-lg font-mono text-xs font-bold border flex items-center gap-1.5",
            isUrgent
              ? "bg-red-400/15 border-red-400/40 text-red-400 animate-pulse"
              : "bg-white/[0.06] border-white/[0.1] text-neutral-300"
          )}>
            <Clock className="w-3 h-3" />
            {countdown}
          </div>
        </div>

        {/* Buyer info */}
        <div className="bg-blue-400/[0.06] border border-blue-400/20 rounded-xl p-3.5 mb-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 border-2 border-blue-400/30 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {pendingDealAsSeller.buyer_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-blue-400 font-bold mb-0.5">المشتري</div>
            <div className="text-sm font-bold text-white truncate">{pendingDealAsSeller.buyer_name}</div>
          </div>
          <User className="w-5 h-5 text-blue-400 flex-shrink-0" strokeWidth={1.5} />
        </div>

        {/* Deal details */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-neutral-500" strokeWidth={1.5} />
              <span className="text-xs text-neutral-500">المشروع</span>
            </div>
            <span className="text-sm font-bold text-white">{pendingDealAsSeller.project_name}</span>
          </div>

          <div className="h-px bg-white/[0.05]" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">عدد الحصص</span>
            </div>
            <span className="text-sm font-bold text-green-400 font-mono">{pendingDealAsSeller.shares} حصة</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">سعر الحصة</span>
            <span className="text-sm font-bold text-white font-mono">{fmtNum(pendingDealAsSeller.price_per_share)} د.ع</span>
          </div>

          <div className="h-px bg-white/[0.05]" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-yellow-400" strokeWidth={1.5} />
              <span className="text-xs font-bold text-yellow-400">الإجمالي</span>
            </div>
            <span className="text-base font-bold text-yellow-400 font-mono">
              {fmtNum(pendingDealAsSeller.total)} د.ع
            </span>
          </div>
        </div>

        {/* Info note */}
        <div className="bg-blue-400/[0.04] border border-blue-400/15 rounded-lg p-2.5 mb-4 text-[11px] text-neutral-400 leading-relaxed">
          💡 إذا وافقت، ستُفتح غرفة دردشة مدتها 15 دقيقة للتفاوض وإتمام الصفقة.
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleReject}
            disabled={processing}
            className="flex-1 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-neutral-300 text-sm font-bold hover:bg-white/[0.08] hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <X className="w-4 h-4" strokeWidth={2} />
            رفض
          </button>
          <button
            onClick={handleAccept}
            disabled={processing}
            className="flex-[2] py-3.5 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-bold hover:from-green-600 hover:to-green-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-green-500/20"
          >
            <Check className="w-4 h-4" strokeWidth={2.5} />
            {processing ? "جاري المعالجة..." : "موافقة وفتح الدردشة"}
          </button>
        </div>
      </div>
    </div>
  )
}
