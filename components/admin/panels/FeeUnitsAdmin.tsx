"use client"

import { useState } from "react"
import { Search, X, ExternalLink } from "lucide-react"
import { Badge, ActionBtn, Table, THead, TH, TBody, TR, TD, SectionHeader, KPI, InnerTabBar, AdminEmpty } from "@/components/admin/ui"
import { mockFeeUnitsRequestsAdmin, paymentLabels } from "@/lib/admin/mock-data"
import { showSuccess, showError } from "@/lib/utils/toast"

const fmtNum = (n: number) => n.toLocaleString("en-US")

export function FeeUnitsAdminPanel() {
  const [filter, setFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [selectedRequest, setSelectedRequest] = useState<typeof mockFeeUnitsRequestsAdmin[0] | null>(null)
  const [adminNote, setAdminNote] = useState("")

  const tabs = [
    { key: "all", label: "الكل", count: mockFeeUnitsRequestsAdmin.length },
    { key: "pending", label: "معلقة", count: mockFeeUnitsRequestsAdmin.filter((r) => r.status === "pending").length },
    { key: "approved", label: "موافق", count: mockFeeUnitsRequestsAdmin.filter((r) => r.status === "approved").length },
    { key: "auto_verified", label: "تلقائي", count: mockFeeUnitsRequestsAdmin.filter((r) => r.status === "auto_verified").length },
    { key: "rejected", label: "مرفوضة", count: mockFeeUnitsRequestsAdmin.filter((r) => r.status === "rejected").length },
  ]

  const filtered = mockFeeUnitsRequestsAdmin
    .filter((r) => filter === "all" || r.status === filter)
    .filter((r) => !search || r.user_name.includes(search) || r.payment_reference.includes(search))

  const handleAction = (action: "approve" | "reject") => {
    if (!selectedRequest) return
    if (action === "reject" && !adminNote.trim()) {
      showError("اكتب سبب الرفض في الملاحظة")
      return
    }
    showSuccess(action === "approve" ? "تمت الموافقة + شحن الوحدات" : "تم الرفض")
    setSelectedRequest(null)
    setAdminNote("")
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader title="💳 وحدات الرسوم - الإدارة الكاملة" subtitle="مراجعة طلبات شحن الوحدات والتحقق من المدفوعات" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <KPI label="إجمالي" val={mockFeeUnitsRequestsAdmin.length} color="#fff" />
        <KPI label="معلقة" val={mockFeeUnitsRequestsAdmin.filter((r) => r.status === "pending").length} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
        <KPI label="موافق" val={mockFeeUnitsRequestsAdmin.filter((r) => r.status === "approved").length} color="#4ADE80" />
        <KPI label="تلقائي" val={mockFeeUnitsRequestsAdmin.filter((r) => r.status === "auto_verified").length} color="#60A5FA" />
        <KPI label="مرفوضة" val={mockFeeUnitsRequestsAdmin.filter((r) => r.status === "rejected").length} color="#F87171" />
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالمستخدم أو رقم المرجع..."
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      <InnerTabBar tabs={tabs} active={filter} onSelect={setFilter} />

      {filtered.length === 0 ? (
        <AdminEmpty title="لا توجد طلبات" body="جرب تغيير الفلترة" />
      ) : (
        <Table>
          <THead>
            <TH>المستخدم</TH>
            <TH>الهاتف</TH>
            <TH>المبلغ</TH>
            <TH>الرصيد الحالي</TH>
            <TH>طريقة الدفع</TH>
            <TH>المرجع</TH>
            <TH>الحالة</TH>
            <TH>التاريخ</TH>
            <TH>إجراء</TH>
          </THead>
          <TBody>
            {filtered.map((r) => {
              const pm = paymentLabels[r.payment_method] || { label: r.payment_method, icon: "💳" }
              return (
                <TR key={r.id}>
                  <TD>{r.user_name}</TD>
                  <TD><span dir="ltr" className="font-mono text-[11px]">{r.user_phone}</span></TD>
                  <TD><span className="font-mono text-blue-400 font-bold">{fmtNum(r.amount_requested)}</span></TD>
                  <TD><span className="font-mono">{fmtNum(r.current_balance)}</span></TD>
                  <TD>
                    <span className="text-[11px] flex items-center gap-1">
                      <span>{pm.icon}</span>
                      <span>{pm.label}</span>
                    </span>
                  </TD>
                  <TD><span className="font-mono text-[10px] text-neutral-400">{r.payment_reference}</span></TD>
                  <TD>
                    <Badge
                      label={
                        r.status === "pending" ? "معلق" :
                        r.status === "approved" ? "موافق" :
                        r.status === "auto_verified" ? "تلقائي" : "مرفوض"
                      }
                      color={
                        r.status === "pending" ? "yellow" :
                        r.status === "approved" ? "green" :
                        r.status === "auto_verified" ? "blue" : "red"
                      }
                    />
                  </TD>
                  <TD><span className="text-neutral-500 text-[11px]">{r.created_at}</span></TD>
                  <TD>
                    {r.status === "pending" ? (
                      <div className="flex gap-1.5">
                        <ActionBtn label="مراجعة" color="blue" sm onClick={() => { setSelectedRequest(r); setAdminNote("") }} />
                      </div>
                    ) : (
                      <ActionBtn label="عرض" color="gray" sm onClick={() => { setSelectedRequest(r); setAdminNote(r.admin_note || "") }} />
                    )}
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div>
                <div className="text-base font-bold text-white">مراجعة طلب شحن</div>
                <div className="text-xs text-neutral-500 mt-1">رقم الطلب: <span className="font-mono">#{selectedRequest.id}</span></div>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5 mb-4 space-y-2.5">
              {[
                ["المستخدم", selectedRequest.user_name],
                ["الهاتف", selectedRequest.user_phone],
                ["المبلغ المطلوب", fmtNum(selectedRequest.amount_requested) + " وحدة"],
                ["الرصيد الحالي", fmtNum(selectedRequest.current_balance) + " وحدة"],
                ["طريقة الدفع", paymentLabels[selectedRequest.payment_method]?.icon + " " + paymentLabels[selectedRequest.payment_method]?.label],
                ["رقم المرجع", selectedRequest.payment_reference],
                ["تاريخ الطلب", selectedRequest.created_at],
              ].map(([l, v], i) => (
                <div key={i} className="flex justify-between gap-3">
                  <span className="text-[11px] text-neutral-500">{l}</span>
                  <span className="text-xs font-bold text-white text-left" dir={typeof v === "string" && v.startsWith("+") ? "ltr" : "rtl"}>{v}</span>
                </div>
              ))}
            </div>

            <label className="text-xs text-neutral-400 mb-2 block font-bold">ملاحظة الإدارة</label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
              placeholder="اكتب ملاحظة (مطلوب عند الرفض)..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none mb-4"
            />

            {selectedRequest.status === "pending" ? (
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction("reject")}
                  className="flex-1 py-3 rounded-xl bg-red-500/[0.1] border border-red-500/[0.3] text-red-400 text-sm font-bold hover:bg-red-500/[0.15]"
                >
                  رفض
                </button>
                <button
                  onClick={() => handleAction("approve")}
                  className="flex-1 py-3 rounded-xl bg-green-500/[0.15] border border-green-500/[0.3] text-green-400 text-sm font-bold hover:bg-green-500/[0.2]"
                >
                  موافقة + شحن الوحدات
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSelectedRequest(null)}
                className="w-full py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إغلاق
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
