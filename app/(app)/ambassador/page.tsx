"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, Share2, Check, Users, TrendingUp, Award, Coins, MousePointerClick, Star } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

import {
  mockMarketer,
  mockReferrals,
  mockRewards,
  getCurrentUserAmbassadorStatus,
  type CurrentAmbassadorStatus,
} from "@/lib/mock-data"

import { ApplicationForm } from "@/components/ambassador/ApplicationForm"
import { PendingStatus } from "@/components/ambassador/PendingStatus"
import { RejectedStatus } from "@/components/ambassador/RejectedStatus"

export default function AmbassadorPage() {
  // Read initial state from canonical user profile.
  // To test other states: edit `lib/mock-data/profile.ts` → CURRENT_USER.ambassador_status
  const initial = getCurrentUserAmbassadorStatus("me")
  const [status, setStatus] = useState<CurrentAmbassadorStatus>(initial.status)
  const [application] = useState(initial.application)

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader
            title="🌟 انضم لبرنامج سفير رايلوس"
            subtitle={
              status === "approved"  ? "لوحة تحكّم السفير + رابط الإحالة" :
              status === "pending"   ? "طلبك قيد المراجعة" :
              status === "rejected"  ? "نأسف، تم رفض طلبك" :
              status === "suspended" ? "تم إيقاف حسابك مؤقّتاً" :
              "كن سفيراً واكسب مكافآت من إحالاتك"
            }
          />

          {status === "none" && (
            <ApplicationForm onSubmitted={() => setStatus("pending")} />
          )}

          {status === "pending" && (
            <PendingStatus
              application={application}
              onCancelled={() => setStatus("none")}
            />
          )}

          {status === "rejected" && (
            <RejectedStatus
              rejectionReason={application?.rejection_reason}
              onRetry={() => setStatus("none")}
            />
          )}

          {status === "suspended" && <SuspendedStatus />}

          {status === "approved" && <ApprovedDashboard />}

        </div>
      </div>
    </AppLayout>
  )
}

