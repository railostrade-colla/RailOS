"use client"

/**
 * ShareRequestsPanel — admin queue for share-modification requests.
 * Reads from public.share_modification_requests via the share-modifications
 * data layer. Both pending_super_admin AND any other pending statuses
 * are surfaced here so nothing falls through the cracks.
 */

import { useEffect, useState, useCallback } from "react"
import { Search, Check, X } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  KPI, AdminEmpty, InnerTabBar,
} from "@/components/admin/ui"
import { getPendingShareRequests, type PendingShareRequest } from "@/lib/data/admin-requests"
import { showSuccess, showError } from "@/lib/utils/toast"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type Tab = "pending" | "all"

export function ShareRequestsPanel() {
  const [requests, setRequests] = useState<PendingShareRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("pending")
  const [search, setSearch] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    const rows = await getPendingShareRequests()
    setRequests(rows)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filtered = requests
    .filter((r) =>
      tab === "all" ||
      r.status === "pending_super_admin" ||
      r.status === "pending"
    )
    .filter((r) =>
      !search ||
      r.project_name.includes(search) ||
      r.requested_by_name.includes(search),
    )

  const stats = {
    total: requests.length,
    pending: requests.filter((r) =>
      r.status === "pending_super_admin" || r.status === "pending"
    ).length,
    increase: requests.filter((r) => r.modification_type === "increase").length,
    decrease: requests.filter((r) => r.modification_type === "decrease").length,
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-bold text-white">📥 طلبات تعديل الحصص</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            استقبال ومعالجة طلبات زيادة/تخفيض الحصص (Super Admin فقط)
          </div>
        </div>
        <ActionBtn label="🔄 تحديث" color="gray" sm onClick={refresh} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="إجمالي" val={fmtNum(stats.total)} color="#fff" />
        <KPI label="قيد المراجعة" val={fmtNum(stats.pending)} color="#FBBF24" />
        <KPI label="طلبات زيادة" val={fmtNum(stats.increase)} color="#4ADE80" />
        <KPI label="طلبات تخفيض" val={fmtNum(stats.decrease)} color="#F87171" />
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث (مشروع / مقدّم الطلب)..."
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      <InnerTabBar
        tabs={[
          { key: "pending", label: "قيد المراجعة", count: stats.pending },
          { key: "all", label: "الكل", count: stats.total },
        ]}
        active={tab}
        onSelect={(k) => setTab(k as Tab)}
      />

      {loading ? (
        <AdminEmpty title="جاري التحميل..." />
      ) : filtered.length === 0 ? (
        <AdminEmpty
          title="لا توجد طلبات"
          body="عند تقديم طلب تعديل حصص من قسم تعديل الحصص (Super Admin) سيظهر هنا."
        />
      ) : (
        <Table>
          <THead>
            <TH>المشروع</TH>
            <TH>مقدّم الطلب</TH>
            <TH>النوع</TH>
            <TH>الكمية</TH>
            <TH>السبب</TH>
            <TH>الحالة</TH>
            <TH>التاريخ</TH>
            <TH>الإجراء</TH>
          </THead>
          <TBody>
            {filtered.map((r) => {
              const isPending =
                r.status === "pending_super_admin" || r.status === "pending"
              return (
                <TR key={r.id}>
                  <TD>{r.project_name}</TD>
                  <TD>{r.requested_by_name}</TD>
                  <TD>
                    <Badge
                      label={r.modification_type === "increase" ? "زيادة ↑" : "تخفيض ↓"}
                      color={r.modification_type === "increase" ? "green" : "red"}
                    />
                  </TD>
                  <TD>
                    <span className="font-mono text-xs">{fmtNum(r.shares_amount)}</span>
                  </TD>
                  <TD>
                    <span className="text-[11px] text-neutral-400 truncate max-w-xs inline-block">
                      {r.reason || "—"}
                    </span>
                  </TD>
                  <TD>
                    <Badge
                      label={
                        r.status === "pending_super_admin" || r.status === "pending"
                          ? "معلّق"
                          : r.status === "approved"
                          ? "مُعتمَد"
                          : "مرفوض"
                      }
                      color={
                        isPending ? "yellow" : r.status === "approved" ? "green" : "red"
                      }
                    />
                  </TD>
                  <TD>
                    <span className="text-[11px] text-neutral-500" dir="ltr">
                      {r.created_at.slice(0, 10)}
                    </span>
                  </TD>
                  <TD>
                    {isPending ? (
                      <div className="flex gap-1.5">
                        <ActionBtn
                          label="افتح"
                          color="blue"
                          sm
                          onClick={() => {
                            window.location.href = `/admin?tab=share_modification`
                          }}
                        />
                      </div>
                    ) : (
                      <span className="text-[10px] text-neutral-600">—</span>
                    )}
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      <div className="mt-4 bg-blue-500/[0.05] border border-blue-500/[0.2] rounded-xl p-3 text-[11px] text-blue-300 leading-relaxed">
        💡 المعالجة الكاملة (موافقة/رفض مع كود التحقّق المزدوج) تتمّ من{" "}
        <a href="/admin?tab=share_modification" className="font-bold underline">
          صفحة تعديل الحصص
        </a>
        {" "}— Super Admin فقط.
      </div>
    </div>
  )
}
