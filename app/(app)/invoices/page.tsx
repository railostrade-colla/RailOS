"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, FileText } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, EmptyState, Tabs } from "@/components/ui"
import { InvoiceCard } from "@/components/invoices/InvoiceCard"
import {
  getInvoicesByUser,
  seedMockInvoices,
  INVOICE_TYPE_META,
  type Invoice,
  type InvoiceType,
} from "@/lib/data/invoices"

const CURRENT_USER_ID = "abc123def456"

type FilterTab = "all" | "received" | "sent"

const TABS: Array<{ id: FilterTab; label: string }> = [
  { id: "all",      label: "الكل" },
  { id: "received", label: "🛒 شراء/استلام" },
  { id: "sent",     label: "💰 بيع/إرسال" },
]

const RECEIVED_TYPES: InvoiceType[] = [
  "exchange_buy",
  "quick_sell_buy",
  "direct_buy",
  "auction_win",
  "transfer_receive",
]
const SENT_TYPES: InvoiceType[] = [
  "exchange_sell",
  "quick_sell_sell",
  "transfer_send",
]

export default function InvoicesPage() {
  const [tab, setTab] = useState<FilterTab>("all")
  const [search, setSearch] = useState("")
  const [invoices, setInvoices] = useState<Invoice[]>([])

  useEffect(() => {
    seedMockInvoices()
    setInvoices(getInvoicesByUser(CURRENT_USER_ID))
  }, [])

  const filtered = useMemo(() => {
    let list = invoices
    if (tab === "received") list = list.filter((i) => RECEIVED_TYPES.includes(i.type))
    if (tab === "sent")     list = list.filter((i) => SENT_TYPES.includes(i.type))
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(
        (i) =>
          i.id.toLowerCase().includes(q) ||
          i.project_name.includes(search) ||
          i.from.name.includes(search) ||
          i.to.name.includes(search)
      )
    }
    return list
  }, [invoices, tab, search])

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto pb-20">
          <PageHeader
            title="📄 فواتيري"
            subtitle={`${invoices.length} فاتورة رسمية — كل واحدة عقد لامتلاك الحصص`}
            backHref="/portfolio"
          />

          {/* Notice */}
          <Card variant="gradient" color="blue" className="mb-5">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
              <div>
                <div className="text-sm font-bold text-white mb-1">
                  📋 الفاتورة عقد رسمي
                </div>
                <div className="text-[11px] text-neutral-300 leading-relaxed">
                  كل فاتورة في رايلوس تعتبر <span className="font-bold text-white">عقداً رسمياً</span>
                  {" "}لامتلاك الحصص. تستطيع تنزيلها كـ PDF أو مشاركتها أو طباعتها للسجلات الرسمية.
                </div>
              </div>
            </div>
          </Card>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-neutral-500 absolute right-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث (رقم فاتورة / مشروع / اسم)"
              className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition-colors"
            />
          </div>

          {/* Tabs */}
          <div className="mb-5">
            <Tabs
              tabs={TABS}
              activeTab={tab}
              onChange={(id) => setTab(id as FilterTab)}
            />
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <EmptyState
              icon="📄"
              title="لا توجد فواتير"
              description={
                search
                  ? "جرّب كلمة بحث أخرى أو غيّر التبويب"
                  : "ستظهر فواتيرك تلقائياً بعد إتمام أي عملية شراء/بيع/تحويل"
              }
              size="md"
            />
          ) : (
            <div className="space-y-2.5">
              {filtered.map((invoice) => {
                const meta = INVOICE_TYPE_META[invoice.type]
                return (
                  <div key={invoice.id}>
                    <div className="flex items-center gap-1.5 mb-1 mr-1">
                      <span className="text-[10px] text-neutral-500">{meta.icon}</span>
                      <span className="text-[10px] text-neutral-500">{meta.label}</span>
                    </div>
                    <InvoiceCard invoice={invoice} variant="compact" />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
