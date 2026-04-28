"use client"

import { useState } from "react"
import { Clock, X, CheckCircle, ChevronDown, ChevronUp } from "lucide-react"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"
import {
  cancelAmbassadorApplication,
  estimateReviewProgress,
} from "@/lib/mock-data/ambassadors"
import type { AmbassadorApplicationData } from "@/lib/mock-data/types"

const SOCIAL_ICONS: Record<string, string> = {
  instagram: "📸",
  twitter: "🐦",
  tiktok: "🎵",
  linkedin: "💼",
}

export function PendingStatus({
  application,
  onCancelled,
}: {
  application: AmbassadorApplicationData | null
  onCancelled: () => void
}) {
  const [showDetails, setShowDetails] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const submittedAt = application?.submitted_at || new Date().toISOString()
  const progress = estimateReviewProgress(submittedAt, 5)
  const progressPct = Math.round(progress * 100)

  const handleCancel = async () => {
    setCancelling(true)
    const result = cancelAmbassadorApplication("me")
    setCancelling(false)
    if (result.success) {
      showSuccess("تم إلغاء طلبك. يمكنك التقديم مجدداً في أي وقت.")
      setShowCancelConfirm(false)
      onCancelled()
    } else {
      showError("تعذّر إلغاء الطلب")
    }
  }

  const TIMELINE_STEPS = [
    { id: "submitted",  label: "تم التقديم",       icon: "✅", state: "done"   as const },
    { id: "reviewing",  label: "قيد المراجعة",     icon: "⏳", state: "active" as const },
    { id: "decision",   label: "القرار النهائي",    icon: "⏳", state: "wait"   as const },
    { id: "activation", label: "تفعيل الحساب",      icon: "⏳", state: "wait"   as const },
  ]

  return (
    <>
      {/* Hero — pending */}
      <div className="bg-gradient-to-br from-yellow-400/[0.1] via-orange-400/[0.04] to-transparent border border-yellow-400/[0.3] rounded-2xl p-8 mb-5 text-center">
        <div className="w-20 h-20 rounded-2xl bg-yellow-400/[0.12] border-2 border-yellow-400/[0.3] flex items-center justify-center mx-auto mb-4">
          <Clock className="w-10 h-10 text-yellow-400 animate-pulse" strokeWidth={1.5} />
        </div>
        <div className="text-lg font-bold text-white mb-2">طلبك قيد المراجعة</div>
        <div className="text-xs text-neutral-300 max-w-md mx-auto leading-relaxed">
          سيتم التواصل معك قريباً. عادة المراجعة تأخذ <span className="text-white font-bold">3-5 أيام عمل</span>.
        </div>
      </div>

      {/* Application details (collapsible) */}
      {application && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl mb-3">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full p-4 flex items-center justify-between gap-3 text-right hover:bg-white/[0.02] transition-colors"
          >
            <div>
              <div className="text-sm font-bold text-white">📋 تفاصيل طلبك</div>
              <div className="text-[11px] text-neutral-500 mt-0.5">
                مقدّم في {application.submitted_at}
              </div>
            </div>
            {showDetails ? (
              <ChevronUp className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
            )}
          </button>

          {showDetails && (
            <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05] pt-3">
              <div>
                <div className="text-[11px] font-bold text-neutral-400 mb-1">السبب</div>
                <div className="text-xs text-neutral-200 leading-relaxed">{application.reason}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-neutral-400 mb-1">الخبرة</div>
                <div className="text-xs text-neutral-200 leading-relaxed">{application.experience}</div>
              </div>
              {application.social_links.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-neutral-400 mb-1.5">حسابات التواصل</div>
                  <div className="flex flex-wrap gap-1.5">
                    {application.social_links.map((s, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1 text-[11px] text-neutral-300"
                      >
                        <span>{SOCIAL_ICONS[s.platform] || "🔗"}</span>
                        <span className="font-mono" dir="ltr">{s.url}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/[0.05]">
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">شريحة المتابعين</div>
                  <div className="text-[11px] text-white">{application.follower_range}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">إحالات متوقّعة</div>
                  <div className="text-[11px] text-white">{application.expected_referrals}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
        <div className="text-[11px] font-bold text-neutral-400 mb-3">📍 ماذا بعد؟</div>
        <div className="space-y-3">
          {TIMELINE_STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-full border flex items-center justify-center text-sm flex-shrink-0",
                step.state === "done"   && "bg-green-400/[0.12] border-green-400/[0.3]",
                step.state === "active" && "bg-yellow-400/[0.12] border-yellow-400/[0.3]",
                step.state === "wait"   && "bg-white/[0.04] border-white/[0.08]"
              )}>
                {step.state === "done" ? (
                  <CheckCircle className="w-4 h-4 text-green-400" strokeWidth={2} />
                ) : step.state === "active" ? (
                  <Clock className="w-4 h-4 text-yellow-400 animate-pulse" strokeWidth={1.5} />
                ) : (
                  <span className="text-neutral-600">{i + 1}</span>
                )}
              </div>
              <span className={cn(
                "text-sm",
                step.state === "done"   && "text-green-400 font-bold",
                step.state === "active" && "text-yellow-400 font-bold",
                step.state === "wait"   && "text-neutral-500"
              )}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Estimated time + progress */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[11px] font-bold text-neutral-400">⏱ المدة المتوقّعة</div>
            <div className="text-sm text-white font-bold mt-0.5">3-5 أيام عمل</div>
          </div>
          <div className="text-2xl font-bold text-yellow-400 font-mono">{progressPct}%</div>
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Cancel button */}
      <button
        onClick={() => setShowCancelConfirm(true)}
        className="w-full py-3 rounded-xl bg-red-400/[0.05] border border-red-400/[0.2] text-red-400 text-xs font-medium hover:bg-red-400/[0.1] transition-colors"
      >
        ❌ إلغاء الطلب
      </button>

      {/* Cancel confirm */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">❌ إلغاء الطلب</div>
              <button onClick={() => setShowCancelConfirm(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-neutral-300 mb-4 leading-relaxed">
              هل أنت متأكد؟ سيتم حذف طلبك. يمكنك التقديم مجدداً في أي وقت لاحقاً.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelling}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                تراجع
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-3 rounded-xl bg-red-500/[0.15] border border-red-500/[0.3] text-red-400 text-sm font-bold hover:bg-red-500/[0.2] disabled:opacity-50"
              >
                {cancelling ? "جاري الإلغاء..." : "تأكيد الإلغاء"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
