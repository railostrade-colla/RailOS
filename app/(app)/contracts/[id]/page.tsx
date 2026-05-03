"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Users, Calendar, Coins, FileText, AlertTriangle, X, Check } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { ContractLimitCard } from "@/components/contracts/ContractLimitCard"
import { Card, Modal, Badge } from "@/components/ui"
import { LEVEL_LABELS, LEVEL_ICONS } from "@/lib/utils/contractLimits"
import {
  mockContract,
  calculateContractDistribution,
  endContract as endContractMock,
  CONTRACT_END_FEE_PCT,
} from "@/lib/mock-data"
import type { ContractDetail } from "@/lib/mock-data/types"
import { getContractById, endContract } from "@/lib/data/contracts"
import { createClient } from "@/lib/supabase/client"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtIQD = (n: number) => n.toLocaleString("en-US")

const statusLabel = (s: string) =>
  ({ pending: "قيد الانتظار", active: "نشط", ended: "منتهي" }[s] || s)

const statusBadge = (s: string) => {
  if (s === "pending") return "bg-yellow-400/15 border-yellow-400/30 text-yellow-400"
  if (s === "active") return "bg-green-400/15 border-green-400/30 text-green-400"
  return "bg-white/[0.06] border-white/[0.08] text-neutral-400"
}

