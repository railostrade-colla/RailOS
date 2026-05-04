"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Search, X, ZoomIn } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  MOCK_KYC_SUBMISSIONS,
  KYC_DOC_TYPE_LABELS,
  KYC_STATUS_LABELS,
  type KycSubmission,
} from "@/lib/mock-data/kyc"
import {
  getKycSubmissions,
  approveKyc,
  rejectKyc,
} from "@/lib/data/kyc-admin"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type ActionMode = null | "approve" | "reject" | "resubmit"

const DAY_MS = 86_400_000

/** Per-list stats — replaces getKycStats() which read MOCK_KYC_SUBMISSIONS. */
function computeKycStats(submissions: KycSubmission[]) {
  const now = Date.now()
  let pending = 0
  let verified = 0
  let rejected = 0
  let resubmission = 0
  let todayCount = 0
  for (const s of submissions) {
    if (s.status === "pending") pending++
    if (s.status === "verified") verified++
    if (s.status === "rejected") rejected++
    if (s.status === "needs_resubmission") resubmission++
    const t = new Date(s.submitted_at).getTime()
    if (Number.isFinite(t) && now - t < DAY_MS) todayCount++
  }
  return { pending, verified, rejected, resubmission, today_count: todayCount }
}

export function KycPanel() {
  const [filter, setFilter] = useState<string>("pending")
  const [search, setSearch] = useState("")
  const [docFilter, setDocFilter] = useState<string>("all")
  const [cityFilter, setCityFilter] = useState<string>("all")
  const [selected, setSelected] = useState<KycSubmission | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [reason, setReason] = useState("")
  const [resubmitField, setResubmitField] = useState<"front" | "back" | "selfie">("selfie")
  const [submitting, setSubmitting] = useState(false)

  // Production mode — DB only.
  const [submissions, setSubmissions] = useState<KycSubmission[]>([])

  const refresh = useCallback(async () => {
    const rows = await getKycSubmissions(500)
    setSubmissions(rows)
  }, [])

  useEffect(() => {
    let cancelled = false
    getKycSubmissions(500).then((rows) => {
      if (cancelled) return
      if (rows.length > 0) setSubmissions(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => computeKycStats(submissions), [submissions])

  const tabs = [
    { key: "all", label: "الكل", count: submissions.length },
    { key: "pending", label: "معلّق", count: stats.pending },
    { key: "verified", label: "موثّق", count: stats.verified },
    { key: "rejected", label: "مرفوض", count: stats.rejected },
    { key: "needs_resubmission", label: "إعادة رفع", count: stats.resubmission },
  ]

  const cities = useMemo(
    () => Array.from(new Set(submissions.map((k) => k.city).filter(Boolean) as string[])),
    [submissions],
  )

  const filtered = submissions
    .filter((k) => filter === "all" || k.status === filter)
    .filter((k) => docFilter === "all" || k.document_type === docFilter)
    .filter((k) => cityFilter === "all" || k.city === cityFilter)
    .filter((k) =>
      !search ||
      k.user_name.includes(search) ||
      k.user_email.toLowerCase().includes(search.toLowerCase())
    )

  const closeAll = () => {
    setSelected(null)
    setActionMode(null)
    setReason("")
  }

  const handleConfirm = async () => {
    if (!selected || !actionMode || submitting) return
    if ((actionMode === "reject" || actionMode === "resubmit") && !reason.trim()) {
      showError("اكتب سبب الإجراء")
      return
    }

    setSubmitting(true)
    try {
      if (actionMode === "approve") {
        const r = await approveKyc(selected.id)
        if (!r.success) {
          showError(r.error || "تعذّر التوثيق")
          return
        }
        showSuccess("✅ تم توثيق الحساب + إرسال إشعار للمستخدم")
      } else if (actionMode === "reject") {
        const r = await rejectKyc(selected.id, reason)
        if (!r.success) {
          showError(r.error || "تعذّر الرفض")
          return
        }
        showSuccess("❌ تم رفض الطلب + إرسال السبب للمستخدم")
      } else if (actionMode === "resubmit") {
        // No dedicated 'needs_resubmission' status in the DB enum
        // (the schema only has pending/approved/rejected). We treat
        // resubmit-request as a soft rejection — the user gets the
        // reason + the chance to re-upload from /kyc.
        const note = `[resubmit:${resubmitField}] ${reason}`
        const r = await rejectKyc(selected.id, note)
        if (!r.success) {
          showError(r.error || "تعذّر طلب إعادة الرفع")
          return
        }
        showSuccess("🔄 تم طلب إعادة رفع الصورة")
      }
      await refresh()
      closeAll()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="🛡️ التحقق من الهوية (KYC)"
        subtitle="إدارة طلبات توثيق المستخدمين ومراجعة الوثائق المرفقة"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="معلّقة" val={stats.pending} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
        <KPI label="مُوثّقة" val={stats.verified} color="#4ADE80" />
        <KPI label="مرفوضة" val={stats.rejected} color="#F87171" />
        <KPI label="اليوم" val={stats.today_count} color="#60A5FA" />
      </div>

      {/* Search + filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-3">
        <div className="relative lg:col-span-1">
          <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو البريد..."
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
          />
        </div>
        <select
          value={docFilter}
          onChange={(e) => setDocFilter(e.target.value)}
          className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="all">كل الوثائق</option>
          {Object.entries(KYC_DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="all">كل المدن</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <InnerTabBar tabs={tabs} active={filter} onSelect={setFilter} />

      {filtered.length === 0 ? (
        <AdminEmpty title="لا توجد طلبات تحقق" body="جرّب تعديل الفلترة" />
      ) : (
        <Table>
          <THead>
            <TH>المستخدم</TH>
            <TH>المدينة</TH>
            <TH>نوع الوثيقة</TH>
            <TH>الحالة</TH>
            <TH>تاريخ التقديم</TH>
            <TH>إجراءات</TH>
          </THead>
          <TBody>
            {filtered.map((k) => {
              const st = KYC_STATUS_LABELS[k.status]
              return (
                <TR key={k.id}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-xs font-bold text-white">
                        {k.user_name[0]}
                      </div>
                      <div>
                        <div className="text-xs text-white font-bold">{k.user_name}</div>
                        <div className="text-[10px] text-neutral-500" dir="ltr">{k.user_email}</div>
                      </div>
                    </div>
                  </TD>
                  <TD>{k.city || "—"}</TD>
                  <TD>{KYC_DOC_TYPE_LABELS[k.document_type]}</TD>
                  <TD><Badge label={st.label} color={st.color} /></TD>
                  <TD><span className="text-neutral-500 text-[11px]">{k.submitted_at}</span></TD>
                  <TD>
                    <ActionBtn label="عرض" color="blue" sm onClick={() => setSelected(k)} />
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {/* Detail Modal */}
      {selected && !actionMode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div>
                <div className="text-base font-bold text-white">تفاصيل التحقق</div>
                <div className="text-xs text-neutral-500 mt-1">رقم الطلب: <span className="font-mono">#{selected.id}</span></div>
              </div>
              <button onClick={closeAll} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User info card */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4 space-y-2">
              {[
                ["الاسم الكامل", selected.user_name],
                ["البريد الإلكتروني", selected.user_email],
                ["تاريخ الميلاد", selected.birth_date || "—"],
                ["المدينة", selected.city || "—"],
                ["نوع الوثيقة", KYC_DOC_TYPE_LABELS[selected.document_type]],
                ["تاريخ التقديم", selected.submitted_at],
              ].map(([l, v], i) => (
                <div key={i} className="flex justify-between gap-3">
                  <span className="text-[11px] text-neutral-500">{l}</span>
                  <span className="text-xs font-bold text-white text-left" dir={l === "البريد الإلكتروني" ? "ltr" : "rtl"}>{v}</span>
                </div>
              ))}
              {selected.rejection_reason && (
                <div className="mt-3 pt-3 border-t border-white/[0.05]">
                  <div className="text-[11px] text-red-400 font-bold mb-1">سبب الرفض السابق:</div>
                  <div className="text-xs text-neutral-300">{selected.rejection_reason}</div>
                </div>
              )}
            </div>

            {/* Documents */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { key: "front", label: "وجه الوثيقة", url: selected.front_url },
                { key: "back", label: "خلفية الوثيقة", url: selected.back_url },
                { key: "selfie", label: "Selfie مع الوثيقة", url: selected.selfie_url },
              ].map((doc) => (
                <div key={doc.key} className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
                  <div className="aspect-[3/4] bg-black flex items-center justify-center relative group">
                    <img src={doc.url} alt={doc.label} className="w-full h-full object-cover" />
                    <button
                      onClick={() => setZoomImage(doc.url)}
                      className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                    >
                      <ZoomIn className="w-6 h-6 text-white" />
                    </button>
                  </div>
                  <div className="px-3 py-2 text-[11px] text-neutral-300 text-center font-bold">
                    {doc.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer actions */}
            {selected.status === "pending" || selected.status === "needs_resubmission" ? (
              <div className="grid grid-cols-3 gap-2">
                <ActionBtn label="✅ موافقة" color="green" onClick={() => setActionMode("approve")} />
                <ActionBtn label="🔄 إعادة رفع" color="yellow" onClick={() => setActionMode("resubmit")} />
                <ActionBtn label="❌ رفض" color="red" onClick={() => setActionMode("reject")} />
              </div>
            ) : (
              <button
                onClick={closeAll}
                className="w-full py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إغلاق
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {selected && actionMode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">
                {actionMode === "approve" && "✅ تأكيد الموافقة"}
                {actionMode === "reject" && "❌ تأكيد الرفض"}
                {actionMode === "resubmit" && "🔄 طلب إعادة رفع"}
              </div>
              <button onClick={() => { setActionMode(null); setReason("") }} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-neutral-400 mb-4">
              المستخدم: <span className="text-white font-bold">{selected.user_name}</span>
            </div>

            {actionMode === "resubmit" && (
              <>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">الصورة المطلوب إعادتها</label>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {(["front", "back", "selfie"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setResubmitField(f)}
                      className={cn(
                        "py-2 rounded-lg text-[11px] font-bold border transition-colors",
                        resubmitField === f
                          ? "bg-yellow-400/[0.15] border-yellow-400/[0.4] text-yellow-400"
                          : "bg-white/[0.04] border-white/[0.08] text-neutral-400"
                      )}
                    >
                      {f === "front" ? "الوجه" : f === "back" ? "الخلف" : "Selfie"}
                    </button>
                  ))}
                </div>
              </>
            )}

            {(actionMode === "reject" || actionMode === "resubmit") && (
              <>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">
                  {actionMode === "reject" ? "سبب الرفض (إجباري)" : "ملاحظة للمستخدم (إجبارية)"}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="اكتب السبب الذي سيُرسل للمستخدم..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none mb-4"
                />
              </>
            )}

            {actionMode === "approve" && (
              <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-xl p-3 mb-4 text-xs text-green-400">
                سيتم تفعيل توثيق الحساب وإرسال إشعار للمستخدم. لا رجعة.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setActionMode(null); setReason("") }}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold border disabled:opacity-50",
                  actionMode === "approve" && "bg-green-500/[0.15] border-green-500/[0.3] text-green-400 hover:bg-green-500/[0.2]",
                  actionMode === "reject" && "bg-red-500/[0.15] border-red-500/[0.3] text-red-400 hover:bg-red-500/[0.2]",
                  actionMode === "resubmit" && "bg-yellow-500/[0.15] border-yellow-500/[0.3] text-yellow-400 hover:bg-yellow-500/[0.2]",
                )}
              >
                {submitting ? "جاري التنفيذ..." : "تأكيد"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom image modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomImage(null)}
        >
          <button
            onClick={() => setZoomImage(null)}
            className="absolute top-4 left-4 text-white/80 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img src={zoomImage} alt="zoom" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      <div className="mt-6 text-[10px] text-neutral-600 font-mono">
        {fmtNum(filtered.length)} من {fmtNum(MOCK_KYC_SUBMISSIONS.length)} طلب
      </div>
    </div>
  )
}
