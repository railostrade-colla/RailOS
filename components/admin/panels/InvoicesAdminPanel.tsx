"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, FileText, ExternalLink } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  KPI, AdminEmpty,
} from "@/components/admin/ui"
import {
  getAllInvoices,
  searchInvoices,
  seedMockInvoices,
  INVOICE_TYPE_META,
  type Invoice,
  type InvoiceType,
} from "@/lib/data/invoices"

const fmtNum = (n: number) => n.toLocaleString("en-US")

const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString("en-GB")
}

export function InvoicesAdminPanel() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | InvoiceType>("all")

  useEffect(() => {
    seedMockInvoices()
    setInvoices(getAllInvoices())
  }, [])

  const filtered = useMemo(() => {
    let list = search.trim() ? searchInvoices(search) : invoices
    if (typeFilter !== "all") list = list.filter((i) => i.type === typeFilter)
    return list
  }, [invoices, search, typeFilter])

  const stats = useMemo(() => {
    return {
      total: invoices.length,
      today: invoices.filter((i) => {
        const d = new Date(i.completed_at)
        const now = new Date()
        return d.toDateString() === now.toDateString()
      }).length,
      total_volume: invoices.reduce((s, i) => s + i.total_amount, 0),
      total_shares: invoices.reduce((s, i) => s + i.shares_amount, 0),
    }
  }, [invoices])

  return (
    <div className="p-6 max-w-screen-2xl">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-5 h-5 text-blue-400" strokeWidth={2} />
          <div className="text-lg font-bold text-white">📄 الفواتير الرسمية</div>
        </div>
        <div className="text-xs text-neutral-500">
          سجلّ شامل لكل الفواتير المُصدرة — كل فاتورة عقد رسمي لامتلاك الحصص
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="إجمالي الفواتير" val={fmtNum(stats.total)} color="#60A5FA" />
        <KPI label="فواتير اليوم" val={fmtNum(stats.today)} color="#4ADE80" />
        <KPI label="إجمالي الحصص" val={fmtNum(stats.total_shares)} color="#C084FC" />
        <KPI label="إجمالي القيمة (د.ع)" val={fmtNum(stats.total_volume)} color="#FBBF24" />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-2 mb-3">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث (رقم فاتورة / رقم حساب / اسم / مشروع)..."
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="all">كل الأنواع</option>
          {(Object.entries(INVOICE_TYPE_META) as [InvoiceType, typeof INVOICE_TYPE_META[InvoiceType]][]).map(
            ([t, m]) => (
              <option key={t} value={t}>
                {m.icon} {m.label}
              </option>
            )
          )}
        </select>
      </div>

      {/* Table — البيانات الأساسية فقط (بدون عرض الفاتورة كاملة) */}
      {filtered.length === 0 ? (
        <AdminEmpty title="لا توجد فواتير" body="جرّب تعديل البحث أو الفلتر" />
      ) : (
        <Table>
          <THead>
            <TH>رقم الفاتورة</TH>
            <TH>النوع</TH>
            <TH>من</TH>
            <TH>إلى</TH>
            <TH>المشروع</TH>
            <TH>الكمية</TH>
            <TH>الإجمالي</TH>
            <TH>الساعة</TH>
            <TH>التاريخ</TH>
            <TH>إجراء</TH>
          </THead>
          <TBody>
            {filtered.map((inv) => {
              const meta = INVOICE_TYPE_META[inv.type]
              return (
                <TR key={inv.id}>
                  <TD>
                    <span className="font-mono text-[11px] text-blue-400" dir="ltr">{inv.id}</span>
                  </TD>
                  <TD>
                    <Badge label={`${meta.icon} ${meta.label}`} color={meta.color === "yellow" ? "yellow" : meta.color === "orange" ? "orange" : meta.color} />
                  </TD>
                  <TD>
                    <div className="text-[11px]">
                      <div className="text-white font-bold truncate max-w-[100px]">{inv.from.name}</div>
                      <div className="text-[9px] text-neutral-600 font-mono truncate max-w-[100px]" dir="ltr">
                        {inv.from.id.slice(0, 12)}...
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <div className="text-[11px]">
                      <div className="text-white font-bold truncate max-w-[100px]">{inv.to.name}</div>
                      <div className="text-[9px] text-neutral-600 font-mono truncate max-w-[100px]" dir="ltr">
                        {inv.to.id.slice(0, 12)}...
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <div className="text-[11px] text-white">{inv.project_name}</div>
                  </TD>
                  <TD>
                    <span className="font-mono text-[11px] text-white">{fmtNum(inv.shares_amount)}</span>
                  </TD>
                  <TD>
                    <span className="font-mono text-[11px] text-yellow-400 font-bold">
                      {fmtNum(inv.total_amount)}
                    </span>
                  </TD>
                  <TD>
                    <span className="text-[11px] text-neutral-400 font-mono" dir="ltr">{fmtTime(inv.completed_at)}</span>
                  </TD>
                  <TD>
                    <span className="text-[11px] text-neutral-400 font-mono" dir="ltr">{fmtDate(inv.completed_at)}</span>
                  </TD>
                  <TD>
                    <ActionBtn
                      label="فتح"
                      color="blue"
                      sm
                      onClick={() => router.push(`/invoices/${inv.id}`)}
                    />
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      <div className="mt-5 flex items-center justify-between text-[10px] text-neutral-600">
        <span>
          عرض <span className="text-white font-mono">{fmtNum(filtered.length)}</span> فاتورة من{" "}
          <span className="text-white font-mono">{fmtNum(invoices.length)}</span>
        </span>
        <span className="flex items-center gap-1">
          <ExternalLink className="w-3 h-3" />
          الضغط على "فتح" يعرض الفاتورة الكاملة
        </span>
      </div>
    </div>
  )
}
