"use client"

import { useState } from "react"
import { Search, X } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  MOCK_HEALTHCARE_APPLICATIONS,
  MOCK_HEALTHCARE_CASES,
  MOCK_HEALTHCARE_DONATIONS,
  MOCK_INSURANCE_SUBSCRIPTIONS,
  APP_STATUS_LABELS,
  CASE_STATUS_LABELS,
  DISEASE_LABELS,
  type HealthcareApplication,
  type HealthcareCase,
} from "@/lib/mock-data/healthcare"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type SubTab = "applications" | "cases" | "finance"
type AppAction = null | "approve" | "reject"
type CaseAction = null | "update_progress" | "mark_completed"

export function HealthcareAdminPanel() {
  const [tab, setTab] = useState<SubTab>("applications")

  // Applications
  const [appFilter, setAppFilter] = useState<string>("pending")
  const [appSearch, setAppSearch] = useState("")
  const [selectedApp, setSelectedApp] = useState<HealthcareApplication | null>(null)
  const [appAction, setAppAction] = useState<AppAction>(null)
  const [appReason, setAppReason] = useState("")

  // Cases
  const [caseFilter, setCaseFilter] = useState<string>("urgent")
  const [selectedCase, setSelectedCase] = useState<HealthcareCase | null>(null)
  const [caseAction, setCaseAction] = useState<CaseAction>(null)
  const [progressAmount, setProgressAmount] = useState<number>(0)

  // Create case form
  const [showCreateCase, setShowCreateCase] = useState(false)
  const [newPatient, setNewPatient] = useState("")
  const [newAge, setNewAge] = useState("")
  const [newCity, setNewCity] = useState("")
  const [newDisease, setNewDisease] = useState("")
  const [newDiagnosis, setNewDiagnosis] = useState("")
  const [newHospital, setNewHospital] = useState("")
  const [newDoctor, setNewDoctor] = useState("")
  const [newCost, setNewCost] = useState("")
  const [newRequested, setNewRequested] = useState("")
  const [newAnonymous, setNewAnonymous] = useState(false)
  const [newUrgent, setNewUrgent] = useState(false)

  const handleCreateCase = (asDraft: boolean) => {
    if (!asDraft) {
      if (!newPatient.trim() || !newAge || !newCity.trim() || !newDiagnosis.trim() || !newHospital.trim() || !newCost) {
        return showError("املأ كل الحقول الإجبارية")
      }
    }
    showSuccess(asDraft
      ? "💾 تم حفظ الحالة كمسودّة"
      : `✅ تم نشر حالة "${newPatient}" — ${newUrgent ? "عاجلة" : "نشطة"}${newAnonymous ? " · مجهولة الهوية" : ""}`
    )
    setShowCreateCase(false)
    setNewPatient(""); setNewAge(""); setNewCity(""); setNewDisease("")
    setNewDiagnosis(""); setNewHospital(""); setNewDoctor("")
    setNewCost(""); setNewRequested(""); setNewAnonymous(false); setNewUrgent(false)
  }

  const apps = MOCK_HEALTHCARE_APPLICATIONS
    .filter((a) => appFilter === "all" || a.status === appFilter)
    .filter((a) => !appSearch || a.user_name.includes(appSearch) || a.diagnosis.includes(appSearch))

  const cases = MOCK_HEALTHCARE_CASES.filter((c) => caseFilter === "all" || c.status === caseFilter)

  const handleAppAction = () => {
    if (!selectedApp || !appAction) return
    if (appAction === "reject" && !appReason.trim()) return showError("سبب الرفض مطلوب")
    showSuccess(appAction === "approve" ? "✅ تمت الموافقة على الطلب" : "❌ تم رفض الطلب")
    setSelectedApp(null)
    setAppAction(null)
    setAppReason("")
  }

  const handleCaseAction = () => {
    if (!selectedCase) return
    if (caseAction === "update_progress" && progressAmount <= 0) return showError("أدخل مبلغاً صحيحاً")
    showSuccess(caseAction === "update_progress" ? `✅ تم تحديث المبلغ المُجمَّع` : "✅ تم وضع الحالة كمُكتملة")
    setSelectedCase(null)
    setCaseAction(null)
    setProgressAmount(0)
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <div className="flex justify-between items-start mb-4 gap-3">
        <div>
          <div className="text-lg font-bold text-white">🏥 إدارة الرعاية الصحية</div>
          <div className="text-xs text-neutral-500 mt-0.5">مراجعة الطلبات + إدارة الحالات + متابعة التبرّعات والتأمين</div>
        </div>
        <ActionBtn
          label="+ إنشاء حالة تبرّع جديدة"
          color="purple"
          onClick={() => setShowCreateCase(true)}
        />
      </div>

      <InnerTabBar
        tabs={[
          { key: "applications", label: "📋 الطلبات",         count: MOCK_HEALTHCARE_APPLICATIONS.filter((a) => a.status === "pending").length },
          { key: "cases",        label: "🏥 الحالات النشطة", count: MOCK_HEALTHCARE_CASES.filter((c) => c.status !== "completed").length },
          { key: "finance",      label: "💰 الماليات" },
        ]}
        active={tab}
        onSelect={(k) => setTab(k as SubTab)}
      />

      {/* ═══ TAB 1: Applications ═══ */}
      {tab === "applications" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KPI label="بانتظار" val={MOCK_HEALTHCARE_APPLICATIONS.filter((a) => a.status === "pending").length} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
            <KPI label="مُوافَق" val={MOCK_HEALTHCARE_APPLICATIONS.filter((a) => a.status === "approved").length} color="#4ADE80" />
            <KPI label="مرفوض" val={MOCK_HEALTHCARE_APPLICATIONS.filter((a) => a.status === "rejected").length} color="#F87171" />
            <KPI label="إجمالي" val={MOCK_HEALTHCARE_APPLICATIONS.length} color="#fff" />
          </div>

          <div className="relative mb-3">
            <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={appSearch}
              onChange={(e) => setAppSearch(e.target.value)}
              placeholder="بحث (اسم/تشخيص)..."
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
            />
          </div>

          <InnerTabBar
            tabs={[
              { key: "all",      label: "الكل",   count: MOCK_HEALTHCARE_APPLICATIONS.length },
              { key: "pending",  label: "بانتظار", count: MOCK_HEALTHCARE_APPLICATIONS.filter((a) => a.status === "pending").length },
              { key: "approved", label: "مُوافَق", count: MOCK_HEALTHCARE_APPLICATIONS.filter((a) => a.status === "approved").length },
              { key: "rejected", label: "مرفوض",  count: MOCK_HEALTHCARE_APPLICATIONS.filter((a) => a.status === "rejected").length },
            ]}
            active={appFilter}
            onSelect={setAppFilter}
          />

          {apps.length === 0 ? (
            <AdminEmpty title="لا توجد طلبات" />
          ) : (
            <Table>
              <THead>
                <TH>المستخدم</TH>
                <TH>المرض</TH>
                <TH>التكلفة</TH>
                <TH>المطلوب</TH>
                <TH>الحالة</TH>
                <TH>التاريخ</TH>
                <TH>إجراءات</TH>
              </THead>
              <TBody>
                {apps.map((a) => {
                  const d = DISEASE_LABELS[a.disease_type]
                  const st = APP_STATUS_LABELS[a.status]
                  return (
                    <TR key={a.id}>
                      <TD>{a.user_name}</TD>
                      <TD><span className="text-[11px]">{d.icon} {d.label}</span></TD>
                      <TD><span className="font-mono">{fmtNum(a.total_cost)}</span></TD>
                      <TD><span className="font-mono text-blue-400 font-bold">{fmtNum(a.requested_amount)}</span></TD>
                      <TD><Badge label={st.label} color={st.color} /></TD>
                      <TD><span className="text-[11px] text-neutral-500">{a.submitted_at}</span></TD>
                      <TD>
                        <ActionBtn label={a.status === "pending" ? "مراجعة" : "عرض"} color={a.status === "pending" ? "blue" : "gray"} sm onClick={() => setSelectedApp(a)} />
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          )}
        </>
      )}

      {/* ═══ TAB 2: Cases ═══ */}
      {tab === "cases" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KPI label="عاجلة" val={MOCK_HEALTHCARE_CASES.filter((c) => c.status === "urgent").length} color="#F87171" accent="rgba(248,113,113,0.05)" />
            <KPI label="نشطة" val={MOCK_HEALTHCARE_CASES.filter((c) => c.status === "active").length} color="#FBBF24" />
            <KPI label="مُكتملة" val={MOCK_HEALTHCARE_CASES.filter((c) => c.status === "completed").length} color="#4ADE80" />
            <KPI label="إجمالي المبالغ" val={fmtNum(MOCK_HEALTHCARE_CASES.reduce((s, c) => s + c.amount_collected, 0))} color="#60A5FA" />
          </div>

          <InnerTabBar
            tabs={[
              { key: "urgent",    label: "عاجلة",   count: MOCK_HEALTHCARE_CASES.filter((c) => c.status === "urgent").length },
              { key: "active",    label: "نشطة",    count: MOCK_HEALTHCARE_CASES.filter((c) => c.status === "active").length },
              { key: "completed", label: "مُكتملة", count: MOCK_HEALTHCARE_CASES.filter((c) => c.status === "completed").length },
            ]}
            active={caseFilter}
            onSelect={setCaseFilter}
          />

          {cases.length === 0 ? (
            <AdminEmpty title="لا توجد حالات" />
          ) : (
            <Table>
              <THead>
                <TH>المريض</TH>
                <TH>المرض</TH>
                <TH>المُجمَّع</TH>
                <TH>المطلوب</TH>
                <TH>التقدّم</TH>
                <TH>متبرّعون</TH>
                <TH>الحالة</TH>
                <TH>إجراءات</TH>
              </THead>
              <TBody>
                {cases.map((c) => {
                  const d = DISEASE_LABELS[c.disease_type]
                  const st = CASE_STATUS_LABELS[c.status]
                  const pct = Math.round((c.amount_collected / c.total_required) * 100)
                  return (
                    <TR key={c.id}>
                      <TD>{c.patient_display_name}</TD>
                      <TD><span className="text-[11px]">{d.icon} {d.label}</span></TD>
                      <TD><span className="font-mono text-green-400">{fmtNum(c.amount_collected)}</span></TD>
                      <TD><span className="font-mono">{fmtNum(c.total_required)}</span></TD>
                      <TD>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-red-400 to-orange-400" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-yellow-400 font-bold">{pct}%</span>
                        </div>
                      </TD>
                      <TD><span className="font-mono">{c.donors_count}</span></TD>
                      <TD><Badge label={st.label} color={st.color} /></TD>
                      <TD>
                        <ActionBtn label="إدارة" color="blue" sm onClick={() => { setSelectedCase(c); setProgressAmount(c.amount_collected) }} />
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          )}
        </>
      )}

      {/* ═══ TAB 3: Finance ═══ */}
      {tab === "finance" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KPI label="إجمالي التبرّعات" val={fmtNum(MOCK_HEALTHCARE_DONATIONS.reduce((s, d) => s + d.amount, 0))} color="#4ADE80" />
            <KPI label="عدد التبرّعات" val={MOCK_HEALTHCARE_DONATIONS.length} color="#60A5FA" />
            <KPI label="مشتركو التأمين" val={MOCK_INSURANCE_SUBSCRIPTIONS.filter((s) => s.status === "active").length} color="#a855f7" />
            <KPI label="إيرادات التأمين الشهرية" val={fmtNum(MOCK_INSURANCE_SUBSCRIPTIONS.filter((s) => s.status === "active").reduce((acc, s) => acc + s.monthly_fee, 0))} color="#FBBF24" />
          </div>

          <SectionHeader title="💳 آخر التبرّعات" />
          <Table>
            <THead>
              <TH>المتبرّع</TH>
              <TH>المبلغ</TH>
              <TH>الحالة</TH>
              <TH>متكرّر</TH>
              <TH>التاريخ</TH>
            </THead>
            <TBody>
              {MOCK_HEALTHCARE_DONATIONS.slice(0, 10).map((d) => (
                <TR key={d.id}>
                  <TD>{d.is_anonymous ? <span className="text-neutral-500">مجهول</span> : d.donor_name}</TD>
                  <TD><span className="font-mono text-green-400 font-bold">+{fmtNum(d.amount)}</span></TD>
                  <TD>{d.case_id ? <Badge label={`حالة #${d.case_id.slice(-2)}`} color="blue" /> : <Badge label="عام" color="gray" />}</TD>
                  <TD>{d.is_recurring ? "🔁" : "—"}</TD>
                  <TD><span className="text-[11px] text-neutral-500">{d.created_at}</span></TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <div className="mt-6">
            <SectionHeader title="🛡️ مشتركو التأمين" />
            <Table>
              <THead>
                <TH>المستخدم</TH>
                <TH>الخطّة</TH>
                <TH>القسط الشهري</TH>
                <TH>التغطية</TH>
                <TH>الفاتورة التالية</TH>
                <TH>الحالة</TH>
              </THead>
              <TBody>
                {MOCK_INSURANCE_SUBSCRIPTIONS.map((s) => (
                  <TR key={s.id}>
                    <TD>{s.user_name || s.user_id}</TD>
                    <TD>{s.plan === "basic" ? "أساسي" : s.plan === "advanced" ? "متقدّم" : "شامل"}</TD>
                    <TD><span className="font-mono">{fmtNum(s.monthly_fee)}</span></TD>
                    <TD>{s.coverage_pct}%</TD>
                    <TD><span className="text-[11px] text-neutral-500">{s.next_billing}</span></TD>
                    <TD>
                      <Badge
                        label={s.status === "active" ? "نشط" : s.status === "paused" ? "موقوف" : "ملغى"}
                        color={s.status === "active" ? "green" : s.status === "paused" ? "yellow" : "red"}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </>
      )}

      {/* App detail modal */}
      {selectedApp && !appAction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-base font-bold text-white">طلب #{selectedApp.id}</div>
                <div className="text-xs text-neutral-500 mt-1">{selectedApp.user_name} · {selectedApp.submitted_at}</div>
              </div>
              <button onClick={() => setSelectedApp(null)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4 space-y-2">
              {[
                ["المرض", `${DISEASE_LABELS[selectedApp.disease_type].icon} ${DISEASE_LABELS[selectedApp.disease_type].label}`],
                ["الطبيب", selectedApp.doctor_name],
                ["المستشفى", selectedApp.hospital],
                ["التكلفة الكلّية", fmtNum(selectedApp.total_cost) + " د.ع"],
                ["المتوفّر", fmtNum(selectedApp.user_available) + " د.ع"],
                ["المطلوب", fmtNum(selectedApp.requested_amount) + " د.ع"],
              ].map(([l, v], i) => (
                <div key={i} className="flex justify-between gap-3 text-xs">
                  <span className="text-neutral-500">{l}</span>
                  <span className="text-white text-left">{v}</span>
                </div>
              ))}
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-4">
              <div className="text-[11px] text-neutral-400 font-bold mb-2">التشخيص</div>
              <div className="text-xs text-neutral-200 leading-relaxed">{selectedApp.diagnosis}</div>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-4">
              <div className="text-[11px] text-neutral-400 font-bold mb-2">المرفقات ({selectedApp.attachments.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {selectedApp.attachments.length === 0 ? (
                  <span className="text-[11px] text-neutral-600">— لا مرفقات —</span>
                ) : (
                  selectedApp.attachments.map((a, i) => (
                    <span key={i} className="bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1 text-[10px] text-neutral-300 font-mono">📎 {a}</span>
                  ))
                )}
              </div>
            </div>

            {selectedApp.rejection_reason && (
              <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-xl p-3 mb-4">
                <div className="text-[11px] text-red-400 font-bold mb-1">سبب الرفض</div>
                <div className="text-xs text-neutral-300">{selectedApp.rejection_reason}</div>
              </div>
            )}

            {selectedApp.status === "pending" ? (
              <div className="grid grid-cols-2 gap-2">
                <ActionBtn label="✅ موافقة" color="green" onClick={() => setAppAction("approve")} />
                <ActionBtn label="❌ رفض" color="red" onClick={() => setAppAction("reject")} />
              </div>
            ) : (
              <button onClick={() => setSelectedApp(null)} className="w-full py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إغلاق</button>
            )}
          </div>
        </div>
      )}

      {selectedApp && appAction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="text-base font-bold text-white mb-4">{appAction === "approve" ? "✅ تأكيد الموافقة" : "❌ تأكيد الرفض"}</div>
            {appAction === "reject" && (
              <textarea
                value={appReason}
                onChange={(e) => setAppReason(e.target.value)}
                rows={3}
                placeholder="سبب الرفض..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none mb-4"
              />
            )}
            <div className="flex gap-2">
              <button onClick={() => { setAppAction(null); setAppReason("") }} className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
              <button onClick={handleAppAction} className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold border",
                appAction === "approve" && "bg-green-500/[0.15] border-green-500/[0.3] text-green-400",
                appAction === "reject" && "bg-red-500/[0.15] border-red-500/[0.3] text-red-400"
              )}>تأكيد</button>
            </div>
          </div>
        </div>
      )}

      {/* Case modal */}
      {selectedCase && !caseAction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">{selectedCase.patient_display_name} #{selectedCase.id}</div>
              <button onClick={() => setSelectedCase(null)} className="text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-4 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-neutral-500">المُجمَّع</span><span className="font-mono text-green-400">{fmtNum(selectedCase.amount_collected)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">المطلوب</span><span className="font-mono">{fmtNum(selectedCase.total_required)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">التقدّم</span><span className="font-mono text-yellow-400">{Math.round((selectedCase.amount_collected / selectedCase.total_required) * 100)}%</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ActionBtn label="✏️ تحديث المبلغ" color="blue" onClick={() => setCaseAction("update_progress")} />
              <ActionBtn label="✅ مُكتملة" color="green" onClick={() => setCaseAction("mark_completed")} />
            </div>
          </div>
        </div>
      )}

      {selectedCase && caseAction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="text-base font-bold text-white mb-4">
              {caseAction === "update_progress" ? "✏️ تحديث المبلغ المُجمَّع" : "✅ تأكيد الإكمال"}
            </div>
            {caseAction === "update_progress" && (
              <input
                type="number"
                value={progressAmount}
                onChange={(e) => setProgressAmount(Number(e.target.value))}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20 mb-4"
              />
            )}
            <div className="flex gap-2">
              <button onClick={() => setCaseAction(null)} className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
              <button onClick={handleCaseAction} className="flex-1 py-3 rounded-xl bg-blue-500/[0.15] border border-blue-500/[0.3] text-blue-400 text-sm font-bold">تأكيد</button>
            </div>
          </div>
        </div>
      )}

      {/* Create new case modal */}
      {showCreateCase && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div className="text-base font-bold text-white">+ إنشاء حالة تبرّع جديدة</div>
              <button onClick={() => setShowCreateCase(false)} className="text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">اسم المريض (أو initial) *</label>
                <input type="text" value={newPatient} onChange={(e) => setNewPatient(e.target.value)} placeholder="مثلاً: أ. م." className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">العمر *</label>
                <input type="number" value={newAge} onChange={(e) => setNewAge(e.target.value)} placeholder="6" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white font-mono outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">المدينة *</label>
                <input type="text" value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="بغداد" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">نوع المرض *</label>
                <select value={newDisease} onChange={(e) => setNewDisease(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20">
                  <option value="">— اختر —</option>
                  {Object.entries(DISEASE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className="text-xs text-neutral-400 mb-1.5 block">التشخيص *</label>
                <textarea value={newDiagnosis} onChange={(e) => setNewDiagnosis(e.target.value)} rows={2} placeholder="تفاصيل التشخيص الطبّي..." className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20 resize-none" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">المستشفى *</label>
                <input type="text" value={newHospital} onChange={(e) => setNewHospital(e.target.value)} placeholder="مستشفى الأطفال" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">الطبيب المعالج</label>
                <input type="text" value={newDoctor} onChange={(e) => setNewDoctor(e.target.value)} placeholder="د. علي" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">التكلفة الكلّية (د.ع) *</label>
                <input type="number" value={newCost} onChange={(e) => setNewCost(e.target.value)} placeholder="18000000" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white font-mono outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">المطلوب من البرنامج</label>
                <input type="number" value={newRequested} onChange={(e) => setNewRequested(e.target.value)} placeholder="15000000" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white font-mono outline-none focus:border-white/20" />
              </div>
            </div>

            {/* Placeholders */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button className="bg-white/[0.04] border-2 border-dashed border-white/[0.15] rounded-xl py-4 text-xs text-neutral-400 hover:border-white/[0.25] transition-colors">📷 صورة المريض (placeholder)</button>
              <button className="bg-white/[0.04] border-2 border-dashed border-white/[0.15] rounded-xl py-4 text-xs text-neutral-400 hover:border-white/[0.25] transition-colors">📋 التقرير الطبّي (placeholder)</button>
            </div>

            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newAnonymous} onChange={(e) => setNewAnonymous(e.target.checked)} className="w-4 h-4" />
                <span className="text-xs text-neutral-300">إخفاء هويّة المريض (anonymous)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newUrgent} onChange={(e) => setNewUrgent(e.target.checked)} className="w-4 h-4" />
                <span className="text-xs text-red-400">🚨 حالة عاجلة</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowCreateCase(false)} className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
              <button onClick={() => handleCreateCase(true)} className="flex-1 py-3 rounded-xl bg-yellow-500/[0.15] border border-yellow-500/[0.3] text-yellow-400 text-sm font-bold hover:bg-yellow-500/[0.2]">💾 مسودّة</button>
              <button onClick={() => handleCreateCase(false)} className="flex-1 py-3 rounded-xl bg-green-500/[0.15] border border-green-500/[0.3] text-green-400 text-sm font-bold hover:bg-green-500/[0.2]">📤 نشر للتبرّع</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
