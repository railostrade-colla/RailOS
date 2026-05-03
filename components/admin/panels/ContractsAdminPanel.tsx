"use client"

import { useEffect, useState } from "react"
import { Search, X } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  mockContracts,
  mockContract,
  CONTRACT_END_FEE_PCT,
  calculateContractDistribution,
} from "@/lib/mock-data/contracts"
import type { ContractListItem, ContractStatus } from "@/lib/mock-data/types"
import {
  getAllContracts,
  getContractMembers,
  adminForceEndContract,
  adminCancelContract,
  adminResolveContractInternally,
  type AdminContractMember,
} from "@/lib/data/contracts-admin"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type ActionMode = null | "force_end" | "freeze" | "resolve_internal"

const STATUS_META: Record<ContractStatus, { label: string; color: "yellow" | "green" | "gray" | "red" }> = {
  pending:   { label: "بانتظار التفعيل", color: "yellow" },
  active:    { label: "نشط",             color: "green" },
  ended:     { label: "منتهٍ",           color: "gray" },
  cancelled: { label: "ملغى",            color: "red" },
}

export function ContractsAdminPanel() {
  const [filter, setFilter] = useState<string>("active")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<ContractListItem | null>(null)
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [reason, setReason] = useState("")

  // For internal resolution — edit percentages
  const [editPercents, setEditPercents] = useState<Record<string, number>>({})

  // Mock first-paint, real DB on mount.
  const [contracts, setContracts] = useState<ContractListItem[]>(mockContracts)
  const [members, setMembers] = useState<AdminContractMember[]>([])
  const [submitting, setSubmitting] = useState(false)

  const refresh = () => {
    getAllContracts().then((c) => {
      if (c.length > 0) setContracts(c)
    })
  }
  useEffect(() => {
    refresh()
  }, [])

  // When user opens a contract detail, fetch its real members
  useEffect(() => {
    if (selected) {
      getContractMembers(selected.id).then((m) => {
        setMembers(m)
      })
    } else {
      setMembers([])
    }
  }, [selected])

  const tabs = [
    { key: "all", label: "الكل", count: contracts.length },
    { key: "pending", label: "بانتظار", count: contracts.filter((c) => c.status === "pending").length },
    { key: "active", label: "نشطة", count: contracts.filter((c) => c.status === "active").length },
    { key: "ended", label: "منتهية", count: contracts.filter((c) => c.status === "ended").length },
    { key: "cancelled", label: "ملغاة", count: contracts.filter((c) => c.status === "cancelled").length },
  ]

  const filtered = contracts
    .filter((c) => filter === "all" || c.status === filter)
    .filter((c) =>
      !search ||
      c.id.includes(search) ||
      c.title.includes(search)
    )

  const stats = {
    pending: contracts.filter((c) => c.status === "pending").length,
    active: contracts.filter((c) => c.status === "active").length,
    ended: contracts.filter((c) => c.status === "ended").length,
    cancelled: contracts.filter((c) => c.status === "cancelled").length,
    total_value: contracts.reduce((s, c) => s + c.total_investment, 0),
  }

  const closeAll = () => {
    setSelected(null)
    setActionMode(null)
    setReason("")
    setEditPercents({})
  }

  const initEditPercents = () => {
    // members are loaded async; init defaults from current data
    if (members.length > 0) {
      const initial: Record<string, number> = {}
      members.forEach((m) => { initial[m.id] = m.share_percent })
      setEditPercents(initial)
    } else if (selected && mockContract.id === "ct1" && selected.id === "1") {
      const initial: Record<string, number> = {}
      mockContract.members.forEach((m) => { initial[m.user_id] = m.share_percent })
      setEditPercents(initial)
    }
  }

  // When members load, refresh the edit percents
  useEffect(() => {
    if (selected && members.length > 0) {
      initEditPercents()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, selected])

  const handleAction = async () => {
    if (!selected || !actionMode) return
    if ((actionMode === "force_end" || actionMode === "freeze" || actionMode === "resolve_internal") && !reason.trim()) {
      showError("سبب الإجراء مطلوب")
      return
    }

    setSubmitting(true)
    if (actionMode === "force_end") {
      const result = await adminForceEndContract(selected.id, reason.trim())
      if (!result.success) { showError("فشل الإنهاء"); setSubmitting(false); return }
      const fee = Math.round(selected.total_investment * (CONTRACT_END_FEE_PCT / 100))
      showSuccess(`⛔ تم إنهاء العقد قسرياً + رسوم ${fmtNum(fee)} د.ع`)
    } else if (actionMode === "freeze") {
      // Freeze = cancel for now (no separate freeze status in DB)
      const result = await adminCancelContract(selected.id, reason.trim())
      if (!result.success) { showError("فشل التجميد"); setSubmitting(false); return }
      showSuccess("⏸ تم تجميد العقد")
    } else if (actionMode === "resolve_internal") {
      const total = Object.values(editPercents).reduce((s, v) => s + (v || 0), 0)
      if (Math.abs(total - 100) > 0.01) {
        showError(`مجموع النسب يجب أن يساوي 100% (الحالي: ${total}%)`)
        setSubmitting(false)
        return
      }
      const result = await adminResolveContractInternally(selected.id, editPercents, reason.trim())
      if (!result.success) { showError("فشل التعديل"); setSubmitting(false); return }
      showSuccess("⚖️ تم تعديل توزيع الحصص")
    }
    setSubmitting(false)
    refresh()
    closeAll()
  }

  // Build distribution from real members if loaded; else fall back to mock for ct1
  const distribution = members.length > 0
    ? {
        distribution: members.map((m) => ({
          member_id: m.id,
          member_name: m.user_name,
          percentage: m.share_percent,
          shares: 0,
          value: Math.round(((selected?.total_investment ?? 0) * m.share_percent) / 100),
        })),
      }
    : selected && selected.id === "1" ? calculateContractDistribution("ct1") : null
  void submitting

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="🤝 العقود الجماعية — الإدارة"
        subtitle="إدارة العقود والشراكات وحلّ النزاعات الداخلية"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="بانتظار التفعيل" val={stats.pending} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
        <KPI label="نشطة" val={stats.active} color="#4ADE80" />
        <KPI label="منتهية" val={stats.ended} color="#a3a3a3" />
        <KPI label="القيمة الإجمالية" val={fmtNum(stats.total_value) + " د.ع"} color="#60A5FA" />
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث (id أو اسم العقد)..."
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      <InnerTabBar tabs={tabs} active={filter} onSelect={setFilter} />

      {filtered.length === 0 ? (
        <AdminEmpty title="لا توجد عقود" body="جرّب تعديل الفلترة" />
      ) : (
        <Table>
          <THead>
            <TH>اسم العقد</TH>
            <TH>المنشئ</TH>
            <TH>الأعضاء</TH>
            <TH>القيمة</TH>
            <TH>الحالة</TH>
            <TH>تاريخ الإنشاء</TH>
            <TH>إجراءات</TH>
          </THead>
          <TBody>
            {filtered.map((c) => {
              const st = STATUS_META[c.status]
              return (
                <TR key={c.id}>
                  <TD>
                    <div className="text-xs text-white font-bold">{c.title}</div>
                    <div className="text-[10px] text-neutral-500 font-mono">#{c.id}</div>
                  </TD>
                  <TD>
                    <span className="text-[11px] text-neutral-300">
                      {c.creator_id === "me" ? "أنت" : c.creator_id}
                    </span>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-blue-400 font-bold">{c.partners.length}</span>
                      <span className="text-[10px] text-neutral-500">عضو</span>
                    </div>
                  </TD>
                  <TD><span className="font-mono text-yellow-400">{fmtNum(c.total_investment)}</span></TD>
                  <TD><Badge label={st.label} color={st.color} /></TD>
                  <TD><span className="text-[11px] text-neutral-500">{c.created_at}</span></TD>
                  <TD>
                    <ActionBtn
                      label="التفاصيل"
                      color="blue"
                      sm
                      onClick={() => { setSelected(c); initEditPercents() }}
                    />
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {/* Detail Modal */}
      {selected && !actionMode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div>
                <div className="text-base font-bold text-white">{selected.title}</div>
                <div className="text-xs text-neutral-500 mt-1 font-mono">#{selected.id}</div>
              </div>
              <button onClick={closeAll} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <Badge label={STATUS_META[selected.status].label} color={STATUS_META[selected.status].color} />
              <Badge label={`${selected.partners.length} شركاء`} color="blue" />
            </div>

            {/* Section 1: Contract info */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="text-[11px] font-bold text-neutral-400 mb-3">📋 معلومات العقد</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">المنشئ</div>
                  <div className="text-white">{selected.creator_id === "me" ? "أنت" : selected.creator_id}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">تاريخ الإنشاء</div>
                  <div className="text-white">{selected.created_at}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">القيمة الإجمالية</div>
                  <div className="font-mono text-yellow-400 font-bold">{fmtNum(selected.total_investment)} د.ع</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">عدد الشركاء</div>
                  <div className="font-mono text-white">{selected.partners.length}</div>
                </div>
              </div>
            </div>

            {/* Section 2: Members */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="text-[11px] font-bold text-neutral-400 mb-3">👥 الشركاء</div>
              {distribution ? (
                <Table>
                  <THead>
                    <TH>الاسم</TH>
                    <TH>النسبة</TH>
                    <TH>الحصص</TH>
                    <TH>القيمة</TH>
                  </THead>
                  <TBody>
                    {distribution.distribution.map((d) => (
                      <TR key={d.member_id}>
                        <TD>{d.member_name}</TD>
                        <TD><span className="font-mono text-blue-400 font-bold">{d.percentage}%</span></TD>
                        <TD><span className="font-mono">{fmtNum(d.shares)}</span></TD>
                        <TD><span className="font-mono text-yellow-400">{fmtNum(d.value)} د.ع</span></TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <div className="space-y-2">
                  {selected.partners.map((p: ContractListItem["partners"][number], i: number) => (
                    <div key={i} className="flex items-center gap-2 bg-white/[0.04] rounded-lg p-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-400/[0.15] border border-blue-400/[0.3] flex items-center justify-center text-[11px] font-bold text-blue-300">
                        {p.user.name[0]}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-white">{p.user.name}</div>
                      </div>
                      {p.user.is_verified && <Badge label="✓ موثّق" color="green" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: Financial */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="text-[11px] font-bold text-neutral-400 mb-3">💰 السجلّ المالي</div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                <div className="bg-white/[0.04] rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-neutral-500 mb-1">القيمة الإجمالية</div>
                  <div className="text-base font-bold text-yellow-400 font-mono">{fmtNum(selected.total_investment)}</div>
                </div>
                {distribution && "total_shares" in distribution && (
                  <div className="bg-white/[0.04] rounded-lg p-2.5 text-center">
                    <div className="text-[10px] text-neutral-500 mb-1">إجمالي الحصص</div>
                    <div className="text-base font-bold text-blue-400 font-mono">{fmtNum(distribution.total_shares)}</div>
                  </div>
                )}
                <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-neutral-500 mb-1">رسوم الإنهاء (0.10%)</div>
                  <div className="text-base font-bold text-red-400 font-mono">
                    {fmtNum(Math.round(selected.total_investment * (CONTRACT_END_FEE_PCT / 100)))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            {selected.status === "active" ? (
              <div className="grid grid-cols-3 gap-2">
                <ActionBtn label="⛔ إنهاء قسري" color="red" onClick={() => setActionMode("force_end")} />
                <ActionBtn label="⚖️ حل نزاع داخلي" color="purple" onClick={() => setActionMode("resolve_internal")} />
                <ActionBtn label="⏸ تجميد مؤقّت" color="yellow" onClick={() => setActionMode("freeze")} />
              </div>
            ) : selected.status === "pending" ? (
              <div className="grid grid-cols-2 gap-2">
                <ActionBtn label="⛔ إلغاء قبل التفعيل" color="red" onClick={() => setActionMode("force_end")} />
                <button
                  onClick={closeAll}
                  className="px-4 py-1.5 text-xs rounded-md bg-white/[0.05] border border-white/[0.1] text-white hover:bg-white/[0.08]"
                >
                  إغلاق
                </button>
              </div>
            ) : selected.status === "ended" ? (
              <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-xl p-3 mb-4 text-xs text-green-400">
                ✅ هذا العقد منتهٍ — تم توزيع الحصص وخصم الرسوم.
              </div>
            ) : (
              <button
                onClick={closeAll}
                className="w-full py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إغلاق
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirm action modal */}
      {selected && actionMode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={cn(
            "bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-h-[90vh] overflow-y-auto",
            actionMode === "resolve_internal" ? "max-w-2xl" : "max-w-md"
          )}>
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">
                {actionMode === "force_end" && "⛔ إنهاء قسري للعقد"}
                {actionMode === "freeze" && "⏸ تجميد مؤقّت"}
                {actionMode === "resolve_internal" && "⚖️ حل نزاع داخلي"}
              </div>
              <button onClick={() => { setActionMode(null); setReason("") }} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-neutral-400 mb-3">
              العقد: <span className="text-white font-bold">{selected.title}</span>
            </div>

            {actionMode === "force_end" && (
              <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-xl p-3 mb-4 text-xs text-red-400">
                ⚠️ سيتم إنهاء العقد قسرياً + خصم رسوم <span className="font-bold font-mono">
                {fmtNum(Math.round(selected.total_investment * (CONTRACT_END_FEE_PCT / 100)))}
                </span> د.ع (0.10%) من المنشئ + توزيع الحصص. لا يمكن التراجع.
              </div>
            )}
            {actionMode === "freeze" && (
              <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-xl p-3 mb-4 text-xs text-yellow-400">
                سيتم تجميد العقد مؤقّتاً + إشعار جميع الشركاء. يمكن إعادة التفعيل لاحقاً.
              </div>
            )}
            {actionMode === "resolve_internal" && distribution && (
              <>
                <div className="bg-purple-400/[0.05] border border-purple-400/[0.2] rounded-xl p-3 mb-4 text-xs text-purple-300">
                  عدّل نسب الشركاء لحل نزاع داخلي. يجب أن يساوي المجموع 100%.
                </div>
                <div className="space-y-2 mb-4">
                  {distribution.distribution.map((d) => (
                    <div key={d.member_id} className="flex items-center gap-2 bg-white/[0.04] rounded-lg p-2.5">
                      <div className="flex-1">
                        <div className="text-xs text-white font-bold">{d.member_name}</div>
                        <div className="text-[10px] text-neutral-500">الأصلي: {d.percentage}%</div>
                      </div>
                      <input
                        type="number"
                        value={editPercents[d.member_id] ?? d.percentage}
                        onChange={(e) => setEditPercents({ ...editPercents, [d.member_id]: Number(e.target.value) })}
                        min={0}
                        max={100}
                        className="w-20 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-white font-mono text-center outline-none focus:border-purple-400/40"
                      />
                      <span className="text-[11px] text-neutral-500">%</span>
                    </div>
                  ))}
                  <div className="text-xs text-neutral-400 text-left mt-2">
                    المجموع: <span className={cn(
                      "font-mono font-bold",
                      Math.abs(Object.values(editPercents).reduce((s, v) => s + (v || 0), 0) - 100) < 0.01
                        ? "text-green-400" : "text-red-400"
                    )}>
                      {Object.values(editPercents).reduce((s, v) => s + (v || 0), 0)}%
                    </span>
                  </div>
                </div>
              </>
            )}

            <label className="text-xs text-neutral-400 mb-2 block font-bold">سبب الإجراء (إجباري)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="اكتب التوثيق الكامل للأرشفة..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => { setActionMode(null); setReason("") }}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={handleAction}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold border",
                  actionMode === "force_end" && "bg-red-500/[0.15] border-red-500/[0.3] text-red-400 hover:bg-red-500/[0.2]",
                  actionMode === "freeze" && "bg-yellow-500/[0.15] border-yellow-500/[0.3] text-yellow-400 hover:bg-yellow-500/[0.2]",
                  actionMode === "resolve_internal" && "bg-purple-500/[0.15] border-purple-500/[0.3] text-purple-400 hover:bg-purple-500/[0.2]",
                )}
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 text-[10px] text-neutral-600 font-mono">
        {fmtNum(filtered.length)} من {fmtNum(mockContracts.length)} عقد
      </div>
    </div>
  )
}
