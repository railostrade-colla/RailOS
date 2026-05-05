"use client"

/**
 * UserDetailsModal — Phase 10.64.
 *
 * Fetches `get_user_full_details(user_id)` and renders all sections:
 *   • Profile basics (name, username, phone, email, role, level)
 *   • Account state (active / banned / suspended-until)
 *   • KYC summary (latest submission)
 *   • Investment summary (holdings + value + deals + completed)
 *   • Ambassador status (live row from public.ambassadors)
 *   • Ratings (avg + count from public.ratings)
 *
 * Read-only — actions (ban/unban/ambassador) are on the parent panel.
 */

import { useEffect, useState } from "react"
import { X, User, Shield, Wallet, Star, Crown, Ban } from "lucide-react"
import { Badge } from "@/components/admin/ui"
import {
  getUserFullDetails,
  type AdminUserFullDetails,
} from "@/lib/data/admin-utilities"

const fmtNum = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("en-US")
const fmtMoney = (n: number | null | undefined) => fmtNum(n) + " د.ع"
const fmtDate = (iso: string | null | undefined) =>
  iso ? iso.replace("T", " ").slice(0, 16) : "—"
const fmtShort = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10) : "—"

const LEVEL_LABEL: Record<string, string> = {
  basic: "أساسي",
  advanced: "متقدّم",
  pro: "محترف",
  elite: "نخبة",
}

const KYC_LABEL: Record<string, { label: string; color: "green" | "yellow" | "red" | "gray" }> = {
  approved:      { label: "موثَّق",       color: "green"  },
  pending:       { label: "قيد المراجعة", color: "yellow" },
  rejected:      { label: "مرفوض",       color: "red"    },
  not_submitted: { label: "لم يُقدِّم",   color: "gray"   },
}

interface Props {
  userId: string
  onClose: () => void
}

