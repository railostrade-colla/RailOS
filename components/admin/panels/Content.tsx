"use client"

import { useState } from "react"
import { Plus, Pin, AlertTriangle, Edit2 } from "lucide-react"
import { Badge, ActionBtn, Table, THead, TH, TBody, TR, TD, SectionHeader, KPI, InnerTabBar, AdminEmpty } from "@/components/admin/ui"
import { mockNewsAdmin, mockAdsAdmin, mockSystemOffersAdmin } from "@/lib/admin/mock-data"
import { showSuccess } from "@/lib/utils/toast"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type ContentSubTab = "news" | "ads" | "offers"

export function ContentPanel() {
  const [subTab, setSubTab] = useState<ContentSubTab>("news")

  const tabs = [
    { key: "news", label: "📰 الأخبار", count: mockNewsAdmin.length },
    { key: "ads", label: "📢 الإعلانات", count: mockAdsAdmin.filter((a) => a.status === "active").length },
    { key: "offers", label: "🏢 عروض النظام", count: mockSystemOffersAdmin.filter((o) => o.status === "active").length },
  ]

  return (
    <div className="p-6 max-w-screen-2xl">

      <SectionHeader title="📝 إدارة المحتوى" subtitle="الأخبار والإعلانات وعروض النظام" />

      <InnerTabBar tabs={tabs} active={subTab} onSelect={(k) => setSubTab(k as ContentSubTab)} />

      {/* News */}
      {subTab === "news" && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <KPI label="منشور" val={mockNewsAdmin.filter((n) => n.status === "published").length} color="#4ADE80" />
            <KPI label="مسودة" val={mockNewsAdmin.filter((n) => n.status === "draft").length} color="#FBBF24" />
            <KPI label="إجمالي اللايكات" val={fmtNum(mockNewsAdmin.reduce((s, n) => s + n.likes, 0))} color="#F87171" />
          </div>

          <SectionHeader
            title="📰 الأخبار"
            action={
              <button
                onClick={() => showSuccess("نموذج إضافة خبر قيد التطوير")}
                className="bg-neutral-100 text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-neutral-200 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                خبر جديد
              </button>
            }
          />

          <Table>
            <THead>
              <TH>العنوان</TH>
              <TH>الفئة</TH>
              <TH>المُنشئ</TH>
              <TH>الخصائص</TH>
              <TH>الحالة</TH>
              <TH>اللايكات</TH>
              <TH>التاريخ</TH>
              <TH>الإجراء</TH>
            </THead>
            <TBody>
              {mockNewsAdmin.map((n) => (
                <TR key={n.id}>
                  <TD><span className="font-bold">{n.title}</span></TD>
                  <TD>
                    <Badge
                      label={n.category === "general" ? "عام" : n.category === "project" ? "مشروع" : "تنبيه"}
                      color={n.category === "alert" ? "red" : "blue"}
                    />
                  </TD>
                  <TD><span className="text-neutral-400 text-[11px]">{n.author}</span></TD>
                  <TD>
                    <div className="flex gap-1">
                      {n.is_pinned && (
                        <span className="bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 px-1.5 py-0.5 rounded text-[9px] flex items-center gap-1">
                          <Pin className="w-2.5 h-2.5" />
                          مثبت
                        </span>
                      )}
                      {n.is_important && (
                        <span className="bg-red-400/10 border border-red-400/20 text-red-400 px-1.5 py-0.5 rounded text-[9px] flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          هام
                        </span>
                      )}
                    </div>
                  </TD>
                  <TD>
                    <Badge label={n.status === "published" ? "منشور" : "مسودة"} color={n.status === "published" ? "green" : "gray"} />
                  </TD>
                  <TD><span className="text-red-400 font-mono">{n.likes}</span></TD>
                  <TD><span className="text-neutral-500">{n.created_at}</span></TD>
                  <TD>
                    <div className="flex gap-1.5">
                      <ActionBtn label="تعديل" color="blue" sm onClick={() => showSuccess("نموذج التعديل قيد التطوير")} />
                      <ActionBtn
                        label={n.status === "published" ? "إيقاف" : "نشر"}
                        color={n.status === "published" ? "gray" : "green"}
                        sm
                        onClick={() => showSuccess(n.status === "published" ? "تم الإيقاف" : "تم النشر")}
                      />
                      <ActionBtn label="حذف" color="red" sm onClick={() => showSuccess("تم الحذف")} />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}

      {/* Ads */}
      {subTab === "ads" && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <KPI label="نشطة" val={mockAdsAdmin.filter((a) => a.status === "active").length} color="#4ADE80" />
            <KPI label="إجمالي النقرات" val={fmtNum(mockAdsAdmin.reduce((s, a) => s + a.clicks, 0))} color="#60A5FA" />
            <KPI label="إجمالي الظهور" val={fmtNum(mockAdsAdmin.reduce((s, a) => s + a.impressions, 0))} color="#FBBF24" />
          </div>

          <SectionHeader
            title="📢 الإعلانات"
            action={
              <button
                onClick={() => showSuccess("نموذج إضافة إعلان قيد التطوير")}
                className="bg-neutral-100 text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-neutral-200 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                إعلان جديد
              </button>
            }
          />

          <Table>
            <THead>
              <TH>العنوان</TH>
              <TH>المشروع</TH>
              <TH>النقرات</TH>
              <TH>الظهور</TH>
              <TH>CTR</TH>
              <TH>الحالة</TH>
              <TH>ينتهي في</TH>
              <TH>الإجراء</TH>
            </THead>
            <TBody>
              {mockAdsAdmin.map((a) => {
                const ctr = ((a.clicks / a.impressions) * 100).toFixed(2)
                return (
                  <TR key={a.id}>
                    <TD>{a.title}</TD>
                    <TD>{a.project_name}</TD>
                    <TD><span className="text-blue-400 font-bold font-mono">{fmtNum(a.clicks)}</span></TD>
                    <TD><span className="font-mono">{fmtNum(a.impressions)}</span></TD>
                    <TD><span className="text-yellow-400 font-mono">{ctr}%</span></TD>
                    <TD>
                      <Badge label={a.status === "active" ? "نشط" : "منتهي"} color={a.status === "active" ? "green" : "gray"} />
                    </TD>
                    <TD><span className="text-neutral-500">{a.ends_at}</span></TD>
                    <TD>
                      <div className="flex gap-1.5">
                        <ActionBtn label="تعديل" color="blue" sm onClick={() => showSuccess("نموذج التعديل قيد التطوير")} />
                        {a.status === "active" && (
                          <ActionBtn label="إيقاف" color="red" sm onClick={() => showSuccess("تم الإيقاف")} />
                        )}
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </>
      )}

      {/* System Offers */}
      {subTab === "offers" && (
        <>
          <SectionHeader
            title="🏢 عروض النظام"
            subtitle="عروض رسمية من المنصة (تظهر في صفحة السوق > العروض)"
            action={
              <button
                onClick={() => showSuccess("نموذج إضافة عرض قيد التطوير")}
                className="bg-neutral-100 text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-neutral-200 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                عرض جديد
              </button>
            }
          />

          <Table>
            <THead>
              <TH>المشروع</TH>
              <TH>النوع</TH>
              <TH>السعر</TH>
              <TH>الحصص</TH>
              <TH>القيمة</TH>
              <TH>الحالة</TH>
              <TH>ينتهي في</TH>
              <TH>الإجراء</TH>
            </THead>
            <TBody>
              {mockSystemOffersAdmin.map((o) => (
                <TR key={o.id}>
                  <TD>{o.project_name}</TD>
                  <TD>
                    <Badge label={o.type === "sell" ? "بيع" : "شراء"} color={o.type === "sell" ? "red" : "green"} />
                  </TD>
                  <TD><span className="font-mono">{fmtNum(o.price)}</span></TD>
                  <TD><span className="font-mono">{o.shares}</span></TD>
                  <TD><span className="font-mono text-yellow-400">{fmtNum(o.price * o.shares)}</span></TD>
                  <TD>
                    <Badge label="نشط" color="green" />
                  </TD>
                  <TD><span className="text-neutral-500">{o.ends_at}</span></TD>
                  <TD>
                    <div className="flex gap-1.5">
                      <ActionBtn label="تعديل" color="blue" sm onClick={() => showSuccess("نموذج التعديل قيد التطوير")} />
                      <ActionBtn label="إنهاء" color="red" sm onClick={() => showSuccess("تم الإنهاء")} />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}
    </div>
  )
}
