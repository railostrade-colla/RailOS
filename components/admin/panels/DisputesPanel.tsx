"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Search, X, ZoomIn } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  MOCK_DISPUTES,
  DISPUTE_REASON_LABELS,
  DISPUTE_STATUS_LABELS,
  DISPUTE_PRIORITY_LABELS,
  type Dispute,
  type DisputeResolution,
} from "@/lib/mock-data/disputes"
import {
  getDisputesAdmin,
  resolveDisputeBuyerFavor,
  resolveDisputeSellerFavor,
  resolveDisputeSplit,
  requestDisputeEvidence,
} from "@/lib/data/disputes-admin"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type ActionMode = null | "buyer_favor" | "seller_favor" | "split" | "request_evidence"

function computeDisputeStats(list: Dispute[]) {
  let open = 0, inReview = 0, resolved = 0, closed = 0
  for (const d of list) {
    if (d.status === "open") open++
    else if (d.status === "in_review") inReview++
    else if (d.status === "resolved") resolved++
    else if (d.status === "closed") closed++
  }
  return { total: list.length, open, in_review: inReview, resolved, closed }
}

export function DisputesPanel() {
  const [filter, setFilter] = useState<string>("open")
  const [search, setSearch] = useState("")
  const [reasonFilter, setReasonFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [selected, setSelected] = useState<Dispute | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Production mode — DB only.
  const [disputes, setDisputes] = useState<Dispute[]>([])

  const refresh = useCallback(async () => {
    const rows = await getDisputesAdmin(500)
    setDisputes(rows)
  }, [])

  useEffect(() => {
    let cancelled = false
    getDisputesAdmin(500).then((rows) => {
      if (cancelled) return
      setDisputes(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => computeDisputeStats(disputes), [disputes])

  const tabs = [
    { key: "all", label: "الكل", count: stats.total },
    { key: "open", label: "مفتوحة", count: stats.open },
    { key: "in_review", label: "قيد المراجعة", count: stats.in_review },
    { key: "resolved", label: "مُحلّة", count: stats.resolved },
    { key: "closed", label: "مُغلقة", count: stats.closed },
  ]

  const filtered = disputes
    .filter((d) => filter === "all" || d.status === filter)
    .filter((d) => reasonFilter === "all" || d.reason === reasonFilter)
    .filter((d) => priorityFilter === "all" || d.priority === priorityFilter)
    .filter((d) =>
      !search ||
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.buyer_name.includes(search) ||
      d.seller_name.includes(search) ||
      d.deal_id.toLowerCase().includes(search.toLowerCase())
    )

  const closeAll = () => {
    setSelected(null)
    setActionMode(null)
    setAdminNotes("")
  }

  const handleResolve = async () => {
    if (!selected || !actionMode || submitting) return
    if (!adminNotes.trim()) {
      showError("ملاحظات الإدارة مطلوبة قبل أي قرار")
      return
    }

    setSubmitting(true)
    try {
      const result = await (
        actionMode === "buyer_favor"      ? resolveDisputeBuyerFavor(selected.id, adminNotes) :
        actionMode === "seller_favor"     ? resolveDisputeSellerFavor(selected.id, adminNotes) :
        actionMode === "split"            ? resolveDisputeSplit(selected.id, adminNotes) :
        requestDisputeEvidence(selected.id, adminNotes)
      )

      if (!result.success) {
        if (result.reason === "rls") {
          showError("لا تملك صلاحيات الحلّ")
          return
        }
        if (result.reason === "missing_table") {
          showError("الجدول غير موجود — طبّق migration النزاعات")
          return
        }
        showError(result.error || "تعذّر حلّ النزاع")
        return
      }

      const labels: Record<Exclude<ActionMode, null>, string> = {
        buyer_favor: "✅ تم تحرير الحصص للمشتري + غرامة 2% على البائع",
        seller_favor: "✅ تم إعادة الحصص للبائع + غرامة 2% على المشتري",
        split: "⚖️ تم تقسيم الحصص 50/50 بين الطرفين",
        request_evidence: "📎 تم طلب أدلّة إضافية من الطرفين — تجميد 7 أيام",
      }
      showSuccess(labels[actionMode])
      await refresh()
      closeAll()
    } finally {
      setSubmitting(false)
    }
  }

  const resolutionLabels: Record<DisputeResolution, string> = {
    buyer_favor: "تحرير الحصص للمشتري",
    seller_favor: "إعادة الحصص للبائع",
    split: "تقسيم الحصص 50/50",
    escalated: "صُعِّد للأعلى",
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="⚖️ النزاعات"
        subtitle="حلّ النزاعات بين المشترين والبائعين بإنصاف وتوثيق"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="مفتوحة" val={stats.open} color="#F87171" accent="rgba(248,113,113,0.05)" />
        <KPI label="قيد المراجعة" val={stats.in_review} color="#FBBF24" />
        <KPI label="مُحلّة" val={stats.resolved} color="#4ADE80" />
        <KPI label="مُغلقة" val={stats.closed} color="#a3a3a3" />
      </div>

      {/* Search + filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-3">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث (DSP-001 أو اسم أو deal_id)..."
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
          />
        </div>
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="all">كل الأسباب</option>
          {Object.entries(DISPUTE_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="all">كل الأولويات</option>
          <option value="high">عاجل</option>
          <option value="medium">متوسط</option>
          <option value="low">منخفض</option>
        </select>
      </div>

      <InnerTabBar tabs={tabs} active={filter} onSelect={setFilter} />

      {filtered.length === 0 ? (
        <AdminEmpty title="لا توجد نزاعات" body="جرّب تعديل الفلترة" />
      ) : (
        <Table>
          <THead>
            <TH>المعرّف</TH>
            <TH>الأطراف</TH>
            <TH>المشروع</TH>
            <TH>السبب</TH>
            <TH>الأولوية</TH>
            <TH>الحالة</TH>
            <TH>تاريخ الفتح</TH>
            <TH>إجراءات</TH>
          </THead>
          <TBody>
            {filtered.map((d) => {
              const st = DISPUTE_STATUS_LABELS[d.status]
              const pr = DISPUTE_PRIORITY_LABELS[d.priority]
              return (
                <TR key={d.id}>
                  <TD><span className="font-mono text-xs text-neutral-300">#{d.id}</span></TD>
                  <TD>
                    <div className="text-[11px]">
                      <div>{d.buyer_name} <span className="text-neutral-600">↔</span> {d.seller_name}</div>
                      <div className="text-neutral-600 mt-0.5 font-mono">{d.deal_id}</div>
                    </div>
                  </TD>
                  <TD>{d.project_name}</TD>
                  <TD>{DISPUTE_REASON_LABELS[d.reason]}</TD>
                  <TD><Badge label={pr.label} color={pr.color} /></TD>
                  <TD><Badge label={st.label} color={st.color} /></TD>
                  <TD><span className="text-neutral-500 text-[11px]">{d.opened_at}</span></TD>
                  <TD>
                    <ActionBtn
                      label={d.status === "open" || d.status === "in_review" ? "مراجعة" : "عرض"}
                      color={d.status === "open" || d.status === "in_review" ? "blue" : "gray"}
                      sm
                      onClick={() => setSelected(d)}
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
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div>
                <div className="text-base font-bold text-white">مراجعة النزاع</div>
                <div className="text-xs text-neutral-500 mt-1 font-mono">#{selected.id}</div>
              </div>
              <button onClick={closeAll} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1: Deal info + Escrow status */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="text-[11px] font-bold text-neutral-400">📋 معلومات الصفقة + Escrow</div>
                <span className="bg-yellow-400/[0.12] border border-yellow-400/30 text-yellow-400 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                  🔒 الحصص مُعلَّقة
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">رقم الصفقة</div>
                  <div className="font-mono text-white">{selected.deal_id}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">المشروع</div>
                  <div className="text-white">{selected.project_name}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">🔒 الحصص المُعلَّقة</div>
                  <div className="font-mono text-yellow-400 font-bold">{fmtNum(selected.shares)} حصة</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">المبلغ المُتفق عليه</div>
                  <div className="font-mono text-white font-bold">{fmtNum(selected.amount)} د.ع</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] text-neutral-500 mb-1">المشتري</div>
                  <div className="text-white">{selected.buyer_name}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] text-neutral-500 mb-1">البائع</div>
                  <div className="text-white">{selected.seller_name}</div>
                </div>
              </div>
            </div>

            {/* Section 2: Dispute details */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="text-[11px] font-bold text-neutral-400">⚠️ تفاصيل النزاع</div>
                <Badge label={DISPUTE_REASON_LABELS[selected.reason]} color="orange" />
                <Badge label={DISPUTE_PRIORITY_LABELS[selected.priority].label} color={DISPUTE_PRIORITY_LABELS[selected.priority].color} />
              </div>
              <div className="text-xs text-neutral-300 leading-relaxed mb-3">
                {selected.description}
              </div>

              {selected.evidence_urls.length > 0 && (
                <>
                  <div className="text-[11px] font-bold text-neutral-400 mb-2">الأدلّة المرفقة ({selected.evidence_urls.length})</div>
                  <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
                    {selected.evidence_urls.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setZoomImage(url)}
                        className="aspect-square bg-black border border-white/[0.06] rounded-lg overflow-hidden relative group"
                      >
                        <img src={url} alt={`evidence ${i}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100">
                          <ZoomIn className="w-5 h-5 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Section 3: Messages */}
            {selected.messages.length > 0 && (
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
                <div className="text-[11px] font-bold text-neutral-400 mb-3">💬 سجل المحادثات</div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selected.messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "p-2.5 rounded-lg text-xs border",
                        m.sender === "buyer" && "bg-blue-400/[0.06] border-blue-400/[0.15]",
                        m.sender === "seller" && "bg-purple-400/[0.06] border-purple-400/[0.15]",
                        m.sender === "system" && "bg-yellow-400/[0.06] border-yellow-400/[0.15]"
                      )}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={cn(
                          "font-bold text-[11px]",
                          m.sender === "buyer" && "text-blue-400",
                          m.sender === "seller" && "text-purple-400",
                          m.sender === "system" && "text-yellow-400"
                        )}>
                          {m.sender_name} · {m.sender === "buyer" ? "مشترٍ" : m.sender === "seller" ? "بائع" : "نظام"}
                        </span>
                        <span className="text-[10px] text-neutral-500">{m.created_at}</span>
                      </div>
                      <div className="text-neutral-200">{m.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution badge if already resolved */}
            {selected.resolution && (
              <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-xl p-4 mb-4">
                <div className="text-[11px] font-bold text-green-400 mb-2">✅ تم الحسم — {resolutionLabels[selected.resolution]}</div>
                {selected.resolution_notes && (
                  <div className="text-xs text-neutral-300">{selected.resolution_notes}</div>
                )}
                <div className="text-[10px] text-neutral-500 mt-2">في {selected.resolved_at}</div>
              </div>
            )}

            {/* Footer actions */}
            {(selected.status === "open" || selected.status === "in_review") ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <ActionBtn label="✅ تحرير للمشتري" color="green" onClick={() => setActionMode("buyer_favor")} />
                <ActionBtn label="↩️ إعادة للبائع" color="blue" onClick={() => setActionMode("seller_favor")} />
                <ActionBtn label="⚖️ تقسيم 50/50" color="yellow" onClick={() => setActionMode("split")} />
                <ActionBtn label="🧊 تجميد 7 أيام" color="gray" onClick={() => setActionMode("request_evidence")} />
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
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">
                {actionMode === "buyer_favor" && "✅ تحرير الحصص للمشتري"}
                {actionMode === "seller_favor" && "↩️ إعادة الحصص للبائع"}
                {actionMode === "split" && "⚖️ تقسيم الحصص 50/50"}
                {actionMode === "request_evidence" && "🧊 تجميد الصفقة للتحقيق"}
              </div>
              <button onClick={() => { setActionMode(null); setAdminNotes("") }} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={cn(
              "rounded-xl p-3 mb-4 text-xs border",
              actionMode === "buyer_favor" && "bg-green-400/[0.05] border-green-400/[0.2] text-green-400",
              actionMode === "seller_favor" && "bg-blue-400/[0.05] border-blue-400/[0.2] text-blue-400",
              actionMode === "split" && "bg-yellow-400/[0.05] border-yellow-400/[0.2] text-yellow-400",
              actionMode === "request_evidence" && "bg-gray-400/[0.05] border-gray-400/[0.2] text-gray-400",
            )}>
              {actionMode === "buyer_favor" && `سيتم تحرير ${fmtNum(selected.shares)} حصة من الـ Escrow ونقلها لمحفظة المشتري ${selected.buyer_name}. تُطبَّق غرامة 2% على البائع (في وحدات الرسوم).`}
              {actionMode === "seller_favor" && `سيتم فك تعليق ${fmtNum(selected.shares)} حصة وإعادتها للبائع ${selected.seller_name}. تُطبَّق غرامة 2% على المشتري (في وحدات الرسوم).`}
              {actionMode === "split" && `سيحصل كل طرف على ${fmtNum(Math.floor(selected.shares / 2))} حصة. الباقي يُعاد للبائع.`}
              {actionMode === "request_evidence" && `سيُجمَّد النزاع لـ 7 أيام. الحصص (${fmtNum(selected.shares)}) تبقى مُعلَّقة لحين رفع أدلّة من الطرفين.`}
            </div>

            <label className="text-xs text-neutral-400 mb-2 block font-bold">
              ملاحظات الإدارة (إجبارية)
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={4}
              placeholder="اكتب توثيق القرار + الأسباب..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => { setActionMode(null); setAdminNotes("") }}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleResolve}
                disabled={submitting}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold border disabled:opacity-50",
                  actionMode === "buyer_favor" && "bg-green-500/[0.15] border-green-500/[0.3] text-green-400 hover:bg-green-500/[0.2]",
                  actionMode === "seller_favor" && "bg-blue-500/[0.15] border-blue-500/[0.3] text-blue-400 hover:bg-blue-500/[0.2]",
                  actionMode === "split" && "bg-yellow-500/[0.15] border-yellow-500/[0.3] text-yellow-400 hover:bg-yellow-500/[0.2]",
                  actionMode === "request_evidence" && "bg-white/[0.08] border-white/[0.15] text-white hover:bg-white/[0.12]",
                )}
              >
                {submitting ? "جاري التنفيذ..." : "تأكيد القرار"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom image modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomImage(null)}
        >
          <button
            onClick={() => setZoomImage(null)}
            className="absolute top-4 left-4 text-white/80 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img src={zoomImage} alt="zoom" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      <div className="mt-6 text-[10px] text-neutral-600 font-mono">
        {fmtNum(filtered.length)} من {fmtNum(MOCK_DISPUTES.length)} نزاع
      </div>
    </div>
  )
}