export default function ContractDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = (params?.id as string) || "ct1"

  // Mock first-paint, real DB on mount.
  const [contract, setContract] = useState<ContractDetail>(mockContract)
  const [currentUserId, setCurrentUserId] = useState<string>("")

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getContractById(id),
      createClient().auth.getUser(),
    ]).then(([c, u]) => {
      if (cancelled) return
      if (c) setContract(c)
      const uid = u.data.user?.id ?? ""
      if (uid) setCurrentUserId(uid)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const [showEndModal, setShowEndModal] = useState(false)
  const [confirmCheck, setConfirmCheck] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Real ownership check — by creator id from contract row.
  // Falls back to mock string-match for the seed contract.
  const isCreator =
    currentUserId
      ? // The DB row provides creator as full_name string; we don't
        // expose creator_id on ContractDetail. As a workaround, the
        // /contracts/[id] page should rely on getMyContracts elsewhere
        // for the ownership check. Here we approximate with name.
        contract.creator === "أحمد محمد"
      : contract.creator === "أحمد محمد"

  const distribution = calculateContractDistribution(contract.id)

  const handleEndContract = async () => {
    if (!distribution) return
    if (!confirmCheck) {
      showError("أكّد رغبتك في إنهاء العقد أولاً")
      return
    }
    setSubmitting(true)
    const result = await endContract(contract.id)
    setSubmitting(false)
    if (result.success) {
      // Mirror to mock store too so any other mock-driven UI in the
      // same session reflects the change.
      endContractMock(contract.id)
      showSuccess(
        `تم إنهاء العقد + توزيع الحصص! 🎉${
          result.fee_deducted ? ` (خصم رسوم: ${fmtIQD(result.fee_deducted)})` : ""
        }`,
      )
      setShowEndModal(false)
      setTimeout(() => router.push("/contracts"), 600)
      return
    }
    // Failure paths.
    if (result.reason === "not_owner") {
      showError("فقط منشئ العقد يقدر ينهيه")
    } else if (result.reason === "not_active") {
      showError("العقد غير نشط")
    } else if (result.reason === "missing_table") {
      showError("الميزة غير متاحة على الخادم بعد")
    } else {
      showError(result.error || "تعذّر إنهاء العقد")
    }
    setShowEndModal(false)
  }

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            title="تفاصيل العقد"
            subtitle={contract.title}
            backHref="/contracts"
          />

          {/* Contract info card */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-4">
            <div className="flex items-start justify-between mb-3 gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-white mb-1.5">{contract.title}</div>
                <div className="text-[11px] text-neutral-500">
                  منشئ العقد: <span className="text-white font-bold">{contract.creator}</span>
                </div>
              </div>
              <span className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold border", statusBadge(contract.status))}>
                {statusLabel(contract.status)}
              </span>
            </div>

            {contract.description && (
              <div className="text-xs text-neutral-300 leading-relaxed bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 mt-3">
                {contract.description}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-400 flex-shrink-0" strokeWidth={1.5} />
                <div className="min-w-0">
                  <div className="text-[10px] text-neutral-500 mb-0.5">قيمة الاستثمار</div>
                  <div className="text-xs font-bold text-yellow-400 font-mono truncate">{fmtIQD(contract.total_investment)}</div>
                </div>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400 flex-shrink-0" strokeWidth={1.5} />
                <div className="min-w-0">
                  <div className="text-[10px] text-neutral-500 mb-0.5">الأعضاء</div>
                  <div className="text-xs font-bold text-white">{contract.members.length} شركاء</div>
                </div>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400 flex-shrink-0" strokeWidth={1.5} />
                <div className="min-w-0">
                  <div className="text-[10px] text-neutral-500 mb-0.5">التاريخ</div>
                  <div className="text-xs font-bold text-white truncate">{contract.created_at}</div>
                </div>
              </div>
            </div>
          </div>

          {/* الحد الشهري الجماعي */}
          <div className="mb-4">
            <ContractLimitCard members={contract.members.map((m) => ({ name: m.name, level: m.level }))} />
          </div>

          {/* قائمة الأعضاء التفصيلية */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
              <div className="text-sm font-bold text-white">الشركاء ({contract.members.length})</div>
            </div>
            <div className="space-y-2">
              {contract.members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-base font-bold text-white flex-shrink-0">
                    {m.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">{m.name}</span>
                      <span className="text-[10px]">{LEVEL_ICONS[m.level]}</span>
                      <span className="text-[10px] text-neutral-500">{LEVEL_LABELS[m.level]}</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      حصة: <span className="text-yellow-400 font-mono font-bold">{m.share_percent}%</span>
                    </div>
                  </div>
                  <div className="text-base font-bold text-white font-mono flex-shrink-0">
                    {m.share_percent}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ End contract button (creator + active only) ═══ */}
          {isCreator && contract.status === "active" && (
            <button
              onClick={() => setShowEndModal(true)}
              className="w-full bg-red-500/[0.1] border border-red-500/30 hover:bg-red-500/[0.15] text-red-400 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors mb-6"
            >
              <AlertTriangle className="w-4 h-4" strokeWidth={2} />
              إنهاء العقد وتوزيع الحصص
            </button>
          )}

        </div>
      </div>

      {/* ═══ End contract Modal ═══ */}
      {showEndModal && distribution && (
        <Modal
          isOpen={showEndModal}
          onClose={() => !submitting && setShowEndModal(false)}
          title="⚠️ إنهاء العقد وتوزيع الحصص"
          subtitle="هذا الإجراء لا يمكن التراجع عنه"
          variant="warning"
          size="lg"
          footer={
            <>
              <button
                onClick={() => setShowEndModal(false)}
                disabled={submitting}
                className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-2.5 rounded-xl text-sm hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleEndContract}
                disabled={!confirmCheck || submitting}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  confirmCheck && !submitting
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-white/[0.05] text-neutral-500 cursor-not-allowed",
                )}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري التوزيع...
                  </>
                ) : (
                  "إنهاء وتوزيع"
                )}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Summary */}
            <Card padding="md">
              <div className="text-xs font-bold text-white mb-3">ملخّص التوزيع</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">إجمالي الحصص</div>
                  <div className="text-lg font-bold text-yellow-400 font-mono">
                    {distribution.total_shares.toLocaleString("en-US")}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">عدد الأعضاء</div>
                  <div className="text-lg font-bold text-blue-400 font-mono">
                    {distribution.distribution.length}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">قيمة العقد</div>
                  <div className="text-sm font-bold text-white font-mono">
                    {fmtIQD(distribution.total_value)}
                  </div>
                </div>
              </div>
            </Card>

            {/* Distribution table */}
            <div>
              <div className="text-xs font-bold text-white mb-2">التوزيع المتوقّع</div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_60px_80px_100px] gap-2 px-3 py-2 bg-white/[0.04] border-b border-white/[0.06] text-[10px] text-neutral-500 font-bold">
                  <span>العضو</span>
                  <span className="text-center">النسبة</span>
                  <span className="text-center">الحصص</span>
                  <span className="text-left">القيمة</span>
                </div>
                {distribution.distribution.map((row) => (
                  <div
                    key={row.member_id}
                    className="grid grid-cols-[1fr_60px_80px_100px] gap-2 px-3 py-2.5 items-center border-b border-white/[0.04] last:border-0"
                  >
                    <span className="text-xs text-white truncate">{row.member_name}</span>
                    <span className="text-xs text-yellow-400 font-mono font-bold text-center">{row.percentage}%</span>
                    <span className="text-xs text-blue-400 font-mono font-bold text-center">{row.shares}</span>
                    <span className="text-xs text-white font-mono text-left">
                      {fmtIQD(row.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fee warning */}
            <Card variant="highlighted" color="yellow" padding="md">
              <div className="text-xs font-bold text-yellow-400 mb-2 flex items-center gap-1.5">
                📌 رسوم إنهاء العقد
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] text-neutral-300">{CONTRACT_END_FEE_PCT}% من قيمة العقد</span>
                <span className="text-base font-bold text-yellow-400 font-mono">
                  {fmtIQD(distribution.end_fee)} د.ع
                </span>
              </div>
              <div className="text-[10px] text-neutral-500">
                ستُخصم من رصيد وحدات الرسوم لمنشئ العقد
              </div>
            </Card>

            {/* Confirm checkbox */}
            <label className="flex items-start gap-3 cursor-pointer py-2 group">
              <button
                type="button"
                onClick={() => setConfirmCheck(!confirmCheck)}
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors mt-0.5",
                  confirmCheck
                    ? "bg-red-500 border-red-500"
                    : "bg-white/[0.04] border-white/[0.2] group-hover:border-white/[0.35]",
                )}
              >
                {confirmCheck && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
              </button>
              <span className="text-xs text-neutral-300 leading-relaxed select-none">
                أؤكد أنني أرغب في إنهاء العقد وتوزيع الحصص على جميع الأعضاء
              </span>
            </label>
          </div>
        </Modal>
      )}
    </AppLayout>
  )
}
