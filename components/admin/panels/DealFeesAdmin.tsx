"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { Badge, ActionBtn, Table, THead, TH, TBody, TR, TD, SectionHeader, KPI, InnerTabBar, AdminEmpty } from "@/components/admin/ui"
import { mockDealFeesAdvanced } from "@/lib/admin/mock-data"
import { showSuccess } from "@/lib/utils/toast"

const fmtNum = (n: number) => n.toLocaleString("en-US")

export function DealFeesAdminPanel() {
  const [filter, setFilter] = useState<string>("all")
  const [search, setSearch] = useState("")

  const tabs = [
    { key: "all", label: "الكل", count: mockDealFeesAdvanced.length },
    { key: "collected", label: "محصّلة", count: mockDealFeesAdvanced.filter((f) => f.status === "collected").length },
    { key: "pending", label: "معلقة", count: mockDealFeesAdvanced.filter((f) => f.status === "pending").length },
    { key: "refunded", label: "مستردة", count: mockDealFeesAdvanced.filter((f) => f.status === "refunded").length },
  ]

  const filtered = mockDealFeesAdvanced
    .filter((f) => filter === "all" || f.status === filter)
    .filter((f) => !search || f.project_name.includes(search) || f.buyer.includes(search) || f.seller.includes(search))

  const totalCollected = mockDealFeesAdvanced.filter((f) => f.status === "collected").reduce((s, f) => s + f.fee_amount, 0)
  const totalPending = mockDealFeesAdvanced.filter((f) => f.status === "pending").reduce((s, f) => s + f.fee_amount, 0)
  const totalRefunded = mockDealFeesAdvanced.filter((f) => f.status === "refunded").reduce((s, f) => s + f.fee_amount, 0)

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader title="💸 رسوم الصفقات - الإدارة" subtitle="جميع الرسوم المحصّلة من الصفقات" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="إجمالي الصفقات" val={mockDealFeesAdvanced.length} color="#fff" />
        <KPI label="رسوم محصّلة" val={fmtNum(totalCollected)} color="#4ADE80" />
        <KPI label="رسوم معلقة" val={fmtNum(totalPending)} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
        <KPI label="رسوم مستردة" val={fmtNum(totalRefunded)} color="#F87171" />
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالمشروع أو الطرفين..."
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      <InnerTabBar tabs={tabs} active={filter} onSelect={setFilter} />

      {filtered.length === 0 ? (
        <AdminEmpty title="لا توجد رسوم" body="جرب تغيير الفلترة" />
      ) : (
        <Table>
          <THead>
            <TH>الصفقة</TH>
            <TH>المشروع</TH>
            <TH>المشتري</TH>
            <TH>البائع</TH>
            <TH>قيمة الصفقة</TH>
            <TH>النسبة</TH>
            <TH>الرسوم</TH>
            <TH>الحالة</TH>
            <TH>التاريخ</TH>
            <TH>إجراء</TH>
          </THead>
          <TBody>
            {filtered.map((f) => (
              <TR key={f.id}>
                <TD><span className="font-mono text-[11px]">#{f.deal_id}</span></TD>
                <TD>{f.project_name}</TD>
                <TD>{f.buyer}</TD>
                <TD>{f.seller}</TD>
                <TD><span className="font-mono text-yellow-400">{fmtNum(f.deal_total)}</span></TD>
                <TD><span className="font-mono">{f.fee_percent}%</span></TD>
                <TD><span className="font-mono text-blue-400 font-bold">{fmtNum(f.fee_amount)}</span></TD>
                <TD>
                  <Badge
                    label={f.status === "collected" ? "محصّلة" : f.status === "pending" ? "معلقة" : "مستردة"}
                    color={f.status === "collected" ? "green" : f.status === "pending" ? "yellow" : "red"}
                  />
                </TD>
                <TD><span className="text-neutral-500 text-[11px]">{f.created_at}</span></TD>
                <TD>
                  {f.status === "collected" && (
                    <ActionBtn label="استرداد" color="red" sm onClick={() => showSuccess("تم الاسترداد")} />
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}
