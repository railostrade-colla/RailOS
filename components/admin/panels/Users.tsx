"use client"

import { useState } from "react"
import { Search, Star, AlertTriangle, FileText } from "lucide-react"
import { Badge, ActionBtn, Table, THead, TH, TBody, TR, TD, SectionHeader, KPI, InnerTabBar, AdminEmpty } from "@/components/admin/ui"
import { mockUsersAdmin, mockDisputesAdmin, disputeReasonLabels, mockRatingsAdmin, mockSupportTickets } from "@/lib/admin/mock-data"
import { showSuccess } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

type UsersSubTab = "users" | "disputes" | "ratings" | "support"

export function UsersPanel() {
  const [subTab, setSubTab] = useState<UsersSubTab>("users")
  const [filter, setFilter] = useState<string>("all")
  const [search, setSearch] = useState("")

  const filteredUsers = mockUsersAdmin
    .filter((u) => {
      if (filter === "all") return true
      if (filter === "pending") return u.kyc_status === "pending"
      if (filter === "verified") return u.kyc_status === "verified"
      if (filter === "blocked") return u.blocked
      return true
    })
    .filter((u) => !search || u.name.includes(search) || u.phone.includes(search))

  const tabs = [
    { key: "users", label: "⊙ المستخدمون", count: mockUsersAdmin.length },
    { key: "disputes", label: "⚖ النزاعات", count: mockDisputesAdmin.filter((d) => d.status === "open").length },
    { key: "ratings", label: "⭐ التقييمات", count: mockRatingsAdmin.length },
    { key: "support", label: "📩 الدعم", count: mockSupportTickets.filter((s) => s.status === "new").length },
  ]

  const userFilters = [
    { key: "all", label: "الكل", count: mockUsersAdmin.length },
    { key: "pending", label: "KYC معلق", count: mockUsersAdmin.filter((u) => u.kyc_status === "pending").length },
    { key: "verified", label: "موثقون", count: mockUsersAdmin.filter((u) => u.kyc_status === "verified").length },
    { key: "blocked", label: "محظورون", count: mockUsersAdmin.filter((u) => u.blocked).length },
  ]

  return (
    <div className="p-6 max-w-screen-2xl">

      <SectionHeader title="⊙ المستخدمون والإدارة" subtitle="إدارة المستخدمين والنزاعات والتقييمات والدعم" />

      <InnerTabBar tabs={tabs} active={subTab} onSelect={(k) => setSubTab(k as UsersSubTab)} />

      {/* Users Tab */}
      {subTab === "users" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
            <KPI label="إجمالي" val={mockUsersAdmin.length} color="#fff" />
            <KPI label="موثقون" val={mockUsersAdmin.filter((u) => u.kyc_status === "verified").length} color="#4ADE80" />
            <KPI label="KYC معلق" val={mockUsersAdmin.filter((u) => u.kyc_status === "pending").length} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
            <KPI label="KYC مرفوض" val={mockUsersAdmin.filter((u) => u.kyc_status === "rejected").length} color="#F87171" />
            <KPI label="مستوى Pro" val={mockUsersAdmin.filter((u) => u.level === "pro").length} color="#C084FC" />
            <KPI label="محظورون" val={mockUsersAdmin.filter((u) => u.blocked).length} color="#F87171" />
          </div>

          <div className="relative mb-3">
            <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الهاتف..."
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
            />
          </div>

          <InnerTabBar tabs={userFilters} active={filter} onSelect={setFilter} />

          {filteredUsers.length === 0 ? (
            <AdminEmpty title="لا توجد نتائج" body="جرب تغيير الفلترة أو البحث" />
          ) : (
            <Table>
              <THead>
                <TH>#</TH>
                <TH>الاسم</TH>
                <TH>الهاتف</TH>
                <TH>المستوى</TH>
                <TH>KYC</TH>
                <TH>الصفقات</TH>
                <TH>السمعة</TH>
                <TH>الإجراءات</TH>
              </THead>
              <TBody>
                {filteredUsers.map((u, i) => (
                  <TR key={u.id}>
                    <TD><span className="text-neutral-500">{i + 1}</span></TD>
                    <TD>{u.name}</TD>
                    <TD><span dir="ltr" className="font-mono text-[11px]">{u.phone}</span></TD>
                    <TD>
                      <Badge
                        label={u.level === "pro" ? "★ Pro" : u.level === "advanced" ? "متقدم" : "أساسي"}
                        color={u.level === "pro" ? "purple" : u.level === "advanced" ? "blue" : "gray"}
                      />
                    </TD>
                    <TD>
                      <Badge
                        label={u.kyc_status === "verified" ? "موثق" : u.kyc_status === "rejected" ? "مرفوض" : "معلق"}
                        color={u.kyc_status === "verified" ? "green" : u.kyc_status === "rejected" ? "red" : "yellow"}
                      />
                    </TD>
                    <TD><span className="text-green-400 font-bold font-mono">{u.total_trades}</span></TD>
                    <TD><span className="font-mono">{u.reputation_score}</span></TD>
                    <TD>
                      <div className="flex gap-1.5 flex-wrap">
                        {u.kyc_status !== "verified" && (
                          <ActionBtn label="✓ توثيق" color="green" sm onClick={() => showSuccess("تم التوثيق")} />
                        )}
                        {u.kyc_status === "verified" && (
                          <ActionBtn label="إلغاء التوثيق" color="red" sm onClick={() => showSuccess("تم الإلغاء")} />
                        )}
                        {u.level !== "pro" && (
                          <ActionBtn label="↑ Pro" color="purple" sm onClick={() => showSuccess("تمت الترقية")} />
                        )}
                        {!u.blocked ? (
                          <ActionBtn label="حظر" color="red" sm onClick={() => showSuccess("تم الحظر")} />
                        ) : (
                          <ActionBtn label="فك الحظر" color="green" sm onClick={() => showSuccess("تم فك الحظر")} />
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </>
      )}

      {/* Disputes Tab */}
      {subTab === "disputes" && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <KPI label="مفتوحة" val={mockDisputesAdmin.filter((d) => d.status === "open").length} color="#F87171" accent="rgba(248,113,113,0.05)" />
            <KPI label="قيد التحقيق" val={mockDisputesAdmin.filter((d) => d.status === "investigating").length} color="#FBBF24" />
            <KPI label="محلولة" val={mockDisputesAdmin.filter((d) => d.status === "resolved").length} color="#4ADE80" />
          </div>

          <div className="space-y-3">
            {mockDisputesAdmin.map((d) => (
              <div
                key={d.id}
                className={cn(
                  "rounded-2xl p-4 border",
                  d.status === "open" ? "bg-red-400/[0.05] border-red-400/20" :
                  d.status === "investigating" ? "bg-yellow-400/[0.05] border-yellow-400/20" :
                  "bg-white/[0.05] border-white/[0.08]"
                )}
              >
                <div className="flex items-start justify-between mb-2 gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={cn(
                      "w-4 h-4",
                      d.status === "open" ? "text-red-400" : d.status === "investigating" ? "text-yellow-400" : "text-green-400"
                    )} />
                    <span className="text-sm font-bold text-white">نزاع #{d.id}</span>
                    <span className="text-xs text-neutral-500">صفقة #{d.trade_id}</span>
                  </div>
                  <Badge
                    label={d.status === "open" ? "مفتوح" : d.status === "investigating" ? "قيد التحقيق" : "محلول"}
                    color={d.status === "open" ? "red" : d.status === "investigating" ? "yellow" : "green"}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                    <div className="text-[10px] text-neutral-500 mb-0.5">المُشتكي</div>
                    <div className="text-sm font-bold text-white">{d.complainant}</div>
                  </div>
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                    <div className="text-[10px] text-neutral-500 mb-0.5">المُشتكى عليه</div>
                    <div className="text-sm font-bold text-white">{d.respondent}</div>
                  </div>
                </div>

                <div className="text-[11px] text-neutral-400 mb-1">
                  <span className="text-neutral-500">السبب: </span>
                  <span className="text-white font-bold">{disputeReasonLabels[d.reason] || d.reason}</span>
                </div>
                <div className="text-xs text-neutral-300 leading-relaxed mb-3">{d.details}</div>

                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-neutral-500">{d.created_at}</span>
                  {d.status !== "resolved" && (
                    <div className="flex gap-1.5">
                      <ActionBtn label="تحقيق" color="yellow" sm onClick={() => showSuccess("بدأ التحقيق")} />
                      <ActionBtn label="حل لصالح المُشتكي" color="green" sm onClick={() => showSuccess("تم الحل")} />
                      <ActionBtn label="رفض الشكوى" color="red" sm onClick={() => showSuccess("تم الرفض")} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Ratings Tab */}
      {subTab === "ratings" && (
        <Table>
          <THead>
            <TH>من</TH>
            <TH>إلى</TH>
            <TH>التقييم</TH>
            <TH>التعليق</TH>
            <TH>الصفقة</TH>
            <TH>التاريخ</TH>
          </THead>
          <TBody>
            {mockRatingsAdmin.map((r) => (
              <TR key={r.id}>
                <TD>{r.from_user}</TD>
                <TD>{r.to_user}</TD>
                <TD>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={cn("w-3.5 h-3.5", n <= r.stars ? "fill-yellow-400 text-yellow-400" : "text-neutral-700")}
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>
                </TD>
                <TD><span className="text-neutral-300 text-[11px]">{r.comment || "—"}</span></TD>
                <TD><span className="font-mono text-[11px]">#{r.trade_id}</span></TD>
                <TD><span className="text-neutral-500">{r.created_at}</span></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {/* Support Tab */}
      {subTab === "support" && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <KPI label="جديدة" val={mockSupportTickets.filter((t) => t.status === "new").length} color="#60A5FA" accent="rgba(96,165,250,0.05)" />
            <KPI label="قيد المعالجة" val={mockSupportTickets.filter((t) => t.status === "in_progress").length} color="#FBBF24" />
            <KPI label="مردود عليها" val={mockSupportTickets.filter((t) => t.status === "replied").length} color="#4ADE80" />
          </div>

          <div className="space-y-3">
            {mockSupportTickets.map((t) => (
              <div
                key={t.id}
                className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4"
              >
                <div className="flex items-start justify-between mb-2 gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{t.subject}</span>
                    <Badge label={t.type} color="gray" />
                    <Badge
                      label={t.priority === "high" ? "عاجل" : t.priority === "medium" ? "متوسط" : "عادي"}
                      color={t.priority === "high" ? "red" : t.priority === "medium" ? "yellow" : "gray"}
                    />
                  </div>
                  <Badge
                    label={t.status === "new" ? "جديد" : t.status === "in_progress" ? "قيد المعالجة" : "مردود"}
                    color={t.status === "new" ? "blue" : t.status === "in_progress" ? "yellow" : "green"}
                  />
                </div>
                <div className="text-[11px] text-neutral-500 mb-2">من: <span className="text-white font-bold">{t.user_name}</span> • {t.created_at}</div>
                <div className="text-xs text-neutral-300 leading-relaxed mb-3 bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">{t.message}</div>
                {t.status !== "replied" && (
                  <div className="flex gap-1.5">
                    <ActionBtn label="رد" color="green" sm onClick={() => showSuccess("تم فتح نافذة الرد")} />
                    <ActionBtn label="معالجة" color="yellow" sm onClick={() => showSuccess("تم النقل لقيد المعالجة")} />
                    <ActionBtn label="إغلاق" color="gray" sm onClick={() => showSuccess("تم الإغلاق")} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
