"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, X, ZoomIn, AlertCircle } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  PAYMENT_METHOD_LABELS,
  PROOF_STATUS_LABELS,
  MATCH_STATUS_META,
  type PaymentProof,
} from "@/lib/mock-data/payments"
import { getPaymentProofsAdmin } from "@/lib/data/payment-proofs-admin"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

// ─── Read-only by design ──────────────────────────────────────────
// The deal flow `payment_submitted → completed` is the SELLER's call
// once they verify the off-platform transfer. Admin overrides happen
// through the disputes system, not here. The panel surfaces the
// proof queue + amount comparison so admins can spot mismatches and
// open a dispute when warranted.

const DAY_MS = 86_400_000

function computeStats(list: PaymentProof[]) {
  const now = Date.now()
  let pending = 0
  let confirmedToday = 0
  let disputed = 0
  for (const p of list) {
    if (p.status === "pending") pending++
    if (p.status === "confirmed") {
      const t = new Date(p.submitted_at).getTime()
      if (Number.isFinite(t) && now - t < DAY_MS) confirmedToday++
    }
    if (p.match_status === "mismatch") disputed++
  }
  return { total: list.length, pending, confirmed_today: confirmedToday, disputed }
}

export function PaymentProofsPanel() {
  const router = useRouter()
  const [filter, setFilter] = useState<string>("pending")
  const [search, setSearch] = useState("")
  const [minAmount, setMinAmount] = useState<string>("")
  const [maxAmount, setMaxAmount] = useState<string>("")
  const [selected, setSelected] = useState<PaymentProof | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)

  // Production mode — DB only.
  const [proofs, setProofs] = useState<PaymentProof[]>([])

  useEffect(() => {
    let cancelled = false
    getPaymentProofsAdmin(500).then((rows) => {
      if (cancelled) return
      setProofs(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => computeStats(proofs), [proofs])

  const tabs = [
    { key: "all", label: "الكل", count: stats.total },
    { key: "pending", label: "معلّق", count: proofs.filter((p) => p.status === "pending").length },
    { key: "confirmed", label: "مؤكّد", count: proofs.filter((p) => p.status === "confirmed").length },
    { key: "rejected", label: "مرفوض", count: proofs.filter((p) => p.status === "rejected").length },
  ]

  const filtered = proofs
    .filter((p) => filter === "all" || p.status === filter)
    .filter((p) => !minAmount || p.amount_paid >= Number(minAmount))
    .filter((p) => !maxAmount || p.amount_paid <= Number(maxAmount))
    .filter((p) =>
      !search ||
      p.deal_id.toLowerCase().includes(search.toLowerCase()) ||
      p.user_name.includes(search) ||
      p.reference_number.toLowerCase().includes(search.toLowerCase())
    )

  const closeAll = () => {
    setSelected(null)
  }

  // Open the deal in /admin?tab=disputes (or directly to the deal
  // page so the admin can see context). Disputes panel handles the
  // actual override flow.
  const openDispute = (dealId: string) => {
    router.push(`/deals/${dealId}`)
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="🧾 إثباتات الدفع"
        subtitle="مراجعة إيصالات الدفع المرفقة من المشترين والتحقق من المطابقة"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <KPI label="معلّقة" val={stats.pending} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
        <KPI label="مؤكّدة اليوم" val={stats.confirmed_today} color="#4ADE80" />
        <KPI label="عدم تطابق" val={stats.disputed} color="#F87171" />
      </div>

      {/* Search + amount filter */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-3">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث (deal/user/ref)..."
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
          />
        </div>
        <input
          type="number"
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
          placeholder="الحد الأدنى للمبلغ"
          className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
        <input
          type="number"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          placeholder="الحد الأعلى للمبلغ"
          className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      <InnerTabBar tabs={tabs} active={filter} onSelect={setFilter} />

      {filtered.length === 0 ? (
        <AdminEmpty title="لا توجد إثباتات" body="جرّب تعديل الفلترة" />
      ) : (
        <Table>
          <THead>
            <TH>Deal ID</TH>
            <TH>المستخدم</TH>
            <TH>المشروع</TH>
            <TH>المطلوب</TH>
            <TH>المرفق</TH>
            <TH>تطابق</TH>
            <TH>طريقة الدفع</TH>
            <TH>الحالة</TH>
            <TH>إجراءات</TH>
          </THead>
          <TBody>
            {filtered.map((p) => {
              const ms = MATCH_STATUS_META[p.match_status]
              const st = PROOF_STATUS_LABELS[p.status]
              const pm = PAYMENT_METHOD_LABELS[p.payment_method]
              return (
                <TR key={p.id}>
                  <TD><span className="font-mono text-xs text-neutral-300">{p.deal_id}</span></TD>
                  <TD>{p.user_name}</TD>
                  <TD>{p.project_name}</TD>
                  <TD><span className="font-mono">{fmtNum(p.amount_required)}</span></TD>
                  <TD>
                    <span className={cn(
                      "font-mono font-bold",
                      p.amount_paid === p.amount_required ? "text-green-400" :
                      p.amount_paid < p.amount_required ? "text-red-400" : "text-yellow-400"
                    )}>
                      {fmtNum(p.amount_paid)}
                    </span>
                  </TD>
                  <TD><Badge label={ms.label} color={ms.color} /></TD>
                  <TD>
                    <span className="text-[11px] flex items-center gap-1">
                      <span>{pm.icon}</span>
                      <span>{pm.label}</span>
                    </span>
                  </TD>
                  <TD><Badge label={st.label} color={st.color} /></TD>
                  <TD>
                    <ActionBtn
                      label={p.status === "pending" ? "مراجعة" : "عرض"}
                      color={p.status === "pending" ? "blue" : "gray"}
                      sm
                      onClick={() => setSelected(p)}
                    />
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {/* Review Modal — read-only by design (see header comment) */}
      {selected && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div>
                <div className="text-base font-bold text-white">مراجعة إثبات الدفع</div>
                <div className="text-xs text-neutral-500 mt-1 font-mono">#{selected.id}</div>
              </div>
              <button onClick={closeAll} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image */}
            <button
              onClick={() => setZoomImage(selected.proof_image_url)}
              className="block w-full bg-black border border-white/[0.06] rounded-xl overflow-hidden relative group mb-4"
            >
              <img src={selected.proof_image_url} alt="proof" className="w-full h-auto max-h-96 object-contain mx-auto" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100">
                <ZoomIn className="w-6 h-6 text-white" />
              </div>
            </button>

            {/* Comparison card */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="text-[11px] font-bold text-neutral-400 mb-3">📊 مقارنة المبلغ</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/[0.04] rounded-lg p-3">
                  <div className="text-[10px] text-neutral-500 mb-1">المطلوب</div>
                  <div className="text-base font-bold text-white font-mono">{fmtNum(selected.amount_required)}</div>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-3">
                  <div className="text-[10px] text-neutral-500 mb-1">المُرفق</div>
                  <div className={cn(
                    "text-base font-bold font-mono",
                    selected.amount_paid === selected.amount_required ? "text-green-400" :
                    selected.amount_paid < selected.amount_required ? "text-red-400" : "text-yellow-400"
                  )}>
                    {fmtNum(selected.amount_paid)}
                  </div>
                </div>
                <div className={cn(
                  "rounded-lg p-3",
                  selected.amount_paid - selected.amount_required === 0 ? "bg-green-400/[0.05]" :
                  selected.amount_paid - selected.amount_required < 0 ? "bg-red-400/[0.05]" : "bg-yellow-400/[0.05]"
                )}>
                  <div className="text-[10px] text-neutral-500 mb-1">الفرق</div>
                  <div className={cn(
                    "text-base font-bold font-mono",
                    selected.amount_paid - selected.amount_required === 0 ? "text-green-400" :
                    selected.amount_paid - selected.amount_required < 0 ? "text-red-400" : "text-yellow-400"
                  )}>
                    {selected.amount_paid - selected.amount_required >= 0 ? "+" : ""}
                    {fmtNum(selected.amount_paid - selected.amount_required)}
                  </div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4 space-y-2">
              {[
                ["Deal ID", selected.deal_id],
                ["المستخدم", selected.user_name],
                ["المشروع", selected.project_name],
                ["طريقة الدفع", PAYMENT_METHOD_LABELS[selected.payment_method].icon + " " + PAYMENT_METHOD_LABELS[selected.payment_method].label],
                ["رقم المرجع", selected.reference_number],
                ["تاريخ التقديم", selected.submitted_at],
              ].map(([l, v], i) => (
                <div key={i} className="flex justify-between gap-3">
                  <span className="text-[11px] text-neutral-500">{l}</span>
                  <span className="text-xs font-bold text-white text-left font-mono">{v}</span>
                </div>
              ))}
              {selected.rejection_reason && (
                <div className="pt-2 border-t border-white/[0.05]">
                  <div className="text-[11px] text-red-400 font-bold mb-1">سبب الرفض:</div>
                  <div className="text-xs text-neutral-300">{selected.rejection_reason}</div>
                </div>
              )}
            </div>

            {/* Read-only footer — the panel surfaces evidence; the
                seller closes the deal, and admins override via
                disputes (not here). The buttons below open the deal
                page, where the dispute flow is one click away. */}
            <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-400/[0.06] border border-blue-400/20 rounded-lg mb-3">
              <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-300 leading-relaxed">
                هذه الصفحة <strong>للمراجعة فقط</strong>. التأكيد على البائع، والتدخّل الإداري يتمّ عبر <strong>النزاعات</strong> من صفحة الصفقة.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={closeAll}
                className="py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إغلاق
              </button>
              <button
                onClick={() => openDispute(selected.deal_id)}
                className="py-3 rounded-xl bg-blue-500/[0.15] border border-blue-500/[0.3] text-blue-400 text-sm font-bold hover:bg-blue-500/[0.2]"
              >
                فتح صفحة الصفقة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom modal */}
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
        {fmtNum(filtered.length)} من {fmtNum(proofs.length)} إثبات
      </div>
    </div>
  )
}
