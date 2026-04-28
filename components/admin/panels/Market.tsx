"use client"

import { useState } from "react"
import { Badge, ActionBtn, Table, THead, TH, TBody, TR, TD, SectionHeader, AdminEmpty, KPI, InnerTabBar } from "@/components/admin/ui"
import { mockListingsAdmin, mockAuctionsAdmin, mockBidsAdmin, mockDirectBuyAdmin } from "@/lib/admin/mock-data"
import { showSuccess } from "@/lib/utils/toast"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type MarketSubTab = "overview" | "auctions" | "bids" | "direct_buy" | "market_state"

export function MarketPanel() {
  const [subTab, setSubTab] = useState<MarketSubTab>("overview")

  const tabs = [
    { key: "overview", label: "◉ مركز السوق" },
    { key: "auctions", label: "🔨 المزادات", count: mockAuctionsAdmin.filter((a) => a.status === "active").length },
    { key: "bids", label: "🏷 المزايدات", count: mockBidsAdmin.length },
    { key: "direct_buy", label: "🏦 الشراء المباشر", count: mockDirectBuyAdmin.filter((d) => d.status === "pending").length },
    { key: "market_state", label: "📈 حالة السوق" },
  ]

  return (
    <div className="p-6 max-w-screen-2xl">

      <SectionHeader title="◉ السوق والمزادات" subtitle="إدارة العروض والمزادات والشراء المباشر" />

      <InnerTabBar tabs={tabs} active={subTab} onSelect={(k) => setSubTab(k as MarketSubTab)} />

      {/* Overview - Listings */}
      {subTab === "overview" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KPI label="عروض نشطة" val={mockListingsAdmin.filter((l) => l.status === "active").length} color="#60A5FA" />
            <KPI label="عروض بيع" val={mockListingsAdmin.filter((l) => l.type === "sell" && l.status === "active").length} color="#F87171" />
            <KPI label="عروض شراء" val={mockListingsAdmin.filter((l) => l.type === "buy" && l.status === "active").length} color="#4ADE80" />
            <KPI label="مكتملة" val={mockListingsAdmin.filter((l) => l.status === "completed").length} color="#888" />
          </div>

          <Table>
            <THead>
              <TH>المشروع</TH>
              <TH>المستخدم</TH>
              <TH>النوع</TH>
              <TH>الحصص</TH>
              <TH>السعر</TH>
              <TH>القيمة</TH>
              <TH>الحالة</TH>
              <TH>التاريخ</TH>
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
                  <TD><span className="font-mono text-yellow-400">{fmtNum(l.shares * l.price)}</span></TD>
                  <TD>
                    <Badge label={l.status === "active" ? "نشط" : "مكتمل"} color={l.status === "active" ? "green" : "gray"} />
                  </TD>
                  <TD><span className="text-neutral-500">{l.created_at}</span></TD>
                  <TD>
                    {l.status === "active" && (
                      <ActionBtn label="إيقاف" color="red" sm onClick={() => showSuccess("تم الإيقاف")} />
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}

      {/* Auctions */}
      {subTab === "auctions" && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <KPI label="نشطة" val={mockAuctionsAdmin.filter((a) => a.status === "active").length} color="#FBBF24" />
            <KPI label="مكتملة" val={mockAuctionsAdmin.filter((a) => a.status === "completed").length} color="#4ADE80" />
            <KPI label="إجمالي المزايدات" val={mockAuctionsAdmin.reduce((s, a) => s + a.bids_count, 0)} color="#60A5FA" />
          </div>

          <Table>
            <THead>
              <TH>المشروع</TH>
              <TH>الحصص</TH>
              <TH>سعر الافتتاح</TH>
              <TH>السعر الحالي</TH>
              <TH>المزايدات</TH>
              <TH>الحالة</TH>
              <TH>ينتهي في</TH>
              <TH>إجراء</TH>
            </THead>
            <TBody>
              {mockAuctionsAdmin.map((a) => (
                <TR key={a.id}>
                  <TD>{a.project_name}</TD>
                  <TD><span className="font-mono">{a.shares}</span></TD>
                  <TD><span className="font-mono text-neutral-400">{fmtNum(a.opening_price)}</span></TD>
                  <TD><span className="font-mono text-yellow-400 font-bold">{fmtNum(a.current_price)}</span></TD>
                  <TD><span className="text-green-400 font-bold">{a.bids_count}</span></TD>
                  <TD>
                    <Badge label={a.status === "active" ? "نشط" : "مكتمل"} color={a.status === "active" ? "green" : "gray"} />
                  </TD>
                  <TD><span className="text-neutral-500">{a.ends_at}</span></TD>
                  <TD>
                    {a.status === "active" && (
                      <ActionBtn label="إيقاف" color="red" sm onClick={() => showSuccess("تم الإيقاف")} />
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}

      {/* Bids */}
      {subTab === "bids" && (
        <>
          <SectionHeader title="🏷 المزايدات" subtitle={`${mockBidsAdmin.length} مزايدة في 4 مزادات نشطة`} />
          <Table>
            <THead>
              <TH>المزاد</TH>
              <TH>المستخدم</TH>
              <TH>المبلغ</TH>
              <TH>التاريخ</TH>
            </THead>
            <TBody>
              {mockBidsAdmin.map((b) => (
                <TR key={b.id}>
                  <TD><span className="font-mono">#{b.auction_id}</span></TD>
                  <TD>{b.user_name}</TD>
                  <TD><span className="font-mono text-yellow-400 font-bold">{fmtNum(b.amount)} د.ع</span></TD>
                  <TD><span className="text-neutral-500">{b.created_at}</span></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}

      {/* Direct Buy */}
      {subTab === "direct_buy" && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-5">
            <KPI label="معلق" val={mockDirectBuyAdmin.filter((d) => d.status === "pending").length} color="#FBBF24" />
            <KPI label="معتمد" val={mockDirectBuyAdmin.filter((d) => d.status === "approved").length} color="#60A5FA" />
            <KPI label="مؤجل" val={mockDirectBuyAdmin.filter((d) => d.status === "postponed").length} color="#C084FC" />
            <KPI label="مكتمل" val={mockDirectBuyAdmin.filter((d) => d.status === "completed").length} color="#4ADE80" />
          </div>

          <Table>
            <THead>
              <TH>المشروع</TH>
              <TH>المستخدم</TH>
              <TH>الحصص</TH>
              <TH>السعر/حصة</TH>
              <TH>الإجمالي</TH>
              <TH>الحالة</TH>
              <TH>الإجراء</TH>
            </THead>
            <TBody>
              {mockDirectBuyAdmin.map((d) => (
                <TR key={d.id}>
                  <TD>{d.project_name}</TD>
                  <TD>{d.user_name}</TD>
                  <TD><span className="font-mono">{d.shares}</span></TD>
                  <TD><span className="font-mono">{fmtNum(d.price_per_share)}</span></TD>
                  <TD><span className="font-mono text-yellow-400">{fmtNum(d.shares * d.price_per_share)}</span></TD>
                  <TD>
                    <Badge
                      label={
                        d.status === "pending" ? "معلق" :
                        d.status === "approved" ? "معتمد" :
                        d.status === "postponed" ? "مؤجل" : "مكتمل"
                      }
                      color={
                        d.status === "pending" ? "yellow" :
                        d.status === "approved" ? "blue" :
                        d.status === "postponed" ? "purple" : "green"
                      }
                    />
                  </TD>
                  <TD>
                    {d.status === "pending" && (
                      <div className="flex gap-1.5">
                        <ActionBtn label="موافقة" color="green" sm onClick={() => showSuccess("تمت الموافقة")} />
                        <ActionBtn label="تأجيل" color="purple" sm onClick={() => showSuccess("تم التأجيل")} />
                        <ActionBtn label="رفض" color="red" sm onClick={() => showSuccess("تم الرفض")} />
                      </div>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}

      {/* Market State */}
      {subTab === "market_state" && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-base font-bold text-white mb-4">📈 حالة السوق</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              <div>
                <div className="text-sm font-bold text-white">حالة التداول</div>
                <div className="text-[11px] text-neutral-500">السوق مفتوح حالياً</div>
              </div>
              <div className="flex gap-1.5">
                <ActionBtn label="إغلاق السوق" color="red" sm onClick={() => showSuccess("تم إغلاق السوق")} />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              <div>
                <div className="text-sm font-bold text-white">المزادات</div>
                <div className="text-[11px] text-neutral-500">مفعّلة لجميع المستخدمين</div>
              </div>
              <ActionBtn label="إيقاف" color="red" sm onClick={() => showSuccess("تم الإيقاف")} />
            </div>
            <div className="flex items-center justify-between p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              <div>
                <div className="text-sm font-bold text-white">البيع السريع</div>
                <div className="text-[11px] text-neutral-500">مفعّل بخصم 15%</div>
              </div>
              <ActionBtn label="إيقاف" color="red" sm onClick={() => showSuccess("تم الإيقاف")} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
