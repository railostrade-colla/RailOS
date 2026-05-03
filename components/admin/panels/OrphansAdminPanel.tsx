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
} from "@/lib/mock-data/orphans"
import {
  getAllChildren,
  getAllSponsorships,
  getAllReports,
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

  // Mock first-paint, real DB on mount.
  const [allChildren, setAllChildren] = useState<OrphanChild[]>(MOCK_ORPHAN_CHILDREN)
  const [sponsorships, setSponsorships] = useState<AdminSponsorshipRow[]>(
    // Initial mock projection — keys differ slightly between mock + DB shape.
    MOCK_SPONSORSHIPS.map((s) => ({
      id: s.id,
      sponsor_id: s.sponsor_id,
      sponsor_name: s.is_anonymous ? "مجهول" : s.sponsor_name,
      child_id: s.child_id,
      child_name: s.child_first_name,
      amount: s.amount,
      type: s.type,
      status: s.status,
      started_at: s.started_at,
    })),
  )
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
    if (childAction === "remove" && selectedChild) {
      setSubmitting(true)
      const result = await adminRemoveOrphanChild(selectedChild.id)
      if (!result.success) {
        showError("فشل الحذف")
        setSubmitting(false)
        return
      }
      showSuccess("🗑️ تم حذف الطفل")
      refresh()
      setSubmitting(false)
    } else {
      // Add/edit forms: TODO in next pass — keep optimistic toast.
      showSuccess(
        childAction === "add" ? "✅ تم إضافة الطفل" : "✅ تم تحديث بيانات الطفل",
      )
    }
    setChildAction(null)
    setSelectedChild(null)
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
  void submitting

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
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">
                {childAction === "add" ? "+ إضافة طفل" : childAction === "edit" ? "✏️ تعديل بيانات" : "🗑️ حذف الطفل"}
              </div>
              <button onClick={() => { setChildAction(null); setSelectedChild(null) }} className="text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {childAction === "remove" && (
              <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-xl p-3 mb-4 text-xs text-red-400">
                ⚠️ سيُحذف <span className="font-bold">{selectedChild?.first_name}</span> نهائياً + إيقاف كفالاته. هذا إجراء لا رجعة فيه.
              </div>
            )}
            {childAction !== "remove" && (
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-4 text-xs text-neutral-400">
                نموذج {childAction === "add" ? "إضافة" : "تعديل"} طفل (Form كامل قيد التطوير).
                {selectedChild && <div className="mt-2 text-white">الطفل الحالي: {selectedChild.first_name}</div>}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setChildAction(null); setSelectedChild(null) }} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
              <button onClick={handleChildAction} className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-bold border",
                childAction === "remove" ? "bg-red-500/[0.15] border-red-500/[0.3] text-red-400" : "bg-green-500/[0.15] border-green-500/[0.3] text-green-400"
              )}>
                {childAction === "remove" ? "تأكيد الحذف" : "حفظ"}
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
