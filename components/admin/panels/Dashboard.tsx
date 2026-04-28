"use client"

import { useRouter } from "next/navigation"
import { KPI, Badge, ActionBtn, Table, THead, TH, TBody, TR, TD, SectionHeader } from "@/components/admin/ui"
import { mockAdminStats, mockPendingTrades, mockKYCPending } from "@/lib/admin/mock-data"
import { showSuccess } from "@/lib/utils/toast"

const fmtNum = (n: number) => n.toLocaleString("en-US")

export function DashboardPanel() {
  const router = useRouter()
  const stats = mockAdminStats

  const healthColor =
    stats.marketHealth >= 75 ? "#4ADE80" :
    stats.marketHealth >= 50 ? "#FBBF24" : "#F87171"

  const goTo = (tab: string) => router.push(`/admin?tab=${tab}`)

  return (
    <div className="p-6 max-w-screen-2xl">

      <SectionHeader
        title="◈ لوحة التحكم"
        subtitle="نظرة عامة على المنصة والإحصائيات الأساسية"
      />

      {/* المالية */}
      <div className="mb-5">
        <SectionHeader
          title="💰 الإحصائيات المالية"
          action={<ActionBtn label="الصفقات" color="gray" sm onClick={() => goTo("trades")} />}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="إجمالي الصفقات" val={fmtNum(stats.totalTrades)} color="#fff" />
          <KPI label="صفقات معلقة" val={fmtNum(stats.pendingTrades)} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
          <KPI label="صفقات ملغاة" val={fmtNum(stats.cancelledTrades)} color="#F87171" />
          <KPI label="عروض نشطة" val={fmtNum(stats.activeListings)} color="#60A5FA" />
        </div>
        <div className="mt-3">
          <KPI label="حجم تداول اليوم" val={fmtNum(stats.dailyVolume) + " د.ع"} color="#FBBF24" />
        </div>
      </div>

      {/* المشاريع */}
      <div className="mb-5">
        <SectionHeader
          title="🏢 المشاريع والشركات"
          action={<ActionBtn label="إدارة" color="gray" sm onClick={() => goTo("projects")} />}
        />
        <div className="grid grid-cols-3 gap-3">
          <KPI label="مشاريع نشطة" val={fmtNum(stats.activeProjects)} color="#60A5FA" />
          <KPI label="معلقة - قيد المراجعة" val={fmtNum(stats.pendingProjects)} color="#FBBF24" />
          <KPI label="منتهية / مغلقة" val={fmtNum(stats.closedProjects)} color="rgba(255,255,255,0.4)" />
        </div>
      </div>

      {/* الحصص */}
      <div className="mb-5">
        <SectionHeader
          title="🧩 الحصص"
          action={<ActionBtn label="إدارة الحصص" color="gray" sm onClick={() => goTo("shares")} />}
        />
        <div className="grid grid-cols-3 gap-3">
          <KPI label="إجمالي الحصص" val={fmtNum(stats.totalShares)} color="#fff" />
          <KPI label="حصص متداولة" val={fmtNum(stats.tradedShares)} color="#4ADE80" />
          <KPI label="حصص مجمدة" val={fmtNum(stats.frozenShares)} color="#F87171" accent="rgba(248,113,113,0.06)" />
        </div>
      </div>

      {/* النشاط العام */}
      <div className="mb-5">
        <SectionHeader title="📊 النشاط العام" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <KPI label="مزادات مفتوحة" val={fmtNum(stats.openAuctions)} color="#C084FC" />
          <KPI label="مزادات مكتملة" val={fmtNum(stats.closedAuctions)} color="rgba(255,255,255,0.4)" />
          <KPI label="عقود نشطة" val={fmtNum(stats.activeContracts)} color="#2DD4BF" />
          <KPI label="عقود معلقة" val={fmtNum(stats.pendingContracts)} color="#FBBF24" />
          <KPI
            label="نزاعات مفتوحة"
            val={fmtNum(stats.openDisputes)}
            color="#F87171"
            accent={stats.openDisputes > 0 ? "rgba(248,113,113,0.1)" : undefined}
          />
          <KPI label="أخبار منشورة" val={fmtNum(stats.publishedNews)} color="#60A5FA" />
        </div>
      </div>

      {/* مؤشر صحة السوق */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-5">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-bold text-white">📊 مؤشر صحة السوق</span>
          <span className="text-2xl font-bold" style={{ color: healthColor }}>
            {stats.marketHealth}%
          </span>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${stats.marketHealth}%`, background: healthColor }}
          />
        </div>
        <div className="text-[10px] text-neutral-500">
          يعتمد على: حجم التداول · نسبة نجاح الصفقات · معدل النزاعات · السيولة
        </div>
      </div>

      {/* صفقات معلقة - تنتظر الموافقة */}
      {stats.pendingTrades > 0 && (
        <div className="mb-5">
          <SectionHeader
            title={`⚡ صفقات تنتظر الموافقة (${stats.pendingTrades})`}
            action={<ActionBtn label="الكل" color="yellow" sm onClick={() => goTo("trades")} />}
          />
          <Table>
            <THead>
              <TH>المشروع</TH>
              <TH>الحصص</TH>
              <TH>القيمة</TH>
              <TH>التاريخ</TH>
              <TH>الإجراء</TH>
            </THead>
            <TBody>
              {mockPendingTrades.slice(0, 5).map((t) => (
                <TR key={t.id}>
                  <TD>{t.project_name}</TD>
                  <TD><span className="text-green-400 font-bold">{t.shares}</span></TD>
                  <TD><span className="text-yellow-400 font-mono">{fmtNum(t.total)} د.ع</span></TD>
                  <TD><span className="text-neutral-500">{t.created_at}</span></TD>
                  <TD>
                    <div className="flex gap-1.5">
                      <ActionBtn label="تأكيد ✓" color="green" sm onClick={() => showSuccess("تم التأكيد")} />
                      <ActionBtn label="رفض" color="red" sm onClick={() => showSuccess("تم الرفض")} />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      {/* KYC المعلقة */}
      {stats.kycPending > 0 && (
        <div className="mb-5">
          <SectionHeader
            title={`🪪 طلبات توثيق KYC (${stats.kycPending})`}
            action={<ActionBtn label="الكل" color="yellow" sm onClick={() => goTo("users")} />}
          />
          <Table>
            <THead>
              <TH>الاسم</TH>
              <TH>الهاتف</TH>
              <TH>الانضمام</TH>
              <TH>الإجراء</TH>
            </THead>
            <TBody>
              {mockKYCPending.map((u) => (
                <TR key={u.id}>
                  <TD>{u.name}</TD>
                  <TD><span dir="ltr">{u.phone}</span></TD>
                  <TD><span className="text-neutral-500">{u.joined}</span></TD>
                  <TD>
                    <div className="flex gap-1.5">
                      <ActionBtn label="قبول" color="green" sm onClick={() => showSuccess("تم التوثيق")} />
                      <ActionBtn label="رفض" color="red" sm onClick={() => showSuccess("تم الرفض")} />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

    </div>
  )
}
