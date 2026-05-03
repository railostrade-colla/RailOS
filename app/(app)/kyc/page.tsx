"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Upload, Check, X, Lock, ChevronLeft, Wifi, FileText, Smartphone, Loader2 } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess, showError } from "@/lib/utils/toast"
// Phase 5.5: full KYC submission — Storage upload + DB INSERT.
import { getCurrentUserProfile } from "@/lib/data/profile"
import { uploadKycSelfie, uploadKycDocument } from "@/lib/storage/upload"
import { submitKycRequest, type KycDocTypeApi } from "@/lib/data/kyc"
import { cn } from "@/lib/utils/cn"

type Step =
  | "status"
  | "instructions"
  | "personal"
  | "selfie"
  | "document"
  | "review"
  | "submitted"
type DocType = "id" | "passport"

/** Maps the friendly UI doc type to the DB `id_document_type` enum. */
function toApiDocType(t: DocType): KycDocTypeApi {
  return t === "passport" ? "passport" : "national_id"
}

/**
 * Maps the DB `kyc_status` enum (`not_submitted | pending | approved | rejected`)
 * to the legacy in-page palette (which used `verified` for approved).
 */
type KycView = "not_submitted" | "pending" | "verified" | "rejected"

const statusColors: Record<KycView, string> = {
  not_submitted: "#888888",
  pending:       "#FBBF24",
  verified:      "#4ADE80",
  rejected:      "#F87171",
}

const statusLabels: Record<KycView, string> = {
  not_submitted: "غير موثق",
  pending:       "قيد المراجعة",
  verified:      "موثق",
  rejected:      "مرفوض",
}

function dbToView(s: string | undefined | null): KycView {
  if (s === "approved") return "verified"
  if (s === "pending") return "pending"
  if (s === "rejected") return "rejected"
  return "not_submitted"
}

