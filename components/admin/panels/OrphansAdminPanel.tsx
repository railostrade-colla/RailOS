"use client"

import { useEffect, useState } from "react"
import { Search, X, Plus, FileText } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  MOCK_ORPHAN_CHILDREN,
  MOCK_SPONSORSHIPS,
  MOCK_ORPHAN_REPORTS,
  CHILD_STATUS_LABELS,
  EDUCATION_LABELS,
  SPONSORSHIP_TYPE_LABELS,
  type OrphanChild,
  type EducationLevel,
} from "@/lib/mock-data/orphans"
import {
  getAllChildren,
  getAllSponsorships,
  getAllReports,
  adminCreateOrphanChild,
  adminUpdateOrphanChild,
  adminRemoveOrphanChild,
  adminSendOrphanReport,
  type AdminSponsorshipRow,
  type AdminOrphanReportRow,
} from "@/lib/data/orphans-admin"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type SubTab = "children" | "sponsorships" | "reports"
type ChildAction = null | "add" | "edit" | "remove"

export function OrphansAdminPanel() {
  const [tab, setTab] = useState<SubTab>("children")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [selectedChild, setSelectedChild] = useState<OrphanChild | null>(null)
  const [childAction, setChildAction] = useState<ChildAction>(null)
  const [showCreateReport, setShowCreateReport] = useState(false)
  const [reportText, setReportText] = useState("")
  const [reportChild, setReportChild] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Phase 8.2 — child form state (shared between add + edit)
  const [chFirstName, setChFirstName] = useState("")
  const [chAge, setChAge] = useState<number>(8)
  const [chGender, setChGender] = useState<"male" | "female">("male")
  const [chCity, setChCity] = useState("")
  const [chEducation, setChEducation] = useState<EducationLevel>("primary")
  const [chNeeds, setChNeeds] = useState<number>(100000)
  const [chStory, setChStory] = useState("")
  const [chHealth, setChHealth] = useState<"good" | "monitoring" | "needs_care">("good")
  const [chBlur, setChBlur] = useState(true)

  const resetChildForm = () => {
    setChFirstName("")
    setChAge(8)
    setChGender("male")
    setChCity("")
    setChEducation("primary")
    setChNeeds(100000)
    setChStory("")
    setChHealth("good")
    setChBlur(true)
  }

  // Hydrate the form when "edit" opens; clear on "add".
  useEffect(() => {
    if (childAction === "edit" && selectedChild) {
      setChFirstName(selectedChild.first_name)
      setChAge(selectedChild.age)
      setChGender(selectedChild.gender)
      setChCity(selectedChild.city)
      setChEducation(selectedChild.education_level)
      setChNeeds(selectedChild.needs_amount_monthly)
      setChStory(selectedChild.story ?? "")
      setChHealth(selectedChild.health_status)
      setChBlur(selectedChild.blur_photo)
    } else if (childAction === "add") {
      resetChildForm()
    }
  }, [childAction, selectedChild])

  // Production mode — DB only.
  const [allChildren, setAllChildren] = useState<OrphanChild[]>([])
  const [sponsorships, setSponsorships] = useState<AdminSponsorshipRow[]>([])
  const [reports, setReports] = useState<AdminOrphanReportRow[]>(
    MOCK_ORPHAN_REPORTS.map((r) => ({
      id: r.id,
      child_id: r.child_id,
      child_name: r.child_first_name,
      period: r.period,
      highlights: r.highlights,
      sent_at: r.sent_at,
    })),
  )

  const refresh = () => {
    Promise.all([getAllChildren(), getAllSponsorships(), getAllReports()]).then(
      ([c, s, r]) => {
        if (c.length > 0) setAllChildren(c)
        if (s.length > 0) setSponsorships(s)
        if (r.length > 0) setReports(r)
      },
    )
  }
  useEffect(() => {
    refresh()
  }, [])

  const children = allChildren
    .filter((c) => filter === "all" || c.status === filter)
    .filter((c) => !search || c.first_name.includes(search) || c.city.includes(search))

  const handleChildAction = async () => {
    // ── Remove ──
    if (childAction === "remove" && selectedChild) {
      setSubmitting(true)
      const result = await adminRemoveOrphanChild(selectedChild.id)
      setSubmitting(false)
      if (!result.success) {
        showError("فشل الحذف")
        return
      }
      showSuccess("🗑️ تم حذف الطفل")
      refresh()
      setChildAction(null)
      setSelectedChild(null)
      return
    }

    // ── Add / Edit shared validation ──
    if (childAction === "add" || childAction === "edit") {
      if (!chFirstName.trim()) return showError("اسم الطفل مطلوب")
      if (chAge < 0 || chAge > 25) return showError("العمر بين 0 و25")
      if (!chCity.trim()) return showError("المدينة مطلوبة")
      if (!chNeeds || chNeeds <= 0) return showError("المبلغ الشهري المطلوب يجب أن يكون موجباً")
    }

    // ── Add ──
    if (childAction === "add") {
      setSubmitting(true)
      const result = await adminCreateOrphanChild({
        first_name: chFirstName.trim(),
        age: chAge,
        gender: chGender,
        city: chCity.trim(),
        education_level: chEducation,
        needs_amount_monthly: chNeeds,
        story: chStory.trim() || undefined,
        health_status: chHealth,
        blur_photo: chBlur,
      })
      setSubmitting(false)
      if (!result.success) {
        const map: Record<string, string> = {
          not_admin: "صلاحياتك لا تسمح",
          missing_table: "الجداول غير منشورة بعد",
        }
        showError(map[result.reason ?? ""] ?? "فشلت الإضافة")
        return
      }
      showSuccess(`✅ تم إضافة الطفل ${chFirstName}`)
      resetChildForm()
      refresh()
      setChildAction(null)
      setSelectedChild(null)
      return
    }

    // ── Edit ──
    if (childAction === "edit" && selectedChild) {
      setSubmitting(true)
      const result = await adminUpdateOrphanChild({
        child_id: selectedChild.id,
        first_name: chFirstName.trim(),
        age: chAge,
        gender: chGender,
        city: chCity.trim(),
        education_level: chEducation,
        needs_amount_monthly: chNeeds,
        story: chStory.trim() || undefined,
        health_status: chHealth,
        blur_photo: chBlur,
      })
      setSubmitting(false)
      if (!result.success) {
        const map: Record<string, string> = {
          not_admin: "صلاحياتك لا تسمح",
          not_found: "الطفل غير موجود",
          invalid_age: "العمر بين 0 و25",
          invalid_amount: "المبلغ غير صحيح",
          invalid_health_status: "الحالة الصحية غير صحيحة",
          missing_table: "الجداول غير منشورة بعد",
        }
        showError(map[result.reason ?? ""] ?? "فشل الحفظ")
        return
      }
      showSuccess("✅ تم تحديث بيانات الطفل")
      refresh()
      setChildAction(null)
      setSelectedChild(null)
    }
  }

  const handleSendReport = async () => {
    if (!reportText.trim() || !reportChild) return showError("اختر الطفل + اكتب التقرير")
    setSubmitting(true)
    const result = await adminSendOrphanReport({
      child_id: reportChild,
      period: new Date().toISOString().slice(0, 7),
      highlights: reportText.trim(),
    })
    if (!result.success) {
      showError("فشل إرسال التقرير")
      setSubmitting(false)
      return
    }
    showSuccess(`📨 تم إرسال التقرير لـ ${result.recipients ?? 0} مكفّل`)
    setShowCreateReport(false)
    setReportText("")
    setReportChild("")
    setSubmitting(false)
    refresh()
  }
  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="👶 إدارة الأيتام"
        subtitle="إدارة الأطفال + الكفالات + التقارير"
      />

      <InnerTabBar
        tabs={[
          { key: "children",     label: "👶 الأطفال",       count: allChildren.length },
          { key: "sponsorships", label: "❤️ الكفالات",      count: sponsorships.filter((s) => s.status === "active").length },
          { key: "reports",      label: "📊 التقارير",       count: reports.length },
        ]}
        active={tab}
        onSelect={(k) => setTab(k as SubTab)}
      />

      {/* TAB 1: Children */}
      {tab === "children" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KPI label="إجمالي" val={allChildren.length} color="#fff" />
            <KPI label="بحاجة لكفالة" val={allChildren.filter((c) => c.status === "needs_sponsor").length} color="#F87171" accent="rgba(248,113,113,0.05)" />
            <KPI label="جزئي" val={allChildren.filter((c) => c.status === "partial").length} color="#FBBF24" />
            <KPI label="مكفول" val={allChildren.filter((c) => c.status === "fully_sponsored").length} color="#4ADE80" />
          </div>

          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث (اسم/مدينة)..."
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
              />
            </div>
            <ActionBtn label="+ إضافة طفل" color="green" onClick={() => setChildAction("add")} />
          </div>

          <InnerTabBar
            tabs={[
              { key: "all",              label: "الكل",        count: MOCK_ORPHAN_CHILDREN.length },
              { key: "needs_sponsor",    label: "بحاجة",       count: MOCK_ORPHAN_CHILDREN.filter((c) => c.status === "needs_sponsor").length },
              { key: "partial",          label: "جزئي",        count: MOCK_ORPHAN_CHILDREN.filter((c) => c.status === "partial").length },
              { key: "fully_sponsored",  label: "مكفول",       count: MOCK_ORPHAN_CHILDREN.filter((c) => c.status === "fully_sponsored").length },
            ]}
            active={filter}
            onSelect={setFilter}
          />

          {children.length === 0 ? (
            <AdminEmpty title="لا يوجد أطفال" />
          ) : (
            <Table>
              <THead>
                <TH>الطفل</TH>
                <TH>العمر</TH>
                <TH>المدينة</TH>
                <TH>المرحلة</TH>
                <TH>المطلوب/شهر</TH>
                <TH>المُكفَل</TH>
                <TH>الحالة</TH>
                <TH>إجراءات</TH>
              </THead>
              <TBody>
                {children.map((c) => {
                  const st = CHILD_STATUS_LABELS[c.status]
                  return (
                    <TR key={c.id}>
                      <TD>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-sm">
                            {c.gender === "male" ? "👦" : "👧"}
                          </div>
                          <span className="text-xs text-white">{c.first_name}</span>
                        </div>
                      </TD>
                      <TD><span className="font-mono">{c.age}</span></TD>
                      <TD>{c.city}</TD>
                      <TD><span className="text-[11px]">{EDUCATION_LABELS[c.education_level]}</span></TD>
                      <TD><span className="font-mono text-yellow-400">{fmtNum(c.needs_amount_monthly)}</span></TD>
                      <TD><span className="font-mono text-green-400">{fmtNum(c.sponsored_amount)}</span></TD>
                      <TD><Badge label={st.label} color={st.color} /></TD>
                      <TD>
                        <div className="flex gap-1.5">
                          <ActionBtn label="تعديل" color="blue" sm onClick={() => { setSelectedChild(c); setChildAction("edit") }} />
                          <ActionBtn label="حذف" color="red" sm onClick={() => { setSelectedChild(c); setChildAction("remove") }} />
                        </div>
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          )}
        </>
      )}

      {/* TAB 2: Sponsorships */}
      {tab === "sponsorships" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KPI label="نشطة" val={sponsorships.filter((s) => s.status === "active").length} color="#4ADE80" />
            <KPI label="منتهية" val={sponsorships.filter((s) => s.status === "ended").length} color="#a3a3a3" />
            <KPI label="مكفّلون" val={new Set(sponsorships.map((s) => s.sponsor_id)).size} color="#a855f7" />
            <KPI label="مجموع شهري" val={fmtNum(sponsorships.filter((s) => s.status === "active" && s.type === "monthly").reduce((acc, s) => acc + s.amount, 0))} color="#FBBF24" />
          </div>

          <Table>
            <THead>
              <TH>المكفّل</TH>
              <TH>الطفل</TH>
              <TH>النوع</TH>
              <TH>المبلغ</TH>
              <TH>البداية</TH>
              <TH>الحالة</TH>
            </THead>
            <TBody>
              {sponsorships.map((s) => (
                <TR key={s.id}>
                  <TD>{s.sponsor_name}</TD>
                  <TD>{s.child_name}</TD>
                  <TD>{SPONSORSHIP_TYPE_LABELS[s.type as keyof typeof SPONSORSHIP_TYPE_LABELS] ?? s.type}</TD>
                  <TD><span className="font-mono text-green-400 font-bold">{fmtNum(s.amount)}</span></TD>
                  <TD><span className="text-[11px] text-neutral-500">{s.started_at}</span></TD>
                  <TD>
                    <Badge label={s.status === "active" ? "نشطة" : "منتهية"} color={s.status === "active" ? "green" : "gray"} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}

      {/* TAB 3: Reports */}
      {tab === "reports" && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <KPI label="إجمالي" val={reports.length} color="#fff" />
            <KPI label="هذا الشهر" val={reports.filter((r) => r.sent_at.startsWith(new Date().toISOString().slice(0, 7))).length} color="#60A5FA" />
            <KPI label="بفترة" val={reports.filter((r) => !!r.period).length} color="#a855f7" />
          </div>

          <div className="flex justify-end mb-3">
            <ActionBtn label="+ إنشاء تقرير" color="purple" onClick={() => setShowCreateReport(true)} />
          </div>

          <Table>
            <THead>
              <TH>الطفل</TH>
              <TH>الفترة</TH>
              <TH>الإنجازات</TH>
              <TH>التاريخ</TH>
            </THead>
            <TBody>
              {reports.map((r) => (
                <TR key={r.id}>
                  <TD>{r.child_name}</TD>
                  <TD>{r.period}</TD>
                  <TD><span className="text-[11px] line-clamp-1 max-w-xs">{r.highlights}</span></TD>
                  <TD><span className="text-[11px] text-neutral-500">{r.sent_at}</span></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}

      {/* Child action modal */}
      {childAction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={cn(
            "bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-h-[90vh] overflow-y-auto",
            childAction === "remove" ? "max-w-md" : "max-w-2xl",
          )}>
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">
                {childAction === "add" ? "+ إضافة طفل" : childAction === "edit" ? "✏️ تعديل بيانات" : "🗑️ حذف الطفل"}
              </div>
              <button
                onClick={() => { setChildAction(null); setSelectedChild(null) }}
                className="text-neutral-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {childAction === "remove" && (
              <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-xl p-3 mb-4 text-xs text-red-400">
                ⚠️ سيُحذف <span className="font-bold">{selectedChild?.first_name}</span> نهائياً + إيقاف كفالاته. هذا إجراء لا رجعة فيه.
              </div>
            )}

            {(childAction === "add" || childAction === "edit") && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-neutral-400 mb-1.5 block">الاسم الأول *</label>
                    <input
                      type="text"
                      value={chFirstName}
                      onChange={(e) => setChFirstName(e.target.value)}
                      placeholder="مثلاً: أحمد"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 mb-1.5 block">العمر *</label>
                    <input
                      type="number"
                      value={chAge}
                      onChange={(e) => setChAge(Number(e.target.value))}
                      min={0}
                      max={25}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">الجنس *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setChGender("male")}
                      className={cn(
                        "py-2.5 rounded-xl border text-xs font-bold transition-colors",
                        chGender === "male"
                          ? "bg-blue-500/[0.15] border-blue-500/[0.3] text-blue-400"
                          : "bg-white/[0.04] border-white/[0.08] text-neutral-400",
                      )}
                    >
                      👦 ذكر
                    </button>
                    <button
                      onClick={() => setChGender("female")}
                      className={cn(
                        "py-2.5 rounded-xl border text-xs font-bold transition-colors",
                        chGender === "female"
                          ? "bg-pink-500/[0.15] border-pink-500/[0.3] text-pink-400"
                          : "bg-white/[0.04] border-white/[0.08] text-neutral-400",
                      )}
                    >
                      👧 أنثى
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">المدينة *</label>
                  <input
                    type="text"
                    value={chCity}
                    onChange={(e) => setChCity(e.target.value)}
                    placeholder="مثلاً: بغداد"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-neutral-400 mb-1.5 block">المرحلة الدراسية *</label>
                    <select
                      value={chEducation}
                      onChange={(e) => setChEducation(e.target.value as EducationLevel)}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                    >
                      {Object.entries(EDUCATION_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 mb-1.5 block">الحالة الصحّية *</label>
                    <select
                      value={chHealth}
                      onChange={(e) => setChHealth(e.target.value as typeof chHealth)}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                    >
                      <option value="good">جيدة</option>
                      <option value="monitoring">تحت المتابعة</option>
                      <option value="needs_care">تحتاج رعاية</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">المطلوب شهرياً (د.ع) *</label>
                  <input
                    type="number"
                    value={chNeeds}
                    onChange={(e) => setChNeeds(Number(e.target.value))}
                    min={1}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">قصة الطفل (اختياري)</label>
                  <textarea
                    value={chStory}
                    onChange={(e) => setChStory(e.target.value)}
                    rows={3}
                    placeholder="نبذة قصيرة عن ظروف الطفل..."
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer p-3 bg-white/[0.04] border border-white/[0.08] rounded-xl">
                  <input
                    type="checkbox"
                    checked={chBlur}
                    onChange={(e) => setChBlur(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-xs text-neutral-300">
                    🔒 إخفاء الصور (لخصوصية الطفل)
                  </span>
                </label>
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setChildAction(null); setSelectedChild(null) }}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleChildAction}
                disabled={submitting}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-sm font-bold border disabled:opacity-50",
                  childAction === "remove"
                    ? "bg-red-500/[0.15] border-red-500/[0.3] text-red-400 hover:bg-red-500/[0.2]"
                    : "bg-green-500/[0.15] border-green-500/[0.3] text-green-400 hover:bg-green-500/[0.2]",
                )}
              >
                {submitting
                  ? "جاري..."
                  : childAction === "remove"
                    ? "تأكيد الحذف"
                    : childAction === "add"
                      ? "إضافة"
                      : "حفظ التعديلات"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create report modal */}
      {showCreateReport && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">📨 إنشاء تقرير + إرسال</div>
              <button onClick={() => setShowCreateReport(false)} className="text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <label className="text-xs text-neutral-400 mb-2 block font-bold">الطفل</label>
            <select
              value={reportChild}
              onChange={(e) => setReportChild(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 mb-3"
            >
              <option value="">— اختر —</option>
              {allChildren.map((c) => (
                <option key={c.id} value={c.id}>{c.first_name} ({c.age} سنوات)</option>
              ))}
            </select>

            <label className="text-xs text-neutral-400 mb-2 block font-bold">نص التقرير</label>
            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              rows={4}
              placeholder="التقدّم التعليمي + الحالة الصحّية + إنجازات..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none mb-4"
            />

            <div className="flex gap-2">
              <button onClick={() => setShowCreateReport(false)} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
              <button onClick={handleSendReport} className="flex-1 py-2.5 rounded-xl bg-purple-500/[0.15] border border-purple-500/[0.3] text-purple-400 text-sm font-bold hover:bg-purple-500/[0.2] flex items-center justify-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                إرسال
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
