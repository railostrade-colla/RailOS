"use client"

import { useState } from "react"
import { Badge, ActionBtn, Table, THead, TH, TBody, TR, TD, SectionHeader, KPI, InnerTabBar } from "@/components/admin/ui"
import { mockFeeRequestsAdmin, mockDealFeesAdmin } from "@/lib/admin/mock-data"
import { showSuccess } from "@/lib/utils/toast"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type FeesSubTab = "deal_fees" | "fee_units" | "fee_config"

export function FeesPanel() {
  const [subTab, setSubTab] = useState<FeesSubTab>("deal_fees")
  const [feeConfig, setFeeConfig] = useState({
    listing_fee_percent: 1,
    direct_buy_fee_percent: 1.5,
    auction_fee_percent: 2,
    quick_sell_fee_percent: 2,
    welcome_bonus: 1000,
  })

  const tabs = [
    { key: "deal_fees", label: "🏦 رسوم الصفقات", count: mockDealFeesAdmin.length },
    { key: "fee_units", label: "💳 طلبات الوحدات", count: mockFeeRequestsAdmin.filter((r) => r.status === "pending").length },
    { key: "fee_config", label: "💰 إعداد الرسوم" },
  ]

  return (
    <div className="p-6 max-w-screen-2xl">

      <SectionHeader title="💰 الرسوم" subtitle="إدارة رسوم المنصة وطلبات شحن الوحدات" />

      <InnerTabBar tabs={tabs} active={subTab} onSelect={(k) => setSubTab(k as FeesSubTab)} />

      {/* Deal Fees */}
      {subTab === "deal_fees" && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <KPI label="رسوم اليوم" val={fmtNum(mockDealFeesAdmin.reduce((s, f) => s + f.fee_units, 0))} color="#FBBF24" />
            <KPI label="عدد الصفقات" val={mockDealFeesAdmin.length} color="#60A5FA" />
            <KPI label="متوسط الرسم" val={fmtNum(Math.round(mockDealFeesAdmin.reduce((s, f) => s + f.fee_units, 0) / mockDealFeesAdmin.length))} color="#fff" />
          </div>

          <Table>
            <THead>
              <TH>الصفقة</TH>
              <TH>المشروع</TH>
              <TH>المشتري</TH>
              <TH>إجمالي الصفقة</TH>
              <TH>النسبة</TH>
              <TH>الرسوم</TH>
              <TH>التاريخ</TH>
            </THead>
            <TBody>
              {mockDealFeesAdmin.map((f) => (
                <TR key={f.id}>
                  <TD><span className="font-mono">#{f.deal_id}</span></TD>
                  <TD>{f.project_name}</TD>
                  <TD>{f.buyer}</TD>
                  <TD><span className="font-mono text-yellow-400">{fmtNum(f.deal_total)}</span></TD>
                  <TD><span className="font-mono">{f.fee_percent}%</span></TD>
                  <TD><span className="font-mono text-blue-400 font-bold">{fmtNum(f.fee_units)}</span></TD>
                  <TD><span className="text-neutral-500">{f.created_at}</span></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}

      {/* Fee Units Requests */}
      {subTab === "fee_units" && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <KPI label="معلقة" val={mockFeeRequestsAdmin.filter((r) => r.status === "pending").length} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
            <KPI label="موافق" val={mockFeeRequestsAdmin.filter((r) => r.status === "approved").length} color="#4ADE80" />
            <KPI label="مرفوضة" val={mockFeeRequestsAdmin.filter((r) => r.status === "rejected").length} color="#F87171" />
          </div>

          <Table>
            <THead>
              <TH>المستخدم</TH>
              <TH>المبلغ</TH>
              <TH>طريقة الدفع</TH>
              <TH>الملاحظة</TH>
              <TH>الحالة</TH>
              <TH>التاريخ</TH>
              <TH>الإجراء</TH>
            </THead>
            <TBody>
              {mockFeeRequestsAdmin.map((r) => (
                <TR key={r.id}>
                  <TD>{r.user_name}</TD>
                  <TD><span className="font-mono text-blue-400 font-bold">{fmtNum(r.amount_requested)}</span></TD>
                  <TD>
                    <Badge
                      label={r.payment_method === "zaincash" ? "ZainCash" : r.payment_method === "mastercard" ? "MasterCard" : "بنكي"}
                      color="blue"
                    />
                  </TD>
                  <TD><span className="text-neutral-400 text-[11px]">{r.note}</span></TD>
                  <TD>
                    <Badge
                      label={r.status === "pending" ? "معلق" : r.status === "approved" ? "موافق" : "مرفوض"}
                      color={r.status === "pending" ? "yellow" : r.status === "approved" ? "green" : "red"}
                    />
                  </TD>
                  <TD><span className="text-neutral-500">{r.created_at}</span></TD>
                  <TD>
                    {r.status === "pending" && (
                      <div className="flex gap-1.5">
                        <ActionBtn label="موافقة" color="green" sm onClick={() => showSuccess("تمت الموافقة + شحن الوحدات")} />
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

      {/* Fee Config */}
      {subTab === "fee_config" && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 max-w-2xl">
          <div className="text-base font-bold text-white mb-1">💰 إعداد الرسوم</div>
          <div className="text-xs text-neutral-500 mb-5">رسوم المنصة المطبقة على كل عملية</div>

          <div className="space-y-3">
            {[
              { key: "listing_fee_percent" as const, label: "رسوم إدراج عرض", desc: "نسبة من قيمة العرض" },
              { key: "direct_buy_fee_percent" as const, label: "رسوم الشراء المباشر", desc: "نسبة من قيمة العملية" },
              { key: "auction_fee_percent" as const, label: "رسوم المزادات", desc: "نسبة من السعر النهائي" },
              { key: "quick_sell_fee_percent" as const, label: "رسوم البيع السريع", desc: "نسبة من قيمة البيع" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white">{item.label}</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">{item.desc}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={feeConfig[item.key]}
                    onChange={(e) => setFeeConfig({ ...feeConfig, [item.key]: parseFloat(e.target.value) || 0 })}
                    className="w-20 bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/20 text-center font-mono"
                  />
                  <span className="text-xs text-neutral-400">%</span>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">مكافأة الترحيب</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">عدد الوحدات الممنوحة عند التسجيل</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={feeConfig.welcome_bonus}
                  onChange={(e) => setFeeConfig({ ...feeConfig, welcome_bonus: parseInt(e.target.value) || 0 })}
                  className="w-28 bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/20 text-center font-mono"
                />
                <span className="text-xs text-neutral-400">وحدة</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => showSuccess("تم حفظ الإعدادات")}
            className="w-full mt-5 bg-neutral-100 text-black py-3 rounded-xl text-sm font-bold hover:bg-neutral-200"
          >
            حفظ التغييرات
          </button>
        </div>
      )}
    </div>
  )
}