export default function KYCPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("status")
  // For each upload we now keep the storage path (not the local filename).
  const [selfiePath, setSelfiePath] = useState("")
  const [docPath, setDocPath] = useState("")
  const [docType, setDocType] = useState<DocType>("id")
  const [submitting, setSubmitting] = useState(false)
  // Per-input upload spinner (so the button shows progress).
  const [uploading, setUploading] = useState<"selfie" | "doc" | null>(null)
  const [kycStatus, setKycStatus] = useState<KycView>("not_submitted")
  const [loadingStatus, setLoadingStatus] = useState(true)

  // Personal info (Phase 5.5) — full_name + phone are pre-filled from profile.
  const [fullName, setFullName] = useState("")
  const [dob, setDob] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [phone, setPhone] = useState("")
  const [docNumber, setDocNumber] = useState("")

  useEffect(() => {
    let cancelled = false
    getCurrentUserProfile().then((p) => {
      if (cancelled) return
      setKycStatus(dbToView(p?.kyc_status))
      setFullName(p?.full_name ?? "")
      setPhone(p?.phone ?? "")
      setLoadingStatus(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const steps: Step[] = [
    "status",
    "instructions",
    "personal",
    "selfie",
    "document",
    "review",
    "submitted",
  ]
  const stepPct = (steps.indexOf(step) / (steps.length - 1)) * 100

  /** Quick check whether all 6 personal fields are filled. */
  const personalReady =
    fullName.trim().length >= 2 &&
    /^\d{4}-\d{2}-\d{2}$/.test(dob) &&
    address.trim().length >= 5 &&
    city.trim().length >= 2 &&
    phone.trim().length >= 8 &&
    docNumber.trim().length >= 4

  async function handleSelfieFile(file: File) {
    setUploading("selfie")
    const result = await uploadKycSelfie(file)
    setUploading(null)
    if (result.success && result.path) {
      setSelfiePath(result.path)
      showSuccess("تم رفع صورة السيلفي")
    } else {
      showError(result.error ?? "تعذّر رفع الصورة")
    }
  }

  async function handleDocFile(file: File) {
    setUploading("doc")
    const result = await uploadKycDocument(file, "front")
    setUploading(null)
    if (result.success && result.path) {
      setDocPath(result.path)
      showSuccess("تم رفع الوثيقة")
    } else {
      showError(result.error ?? "تعذّر رفع الوثيقة")
    }
  }

  const submitKYC = async () => {
    if (!personalReady) return showError("أكمل البيانات الشخصية أوّلاً")
    if (!selfiePath) return showError("الرجاء التقاط صورة السيلفي")
    if (!docPath) return showError("الرجاء رفع وثيقة الهوية")
    setSubmitting(true)

    const result = await submitKycRequest({
      full_name: fullName.trim(),
      date_of_birth: dob,
      address: address.trim(),
      city: city.trim(),
      phone: phone.trim(),
      document_type: toApiDocType(docType),
      document_number: docNumber.trim(),
      selfie_url: selfiePath,
      document_front_url: docPath,
    })

    setSubmitting(false)

    if (result.success) {
      showSuccess("تم إرسال طلب التوثيق! 🎉 سنُعلمك بالنتيجة")
      setKycStatus("pending")
      setStep("submitted")
    } else {
      showError(result.error ?? "تعذّر إرسال الطلب")
    }
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">

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
                <span>البيانات</span>
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
                    background: `${statusColors[kycStatus]}15`,
                    borderColor: `${statusColors[kycStatus]}30`,
                  }}
                >
                  <span className="text-4xl">
                    {loadingStatus
                      ? "⏳"
                      : kycStatus === "verified"
                        ? "✓"
                        : kycStatus === "rejected"
                          ? "✗"
                          : kycStatus === "pending"
                            ? "🔍"
                            : "🛡️"}
                  </span>
                </div>
                <div className="text-2xl font-bold text-white mb-2">
                  {loadingStatus ? "..." : statusLabels[kycStatus]}
                </div>
                <div className="text-sm text-neutral-400 leading-relaxed">
                  {loadingStatus
                    ? "جاري التحقّق من حالتك..."
                    : kycStatus === "verified"
                      ? "حسابك موثق بالكامل"
                      : kycStatus === "pending"
                        ? "طلبك قيد المراجعة من قبل الإدارة"
                        : kycStatus === "rejected"
                          ? "تم رفض طلبك، يرجى إعادة المحاولة"
                          : "يمكنك الآن البدء بتوثيق حسابك"}
                </div>
              </div>

              {!loadingStatus && kycStatus !== "verified" && kycStatus !== "pending" && (
                <button
                  onClick={() => setStep("instructions")}
                  className="w-full py-3.5 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 transition-colors"
                >
                  {kycStatus === "rejected" ? "إعادة التوثيق" : "بدء التوثيق"}
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
                onClick={() => setStep("personal")}
                className="w-full py-3.5 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 transition-colors"
              >
                فهمت، ابدأ التوثيق
              </button>
            </>
          )}

          {/* البيانات الشخصية (Phase 5.5) */}
          {step === "personal" && (
            <>
              <div className="text-2xl font-bold text-white mb-2">البيانات الشخصية</div>
              <div className="text-sm text-neutral-400 mb-5">يجب أن تطابق هذه البيانات وثيقة هويتك تماماً</div>

              <div className="space-y-3 mb-5">
                {/* Full name */}
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">الاسم الكامل (كما في الوثيقة)</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: محمد علي حسين"
                    className="w-full bg-white/[0.05] border border-white/[0.1] focus:border-white/[0.25] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition-colors"
                  />
                </div>

                {/* DOB */}
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">تاريخ الميلاد</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().slice(0, 10)}
                    className="w-full bg-white/[0.05] border border-white/[0.1] focus:border-white/[0.25] rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
                    dir="ltr"
                  />
                </div>

                {/* City + Phone (grid) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">المدينة</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="بغداد"
                      className="w-full bg-white/[0.05] border border-white/[0.1] focus:border-white/[0.25] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">رقم الهاتف</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+9647701234567"
                      className="w-full bg-white/[0.05] border border-white/[0.1] focus:border-white/[0.25] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition-colors"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">العنوان التفصيلي</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="المحلّة، الزقاق، رقم الدار"
                    className="w-full bg-white/[0.05] border border-white/[0.1] focus:border-white/[0.25] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition-colors"
                  />
                </div>

                {/* Document number */}
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">رقم الوثيقة</label>
                  <input
                    type="text"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder="مثال: 12345678"
                    className="w-full bg-white/[0.05] border border-white/[0.1] focus:border-white/[0.25] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition-colors"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("instructions")}
                  className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
                >
                  رجوع
                </button>
                <button
                  onClick={() => {
                    if (!personalReady) {
                      return showError("أكمل جميع الحقول بشكل صحيح")
                    }
                    setStep("selfie")
                  }}
                  disabled={!personalReady}
                  className={cn(
                    "flex-[2] py-3 rounded-xl text-sm font-bold transition-colors",
                    personalReady
                      ? "bg-neutral-100 text-black hover:bg-neutral-200"
                      : "bg-white/[0.05] text-neutral-600 cursor-not-allowed",
                  )}
                >
                  التالي
                </button>
              </div>
            </>
          )}

          {/* السيلفي */}
          {step === "selfie" && (
            <>
              <div className="text-2xl font-bold text-white mb-2">صورة السيلفي</div>
              <div className="text-sm text-neutral-400 mb-5">التقط صورة واضحة لوجهك مع الهوية</div>

              <button
                onClick={() => uploading !== "selfie" && document.getElementById("selfie-input")?.click()}
                disabled={uploading === "selfie"}
                className="w-full bg-white/[0.05] border-2 border-dashed border-white/[0.15] rounded-2xl p-10 mb-5 hover:bg-white/[0.07] hover:border-white/[0.25] transition-colors disabled:opacity-60 disabled:cursor-wait"
              >
                {uploading === "selfie" ? (
                  <div>
                    <Loader2 className="w-12 h-12 text-blue-400 mx-auto mb-3 animate-spin" strokeWidth={1.5} />
                    <div className="text-sm font-bold text-blue-400 mb-1">جاري الرفع...</div>
                  </div>
                ) : selfiePath ? (
                  <div>
                    <div className="text-5xl mb-3">✅</div>
                    <div className="text-sm font-bold text-green-400 mb-1">تم التقاط الصورة</div>
                    <div className="text-[11px] text-neutral-500 break-all">{selfiePath.split("/").slice(-1)[0]}</div>
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
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleSelfieFile(f)
                  // reset input so the same file can be selected again
                  e.target.value = ""
                }}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("personal")}
                  disabled={uploading === "selfie"}
                  className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
                >
                  رجوع
                </button>
                <button
                  onClick={() => {
                    if (!selfiePath) return showError("الرجاء التقاط صورة أولاً")
                    setStep("document")
                  }}
                  disabled={!selfiePath || uploading === "selfie"}
                  className={cn(
                    "flex-[2] py-3 rounded-xl text-sm font-bold transition-colors",
                    selfiePath && uploading !== "selfie"
                      ? "bg-neutral-100 text-black hover:bg-neutral-200"
                      : "bg-white/[0.05] text-neutral-600 cursor-not-allowed",
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
                onClick={() => uploading !== "doc" && document.getElementById("doc-input")?.click()}
                disabled={uploading === "doc"}
                className="w-full bg-white/[0.05] border-2 border-dashed border-white/[0.15] rounded-2xl p-10 mb-5 hover:bg-white/[0.07] hover:border-white/[0.25] transition-colors disabled:opacity-60 disabled:cursor-wait"
              >
                {uploading === "doc" ? (
                  <div>
                    <Loader2 className="w-12 h-12 text-blue-400 mx-auto mb-3 animate-spin" strokeWidth={1.5} />
                    <div className="text-sm font-bold text-blue-400 mb-1">جاري الرفع...</div>
                  </div>
                ) : docPath ? (
                  <div>
                    <div className="text-5xl mb-3">✅</div>
                    <div className="text-sm font-bold text-green-400 mb-1">تم رفع الوثيقة</div>
                    <div className="text-[11px] text-neutral-500 break-all">{docPath.split("/").slice(-1)[0]}</div>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-12 h-12 text-neutral-400 mx-auto mb-3" strokeWidth={1.5} />
                    <div className="text-sm font-bold text-white mb-1">اضغط لرفع الوثيقة</div>
                    <div className="text-xs text-neutral-500">JPG أو PNG أو WEBP — حجم أقصى 10MB</div>
                  </div>
                )}
              </button>
              <input
                id="doc-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleDocFile(f)
                  e.target.value = ""
                }}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("selfie")}
                  disabled={uploading === "doc"}
                  className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
                >
                  رجوع
                </button>
                <button
                  onClick={() => {
                    if (!docPath) return showError("الرجاء رفع الوثيقة أولاً")
                    setStep("review")
                  }}
                  disabled={!docPath || uploading === "doc"}
                  className={cn(
                    "flex-[2] py-3 rounded-xl text-sm font-bold transition-colors",
                    docPath && uploading !== "doc"
                      ? "bg-neutral-100 text-black hover:bg-neutral-200"
                      : "bg-white/[0.05] text-neutral-600 cursor-not-allowed",
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

              {/* Personal info summary */}
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3.5 mb-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">الاسم</span>
                  <span className="text-white font-bold">{fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">تاريخ الميلاد</span>
                  <span className="text-white font-mono" dir="ltr">{dob}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">المدينة</span>
                  <span className="text-white">{city}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">الهاتف</span>
                  <span className="text-white font-mono" dir="ltr">{phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">العنوان</span>
                  <span className="text-white truncate max-w-[60%]">{address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">رقم الوثيقة</span>
                  <span className="text-white font-mono" dir="ltr">{docNumber}</span>
                </div>
              </div>

              <div className="space-y-2.5 mb-4">
                {[
                  {
                    label: "صورة السيلفي",
                    value: selfiePath ? selfiePath.split("/").slice(-1)[0] : "—",
                    ok: !!selfiePath,
                  },
                  {
                    label: `وثيقة ${docType === "id" ? "الهوية الوطنية" : "جواز السفر"}`,
                    value: docPath ? docPath.split("/").slice(-1)[0] : "—",
                    ok: !!docPath,
                  },
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
                  onClick={() => setStep("personal")}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
                >
                  تعديل
                </button>
                <button
                  onClick={submitKYC}
                  disabled={submitting}
                  className="flex-[2] py-3 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