export function UserDetailsModal({ userId, onClose }: Props) {
  const [details, setDetails] = useState<AdminUserFullDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getUserFullDetails(userId).then((d) => {
      if (cancelled) return
      setDetails(d)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [userId])

  const profile = details?.profile
  const kyc = details?.kyc
  const ambassador = details?.ambassador
  const isBannedNow = profile?.is_banned ||
    (profile?.banned_until && new Date(profile.banned_until) > new Date())

  const kycMeta = profile ? (KYC_LABEL[profile.kyc_status] ?? KYC_LABEL.not_submitted) : KYC_LABEL.not_submitted

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-400/[0.15] border border-blue-400/[0.3] flex items-center justify-center">
              <User className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                {profile?.full_name ?? "تفاصيل المستخدم"}
              </div>
              <div className="text-[10px] text-neutral-500" dir="ltr">
                {details?.email ?? "—"}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="text-center py-12 text-xs text-neutral-500">
              جاري التحميل...
            </div>
          ) : !profile ? (
            <div className="text-center py-12">
              <div className="text-sm text-red-400 font-bold mb-1">
                ⚠ تعذّر جلب البيانات
              </div>
              <div className="text-[11px] text-neutral-500">
                إمّا أن المستخدم غير موجود، أو الـ RPC غير منشورة، أو RLS يحجب القراءة.
              </div>
            </div>
          ) : (
            <>
              {/* Account state banner */}
              {isBannedNow && (
                <div className="bg-red-400/[0.08] border border-red-400/[0.3] rounded-xl p-3 flex items-start gap-2.5">
                  <Ban className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-red-400 mb-0.5">
                      الحساب محظور
                      {profile.banned_until && (
                        <span className="text-[10px] text-red-300 mr-2">
                          (حتى {fmtShort(profile.banned_until)})
                        </span>
                      )}
                    </div>
                    {profile.ban_reason && (
                      <div className="text-[11px] text-red-200 leading-relaxed">
                        السبب: {profile.ban_reason}
                      </div>
                    )}
                    {profile.suspended_at && (
                      <div className="text-[10px] text-red-300/70 mt-1" dir="ltr">
                        منذ {fmtDate(profile.suspended_at)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section 1: Profile basics */}
              <Section title="المعلومات الأساسية" icon={<User className="w-3.5 h-3.5" />}>
                <Field label="الاسم" value={profile.full_name ?? "—"} />
                <Field label="username" value={profile.username ? `@${profile.username}` : "—"} dir="ltr" />
                <Field label="البريد" value={details?.email ?? "—"} dir="ltr" />
                <Field label="الهاتف" value={profile.phone ?? "—"} dir="ltr" />
                <Field
                  label="الدور"
                  value={
                    <Badge
                      label={
                        profile.role === "ambassador" ? "🌟 سفير" :
                        profile.role === "admin"      ? "🛡 أدمن" :
                        profile.role === "super_admin"? "👑 مسؤول أعلى" :
                        "مستخدم"
                      }
                      color={
                        profile.role === "ambassador" ? "green" :
                        profile.role === "admin"      ? "blue"  :
                        profile.role === "super_admin"? "purple" :
                        "gray"
                      }
                    />
                  }
                />
                <Field
                  label="المستوى"
                  value={
                    <Badge
                      label={LEVEL_LABEL[profile.level] ?? "أساسي"}
                      color={
                        profile.level === "elite"    ? "yellow" :
                        profile.level === "pro"      ? "purple" :
                        profile.level === "advanced" ? "blue"   :
                        "gray"
                      }
                    />
                  }
                />
              </Section>

              {/* Section 2: KYC */}
              <Section title="التحقق (KYC)" icon={<Shield className="w-3.5 h-3.5" />}>
                <Field
                  label="الحالة"
                  value={<Badge label={kycMeta.label} color={kycMeta.color} />}
                />
                {kyc && (
                  <>
                    <Field label="نوع الوثيقة" value={kyc.document_type} />
                    <Field label="المدينة" value={kyc.city ?? "—"} />
                    <Field label="تاريخ التقديم" value={fmtDate(kyc.submitted_at)} dir="ltr" />
                    {kyc.reviewed_at && (
                      <Field label="تاريخ المراجعة" value={fmtDate(kyc.reviewed_at)} dir="ltr" />
                    )}
                    {kyc.review_notes && (
                      <Field label="ملاحظات المراجعة" value={kyc.review_notes} />
                    )}
                  </>
                )}
              </Section>

              {/* Section 3: Investments */}
              <Section title="الاستثمارات والصفقات" icon={<Wallet className="w-3.5 h-3.5" />}>
                <Field label="الحصص المملوكة" value={fmtNum(details?.holdings_total)} />
                <Field
                  label="قيمة الاستثمار"
                  value={<span className="text-yellow-400 font-mono">{fmtMoney(details?.holdings_value)}</span>}
                />
                <Field label="إجمالي الصفقات" value={fmtNum(details?.deals_total)} />
                <Field
                  label="المكتملة"
                  value={<span className="text-green-400 font-mono">{fmtNum(details?.deals_completed)}</span>}
                />
              </Section>

              {/* Section 4: Ambassador */}
              <Section title="السفير" icon={<Crown className="w-3.5 h-3.5" />}>
                {ambassador && ambassador.is_active ? (
                  <>
                    <Field
                      label="الحالة"
                      value={<Badge label={`🌟 سفير نشط (${ambassador.application_status})`} color="green" />}
                    />
                    <Field label="نسبة المكافأة" value={`${ambassador.reward_percentage}%`} />
                    {ambassador.approved_at && (
                      <Field label="تاريخ الاعتماد" value={fmtDate(ambassador.approved_at)} dir="ltr" />
                    )}
                    {ambassador.application_reason && (
                      <Field label="سبب التقديم" value={ambassador.application_reason} />
                    )}
                  </>
                ) : ambassador ? (
                  <Field
                    label="الحالة"
                    value={<Badge label={`غير نشط (${ambassador.application_status})`} color="gray" />}
                  />
                ) : profile.is_ambassador ? (
                  <Field label="الحالة" value={<Badge label="🌟 سفير (في profiles فقط)" color="green" />} />
                ) : (
                  <Field label="الحالة" value={<span className="text-neutral-500 text-xs">— ليس سفيراً —</span>} />
                )}
              </Section>

              {/* Section 5: Ratings */}
              <Section title="التقييمات" icon={<Star className="w-3.5 h-3.5" />}>
                <Field
                  label="متوسط التقييم"
                  value={
                    <span className="text-yellow-400 font-mono font-bold">
                      ⭐ {Number(details?.avg_rating ?? 0).toFixed(2)} / 5
                    </span>
                  }
                />
                <Field label="عدد التقييمات" value={fmtNum(details?.rating_count)} />
              </Section>

              {/* Section 6: Timestamps */}
              <Section title="التواريخ" icon={<User className="w-3.5 h-3.5" />}>
                <Field label="تاريخ التسجيل" value={fmtDate(profile.created_at)} dir="ltr" />
                <Field label="آخر تحديث" value={fmtDate(profile.updated_at)} dir="ltr" />
                <Field label="آخر دخول" value={fmtDate(profile.last_seen_at)} dir="ltr" />
              </Section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.06] flex justify-end sticky bottom-0 bg-[#0a0a0a]/95 backdrop-blur">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-xs hover:bg-white/[0.08]"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────

function Section({
  title, icon, children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="text-[11px] font-bold text-neutral-400 mb-2 flex items-center gap-1.5">
        <span className="text-neutral-500">{icon}</span>
        {title}
      </div>
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-1.5 text-xs">
        {children}
      </div>
    </div>
  )
}

function Field({
  label, value, dir,
}: {
  label: string
  value: React.ReactNode
  dir?: "ltr"
}) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-neutral-500 text-[11px]">{label}</span>
      <span className="text-white text-[11px] truncate max-w-[60%] text-left" dir={dir}>
        {value}
      </span>
    </div>
  )
}
