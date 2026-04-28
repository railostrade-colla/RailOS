"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Upload, Check, X, Lock, ChevronLeft, Wifi, FileText, Smartphone } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess, showError } from "@/lib/utils/toast"
import { mockProfileKYC as mockProfile } from "@/lib/mock-data"
import { cn } from "@/lib/utils/cn"

type Step = "status" | "instructions" | "selfie" | "document" | "review" | "submitted"
type DocType = "id" | "passport"

const statusColors = {
  pending: "#FBBF24",
  verified: "#4ADE80",
  rejected: "#F87171",
}

const statusLabels = {
  pending: "قيد المراجعة",
  verified: "موثق",
  rejected: "مرفوض",
}

export default function KYCPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("status")
  const [selfieData, setSelfieData] = useState("")
  const [docData, setDocData] = useState("")
  const [docType, setDocType] = useState<DocType>("id")
  const [submitting, setSubmitting] = useState(false)

  const steps: Step[] = ["status", "instructions", "selfie", "document", "review", "submitted"]
  const stepPct = (steps.indexOf(step) / (steps.length - 1)) * 100

  const submitKYC = () => {
    if (!selfieData) return showError("الرجاء التقاط صورة السيلفي")
    if (!docData) return showError("الرجاء رفع وثيقة الهوية")
    setSubmitting(true)
    setTimeout(() => {
      showSuccess("تم إرسال طلب التوثيق! 🎉")
      setStep("submitted")
      setSubmitting(false)
    }, 1500)
  }

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            badge="KYC · توثيق الهوية"
            title="التوثيق"
            description="وثّق هويتك للحصول على مزايا الحساب الموثق"
          />

          {/* Progress bar */}
          {step !== "submitted" && (
            <div className="mb-6">
              <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${stepPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-neutral-500">
                <span>الحالة</span>
                <span>التعليمات</span>
                <span>السيلفي</span>
                <span>الوثيقة</span>
                <span>المراجعة</span>
              </div>
            </div>
          )}

          {/* الحالة الحالية */}
          {step === "status" && (
            <>
              <div className="text-center mb-6">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 border-2"
                  style={{
                    background: `${mockProfile.kyc_status ? statusColors[mockProfile.kyc_status] : "#888"}15`,
                    borderColor: `${mockProfile.kyc_status ? statusColors[mockProfile.kyc_status] : "#888"}30`,
                  }}
                >
                  <span className="text-4xl">
                    {mockProfile.kyc_status === "verified" ? "✓" : mockProfile.kyc_status === "rejected" ? "✗" : "🔍"}
                  </span>
                </div>
                <div className="text-2xl font-bold text-white mb-2">
                  {mockProfile.kyc_status ? statusLabels[mockProfile.kyc_status] : "غير موثق"}
                </div>
                <div className="text-sm text-neutral-400 leading-relaxed">
                  {mockProfile.kyc_status === "verified"
                    ? "حسابك موثق بالكامل"
                    : mockProfile.kyc_status === "rejected"
                      ? "تم رفض طلبك، يرجى إعادة المحاولة"
                      : "يمكنك الآن البدء بتوثيق حسابك"}
                </div>
              </div>

              {mockProfile.kyc_status !== "verified" && (
                <button
                  onClick={() => setStep("instructions")}
                  className="w-full py-3.5 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 transition-colors"
                >
                  {mockProfile.kyc_status === "rejected" ? "إعادة التوثيق" : "بدء التوثيق"}
                </button>
              )}
            </>
          )}

          {/* التعليمات */}
          {step === "instructions" && (
            <>
              <div className="text-2xl font-bold text-white mb-2">قبل البدء</div>
              <div className="text-sm text-neutral-400 mb-6 leading-relaxed">
                تأكد من توفر المتطلبات التالية للحصول على موافقة أسرع
              </div>

              <div className="space-y-2.5 mb-6">
                {[
                  { Icon: Camera, title: "صورة سيلفي واضحة", desc: "وجهك ظاهر بالكامل، بدون فلتر، إضاءة جيدة", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
                  { Icon: FileText, title: "وثيقة هوية سارية", desc: "هوية وطنية أو جواز سفر — جميع الزوايا واضحة والنص مقروء", color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20" },
                  { Icon: Wifi, title: "اتصال جيد بالإنترنت", desc: "لضمان رفع الصور بنجاح", color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/20" },
                ].map((item, i) => (
                  <div key={i} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4 flex gap-3 items-start">
                    <div className={cn("w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0", item.bg, item.border)}>
                      <item.Icon className={cn("w-5 h-5", item.color)} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white mb-1">{item.title}</div>
                      <div className="text-xs text-neutral-400 leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep("selfie")}
                className="w-full py-3.5 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 transition-colors"
              >
                فهمت، ابدأ التوثيق
              </button>
            </>
          )}

          {/* السيلفي */}
          {step === "selfie" && (
            <>
              <div className="text-2xl font-bold text-white mb-2">صورة السيلفي</div>
              <div className="text-sm text-neutral-400 mb-5">التقط صورة واضحة لوجهك مع الهوية</div>

              <button
                onClick={() => document.getElementById("selfie-input")?.click()}
                className="w-full bg-white/[0.05] border-2 border-dashed border-white/[0.15] rounded-2xl p-10 mb-5 hover:bg-white/[0.07] hover:border-white/[0.25] transition-colors"
              >
                {selfieData ? (
                  <div>
                    <div className="text-5xl mb-3">✅</div>
                    <div className="text-sm font-bold text-green-400 mb-1">تم التقاط الصورة</div>
                    <div className="text-[11px] text-neutral-500">{selfieData}</div>
                  </div>
                ) : (
                  <div>
                    <Camera className="w-12 h-12 text-neutral-400 mx-auto mb-3" strokeWidth={1.5} />
                    <div className="text-sm font-bold text-white mb-1">اضغط للتقاط صورة</div>
                    <div className="text-xs text-neutral-500">أو رفع من المعرض</div>
                  </div>
                )}
              </button>
              <input
                id="selfie-input"
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) setSelfieData(f.name)
                }}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setSelfieData("")}
                  className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
                >
                  إعادة
                </button>
                <button
                  onClick={() => {
                    if (!selfieData) return showError("الرجاء التقاط صورة أولاً")
                    setStep("document")
                  }}
                  disabled={!selfieData}
                  className={cn(
                    "flex-[2] py-3 rounded-xl text-sm font-bold transition-colors",
                    selfieData ? "bg-neutral-100 text-black hover:bg-neutral-200" : "bg-white/[0.05] text-neutral-600 cursor-not-allowed"
                  )}
                >
                  التالي
                </button>
              </div>
            </>
          )}

          {/* الوثيقة */}
          {step === "document" && (
            <>
              <div className="text-2xl font-bold text-white mb-2">وثيقة الهوية</div>
              <div className="text-sm text-neutral-400 mb-4">ارفع صورة واضحة لوثيقة هويتك</div>

              {/* نوع الوثيقة */}
              <div className="flex gap-2.5 mb-4">
                {([
                  { key: "id" as const, label: "هوية وطنية" },
                  { key: "passport" as const, label: "جواز سفر" },
                ]).map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setDocType(d.key)}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-sm transition-colors border",
                      docType === d.key
                        ? "bg-white/[0.1] border-white/[0.2] text-white font-bold"
                        : "bg-white/[0.05] border-white/[0.08] text-neutral-400 hover:bg-white/[0.07]"
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {/* رفع */}
              <button
                onClick={() => document.getElementById("doc-input")?.click()}
                className="w-full bg-white/[0.05] border-2 border-dashed border-white/[0.15] rounded-2xl p-10 mb-5 hover:bg-white/[0.07] hover:border-white/[0.25] transition-colors"
              >
                {docData ? (
                  <div>
                    <div className="text-5xl mb-3">✅</div>
                    <div className="text-sm font-bold text-green-400 mb-1">تم رفع الوثيقة</div>
                    <div className="text-[11px] text-neutral-500">{docData}</div>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-12 h-12 text-neutral-400 mx-auto mb-3" strokeWidth={1.5} />
                    <div className="text-sm font-bold text-white mb-1">اضغط لرفع الوثيقة</div>
                    <div className="text-xs text-neutral-500">JPG أو PNG — حجم أقصى 10MB</div>
                  </div>
                )}
              </button>
              <input
                id="doc-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) setDocData(f.name)
                }}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("selfie")}
                  className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
                >
                  رجوع
                </button>
                <button
                  onClick={() => {
                    if (!docData) return showError("الرجاء رفع الوثيقة أولاً")
                    setStep("review")
                  }}
                  disabled={!docData}
                  className={cn(
                    "flex-[2] py-3 rounded-xl text-sm font-bold transition-colors",
                    docData ? "bg-neutral-100 text-black hover:bg-neutral-200" : "bg-white/[0.05] text-neutral-600 cursor-not-allowed"
                  )}
                >
                  التالي
                </button>
              </div>
            </>
          )}

          {/* المراجعة */}
          {step === "review" && (
            <>
              <div className="text-2xl font-bold text-white mb-2">مراجعة قبل الإرسال</div>
              <div className="text-sm text-neutral-400 mb-5">تأكد من صحة البيانات</div>

              <div className="space-y-2.5 mb-4">
                {[
                  { label: "صورة السيلفي", value: selfieData, ok: !!selfieData },
                  { label: `وثيقة ${docType === "id" ? "الهوية الوطنية" : "جواز السفر"}`, value: docData, ok: !!docData },
                ].map((item, i) => (
                  <div key={i} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3.5 flex justify-between items-center">
                    <div>
                      <div className="text-sm font-bold text-white">{item.label}</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">{item.value}</div>
                    </div>
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center",
                      item.ok ? "bg-green-400/10 border border-green-400/20" : "bg-red-400/10 border border-red-400/20"
                    )}>
                      {item.ok ? (
                        <Check className="w-4 h-4 text-green-400" strokeWidth={2} />
                      ) : (
                        <X className="w-4 h-4 text-red-400" strokeWidth={2} />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-5 flex gap-2 items-start">
                <Lock className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                <div className="text-[11px] text-neutral-400 leading-relaxed">
                  بياناتك محمية بالكامل ولن تُشارك مع أي طرف خارجي. تُستخدم فقط للتحقق من هويتك.
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("document")}
                  className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
                >
                  تعديل
                </button>
                <button
                  onClick={submitKYC}
                  disabled={submitting}
                  className="flex-[2] py-3 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 disabled:opacity-50"
                >
                  {submitting ? "جاري الإرسال..." : "إرسال للمراجعة"}
                </button>
              </div>
            </>
          )}

          {/* تم الإرسال */}
          {step === "submitted" && (
            <div className="text-center py-10">
              <div className="w-24 h-24 rounded-full bg-green-400/10 border-2 border-green-400/30 flex items-center justify-center mx-auto mb-5">
                <Check className="w-12 h-12 text-green-400" strokeWidth={2} />
              </div>
              <div className="text-2xl font-bold text-white mb-2">تم إرسال طلبك! 🎉</div>
              <div className="text-sm text-neutral-400 leading-relaxed mb-6 max-w-md mx-auto">
                سيتم مراجعة طلب التوثيق خلال 24-48 ساعة. سنُعلمك بالنتيجة عبر الإشعارات.
              </div>
              <button
                onClick={() => router.push("/profile")}
                className="bg-neutral-100 text-black px-8 py-3 rounded-xl text-sm font-bold hover:bg-neutral-200"
              >
                العودة للملف الشخصي
              </button>
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  )
}
