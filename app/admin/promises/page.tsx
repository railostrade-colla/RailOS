"use client"

import { useState, useMemo } from "react"
import { Calendar, CheckCircle, Clock, XCircle, Plus, Award } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader, StatCard, Badge, Tabs, EmptyState, Modal } from "@/components/ui"
import { MOCK_PROMISES, getPromiseStats } from "@/lib/mock-data/market"
import type { DevelopmentPromise, PromiseStatus } from "@/lib/market/types"
import { showSuccess, showInfo } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

type TabId = "pending" | "in_progress" | "completed" | "failed" | "all"

const TABS: Array<{ id: TabId; icon: string; label: string }> = [
  { id: "pending",     icon: "⏳", label: "معلّقة" },
  { id: "in_progress", icon: "🔄", label: "قيد التنفيذ" },
  { id: "completed",   icon: "✅", label: "منجزة" },
  { id: "failed",      icon: "❌", label: "فاشلة" },
  { id: "all",         icon: "📋", label: "الكل" },
]

const STATUS_META: Record<PromiseStatus, { label: string; color: "yellow" | "blue" | "green" | "red" | "purple" }> = {
  pending:     { label: "معلّق",       color: "yellow" },
  in_progress: { label: "قيد التنفيذ", color: "blue" },
  completed:   { label: "منجز",        color: "green" },
  failed:      { label: "فاشل",        color: "red" },
  extended:    { label: "ممدّد",       color: "purple" },
}

const TYPE_LABELS: Record<DevelopmentPromise["promise_type"], string> = {
  milestone:   "مرحلة",
  expansion:   "توسعة",
  improvement: "تحسين",
  delivery:    "تسليم",
}

export default function PromisesPage() {
  const [tab, setTab] = useState<TabId>("pending")
  const [actionModal, setActionModal] = useState<{ promise: DevelopmentPromise; action: "complete" | "extend" | "fail" } | null>(null)

  const stats = useMemo(() => getPromiseStats(), [])

  const filtered = useMemo(() => {
    if (tab === "all") return MOCK_PROMISES
    return MOCK_PROMISES.filter((p) => p.status === tab)
  }, [tab])

  const handleAction = () => {
    if (!actionModal) return
    const labels = { complete: "تم تسجيل الإنجاز ✓", extend: "تم التمديد", fail: "تم تسجيل الفشل" }
    showSuccess(labels[actionModal.action])
    setActionModal(null)
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-5xl mx-auto pb-20">

          <PageHeader
            title="📜 وعود التطوير"
            subtitle="متابعة الالتزامات بحسب المشاريع"
            backHref="/admin"
          />

          {/* ═══ Stats ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 mb-6">
            <StatCard label="إجمالي" value={stats.total} icon={<Award className="w-3 h-3" />} />
            <StatCard label="معلّقة" value={stats.pending} color="yellow" />
            <StatCard label="قيد التنفيذ" value={stats.in_progress} color="blue" />
            <StatCard label="منجزة" value={stats.completed} color="green" />
            <StatCard label="فاشلة" value={stats.failed} color="red" />
          </div>

          {/* ═══ Tabs ═══ */}
          <div className="mb-5">
            <Tabs
              tabs={TABS.map((t) => ({
                ...t,
                count: t.id === "all" ? stats.total : MOCK_PROMISES.filter((p) => p.status === t.id).length,
              }))}
              activeTab={tab}
              onChange={(id) => setTab(id as TabId)}
              size="sm"
            />
          </div>

          {/* ═══ Promises list ═══ */}
          {filtered.length === 0 ? (
            <EmptyState
              icon="📭"
              title="لا توجد وعود في هذه الفئة"
              description="جرّب تبويباً آخر"
              size="md"
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => {
                const status = STATUS_META[p.status]
                const isOverdue = new Date(p.due_at) < new Date() && p.status !== "completed" && p.status !== "failed"
                return (
                  <Card key={p.id}>
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white mb-1">{p.project_name}</div>
                        <p className="text-xs text-neutral-300 leading-relaxed">{p.promise_text}</p>
                      </div>
                      <Badge color={status.color} variant="soft">{status.label}</Badge>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <Badge color="neutral" variant="soft" size="xs">{TYPE_LABELS[p.promise_type]}</Badge>
                      <span className={cn(
                        "text-[10px] flex items-center gap-1",
                        isOverdue ? "text-red-400" : "text-neutral-500",
                      )}>
                        <Calendar className="w-2.5 h-2.5" />
                        <span dir="ltr">{p.due_at.slice(0, 10)}</span>
                        {isOverdue && <span className="text-red-400 font-bold">· متأخر</span>}
                      </span>
                      {p.completed_at && (
                        <span className="text-[10px] text-green-400 flex items-center gap-1">
                          <CheckCircle className="w-2.5 h-2.5" />
                          أُنجز <span dir="ltr">{p.completed_at.slice(0, 10)}</span>
                        </span>
                      )}
                    </div>

                    {(p.status === "pending" || p.status === "in_progress" || p.status === "extended") && (
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setActionModal({ promise: p, action: "complete" })}
                          className="flex-1 bg-green-400/[0.08] border border-green-400/25 hover:bg-green-400/[0.12] text-green-400 py-2 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" strokeWidth={2.5} />
                          إثبات الإنجاز
                        </button>
                        <button
                          onClick={() => setActionModal({ promise: p, action: "extend" })}
                          className="flex-1 bg-yellow-400/[0.08] border border-yellow-400/25 hover:bg-yellow-400/[0.12] text-yellow-400 py-2 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1"
                        >
                          <Clock className="w-3 h-3" strokeWidth={2.5} />
                          تمديد
                        </button>
                        <button
                          onClick={() => setActionModal({ promise: p, action: "fail" })}
                          className="flex-1 bg-red-400/[0.08] border border-red-400/25 hover:bg-red-400/[0.12] text-red-400 py-2 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1"
                        >
                          <XCircle className="w-3 h-3" strokeWidth={2.5} />
                          تسجيل فشل
                        </button>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}

          {/* Floating add button */}
          <button
            onClick={() => showInfo("إنشاء وعد يدوي قادم قريباً")}
            className="fixed bottom-6 left-6 lg:left-1/2 lg:-translate-x-1/2 bg-neutral-100 text-black w-14 h-14 rounded-full shadow-2xl hover:bg-neutral-200 transition-colors flex items-center justify-center z-40"
            aria-label="إضافة وعد"
          >
            <Plus className="w-5 h-5" strokeWidth={2.5} />
          </button>

        </div>
      </div>

      {/* Action confirmation Modal */}
      {actionModal && (
        <Modal
          isOpen={!!actionModal}
          onClose={() => setActionModal(null)}
          title={
            actionModal.action === "complete" ? "إثبات الإنجاز" :
            actionModal.action === "extend" ? "تمديد المهلة" :
            "تسجيل فشل"
          }
          subtitle={actionModal.promise.project_name}
          variant={actionModal.action === "fail" ? "danger" : actionModal.action === "complete" ? "success" : "warning"}
          size="sm"
          footer={
            <>
              <button
                onClick={() => setActionModal(null)}
                className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-2.5 rounded-xl text-sm hover:bg-white/[0.08] transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleAction}
                className="flex-1 bg-neutral-100 text-black py-2.5 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-colors"
              >
                تأكيد
              </button>
            </>
          }
        >
          <p className="text-sm text-neutral-300 leading-relaxed">{actionModal.promise.promise_text}</p>
        </Modal>
      )}
    </AppLayout>
  )
}
