"use client"

/**
 * MarketEnginePanel — Phase 10.63.
 *
 * Admin viewer for the market engine internals that previously had
 * no UI surface:
 *   • stability_fund (singleton balances)
 *   • fund_transactions (recent intervention log)
 *   • development_promises (counts by status)
 *
 * Read-only — interventions are produced by the market engine RPCs
 * (lib/market/engine.ts), not by admins clicking buttons here.
 */

import { useEffect, useState, useCallback } from "react"
import { Wallet, Activity, FileText, AlertTriangle, RefreshCw } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  KPI, AdminEmpty, SectionHeader,
} from "@/components/admin/ui"
import {
  getMarketEngineOverview,
  getFundTransactions,
  type MarketEngineOverview,
  type FundTransaction,
} from "@/lib/data/market-engine"

const fmtNum = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("en-US")
const fmtMoney = (n: number | null | undefined) => fmtNum(n) + " د.ع"
const fmtDate = (iso: string | null | undefined) =>
  iso ? iso.replace("T", " ").slice(0, 16) : "—"

const TXN_TYPE_LABELS: Record<string, { label: string; color: "green" | "red" | "blue" | "yellow" | "gray" | "purple" }> = {
  inflow:        { label: "إيداع",        color: "green" },
  intervention:  { label: "تدخّل",       color: "purple" },
  buyback:       { label: "إعادة شراء",  color: "blue" },
  outflow:       { label: "سحب",          color: "red" },
  profit:        { label: "ربح",           color: "yellow" },
  fee:           { label: "رسوم",         color: "gray" },
}

export function MarketEnginePanel() {
  const [overview, setOverview] = useState<MarketEngineOverview | null>(null)
  const [allTxns, setAllTxns] = useState<FundTransaction[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [ov, txns] = await Promise.all([
      getMarketEngineOverview(),
      getFundTransactions(100),
    ])
    setOverview(ov)
    setAllTxns(txns)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const fund = overview?.stability_fund
  const promises = overview?.promises_summary

  return (
    <div className="p-6 max-w-screen-2xl">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <div className="text-lg font-bold text-white">⚙ محرّك السوق (Market Engine)</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            صندوق الاستقرار · سجلّ التدخّلات · تعهّدات التطوير — قراءة فقط
          </div>
        </div>
        <ActionBtn label="🔄 تحديث" color="gray" sm onClick={refresh} />
      </div>

      {/* ─── Stability Fund ─── */}
      <SectionHeader title="🏦 صندوق الاستقرار" />
      {!fund ? (
        <AdminEmpty
          title={loading ? "جاري التحميل..." : "صندوق الاستقرار غير مفعّل"}
          body={
            loading ? undefined :
            "لم يتم العثور على سجل في public.stability_fund (id=1). " +
            "تأكد من تطبيق migration 20250425_market_engine.sql."
          }
        />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          <KPI label="الرصيد الإجمالي" val={fmtMoney(fund.total_balance)} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
          <KPI label="المتاح للتدخّل" val={fmtMoney(fund.available_balance)} color="#4ADE80" />
          <KPI label="محجوز" val={fmtMoney(fund.reserved_balance)} color="#60A5FA" />
          <KPI label="إجمالي الإيداعات" val={fmtMoney(fund.total_inflow)} color="#a3a3a3" />
          <KPI label="إجمالي التدخّلات" val={fmtMoney(fund.total_interventions)} color="#C084FC" />
          <KPI label="إجمالي الأرباح" val={fmtMoney(fund.total_profit)} color="#2DD4BF" />
        </div>
      )}

      {/* ─── Development Promises summary ─── */}
      <SectionHeader title="📜 تعهّدات التطوير" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="إجمالي التعهّدات" val={fmtNum(promises?.total)} color="#fff" />
        <KPI label="معلّقة" val={fmtNum(promises?.pending)} color="#FBBF24" />
        <KPI label="مكتملة" val={fmtNum(promises?.completed)} color="#4ADE80" />
        <KPI
          label="متأخّرة (تجاوزت الموعد)"
          val={fmtNum(promises?.overdue)}
          color="#F87171"
          accent={promises && promises.overdue > 0 ? "rgba(248,113,113,0.08)" : undefined}
        />
      </div>

      {/* ─── Recent Fund Transactions ─── */}
      <SectionHeader
        title="📋 سجلّ تدخّلات الصندوق"
        action={<span className="text-[10px] text-neutral-500">أحدث {allTxns.length} حركة</span>}
      />
      {loading ? (
        <AdminEmpty title="جاري التحميل..." />
      ) : allTxns.length === 0 ? (
        <AdminEmpty
          title="لا توجد حركات"
          body="سيظهر هنا كل تدخّل من صندوق الاستقرار + الإيداعات + إعادات الشراء."
        />
      ) : (
        <Table>
          <THead>
            <TH>النوع</TH>
            <TH>المبلغ</TH>
            <TH>المشروع</TH>
            <TH>الحصص</TH>
            <TH>سعر الحصة</TH>
            <TH>التاريخ</TH>
            <TH>ملاحظات</TH>
          </THead>
          <TBody>
            {allTxns.map((t) => {
              const meta = TXN_TYPE_LABELS[t.type] ?? { label: t.type, color: "gray" as const }
              return (
                <TR key={t.id}>
                  <TD><Badge label={meta.label} color={meta.color} /></TD>
                  <TD><span className="font-mono text-yellow-400 text-xs">{fmtMoney(t.amount)}</span></TD>
                  <TD><span className="text-xs text-neutral-300">{t.project_name ?? "—"}</span></TD>
                  <TD><span className="font-mono text-xs">{t.shares_count ? fmtNum(t.shares_count) : "—"}</span></TD>
                  <TD><span className="font-mono text-xs">{t.price_per_share ? fmtNum(t.price_per_share) : "—"}</span></TD>
                  <TD><span className="text-[11px] text-neutral-500" dir="ltr">{fmtDate(t.recorded_at)}</span></TD>
                  <TD>
                    <span className="text-[11px] text-neutral-400 truncate max-w-xs inline-block">
                      {t.notes ?? "—"}
                    </span>
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {overview?.snapshot_at && (
        <div className="mt-4 text-[10px] text-neutral-600 text-center" dir="ltr">
          آخر تحديث: {new Date(overview.snapshot_at).toLocaleString("en-US")}
        </div>
      )}
    </div>
  )
}
