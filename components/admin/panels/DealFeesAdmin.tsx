"use client"

/**
 * DealFeesAdminPanel — Phase 12.5 (2026-05-09).
 *
 * Reads the real commission ledger from `deals.buyer_commission +
 * seller_commission` (added by Phase 12 schema). Each row = one deal
 * = one commission record. Status maps deal lifecycle to fee state:
 *   completed → collected
 *   pending / payment_submitted / paid / disputed → pending
 *   cancelled / rejected / expired → refunded
 *
 * No write actions yet — refunds happen automatically when a deal
 * is cancelled/expired (the Phase 12 trigger zero-outs the row),
 * so the panel stays a read-only ledger. If the founder wants a
 * manual refund button we'll wire it via an RPC in a follow-up.
 */

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, RefreshCw } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  getDealFeesAdmin,
  computeDealFeeStats,
  type DealFeeRow,
} from "@/lib/data/deal-fees-admin"
import { createClient } from "@/lib/supabase/client"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const fmtDate = (iso: string) => {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-GB")
}

export function DealFeesAdminPanel() {
  const router = useRouter()
  const [filter, setFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [rows, setRows] = useState<DealFeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const data = await getDealFeesAdmin(500)
      setRows(data)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  // Phase 13.6 — initial fetch + realtime subscription on `deals`.
  // Any INSERT/UPDATE/DELETE on the deals table triggers an instant
  // refresh, so the ledger stays current without a page reload.
  useEffect(() => {
    let cancelled = false
    void refresh()

    const supabase = createClient()
    const channel = supabase
      .channel("deal-fees-admin-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals" },
        () => {
          if (!cancelled) void refresh()
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      try { supabase.removeChannel(channel) } catch { /* ignore */ }
    }
  }, [refresh])

  const stats = useMemo(() => computeDealFeeStats(rows), [rows])

  const tabs = [
    { key: "all", label: "الكل", count: rows.length },
    { key: "collected", label: "محصّلة", count: rows.filter((r) => r.status === "collected").length },
    { key: "pending", label: "معلّقة", count: rows.filter((r) => r.status === "pending").length },
    { key: "refunded", label: "مستردة", count: rows.filter((r) => r.status === "refunded").length },
  ]

  const filtered = rows
    .filter((r) => filter === "all" || r.status === filter)
    .filter((r) => {
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      return (
        r.project_name.toLowerCase().includes(q) ||
        r.buyer_name.toLowerCase().includes(q) ||
        r.seller_name.toLowerCase().includes(q) ||
        r.deal_id.toLowerCase().includes(q)
      )
    })

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="📊 رسوم الصفقات"
        subtitle="عمولة 2% المحصّلة من الطرفَين على كل صفقة (وحدات الرسوم)"
        action={
          <button
            onClick={refresh}
            disabled={refreshing}
            className="bg-white/[0.05] border border-white/[0.08] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white/[0.08] flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={"w-3.5 h-3.5 " + (refreshing ? "animate-spin" : "")} />
            تحديث
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="إجمالي الصفقات" val={fmtNum(stats.total_deals)} color="#fff" />
        <KPI label="رسوم محصّلة (وحدة)" val={fmtNum(stats.total_collected)} color="#4ADE80" />
        <KPI label="رسوم معلّقة (وحدة)" val={fmtNum(stats.total_pending)} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
        <KPI label="رسوم مستردة (وحدة)" val={fmtNum(stats.total_refunded)} color="#F87171" />
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث (مشروع / مشتري / بائع / رقم صفقة)..."
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      <InnerTabBar tabs={tabs} active={filter} onSelect={setFilter} />

      {loading ? (
        <AdminEmpty title="جاري التحميل..." body="نقرأ سجل العمولات من قاعدة البيانات" />
      ) : filtered.length === 0 ? (
        <AdminEmpty
          title="لا توجد رسوم"
          body={
            rows.length === 0
              ? "لم تُحسم أي صفقة بعد. سيظهر السجل هنا تلقائياً مع كل صفقة جديدة."
              : "لا توجد نتائج للفلترة الحالية."
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>الصفقة</TH>
            <TH>المشروع</TH>
            <TH>المشتري</TH>
            <TH>البائع</TH>
            <TH>الكمية</TH>
            <TH>قيمة الصفقة</TH>
            <TH>عمولة المشتري</TH>
            <TH>عمولة البائع</TH>
            <TH>الإجمالي</TH>
            <TH>الحالة</TH>
            <TH>التاريخ</TH>
            <TH>إجراء</TH>
          </THead>
          <TBody>
            {filtered.map((r) => (
              <TR key={r.id}>
                <TD>
                  <span className="font-mono text-[10px] text-blue-400" dir="ltr">
                    {r.deal_id.slice(0, 8)}…
                  </span>
                </TD>
                <TD>{r.project_name}</TD>
                <TD>
                  <span className="text-[11px] text-white">{r.buyer_name}</span>
                </TD>
                <TD>
                  <span className="text-[11px] text-white">{r.seller_name}</span>
                </TD>
                <TD>
                  <span className="font-mono text-[11px]">{fmtNum(r.shares)}</span>
                </TD>
                <TD>
                  <span className="font-mono text-yellow-400">{fmtNum(r.deal_total)}</span>
                  <span className="text-[9px] text-neutral-600 mr-1">د.ع</span>
                </TD>
                <TD>
                  <span className="font-mono text-blue-400">{fmtNum(r.buyer_commission)}</span>
                </TD>
                <TD>
                  <span className="font-mono text-blue-400">{fmtNum(r.seller_commission)}</span>
                </TD>
                <TD>
                  <span className="font-mono text-blue-400 font-bold">{fmtNum(r.fee_amount)}</span>
                  <span className="text-[9px] text-neutral-600 mr-1">وحدة</span>
                </TD>
                <TD>
                  <Badge
                    label={
                      r.status === "collected" ? "محصّلة" :
                      r.status === "pending" ? "معلّقة" : "مستردة"
                    }
                    color={
                      r.status === "collected" ? "green" :
                      r.status === "pending" ? "yellow" : "red"
                    }
                  />
                </TD>
                <TD>
                  <span className="text-neutral-500 text-[11px]">{fmtDate(r.created_at)}</span>
                </TD>
                <TD>
                  <ActionBtn
                    label="فتح"
                    color="blue"
                    sm
                    onClick={() => router.push(`/deals/${r.deal_id}`)}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <div className="mt-6 text-[10px] text-neutral-600 font-mono">
        {fmtNum(filtered.length)} من {fmtNum(rows.length)} صفقة
      </div>
    </div>
  )
}
