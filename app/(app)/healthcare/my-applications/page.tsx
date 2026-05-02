"use client"

import { useRouter } from "next/navigation"
import { Plus, Hospital } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, Badge, EmptyState } from "@/components/ui"
import {
  getMyApplications,
  APP_STATUS_LABELS,
  DISEASE_LABELS,
} from "@/lib/mock-data/healthcare"

const fmtNum = (n: number) => n.toLocaleString("en-US")

export default function MyApplicationsPage() {
  const router = useRouter()
  const apps = getMyApplications("abc123def456")

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader
            title="📋 طلباتي"
            subtitle="متابعة طلبات الرعاية الصحية المُقدَّمة"
            rightAction={
              <button
                onClick={() => router.push("/healthcare/apply")}
                className="bg-neutral-100 text-black px-3 py-1.5 rounded-md text-xs font-bold hover:bg-neutral-200 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                طلب جديد
              </button>
            }
          />

          {apps.length === 0 ? (
            <EmptyState
              icon="📋"
              title="لا توجد طلبات بعد"
              description="قدّم طلبك الأول الآن"
              action={{ label: "تقديم طلب", onClick: () => router.push("/healthcare/apply") }}
              size="md"
            />
          ) : (
            <div className="space-y-3">
              {apps.map((app) => {
                const disease = DISEASE_LABELS[app.disease_type]
                const status = APP_STATUS_LABELS[app.status]
                return (
                  <Card key={app.id} padding="md">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-red-400/[0.1] border border-red-400/[0.2] flex items-center justify-center text-base flex-shrink-0">
                          {disease.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-white">{disease.label}</div>
                          <div className="text-[10px] text-neutral-500 font-mono">#{app.id}</div>
                        </div>
                      </div>
                      <Badge color={status.color}>{status.label}</Badge>
                    </div>

                    <div className="text-xs text-neutral-300 leading-relaxed mb-3 line-clamp-2">{app.diagnosis}</div>

                    <div className="grid grid-cols-3 gap-2 mb-3 text-[11px]">
                      <div>
                        <div className="text-[10px] text-neutral-500 mb-0.5">التكلفة</div>
                        <div className="text-white font-mono">{fmtNum(app.total_cost)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-neutral-500 mb-0.5">المتوفّر</div>
                        <div className="text-neutral-300 font-mono">{fmtNum(app.user_available)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-neutral-500 mb-0.5">المطلوب</div>
                        <div className="text-blue-400 font-mono font-bold">{fmtNum(app.requested_amount)}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-neutral-400 pt-2 border-t border-white/[0.05]">
                      <Hospital className="w-3 h-3" strokeWidth={1.5} />
                      <span className="truncate">{app.hospital}</span>
                      <span className="text-neutral-600">·</span>
                      <span className="text-neutral-500 mr-auto">{app.submitted_at}</span>
                    </div>

                    {app.rejection_reason && (
                      <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-lg p-2.5 mt-3">
                        <div className="text-[10px] text-red-400 font-bold mb-1">سبب الرفض:</div>
                        <div className="text-[11px] text-neutral-300">{app.rejection_reason}</div>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  )
}
