"use client"

import { useState } from "react"
import { Badge, ActionBtn, Table, THead, TH, TBody, TR, TD, SectionHeader, KPI, InnerTabBar } from "@/components/admin/ui"
import {
  mockProjectsAdmin,
  mockListingsAdmin,
  mockTradesAdmin,
  mockContractsAdmin,
  mockHoldingsAdmin,
  mockTransactionsAdmin,
} from "@/lib/admin/mock-data"
import { showSuccess } from "@/lib/utils/toast"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type SharesSubTab = "shares" | "listings" | "trades" | "contracts" | "holdings" | "transactions"

export function SharesPanel() {
  const [subTab, setSubTab] = useState<SharesSubTab>("shares")

  const totalShares = mockProjectsAdmin.reduce((s, p) => s + p.total_shares, 0)
  const availableShares = mockProjectsAdmin.reduce((s, p) => s + p.available_shares, 0)
  const tradedShares = totalShares - availableShares

  const tabs = [
    { key: "shares", label: "◎ إدارة الحصص" },
    { key: "listings", label: "◇ العروض", count: mockListingsAdmin.length },
    { key: "trades", label: "⇄ الصفقات", count: mockTradesAdmin.length },
    { key: "contracts", label: "📑 العقود", count: mockContractsAdmin.length },
    { key: "holdings", label: "📂 الحيازات" },
    { key: "transactions", label: "📊 المعاملات" },
  ]

  return (
    <div className="p-6 max-w-screen-2xl">

      <SectionHeader title="◎ الحصص والتداول" subtitle="إدارة كل ما يخص الحصص والتداولات" />

      <InnerTabBar tabs={tabs} active={subTab} onSelect={(k) => setSubTab(k as SharesSubTab)} />

      {/* Shares overview */}
      {subTab === "shares" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KPI label="إجمالي الحصص" val={fmtNum(totalShares)} color="#fff" />
            <KPI label="متاحة" val={fmtNum(availableShares)} color="#4ADE80" />
            <KPI label="متداولة" val={fmtNum(tradedShares)} color="#60A5FA" />
            <KPI label="نسبة التداول" val={Math.round((tradedShares / totalShares) * 100) + "%"} color="#FBBF24" />
          </div>

          <Table>
            <THead>
              <TH>المشروع</TH>
              <TH>القطاع</TH>
              <TH>إجمالي الحصص</TH>
              <TH>متاحة</TH>
              <TH>متداولة</TH>
              <TH>نسبة التمويل</TH>
              <TH>سعر الحصة</TH>
            </THead>
            <TBody>
              {mockProjectsAdmin.filter((p) => p.entity_type === "project").map((p) => {
                const traded = p.total_shares - p.available_shares
                const pct = Math.round((traded / p.total_shares) * 100)
                return (
                  <TR key={p.id}>
                    <TD>{p.name}</TD>
                    <TD><span className="text-neutral-400">{p.sector}</span></TD>
                    <TD><span className="font-mono">{fmtNum(p.total_shares)}</span></TD>
                    <TD><span className="font-mono text-green-400">{fmtNum(p.available_shares)}</span></TD>
                    <TD><span className="font-mono text-blue-400">{fmtNum(traded)}</span></TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-white/60 rounded-full" style={{ width: pct + "%" }} />
                        </div>
                        <span className="text-[11px] font-mono">{pct}%</span>
                      </div>
                    </TD>
                    <TD><span className="font-mono text-yellow-400">{fmtNum(p.share_price)}</span></TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </>
      )}

      {/* Listings */}
      {subTab === "listings" && (
        <Table>
          <THead>
            <TH>المشروع</TH>
            <TH>المستخدم</TH>
            <TH>النوع</TH>
            <TH>الحصص</TH>
            <TH>السعر</TH>
            <TH>الحالة</TH>
            <TH>الإجراء</TH>
          </THead>
          <TBody>
            {mockListingsAdmin.map((l) => (
              <TR key={l.id}>
                <TD>{l.project_name}</TD>
                <TD>{l.user_name}</TD>
                <TD>
                  <Badge label={l.type === "sell" ? "بيع" : "شراء"} color={l.type === "sell" ? "red" : "green"} />
                </TD>
                <TD><span className="font-mono">{l.shares}</span></TD>
                <TD><span className="font-mono">{fmtNum(l.price)}</span></TD>
                <TD>
                  <Badge label={l.status === "active" ? "نشط" : "مكتمل"} color={l.status === "active" ? "green" : "gray"} />
                </TD>
                <TD>
                  {l.status === "active" && <ActionBtn label="إيقاف" color="red" sm onClick={() => showSuccess("تم الإيقاف")} />}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {/* Trades */}
      {subTab === "trades" && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <KPI label="معلقة" val={mockTradesAdmin.filter((t) => t.status === "pending").length} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
            <KPI label="مكتملة" val={mockTradesAdmin.filter((t) => t.status === "confirmed").length} color="#4ADE80" />
            <KPI label="ملغاة" val={mockTradesAdmin.filter((t) => t.status === "cancelled").length} color="#F87171" />
          </div>

          <Table>
            <THead>
              <TH>المشروع</TH>
              <TH>المشتري</TH>
              <TH>البائع</TH>
              <TH>الحصص</TH>
              <TH>الإجمالي</TH>
              <TH>الحالة</TH>
              <TH>التاريخ</TH>
              <TH>إجراء</TH>
            </THead>
            <TBody>
              {mockTradesAdmin.map((t) => (
                <TR key={t.id}>
                  <TD>{t.project_name}</TD>
                  <TD>{t.buyer}</TD>
                  <TD>{t.seller}</TD>
                  <TD><span className="font-mono">{t.shares}</span></TD>
                  <TD><span className="font-mono text-yellow-400">{fmtNum(t.total)}</span></TD>
                  <TD>
                    <Badge
                      label={t.status === "confirmed" ? "مكتملة" : t.status === "pending" ? "معلقة" : "ملغاة"}
                      color={t.status === "confirmed" ? "green" : t.status === "pending" ? "yellow" : "red"}
                    />
                  </TD>
                  <TD><span className="text-neutral-500">{t.created_at}</span></TD>
                  <TD>
                    {t.status === "pending" && (
                      <div className="flex gap-1.5">
                        <ActionBtn label="تأكيد" color="green" sm onClick={() => showSuccess("تم التأكيد")} />
                        <ActionBtn label="إلغاء" color="red" sm onClick={() => showSuccess("تم الإلغاء")} />
                      </div>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}

      {/* Contracts */}
      {subTab === "contracts" && (
        <Table>
          <THead>
            <TH>العنوان</TH>
            <TH>المنشئ</TH>
            <TH>الشركاء</TH>
            <TH>الاستثمار</TH>
            <TH>الحالة</TH>
            <TH>التاريخ</TH>
          </THead>
          <TBody>
            {mockContractsAdmin.map((c) => (
              <TR key={c.id}>
                <TD>{c.title}</TD>
                <TD>{c.creator}</TD>
                <TD><span className="font-mono">{c.partners_count}</span></TD>
                <TD><span className="font-mono text-yellow-400">{fmtNum(c.total_investment)}</span></TD>
                <TD>
                  <Badge
                    label={c.status === "active" ? "نشط" : c.status === "pending" ? "معلق" : "منتهي"}
                    color={c.status === "active" ? "green" : c.status === "pending" ? "yellow" : "gray"}
                  />
                </TD>
                <TD><span className="text-neutral-500">{c.created_at}</span></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {/* Holdings */}
      {subTab === "holdings" && (
        <Table>
          <THead>
            <TH>المستخدم</TH>
            <TH>المشروع</TH>
            <TH>الحصص</TH>
            <TH>القيمة الحالية</TH>
          </THead>
          <TBody>
            {mockHoldingsAdmin.map((h) => (
              <TR key={h.id}>
                <TD>{h.user_name}</TD>
                <TD>{h.project_name}</TD>
                <TD><span className="font-mono text-green-400">{h.shares}</span></TD>
                <TD><span className="font-mono text-yellow-400">{fmtNum(h.current_value)} د.ع</span></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {/* Transactions */}
      {subTab === "transactions" && (
        <Table>
          <THead>
            <TH>المستخدم</TH>
            <TH>النوع</TH>
            <TH>المبلغ/الكمية</TH>
            <TH>المشروع</TH>
            <TH>التاريخ</TH>
          </THead>
          <TBody>
            {mockTransactionsAdmin.map((tx) => {
              const labels: Record<string, { label: string; color: any }> = {
                deal_buy: { label: "📈 شراء", color: "green" },
                deal_sell: { label: "📉 بيع", color: "red" },
                shares_received: { label: "📥 استلام حصص", color: "blue" },
                shares_sent: { label: "📤 إرسال حصص", color: "orange" },
              }
              const cfg = labels[tx.type] || { label: tx.type, color: "gray" as const }
              return (
                <TR key={tx.id}>
                  <TD>{tx.user_name}</TD>
                  <TD><Badge label={cfg.label} color={cfg.color} /></TD>
                  <TD><span className="font-mono">{fmtNum(tx.amount)}</span></TD>
                  <TD>{tx.project}</TD>
                  <TD><span className="text-neutral-500">{tx.created_at}</span></TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}
    </div>
  )
}