// ─── Suspended state ──────────────────────────────────
function SuspendedStatus() {
  return (
    <>
      <div className="bg-gradient-to-br from-red-400/[0.08] to-transparent border border-red-400/[0.2] rounded-2xl p-8 mb-5 text-center">
        <div className="w-20 h-20 rounded-2xl bg-red-400/[0.1] border-2 border-red-400/[0.3] flex items-center justify-center mx-auto mb-4">
          <Star className="w-10 h-10 text-red-400" strokeWidth={1.5} />
        </div>
        <div className="text-lg font-bold text-white mb-2">حسابك كسفير مُوقَف مؤقّتاً</div>
        <div className="text-xs text-neutral-300 max-w-md mx-auto leading-relaxed">
          يرجى التواصل مع الدعم الفني للحصول على التفاصيل.
        </div>
      </div>
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
        <div className="bg-red-400/[0.06] border border-red-400/[0.2] rounded-xl p-4">
          <div className="text-[11px] text-neutral-400 mb-1.5">السبب</div>
          <div className="text-sm text-red-400 leading-relaxed">
            {mockMarketer.rejection_reason || "يرجى التواصل مع الدعم الفني للحصول على التفاصيل."}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Approved Dashboard ──────────────────────────────
function ApprovedDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<"overview" | "referrals" | "rewards">("overview")
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(mockMarketer.referral_link)
      setCopied(true)
      showSuccess("تم نسخ الرابط")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showError("تعذّر النسخ")
    }
  }

  const shareLink = async () => {
    if (typeof navigator !== "undefined" && (navigator as { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> }).share) {
      try {
        await (navigator as { share: (data: { title?: string; text?: string; url?: string }) => Promise<void> }).share({
          title: "انضم إلى رايلوس",
          text: "سجّل عبر رابطي في رايلوس للاستثمار في حصص المشاريع",
          url: mockMarketer.referral_link,
        })
      } catch {}
    } else {
      copyLink()
    }
  }

  return (
    <>
      <div className="bg-gradient-to-br from-yellow-400/[0.12] to-transparent border border-yellow-400/[0.3] rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-yellow-400/[0.15] border border-yellow-400/[0.3] flex items-center justify-center">
            <Star className="w-4 h-4 text-yellow-400" fill="currentColor" strokeWidth={1} />
          </div>
          <div className="text-sm font-bold text-white">سفير رايلوس</div>
        </div>
        <div className="text-xs text-neutral-300 leading-relaxed">
          أنت الآن سفير رايلوس معتمد. شارك رابطك وستحصل على{" "}
          <span className="text-yellow-400 font-bold">2% من حصص أول استثمار</span>{" "}
          يقوم به كل شخص يسجّل عبره.
        </div>
      </div>

      {/* Referral link card */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
        <div className="text-[11px] text-neutral-500 mb-2 font-bold tracking-wider uppercase">
          رابط الإحالة الخاص بك
        </div>
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 flex items-center gap-2">
          <div className="flex-1 text-xs text-white font-mono truncate" dir="ltr">
            {mockMarketer.referral_link}
          </div>
          <button
            onClick={copyLink}
            className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center transition-colors flex-shrink-0"
            title="نسخ"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" strokeWidth={2} />
            ) : (
              <Copy className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
            )}
          </button>
          <button
            onClick={shareLink}
            className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center transition-colors flex-shrink-0"
            title="مشاركة"
          >
            <Share2 className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
          </button>
        </div>
        <div className="text-[11px] text-neutral-400 mt-2 text-center">
          كود السفير:{" "}
          <span className="text-yellow-400 font-bold tracking-widest">
            {mockMarketer.referral_code}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        {[
          { label: "النقرات", value: mockMarketer.total_clicks, icon: MousePointerClick, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
          { label: "التسجيلات", value: mockMarketer.total_signups, icon: Users, color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/20" },
          { label: "المستثمرون", value: mockMarketer.total_investors, icon: TrendingUp, color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20" },
          { label: "حصص المكافآت", value: mockMarketer.total_rewards_shares, icon: Coins, color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20" },
        ].map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <div key={i} className={cn("rounded-xl p-3.5 border", kpi.bg, kpi.border)}>
              <Icon className={cn("w-4 h-4 mb-2", kpi.color)} strokeWidth={1.5} />
              <div className={cn("text-2xl font-bold", kpi.color)}>{kpi.value}</div>
              <div className="text-[10px] text-neutral-400 mt-0.5">{kpi.label}</div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.05] border border-white/[0.08] rounded-xl p-1 mb-4">
        {[
          { key: "overview" as const, label: "نظرة عامة" },
          { key: "referrals" as const, label: `الإحالات (${mockReferrals.length})` },
          { key: "rewards" as const, label: `المكافآت (${mockRewards.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 py-2 rounded-lg text-[11px] transition-colors",
              tab === t.key
                ? "bg-white/[0.08] text-white font-bold border border-white/[0.1]"
                : "text-neutral-500 hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
          <div className="text-[11px] text-neutral-500 mb-3 font-bold tracking-wider uppercase">
            كيف يعمل البرنامج
          </div>
          {[
            { n: 1, title: "شارك رابطك", body: "عبر وسائل التواصل أو رسائل مباشرة." },
            { n: 2, title: "تسجيل عبر رابطك", body: "كل زائر يسجّل عبر رابطك يُربط بحسابك تلقائياً." },
            { n: 3, title: "أول استثمار", body: "عند إتمام أول صفقة استثمار، يتم حجز 2% حصص كمكافأة." },
            { n: 4, title: "اعتماد المكافأة", body: "بعد التأكد من عدم وجود نزاع، تُضاف الحصص إلى محفظتك." },
          ].map((s) => (
            <div key={s.n} className="flex gap-3 items-start mb-4 last:mb-0">
              <div className="w-7 h-7 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-xs font-bold text-yellow-400 flex-shrink-0">
                {s.n}
              </div>
              <div>
                <div className="text-sm font-bold text-white mb-0.5">{s.title}</div>
                <div className="text-xs text-neutral-400 leading-relaxed">{s.body}</div>
              </div>
            </div>
          ))}
          <button
            onClick={() => router.push("/portfolio?tab=fee_units")}
            className="w-full mt-2 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-xs hover:bg-white/[0.08] transition-colors"
          >
            عرض رصيد الحصص في المحفظة
          </button>
        </div>
      )}

      {/* Referrals tab */}
      {tab === "referrals" && (
        mockReferrals.length === 0 ? (
          <div className="text-center py-12 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
            <Users className="w-12 h-12 text-neutral-600 mx-auto mb-3" strokeWidth={1.5} />
            <div className="text-sm font-bold text-white mb-1">لا توجد إحالات بعد</div>
            <div className="text-xs text-neutral-500">عندما يسجّل شخص عبر رابطك، سيظهر هنا</div>
          </div>
        ) : (
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl divide-y divide-white/[0.04]">
            {mockReferrals.map((r) => (
              <div key={r.id} className="p-3.5 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-sm font-bold text-neutral-400 flex-shrink-0">
                    {r.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white truncate">{r.name}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      {r.created_at}
                      {r.kyc_status === "verified" && " • تم التحقق"}
                    </div>
                  </div>
                </div>
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap",
                    r.reward_given
                      ? "bg-yellow-400/15 border-yellow-400/35 text-yellow-400"
                      : r.status === "invested"
                      ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-400"
                      : r.status === "registered"
                      ? "bg-blue-400/10 border-blue-400/20 text-blue-400"
                      : "bg-white/[0.06] border-white/[0.08] text-neutral-500"
                  )}
                >
                  {r.reward_given
                    ? "مكافأة مستلمة"
                    : r.status === "invested"
                    ? "استثمر"
                    : r.status === "registered"
                    ? "مسجّل"
                    : "نقرة"}
                </span>
              </div>
            ))}
          </div>
        )
      )}

      {/* Rewards tab */}
      {tab === "rewards" && (
        mockRewards.length === 0 ? (
          <div className="text-center py-12 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
            <Award className="w-12 h-12 text-neutral-600 mx-auto mb-3" strokeWidth={1.5} />
            <div className="text-sm font-bold text-white mb-1">لا توجد مكافآت بعد</div>
            <div className="text-xs text-neutral-500">ستظهر فور إتمام أول استثمار</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: "الإجمالي", value: mockRewards.reduce((s, r) => s + r.shares, 0), color: "text-orange-400" },
                { label: "مُعتمدة", value: mockRewards.filter((r) => r.status === "approved").reduce((s, r) => s + r.shares, 0), color: "text-green-400" },
                { label: "قيد الانتظار", value: mockRewards.filter((r) => r.status === "pending").reduce((s, r) => s + r.shares, 0), color: "text-yellow-400" },
              ].map((s, i) => (
                <div key={i} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 text-center">
                  <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
                  <div className="text-[10px] text-neutral-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl divide-y divide-white/[0.04]">
              {mockRewards.map((r) => (
                <div key={r.id} className="p-3.5 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <Coins className="w-4 h-4 text-orange-400" strokeWidth={1.5} />
                    <div>
                      <div className="text-sm font-bold text-white">{r.shares} حصة</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">
                        {r.project_name} • {r.created_at}
                      </div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "px-2.5 py-0.5 rounded-md text-[10px] font-bold border",
                      r.status === "approved"
                        ? "bg-green-400/10 border-green-400/20 text-green-400"
                        : "bg-yellow-400/10 border-yellow-400/20 text-yellow-400"
                    )}
                  >
                    {r.status === "approved" ? "✓ مُعتمدة" : "⏳ قيد الانتظار"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )
      )}
    </>
  )
}
