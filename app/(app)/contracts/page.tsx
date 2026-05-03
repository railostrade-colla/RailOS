"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, FileText } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { mockContracts, type ContractStatus } from "@/lib/mock-data"
import type { ContractListItem } from "@/lib/mock-data/types"
import { getMyContracts } from "@/lib/data/contracts"
import { cn } from "@/lib/utils/cn"

type Tab = "active" | "ended"

const statusLabel = (s: ContractStatus) =>
  ({ pending: "قيد الانتظار", active: "نشط", ended: "منتهي", cancelled: "ملغى" }[s])

const statusBadge = (s: ContractStatus) => {
  if (s === "pending") return "bg-yellow-400/15 border-yellow-400/30 text-yellow-400"
  if (s === "active") return "bg-green-400/15 border-green-400/30 text-green-400"
  if (s === "ended") return "bg-white/[0.06] border-white/[0.08] text-neutral-400"
  return "bg-red-400/15 border-red-400/30 text-red-400"
}

export default function ContractsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("active")
  // Mock first-paint, real DB on mount.
  const [contracts, setContracts] = useState<ContractListItem[]>(mockContracts)

  useEffect(() => {
    let cancelled = false
    getMyContracts().then((rows) => {
      if (cancelled) return
      // Show real list always — empty means user has no contracts.
      setContracts(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = contracts.filter((c) =>
    tab === "active" ? ["pending", "active"].includes(c.status) : ["ended", "cancelled"].includes(c.status)
  )

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            title="العقود"
            subtitle="عقود الشراكة والاستثمار الخاصة بك"
            rightAction={
              <button
                onClick={() => router.push("/contracts/create")}
                className="bg-neutral-100 text-black px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-neutral-200 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                إنشاء عقد
              </button>
            }
          />

          {/* Tabs النشطة/المنتهية */}
          <div className="flex justify-start items-center mb-4">
            <div className="flex gap-1 bg-white/[0.05] border border-white/[0.08] rounded-xl p-1">
              {[
                { key: "active" as const, label: "النشطة" },
                { key: "ended" as const, label: "المنتهية" },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "px-5 py-2 rounded-lg text-xs transition-colors",
                    tab === t.key
                      ? "bg-white/[0.08] text-white font-bold border border-white/[0.1]"
                      : "text-neutral-500 hover:text-white"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Empty state */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 text-neutral-600 mx-auto mb-3" strokeWidth={1.5} />
              <div className="text-sm font-bold text-white mb-1">
                {tab === "active" ? "لا توجد عقود سارية" : "لا توجد عقود منتهية"}
              </div>
              {tab === "active" && (
                <button
                  onClick={() => router.push("/contracts/create")}
                  className="mt-5 bg-neutral-100 text-black px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-neutral-200"
                >
                  إنشاء أول عقد
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/contracts/${c.id}`)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 hover:bg-white/[0.07] transition-colors text-right"
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-bold text-white mb-1 truncate">{c.title}</div>
                      <div className="text-[11px] text-neutral-500">{c.created_at}</div>
                    </div>
                    <span className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold border", statusBadge(c.status))}>
                      {statusLabel(c.status)}
                    </span>
                  </div>

                  {/* Partners stack */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex">
                      {c.partners.slice(0, 4).map((p, i) => (
                        <div
                          key={i}
                          className="w-7 h-7 rounded-full bg-white/[0.1] border-2 border-black flex items-center justify-center text-[10px] font-bold text-white -mr-2"
                          style={{ zIndex: 10 - i }}
                        >
                          {p.user.name.charAt(0)}
                        </div>
                      ))}
                    </div>
                    <span className="text-[11px] text-neutral-500 ml-2">{c.partners.length} شركاء</span>
                    {c.creator_id === "me" && (
                      <span className="text-[10px] text-neutral-500 mr-auto">أنت المنشئ</span>
                    )}
                  </div>

                  {/* Investment value */}
                  {c.total_investment > 0 && (
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                      <div className="text-[10px] text-neutral-500 mb-0.5">قيمة الاستثمار</div>
                      <div className="text-sm font-bold text-white font-mono">
                        {c.total_investment.toLocaleString("en-US")} IQD
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  )
}
