"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, ChevronLeft, FileText } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, Tabs, Badge, EmptyState, Modal } from "@/components/ui"
import {
  getMySponsorships,
  getMyReports,
  SPONSORSHIP_TYPE_LABELS,
} from "@/lib/mock-data/orphans"
import { showSuccess } from "@/lib/utils/toast"

const fmtNum = (n: number) => n.toLocaleString("en-US")

export default function MySponsorshipsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<"active" | "ended">("active")
  const sponsorships = getMySponsorships("abc123def456")
  const reports = getMyReports("abc123def456")
  const [showStopId, setShowStopId] = useState<string | null>(null)

  const filtered = sponsorships.filter((s) => s.status === tab)

  const handleStop = () => {
    if (!showStopId) return
    showSuccess("✅ تم إيقاف الكفالة. شكراً لمساهمتك")
    setShowStopId(null)
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader
            title="💝 كفالاتي"
            subtitle="متابعة الأطفال الذين تكفلهم"
            rightAction={
              <button
                onClick={() => router.push("/orphans/sponsor")}
                className="bg-neutral-100 text-black px-3 py-1.5 rounded-md text-xs font-bold hover:bg-neutral-200 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                كفالة جديدة
              </button>
            }
          />

          <div className="mb-5">
            <Tabs
              tabs={[
                { id: "active", icon: "💝", label: "نشطة",   count: sponsorships.filter((s) => s.status === "active").length },
                { id: "ended",  icon: "✅", label: "منتهية", count: sponsorships.filter((s) => s.status === "ended").length },
              ]}
              activeTab={tab}
              onChange={(id) => setTab(id as "active" | "ended")}
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="💝"
              title={tab === "active" ? "لا توجد كفالات نشطة" : "لا توجد كفالات منتهية"}
              description={tab === "active" ? "ابدأ كفالتك الأولى الآن" : ""}
              action={tab === "active" ? { label: "ابدأ كفالة", onClick: () => router.push("/orphans/sponsor") } : undefined}
              size="md"
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((s) => {
                const childReports = reports.filter((r) => r.child_id === s.child_id)
                return (
                  <Card key={s.id} padding="md">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-2xl bg-teal-400/[0.1] border border-teal-400/[0.2] flex items-center justify-center text-2xl flex-shrink-0">
                          👤
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-white">{s.child_first_name}</div>
                          <div className="text-[10px] text-neutral-500">منذ {s.started_at}</div>
                        </div>
                      </div>
                      <Badge color={s.type === "monthly" ? "green" : s.type === "annual" ? "purple" : "blue"}>{SPONSORSHIP_TYPE_LABELS[s.type]}</Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3 text-[11px]">
                      <div>
                        <div className="text-[10px] text-neutral-500 mb-0.5">المبلغ</div>
                        <div className="text-green-400 font-mono font-bold">{fmtNum(s.amount)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-neutral-500 mb-0.5">المدّة</div>
                        <div className="text-white">{s.duration_months} شهر</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-neutral-500 mb-0.5">التقارير</div>
                        <div className="text-white font-mono">{childReports.length}</div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-white/[0.05]">
                      <button
                        onClick={() => router.push(`/orphans/children/${s.child_id}`)}
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] text-white py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
                      >
                        ملف الطفل
                        <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
                      </button>
                      {s.status === "active" && (
                        <button
                          onClick={() => setShowStopId(s.id)}
                          className="bg-red-400/[0.05] border border-red-400/[0.2] text-red-400 px-4 py-2 rounded-lg text-xs font-medium hover:bg-red-400/[0.1] transition-colors"
                        >
                          إيقاف
                        </button>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Reports section */}
          {reports.length > 0 && tab === "active" && (
            <>
              <div className="mt-7 mb-3">
                <div className="text-base font-bold text-white">📊 آخر التقارير</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">{reports.length} تقرير</div>
              </div>
              <div className="space-y-2">
                {reports.slice(0, 5).map((r) => (
                  <Card key={r.id} padding="sm">
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 text-blue-400 flex-shrink-0 mt-1" strokeWidth={1.5} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs text-white font-bold">{r.child_first_name} · {r.period}</div>
                          <span className="text-[10px] text-neutral-500">{r.sent_at}</span>
                        </div>
                        <div className="text-[11px] text-neutral-400 line-clamp-2">{r.education_progress}</div>
                        {r.photos_count > 0 && (
                          <div className="text-[10px] text-blue-400 mt-1">📷 {r.photos_count} صور</div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

        </div>
      </div>

      <Modal
        isOpen={!!showStopId}
        onClose={() => setShowStopId(null)}
        title="إيقاف الكفالة"
        variant="warning"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowStopId(null)} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">تراجع</button>
            <button onClick={handleStop} className="flex-1 py-2.5 rounded-xl bg-red-500/[0.15] border border-red-500/[0.3] text-red-400 text-sm font-bold hover:bg-red-500/[0.2]">تأكيد الإيقاف</button>
          </>
        }
      >
        <div className="text-xs text-neutral-300 leading-relaxed">
          هل أنت متأكد من إيقاف الكفالة؟ سيتم إشعارك بالتقارير حتى نهاية الشهر الحالي. لن يُخصم أي مبلغ بعد ذلك.
        </div>
      </Modal>
    </AppLayout>
  )
}
