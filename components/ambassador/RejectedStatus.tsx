"use client"

import { XCircle, Lightbulb, RefreshCw } from "lucide-react"

const IMPROVEMENT_TIPS = [
  { icon: "💡", title: "زيادة الخبرة",      body: "اكتسب خبرة أكبر في التسويق الرقمي أو الاستثمار." },
  { icon: "📱", title: "بناء حضور رقمي",   body: "ركّز على بناء حساباتك الاجتماعية وزيادة المتابعين الفعّالين." },
  { icon: "📊", title: "تطوير خطة واضحة", body: "حدّد جمهوراً مستهدَفاً واستراتيجية تسويقية مكتوبة." },
  { icon: "⏰", title: "أعد المحاولة",     body: "يمكنك إعادة التقديم بعد 30 يوماً من تاريخ الرفض." },
]

export function RejectedStatus({
  rejectionReason,
  onRetry,
}: {
  rejectionReason?: string
  onRetry: () => void
}) {
  return (
    <>
      {/* Hero — rejected */}
      <div className="bg-gradient-to-br from-red-400/[0.08] to-transparent border border-red-400/[0.2] rounded-2xl p-8 mb-5 text-center">
        <div className="w-20 h-20 rounded-2xl bg-red-400/[0.1] border-2 border-red-400/[0.3] flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-10 h-10 text-red-400" strokeWidth={1.5} />
        </div>
        <div className="text-lg font-bold text-white mb-2">نأسف، تم رفض طلبك</div>
        <div className="text-xs text-neutral-300 max-w-md mx-auto leading-relaxed">
          لم تتم الموافقة على طلبك في هذه المرة. لا تستسلم — يمكنك تطوير ملفك وإعادة التقديم.
        </div>
      </div>

      {/* Rejection reason */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
        <div className="text-[11px] font-bold text-neutral-400 mb-2">📝 سبب الرفض</div>
        <div className="bg-red-400/[0.06] border border-red-400/[0.2] rounded-xl p-3.5">
          <div className="text-sm text-red-400 leading-relaxed">
            {rejectionReason?.trim() || "لم يُقدَّم سبب محدد. يرجى مراجعة بيانات الطلب وتطوير ملفك قبل إعادة التقديم."}
          </div>
        </div>
      </div>

      {/* Tips card */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-yellow-400" strokeWidth={2} />
          <div className="text-[11px] font-bold text-neutral-400">ماذا يمكنك فعله؟</div>
        </div>
        <div className="space-y-3">
          {IMPROVEMENT_TIPS.map((tip, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-base flex-shrink-0">
                {tip.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white mb-0.5">{tip.title}</div>
                <div className="text-xs text-neutral-400 leading-relaxed">{tip.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Retry button */}
      <button
        onClick={onRetry}
        className="w-full py-3.5 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
      >
        <RefreshCw className="w-4 h-4" strokeWidth={2} />
        📝 تقديم طلب جديد
      </button>
    </>
  )
}
