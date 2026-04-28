"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Send, Paperclip } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, Modal } from "@/components/ui"
import { CURRENT_USER } from "@/lib/mock-data/profile"
import {
  DISEASE_LABELS,
  submitHealthcareApplication,
  type DiseaseType,
} from "@/lib/mock-data/healthcare"
import { showError, showSuccess } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

const ATTACHMENTS = [
  { id: "medical_report", label: "تقرير طبّي رسمي",       required: true,  icon: "📋" },
  { id: "prescription",   label: "وصفة الطبيب",                 required: true,  icon: "💊" },
  { id: "invoice",        label: "فاتورة المستشفى/الأدوية", required: false, icon: "🧾" },
  { id: "id_copy",        label: "صورة الهوية الشخصية",         required: true,  icon: "🪪" },
]

export default function HealthcareApplyPage() {
  const router = useRouter()
  const [disease, setDisease] = useState<DiseaseType | "">("")
  const [diagnosis, setDiagnosis] = useState("")
  const [doctor, setDoctor] = useState("")
  const [hospital, setHospital] = useState("")
  const [totalCost, setTotalCost] = useState("")
  const [available, setAvailable] = useState("")
  const [attachments, setAttachments] = useState<Record<string, boolean>>({})
  const [acceptDocs, setAcceptDocs] = useState(false)
  const [acceptVerify, setAcceptVerify] = useState(false)
  const [acceptResponsibility, setAcceptResponsibility] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const totalCostNum = Number(totalCost) || 0
  const availableNum = Number(available) || 0
  const requested = Math.max(0, totalCostNum - availableNum)

  const requiredAttachments = ATTACHMENTS.filter((a) => a.required)
  const allRequiredAttached = requiredAttachments.every((a) => attachments[a.id])

  const isValid =
    !!disease &&
    diagnosis.trim().length >= 20 &&
    doctor.trim().length >= 3 &&
    hospital.trim().length >= 3 &&
    totalCostNum > 0 &&
    availableNum >= 0 &&
    allRequiredAttached &&
    acceptDocs &&
    acceptVerify &&
    acceptResponsibility

  const handleSubmitClick = () => {
    if (!disease) return showError("اختر نوع المرض")
    if (diagnosis.trim().length < 20) return showError("التشخيص يحتاج 20 حرف على الأقل")
    if (!doctor.trim()) return showError("اسم الطبيب مطلوب")
    if (!hospital.trim()) return showError("اسم المستشفى مطلوب")
    if (totalCostNum < 1000) return showError("التكلفة الكلّية مطلوبة")
    if (!allRequiredAttached) return showError("المرفقات الإجبارية ناقصة")
    if (!acceptDocs || !acceptVerify || !acceptResponsibility) return showError("الموافقة على الشروط الثلاثة إجبارية")
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    setSubmitting(true)
    const result = submitHealthcareApplication("me", {
      user_id: CURRENT_USER.id,
      disease_type: disease as DiseaseType,
      diagnosis: diagnosis.trim(),
      doctor_name: doctor.trim(),
      hospital: hospital.trim(),
      total_cost: totalCostNum,
      user_available: availableNum,
      requested_amount: requested,
    })
    setSubmitting(false)
    if (result.success) {
      showSuccess("✅ تم تقديم طلبك — ستصلك النتيجة خلال 5-7 أيام")
      setShowConfirm(false)
      router.push("/healthcare/my-applications")
    }
  }

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader title="📝 تقديم طلب رعاية" subtitle="املأ النموذج لطلب دعم علاجك أو علاج قريب" />

          {/* 1. Personal info (auto-fill) */}
          <Card padding="md" className="mb-3">
            <div className="text-[11px] font-bold text-neutral-400 mb-3">1️⃣ معلومات شخصية</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[10px] text-neutral-500 mb-1">الاسم</div>
                <div className="text-white font-bold">{CURRENT_USER.name}</div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500 mb-1">المستوى</div>
                <div className="text-white">{CURRENT_USER.level}</div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500 mb-1">المحافظة</div>
                <div className="text-white">{CURRENT_USER.governorate}</div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500 mb-1">KYC</div>
                <div className={CURRENT_USER.kyc_status === "verified" ? "text-green-400 font-bold" : "text-yellow-400"}>
                  {CURRENT_USER.kyc_status === "verified" ? "✓ موثَّق" : "⚠️ غير موثَّق"}
                </div>
              </div>
            </div>
          </Card>

          {/* 2. Diagnosis */}
          <Card padding="md" className="mb-3">
            <div className="text-[11px] font-bold text-neutral-400 mb-3">2️⃣ التشخيص الطبّي</div>

            <label className="text-xs text-neutral-400 mb-1.5 block">نوع المرض *</label>
            <select
              value={disease}
              onChange={(e) => setDisease(e.target.value as DiseaseType | "")}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 mb-3"
            >
              <option value="">— اختر —</option>
              {Object.entries(DISEASE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>

            <label className="text-xs text-neutral-400 mb-1.5 block">تفاصيل التشخيص *</label>
            <textarea
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={3}
              placeholder="مثلاً: ذبحة صدرية، تحتاج قسطرة + دعامة..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none mb-3"
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">اسم الطبيب *</label>
                <input
                  type="text"
                  value={doctor}
                  onChange={(e) => setDoctor(e.target.value)}
                  placeholder="د. علي العبيدي"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">المستشفى *</label>
                <input
                  type="text"
                  value={hospital}
                  onChange={(e) => setHospital(e.target.value)}
                  placeholder="مركز القلب"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
                />
              </div>
            </div>
          </Card>

          {/* 3. Cost */}
          <Card padding="md" className="mb-3">
            <div className="text-[11px] font-bold text-neutral-400 mb-3">3️⃣ التكلفة المالية</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">التكلفة الكلّية (د.ع) *</label>
                <input
                  type="number"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  placeholder="8000000"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">المتوفّر لديك (د.ع)</label>
                <input
                  type="number"
                  value={available}
                  onChange={(e) => setAvailable(e.target.value)}
                  placeholder="2000000"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
                />
              </div>
            </div>
            <div className="bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-xl p-3 flex justify-between items-center">
              <span className="text-xs text-blue-400">المطلوب من البرنامج</span>
              <span className="text-base font-bold text-blue-400 font-mono">{fmtNum(requested)} د.ع</span>
            </div>
          </Card>

          {/* 4. Attachments */}
          <Card padding="md" className="mb-3">
            <div className="text-[11px] font-bold text-neutral-400 mb-3">4️⃣ المرفقات</div>
            <div className="space-y-2">
              {ATTACHMENTS.map((att) => (
                <button
                  key={att.id}
                  onClick={() => setAttachments({ ...attachments, [att.id]: !attachments[att.id] })}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-right",
                    attachments[att.id]
                      ? "bg-green-400/[0.06] border-green-400/[0.25]"
                      : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.06]"
                  )}
                >
                  <span className="text-base">{att.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-bold flex items-center gap-1.5">
                      {att.label}
                      {att.required && <span className="text-red-400">*</span>}
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {attachments[att.id] ? "✓ تمّ الرفع (placeholder)" : "اضغط للرفع"}
                    </div>
                  </div>
                  <Paperclip className="w-3.5 h-3.5 text-neutral-500" />
                </button>
              ))}
            </div>
          </Card>

          {/* 5. Terms */}
          <Card padding="md" className="mb-5">
            <div className="text-[11px] font-bold text-neutral-400 mb-3">5️⃣ الشروط</div>
            <div className="space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={acceptDocs} onChange={(e) => setAcceptDocs(e.target.checked)} className="mt-0.5 w-4 h-4" />
                <span className="text-xs text-neutral-300 leading-relaxed">أُقرّ أن المستندات المُقدَّمة صحيحة وأصلية</span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={acceptVerify} onChange={(e) => setAcceptVerify(e.target.checked)} className="mt-0.5 w-4 h-4" />
                <span className="text-xs text-neutral-300 leading-relaxed">أوافق على التحقّق من حالتي مع المستشفى المذكور</span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={acceptResponsibility} onChange={(e) => setAcceptResponsibility(e.target.checked)} className="mt-0.5 w-4 h-4" />
                <span className="text-xs text-neutral-300 leading-relaxed">أتحمّل المسؤولية الكاملة في حال تبيّن أي تقصير في المعلومات</span>
              </label>
            </div>
          </Card>

          {/* CTA */}
          <button
            onClick={handleSubmitClick}
            disabled={!isValid}
            className={cn(
              "w-full py-3.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
              isValid
                ? "bg-neutral-100 text-black hover:bg-neutral-200"
                : "bg-white/[0.05] text-neutral-500 cursor-not-allowed"
            )}
          >
            <Send className="w-4 h-4" strokeWidth={2} />
            تقديم الطلب
          </button>

        </div>
      </div>

      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="📤 تأكيد التقديم"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowConfirm(false)} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
            <button onClick={handleConfirm} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 disabled:opacity-50">{submitting ? "جاري..." : "تأكيد"}</button>
          </>
        }
      >
        <div className="text-xs text-neutral-300 leading-relaxed mb-3">
          سيتم مراجعة طلبك خلال <span className="text-white font-bold">5-7 أيام عمل</span>.
          ستصلك النتيجة عبر إشعار + يمكن متابعة الحالة من <span className="text-white font-bold">طلباتي</span>.
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-1.5 text-xs">
          <div className="flex justify-between"><span className="text-neutral-500">المرض</span><span className="text-white">{disease ? DISEASE_LABELS[disease as DiseaseType].label : "—"}</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">المطلوب</span><span className="text-blue-400 font-mono font-bold">{fmtNum(requested)} د.ع</span></div>
        </div>
      </Modal>
    </AppLayout>
  )
}
