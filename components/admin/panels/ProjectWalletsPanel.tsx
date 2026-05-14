"use client"

import { useState, useEffect } from "react"
import { Search, X, Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, TrendingUp } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  WALLET_STATUS_LABELS,
  WALLET_TX_REASON_LABELS,
  getWalletTransactions,
  type ProjectWallet,
} from "@/lib/mock-data/projectWallets"
import {
  adminFreezeProject,
  adminUnfreezeProject,
  adminReleaseSharesToMarket,
  adminAddSharesToOffering,
  adminSuspendTrading,
  adminResumeTrading,
  adminSuspendOffering,
  adminResumeOffering,
  getAllProjectWalletsAdmin,
  adminMoveShares,
  type ShareBucket,
} from "@/lib/data/admin-utilities"
import { createClient } from "@/lib/supabase/client"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

// Note: "transfer" (cash) was removed — the platform doesn't move money,
// only shares + fee-units. "release" moves shares from reserve → offering;
// "add_shares" (Phase 10.85) takes shares from the company-held pool
// (projects.total_shares) and injects them into the offering wallet.
// Phase 10.93: "suspend_trading" / "resume_trading" block all buy+sell;
//              "suspend_offering" / "resume_offering" block new direct buys only.
type WalletAction = null | "freeze" | "unfreeze" | "release" | "add_shares"
  | "suspend_trading" | "resume_trading"
  | "suspend_offering" | "resume_offering"
  // Phase 13.41 — generic 4-way movement modes. The source button
  // determines the source bucket; the destination radios let admin
  // pick where to send the shares.
  | "move_from_reserve"
  | "move_to_reserve"

// Phase 13.41 — Arabic labels for bucket names used in confirm
// banners and success toasts.
const BUCKET_LABEL: Record<ShareBucket, string> = {
  owner:      "👤 المالك (المحفظة الرئيسية)",
  offering:   "💎 الطرح",
  reserve:    "🏦 الاحتياطي",
  ambassador: "🌟 السفراء",
}

export function ProjectWalletsPanel() {
  const [filter, setFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<ProjectWallet | null>(null)
  const [action, setAction] = useState<WalletAction>(null)
  const [reason, setReason] = useState("")
  const [releaseAmount, setReleaseAmount] = useState("")
  // Phase 13.41 — for the new move modals: which bucket the
  // destination (or source) radio is set to.
  const [moveCounterpart, setMoveCounterpart] = useState<ShareBucket>("offering")

  // Production mode — real DB. Loaded async on mount; refresh after
  // each freeze/unfreeze/release.
  const [wallets, setWallets] = useState<ProjectWallet[]>([])
  const [loadState, setLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle")
  const [loadError, setLoadError] = useState<string>("")

  // Phase 13.11 — sum of shares added via admin_add_shares_to_offering
  // for the currently-selected project, computed from audit_log.
  const [sharesAddedAfter, setSharesAddedAfter] = useState<number>(0)

  const reload = () => {
    setLoadState("loading")
    setLoadError("")
    getAllProjectWalletsAdmin(500)
      .then((rows) => {
        setWallets(rows as unknown as ProjectWallet[])
        setLoadState("loaded")
      })
      .catch((err) => {
        setLoadState("error")
        setLoadError(err instanceof Error ? err.message : String(err))
      })
  }

  useEffect(() => {
    reload()
  }, [])

  // Phase 13.11 — when a project is selected, sum every
  // add_shares_to_offering audit_log entry for that project so we can
  // surface "الحصص المُضافة بعد الإعلان" in the modal. This gives an
  // exact running total of post-launch additions independent of any
  // offering_total recalculation.
  useEffect(() => {
    if (!selected) {
      setSharesAddedAfter(0)
      return
    }
    // ProjectWallet.id and adminRow.project_id are the same value
    // (matched at line ~434 in the modal lookup).
    const projectId = (selected as unknown as { project_id?: string }).project_id ?? selected.id
    let cancelled = false
    void (async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("audit_log")
          .select("metadata")
          .eq("action", "add_shares_to_offering")
          .eq("entity_type", "project")
          .eq("entity_id", projectId)
        if (cancelled || error || !data) return
        const total = (data as Array<{ metadata: { amount?: number | string } | null }>)
          .reduce((sum, row) => {
            const amt = Number(row.metadata?.amount ?? 0)
            return sum + (Number.isFinite(amt) ? amt : 0)
          }, 0)
        setSharesAddedAfter(total)
      } catch {
        if (!cancelled) setSharesAddedAfter(0)
      }
    })()
    return () => { cancelled = true }
  }, [selected])

  // Cast to admin-shape so we can read the new Phase 10.57 fields.
  // The cast is safe because every entry in `wallets` came from
  // getAllProjectWalletsAdmin which produces ProjectWalletAdminRow.
  const adminRows = wallets as unknown as Array<{
    project_id: string
    project_name: string
    market_price: number
    /** Immutable total shares of the project (owner + all wallets) */
    total_shares: number
    offering_total: number
    offering_available: number
    ambassador_total: number
    ambassador_available: number
    reserve_total: number
    reserve_available: number
    sold_shares: number
    investors_count: number
    total_market_value: number
    sold_value: number
    unsold_offering_value: number
    status: "active" | "frozen" | "closed"
    balance: number
    total_inflow: number
    total_outflow: number
    /** Phase 10.93 — trading & offering suspension */
    trading_suspended: boolean
    trading_suspension_reason: string | null
    offering_suspended: boolean
    offering_suspension_reason: string | null
  }>

  const stats = {
    total: wallets.length,
    active: wallets.filter((w) => w.status === "active").length,
    frozen: wallets.filter((w) => w.status === "frozen").length,
    // Phase 10.57: total shares = SUM(total_shares) across projects
    total_shares: adminRows.reduce((s, r) => s + (r.total_shares ?? 0), 0),
    // Phase 10.57: total balance = SUM(total_shares × market_price)
    total_balance: adminRows.reduce((s, r) => s + (r.total_market_value ?? 0), 0),
    total_inflow: wallets.reduce((s, w) => s + w.total_inflow, 0),
    total_outflow: wallets.reduce((s, w) => s + w.total_outflow, 0),
  }

  const filtered = wallets
    .filter((w) => filter === "all" || w.status === filter)
    .filter((w) => !search || w.project_name.includes(search))

  const handleAction = async () => {
    if (!selected || !action) return
    if (action === "freeze" && !reason.trim()) return showError("سبب التجميد مطلوب")

    if (action === "add_shares") {
      const amt = Math.floor(Number(releaseAmount))
      if (!amt || amt <= 0) return showError("الكمية غير صحيحة")
      const isUuid = /^[0-9a-f-]{36}$/i.test(selected.id)
      if (!isUuid) {
        return showError("المحفظة الحالية للعرض فقط — اختر محفظة من DB")
      }
      const projectId =
        (selected as ProjectWallet & { project_id?: string }).project_id ?? selected.id

      // Client-side validation against 90% cap
      const adminRow = adminRows.find((r) => r.project_id === selected.id)
      if (adminRow) {
        const totalProject = adminRow.total_shares
        const ownerShares = Math.max(
          0,
          totalProject - (adminRow.offering_total + adminRow.ambassador_total + adminRow.reserve_total)
        )
        const maxCap90 = Math.max(0, Math.floor(0.9 * totalProject) - adminRow.offering_total)
        const maxAddable = Math.min(ownerShares, maxCap90)
        if (amt > ownerShares) {
          return showError(`حصص المالك المتاحة: ${fmtNum(ownerShares)} حصة فقط`)
        }
        if (amt > maxCap90) {
          return showError(
            `الطرح للجمهور لا يتجاوز 90٪ من إجمالي المشروع · يمكن إضافة ${fmtNum(maxAddable)} حصة كحد أقصى`
          )
        }
      }

      const result = await adminAddSharesToOffering(projectId, amt, reason.trim() || undefined)
      if (!result.success) {
        const map: Record<string, string> = {
          unauthenticated: "يجب تسجيل الدخول أولاً",
          super_admin_only: "هذا الإجراء يتطلّب صلاحية Super Admin فقط",
          not_admin: "صلاحياتك لا تسمح بهذا الإجراء",
          invalid_amount: "الكمية غير صحيحة",
          project_not_found: "المشروع غير موجود",
          insufficient_owner_shares: `حصص المالك المتاحة: ${result.available ?? "؟"} حصة فقط`,
          insufficient_company_shares: `حصص المالك المتاحة: ${result.available ?? "؟"} حصة فقط`,
          offering_cap_exceeded: `الطرح لا يتجاوز 90٪ · الحد المتاح: ${result.available ?? "؟"} حصة`,
          offering_wallet_missing: "محفظة العرض غير موجودة",
          offering_wallet_frozen: "محفظة العرض مُجمَّدة — افكّ التجميد أوّلاً",
          missing_table: "الـ RPC غير منشور — طبّق Migration 10.92",
          rls: "ليس لديك صلاحية لهذا الإجراء",
        }
        // eslint-disable-next-line no-console
        console.warn("[add_shares] failure:", result)
        showError(
          map[result.reason ?? ""] ??
            `فشل إضافة الحصص${result.reason ? ` (${result.reason})` : ""}`,
        )
        return
      }
      // Special case: owner's shares are now 0 — ownership should transfer
      if (result.ownership_transfer_needed) {
        showSuccess(
          `➕ تم طرح ${fmtNum(amt)} حصة للعرض · ⚠️ حصص المالك وصلت صفر — يجب تحويل ملكية المشروع يدوياً إلى المستثمر الأكبر`
        )
      } else {
        showSuccess(
          `➕ تم طرح ${fmtNum(amt)} حصة جديدة · حصص المالك المتبقية: ${fmtNum(result.owner_shares_after ?? 0)}`
        )
      }
    }

    // Phase 13.41 — generic 4-way move (unified handler).
    if (action === "move_from_reserve" || action === "move_to_reserve") {
      const amt = Math.floor(Number(releaseAmount))
      if (!amt || amt <= 0) return showError("الكمية غير صحيحة")
      const projectId =
        (selected as ProjectWallet & { project_id?: string }).project_id ?? selected.id

      const from: ShareBucket =
        action === "move_from_reserve" ? "reserve" : moveCounterpart
      const to: ShareBucket =
        action === "move_from_reserve" ? moveCounterpart : "reserve"

      const result = await adminMoveShares(projectId, from, to, amt, reason.trim() || undefined)
      if (!result.success) {
        const reasonMap: Record<string, string> = {
          unauthenticated: "يجب تسجيل الدخول",
          not_admin: "صلاحياتك لا تسمح",
          invalid_amount: "الكمية غير صحيحة",
          same_source_and_destination: "اختر وجهة مختلفة عن المصدر",
          invalid_bucket: "اختيار غير صالح",
          project_not_found: "المشروع غير موجود",
          source_wallet_missing: "المحفظة المصدر غير موجودة",
          insufficient_owner_shares: `متاح من حصص المالك: ${fmtNum(result.available ?? 0)}`,
          insufficient_source_shares: `متاح في المصدر: ${fmtNum(result.available ?? 0)}`,
          missing_rpc: result.error ?? "RPC غير موجود",
        }
        return showError(reasonMap[result.reason ?? ""] ?? result.error ?? "فشل النقل")
      }

      const fromLabel = BUCKET_LABEL[from]
      const toLabel = BUCKET_LABEL[to]
      showSuccess(`📤 تم نقل ${fmtNum(amt)} حصة من ${fromLabel} إلى ${toLabel}`)
    }

    // ── Phase 10.93: Trading suspension ──────────────────────────
    if (action === "suspend_trading" || action === "resume_trading" ||
        action === "suspend_offering" || action === "resume_offering") {
      const projectId =
        (selected as ProjectWallet & { project_id?: string }).project_id ?? selected.id
      let result: { success: boolean; reason?: string }
      let successMessage = ""
      if (action === "suspend_trading") {
        result = await adminSuspendTrading(projectId, reason.trim() || undefined)
        successMessage = `⏸️ تم تعليق التداول لـ ${selected.project_name}`
      } else if (action === "resume_trading") {
        result = await adminResumeTrading(projectId)
        successMessage = `▶️ تم استئناف التداول لـ ${selected.project_name}`
      } else if (action === "suspend_offering") {
        result = await adminSuspendOffering(projectId, reason.trim() || undefined)
        successMessage = `🔒 تم تعليق الشراء المباشر لـ ${selected.project_name}`
      } else {
        result = await adminResumeOffering(projectId)
        successMessage = `🔓 تم استئناف الشراء المباشر لـ ${selected.project_name}`
      }
      if (!result.success) {
        const errMap: Record<string, string> = {
          unauthenticated: "يجب تسجيل الدخول أولاً",
          super_admin_only: "هذا الإجراء يتطلّب صلاحية Super Admin",
          project_not_found: "المشروع غير موجود",
          missing_table: "طبّق Migration 10.93 أولاً",
        }
        showError(errMap[result.reason ?? ""] ?? `فشل العملية (${result.reason ?? "unknown"})`)
        return
      }
      showSuccess(successMessage)
    }

    if (action === "freeze") {
      // Phase 10.54 — operate on the project as a unit (freezes ALL
      // 3 wallets at once). The user sees one row per project; the
      // 3-wallet split is internal.
      const projectId =
        (selected as ProjectWallet & { project_id?: string }).project_id ?? selected.id
      const result = await adminFreezeProject(projectId, reason.trim() || undefined)
      if (!result.success) {
        const map: Record<string, string> = {
          unauthenticated: "سجّل دخولك أولاً",
          not_admin: "صلاحياتك لا تسمح",
          wallets_table_missing: "جدول المحافظ غير منشور",
          missing_table: "الجداول غير منشورة بعد",
        }
        showError(map[result.reason ?? ""] ?? "فشل التجميد")
        return
      }
      showSuccess(`❄️ تم تجميد محافظ ${selected.project_name} (${fmtNum(result.wallets_frozen ?? 0)} محفظة)`)
    }
    if (action === "unfreeze") {
      const projectId =
        (selected as ProjectWallet & { project_id?: string }).project_id ?? selected.id
      const result = await adminUnfreezeProject(projectId)
      if (!result.success) {
        showError("فشل فكّ التجميد")
        return
      }
      showSuccess(`✅ تم فكّ تجميد محافظ ${selected.project_name} (${fmtNum(result.wallets_unfrozen ?? 0)} محفظة)`)
    }
    setAction(null)
    setSelected(null)
    setReason("")
    setReleaseAmount("")
    reload()  // refresh DB-backed table after every successful action
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="🏦 محافظ المشاريع"
        subtitle="إدارة المحافظ التلقائية لكل مشروع — رصيد + إيرادات + مصروفات"
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <KPI label="إجمالي المحافظ" val={stats.total}                                  color="#fff" />
        <KPI label="نشطة"            val={stats.active}                                 color="#4ADE80" />
        <KPI label="مُجمَّدة"        val={stats.frozen}                                 color="#FBBF24" />
        <KPI label="إجمالي الحصص"    val={fmtNum(stats.total_shares)}                  color="#C084FC" />
        <KPI label="إجمالي الأرصدة"  val={fmtNum(stats.total_balance) + " د.ع"}        color="#60A5FA" />
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث عن مشروع..."
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      <InnerTabBar
        tabs={[
          { key: "all",    label: "الكل",      count: stats.total  },
          { key: "active", label: "نشطة",      count: stats.active },
          { key: "frozen", label: "مُجمَّدة",  count: stats.frozen },
        ]}
        active={filter}
        onSelect={setFilter}
      />

      {filtered.length === 0 ? (
        loadState === "loading" ? (
          <AdminEmpty title="جاري التحميل..." body="نقرأ المحافظ من قاعدة البيانات" />
        ) : loadState === "error" ? (
          <AdminEmpty title="خطأ أثناء التحميل" body={loadError || "غير معروف"} />
        ) : (
          <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.25] rounded-2xl p-5 mb-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div className="flex-1">
                <div className="text-sm font-bold text-yellow-400 mb-2">
                  لا توجد محافظ ظاهرة (الواجهة لم تستلم بيانات)
                </div>
                <div className="text-xs text-neutral-300 leading-relaxed mb-3">
                  تأكّد من الخطوات الثلاث:
                </div>
                <ol className="text-xs text-neutral-300 leading-relaxed space-y-2 list-decimal pr-5">
                  <li>
                    <span className="font-bold text-white">طبّق Migration 10.55</span>
                    {" "}في Supabase SQL Editor (يُضيف RLS + RPC).
                  </li>
                  <li>
                    تحقّق من أنّ صلاحيتك في DB =
                    <code className="font-mono bg-black/30 px-1.5 mx-1 rounded">super_admin</code>
                    عبر شريط التشخيص في أعلى الصفحة.
                  </li>
                  <li>
                    افتح <span className="font-mono bg-black/30 px-1 rounded">F12</span> → Console،
                    وستجد رسالة <code className="font-mono bg-black/30 px-1 rounded">[wallets] RPC ...</code>
                    تكشف السبب الدقيق.
                  </li>
                </ol>
                <button
                  onClick={reload}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-blue-500/[0.15] border border-blue-500/[0.3] text-blue-400 text-xs font-bold hover:bg-blue-500/[0.2]"
                >
                  🔄 إعادة المحاولة
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        <Table>
          <THead>
            <TH>المشروع</TH>
            <TH>الرصيد</TH>
            <TH>الإيرادات</TH>
            <TH>المصروفات</TH>
            <TH>الحالة</TH>
            <TH>الإنشاء</TH>
            <TH>إجراءات</TH>
          </THead>
          <TBody>
            {filtered.map((w) => {
              const st = WALLET_STATUS_LABELS[w.status]
              return (
                <TR key={w.id}>
                  <TD>
                    <div className="flex items-center gap-2">
                      <WalletIcon className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
                      <span className="text-xs text-white font-bold">{w.project_name}</span>
                    </div>
                  </TD>
                  <TD><span className="font-mono text-blue-400 font-bold">{fmtNum(w.balance)}</span></TD>
                  <TD><span className="font-mono text-green-400">+{fmtNum(w.total_inflow)}</span></TD>
                  <TD><span className="font-mono text-red-400">-{fmtNum(w.total_outflow)}</span></TD>
                  <TD><Badge label={st.label} color={st.color} /></TD>
                  <TD><span className="text-[11px] text-neutral-500">{w.created_at}</span></TD>
                  <TD>
                    <ActionBtn label="إدارة" color="blue" sm onClick={() => setSelected(w)} />
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {/* Detail modal */}
      {selected && !action && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div>
                <div className="text-base font-bold text-white">محفظة {selected.project_name}</div>
                <div className="text-xs text-neutral-500 mt-1 font-mono">#{selected.id}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Phase 10.57: shares-level KPIs (5 boxes) */}
            {(() => {
              const adminRow = adminRows.find((r) => r.project_id === selected.id)
              if (!adminRow) {
                return (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-neutral-500 mb-1">الرصيد</div>
                      <div className="text-base font-bold text-blue-400 font-mono">{fmtNum(selected.balance)}</div>
                    </div>
                    <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-neutral-500 mb-1">إيرادات</div>
                      <div className="text-base font-bold text-green-400 font-mono">+{fmtNum(selected.total_inflow)}</div>
                    </div>
                    <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-neutral-500 mb-1">مصروفات</div>
                      <div className="text-base font-bold text-red-400 font-mono">-{fmtNum(selected.total_outflow)}</div>
                    </div>
                  </div>
                )
              }
              return (
                <>
                  {/* Phase 13.9 — Hero box: shares actually available to
                       sell right now = offering_total - sold_shares.
                       This is the live pool the platform draws from
                       for any sale, listing, or auction. Decrements by
                       the bought quantity on every successful purchase. */}
                  <div className="bg-gradient-to-l from-cyan-400/[0.1] to-cyan-400/[0.04] border-2 border-cyan-400/30 rounded-xl p-4 mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] text-cyan-300 font-bold mb-1 flex items-center gap-1.5">
                        💎 الحصص المتوفرة للبيع
                      </div>
                      <div className="text-[9px] text-neutral-400 leading-relaxed">
                        المباعة تُخصم تلقائياً · يُسحب منها لأي بيع/مزاد جديد
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-3xl lg:text-4xl font-bold text-cyan-300 font-mono leading-none">
                        {fmtNum(adminRow.offering_available)}
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-1 font-mono">
                        من أصل {fmtNum(adminRow.offering_total)} معروضة
                      </div>
                    </div>
                  </div>

                  {/* Row 1: shares counts */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-purple-400/[0.05] border border-purple-400/[0.2] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-neutral-500 mb-1">الحصص المعروضة</div>
                      <div className="text-base font-bold text-purple-400 font-mono">{fmtNum(adminRow.offering_total)}</div>
                    </div>
                    <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-neutral-500 mb-1">حصص مباعة</div>
                      <div className="text-base font-bold text-green-400 font-mono">{fmtNum(adminRow.sold_shares)}</div>
                    </div>
                    <div className="bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-neutral-500 mb-1">عدد المستثمرين</div>
                      <div className="text-base font-bold text-blue-400 font-mono">{fmtNum(adminRow.investors_count)}</div>
                    </div>
                  </div>
                  {/* Row 2: market values
                       Phase 13.10 — "قيمة الحصص غير المباعة" is now computed
                       client-side as market_price × offering_available so it
                       always matches the hero "متوفرة للبيع" box exactly,
                       regardless of how the server-side RPC chose to value
                       legacy rows. */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-emerald-400/[0.05] border border-emerald-400/[0.2] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-neutral-500 mb-1">إيرادات المباعة (سعر السوق)</div>
                      <div className="text-base font-bold text-emerald-400 font-mono">{fmtNum(adminRow.sold_value)} د.ع</div>
                    </div>
                    <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-neutral-500 mb-1">قيمة الحصص غير المباعة</div>
                      <div className="text-base font-bold text-yellow-400 font-mono">
                        {fmtNum(adminRow.market_price * adminRow.offering_available)} د.ع
                      </div>
                      <div className="text-[9px] text-neutral-500 mt-1 font-mono">
                        {fmtNum(adminRow.market_price)} × {fmtNum(adminRow.offering_available)}
                      </div>
                    </div>
                  </div>

                  {/* Row 3 (Phase 13.11): reserve + shares-added-after-launch */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-orange-400/[0.05] border border-orange-400/[0.2] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-neutral-500 mb-1">🏦 الاحتياطي</div>
                      <div className="text-base font-bold text-orange-400 font-mono">
                        {fmtNum(adminRow.reserve_available)}
                      </div>
                      <div className="text-[9px] text-neutral-500 mt-1">
                        من أصل {fmtNum(adminRow.reserve_total)} حصة
                      </div>
                    </div>
                    <div className="bg-pink-400/[0.05] border border-pink-400/[0.2] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-neutral-500 mb-1">➕ حصص مُضافة بعد الإعلان</div>
                      <div className="text-base font-bold text-pink-400 font-mono">
                        {fmtNum(sharesAddedAfter)}
                      </div>
                      <div className="text-[9px] text-neutral-500 mt-1">
                        مجموع كل عمليات "إضافة حصص للطرح"
                      </div>
                    </div>
                  </div>
                  {/* Helper line: market price */}
                  <div className="text-[11px] text-neutral-500 mb-4 text-center">
                    سعر السوق الحالي: <span className="font-mono text-white">{fmtNum(adminRow.market_price)} د.ع</span>
                    {" · "}
                    إجمالي الحصص: <span className="font-mono text-white">{fmtNum(adminRow.total_shares)}</span>
                  </div>
                </>
              )
            })()}

            {selected.status === "frozen" && selected.frozen_reason && (
              <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-xl p-3 mb-4">
                <div className="text-[11px] font-bold text-yellow-400 mb-1">❄️ مُجمَّدة منذ {selected.frozen_at}</div>
                <div className="text-xs text-neutral-300">{selected.frozen_reason}</div>
              </div>
            )}
            {/* Phase 10.93: suspension banners */}
            {(() => {
              const ar = adminRows.find((r) => r.project_id === selected.id)
              if (!ar) return null
              return (
                <>
                  {ar.trading_suspended && (
                    <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-xl p-3 mb-3">
                      <div className="text-[11px] font-bold text-red-400 mb-1">⏸️ التداول معلق</div>
                      {ar.trading_suspension_reason && (
                        <div className="text-xs text-neutral-300">{ar.trading_suspension_reason}</div>
                      )}
                    </div>
                  )}
                  {ar.offering_suspended && (
                    <div className="bg-orange-400/[0.05] border border-orange-400/[0.2] rounded-xl p-3 mb-3">
                      <div className="text-[11px] font-bold text-orange-400 mb-1">🔒 شراء الحصص المتبقية معلق</div>
                      {ar.offering_suspension_reason && (
                        <div className="text-xs text-neutral-300">{ar.offering_suspension_reason}</div>
                      )}
                    </div>
                  )}
                </>
              )
            })()}

            {/* Transactions */}
            <SectionHeader title="📋 سجلّ الحركات" />
            {(() => {
              const txs = getWalletTransactions(selected.id)
              if (txs.length === 0) return <div className="text-xs text-neutral-500 text-center py-4">لا حركات بعد</div>
              return (
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.05] mb-4">
                  {txs.map((t) => {
                    const reasonMeta = WALLET_TX_REASON_LABELS[t.reason]
                    return (
                      <div key={t.id} className="flex items-center gap-3 p-3">
                        <div className={cn(
                          "w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0",
                          t.type === "inflow" ? "bg-green-400/[0.08] border-green-400/[0.25]" : "bg-red-400/[0.08] border-red-400/[0.25]"
                        )}>
                          {t.type === "inflow" ? <ArrowDownLeft className="w-4 h-4 text-green-400" /> : <ArrowUpRight className="w-4 h-4 text-red-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white font-bold truncate flex items-center gap-1.5">
                            <span>{reasonMeta.icon}</span>
                            <span>{t.description}</span>
                          </div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">{reasonMeta.label} · {t.created_at}</div>
                        </div>
                        <div className={cn("text-sm font-bold font-mono flex-shrink-0", t.type === "inflow" ? "text-green-400" : "text-red-400")}>
                          {t.type === "inflow" ? "+" : "-"}{fmtNum(t.amount)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Actions */}
            {(() => {
              const ar = adminRows.find((r) => r.project_id === selected.id)
              return (
                <div className="grid grid-cols-2 gap-2">
                  {selected.status === "active" ? (
                    <ActionBtn label="❄️ تجميد المحفظة" color="yellow" onClick={() => setAction("freeze")} />
                  ) : (
                    <ActionBtn label="✅ فكّ التجميد" color="green" onClick={() => setAction("unfreeze")} />
                  )}
                  <ActionBtn
                    label="➕ إضافة حصص للطرح"
                    color="purple"
                    onClick={() => setAction("add_shares")}
                    disabled={selected.status !== "active"}
                  />
                  {/* Phase 13.41 — replaces the old 'release' single
                       direction with a generic move modal. Source =
                       reserve, destination is picked inside the modal
                       (offering / owner). */}
                  <ActionBtn
                    label="📤 نقل من الاحتياطي"
                    color="blue"
                    onClick={() => {
                      setMoveCounterpart("offering")
                      setReleaseAmount("")
                      setReason("")
                      setAction("move_from_reserve")
                    }}
                    disabled={selected.status !== "active"}
                  />
                  {/* Phase 13.41 — new: add shares to reserve.
                       Source = offering or owner (picked inside modal). */}
                  <ActionBtn
                    label="➕ إضافة إلى الاحتياطي"
                    color="purple"
                    onClick={() => {
                      setMoveCounterpart("offering")
                      setReleaseAmount("")
                      setReason("")
                      setAction("move_to_reserve")
                    }}
                    disabled={selected.status !== "active"}
                  />
                  {/* Phase 10.93: Trading suspension */}
                  {ar?.trading_suspended ? (
                    <ActionBtn label="▶️ استئناف التداول" color="green" onClick={() => setAction("resume_trading")} />
                  ) : (
                    <ActionBtn label="⏸️ تعليق التداول" color="red" onClick={() => setAction("suspend_trading")} />
                  )}
                  {ar?.offering_suspended ? (
                    <ActionBtn label="🔓 استئناف الحصص المتبقية" color="green" onClick={() => setAction("resume_offering")} />
                  ) : (
                    <ActionBtn label="🔒 تعليق الحصص المتبقية" color="yellow" onClick={() => setAction("suspend_offering")} />
                  )}
                  <button onClick={() => setSelected(null)} className="px-3 py-1.5 text-xs rounded-xl bg-white/[0.04] border border-white/[0.08] text-neutral-300 hover:bg-white/[0.08]">إغلاق</button>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {selected && action && (() => {
        const adminRow = adminRows.find((r) => r.project_id === selected.id)
        return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="text-base font-bold text-white mb-4">
              {action === "freeze" && "❄️ تجميد المحفظة"}
              {action === "unfreeze" && "✅ فكّ التجميد"}
              {action === "release" && "📤 نقل من الاحتياطي للعرض"}
              {action === "add_shares" && "➕ إضافة حصص للطرح من حصص الشركة"}
              {action === "move_from_reserve" && "📤 نقل من الاحتياطي"}
              {action === "move_to_reserve" && "➕ إضافة إلى الاحتياطي"}
              {action === "suspend_trading" && "⏸️ تعليق التداول الكلي"}
              {action === "resume_trading" && "▶️ استئناف التداول"}
              {action === "suspend_offering" && "🔒 تعليق الحصص المتبقية للشراء"}
              {action === "resume_offering" && "🔓 استئناف الحصص المتبقية"}
            </div>

            <div className={cn(
              "rounded-xl p-3 mb-4 text-xs border",
              action === "freeze" && "bg-yellow-400/[0.05] border-yellow-400/[0.2] text-yellow-400",
              action === "unfreeze" && "bg-green-400/[0.05] border-green-400/[0.2] text-green-400",
              action === "release" && "bg-blue-400/[0.05] border-blue-400/[0.2] text-blue-400",
              action === "add_shares" && "bg-purple-400/[0.05] border-purple-400/[0.2] text-purple-400",
              action === "suspend_trading" && "bg-red-400/[0.05] border-red-400/[0.2] text-red-400",
              action === "resume_trading" && "bg-green-400/[0.05] border-green-400/[0.2] text-green-400",
              action === "suspend_offering" && "bg-orange-400/[0.05] border-orange-400/[0.2] text-orange-400",
              action === "resume_offering" && "bg-green-400/[0.05] border-green-400/[0.2] text-green-400",
            )}>
              المحفظة: <span className="font-bold text-white">{selected.project_name}</span>
              {action === "release" && (
                <>
                  {" "}· الاحتياطي:{" "}
                  <span className="font-mono font-bold">{fmtNum(selected.balance)} حصة</span>
                </>
              )}
            </div>

            {action === "add_shares" && (() => {
              const totalProject = adminRow?.total_shares ?? 0
              const offeringTotal = adminRow?.offering_total ?? 0
              const ambassadorTotal = adminRow?.ambassador_total ?? 0
              const reserveTotal = adminRow?.reserve_total ?? 0
              // Owner shares = total project shares minus all wallet allocations
              const ownerShares = Math.max(0, totalProject - offeringTotal - ambassadorTotal - reserveTotal)
              const cap90 = Math.floor(0.9 * totalProject)
              const maxAddable = Math.max(0, Math.min(ownerShares, cap90 - offeringTotal))
              return (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-purple-400/[0.05] border border-purple-400/[0.2] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-neutral-500 mb-1">حصص المالك المتاحة</div>
                      <div className="text-base font-bold text-purple-400 font-mono">
                        {fmtNum(ownerShares)}
                      </div>
                      <div className="text-[9px] text-neutral-600 mt-0.5">
                        {totalProject > 0 ? ((ownerShares / totalProject) * 100).toFixed(1) : "0"}٪
                      </div>
                    </div>
                    <div className="bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-neutral-500 mb-1">المعروض للجمهور حالياً</div>
                      <div className="text-base font-bold text-blue-400 font-mono">
                        {fmtNum(offeringTotal)}
                      </div>
                      <div className="text-[9px] text-neutral-600 mt-0.5">
                        {totalProject > 0 ? ((offeringTotal / totalProject) * 100).toFixed(1) : "0"}٪ من {fmtNum(totalProject)}
                      </div>
                    </div>
                  </div>
                  {maxAddable < ownerShares && offeringTotal > 0 && (
                    <div className="bg-yellow-400/[0.06] border border-yellow-400/[0.2] rounded-lg p-2 mb-3 text-[10px] text-yellow-400 text-center">
                      ⚡ الحد الأقصى للطرح 90٪ من إجمالي المشروع ({fmtNum(cap90)} حصة) · متاح الآن: {fmtNum(maxAddable)}
                    </div>
                  )}
                </>
              )
            })()}

            {/* Phase 10.93: suspend/resume UI */}
            {(action === "suspend_trading" || action === "suspend_offering") && (
              <>
                <div className={cn(
                  "rounded-xl p-3 mb-4 text-xs border leading-relaxed",
                  action === "suspend_trading"
                    ? "bg-red-400/[0.05] border-red-400/[0.2] text-red-300"
                    : "bg-orange-400/[0.05] border-orange-400/[0.2] text-orange-300"
                )}>
                  {action === "suspend_trading"
                    ? "⚠️ سيُوقَف جميع أوامر البيع والشراء للمشروع فوراً. سيُعلَم المستثمرون بسبب التعليق."
                    : "⚠️ سيُوقَف شراء الحصص المتبقية (الشراء المباشر الجديد فقط). الصفقات الجارية بين المستثمرين لن تتأثر."}
                </div>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">السبب (اختياري — يُعرض للمستخدمين)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder={action === "suspend_trading"
                    ? "مثلاً: إعادة تقييم المشروع — سيُستأنف خلال 48 ساعة"
                    : "مثلاً: تعليق الطرح موقتاً لمراجعة السعر"}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none mb-4"
                />
              </>
            )}
            {(action === "resume_trading" || action === "resume_offering") && (
              <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-xl p-3 mb-4 text-xs text-green-300 leading-relaxed">
                {action === "resume_trading"
                  ? "✅ سيُستأنَف التداول الكامل (بيع وشراء) لهذا المشروع فوراً."
                  : "✅ سيُستأنَف الشراء المباشر للحصص المتبقية فوراً."}
              </div>
            )}

            {action === "freeze" && (
              <>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">سبب التجميد (إجباري)</label>
                <textarea
                  value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                  placeholder="مثلاً: تحت مراجعة لجنة التطوير..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none mb-4"
                />
              </>
            )}

            {action === "release" && (
              <>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">عدد الحصص للإطلاق</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={releaseAmount}
                  onChange={(e) => setReleaseAmount(e.target.value)}
                  placeholder="مثلاً: 1000"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20 mb-3"
                />
                <label className="text-xs text-neutral-400 mb-2 block font-bold">السبب (اختياري)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="مثلاً: مرحلة عرض ثانية..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none mb-3"
                />
                <div className="bg-blue-400/[0.04] border border-blue-400/[0.15] rounded-lg p-2.5 text-[11px] text-blue-300 mb-4 leading-relaxed">
                  💡 الحصص ستُنقل من <b className="text-white">محفظة الاحتياطي</b> إلى{" "}
                  <b className="text-white">محفظة العرض</b> (السوق)، فتصبح متاحة للتداول.
                </div>
              </>
            )}

            {/* Phase 13.41 — generic move modals (from-reserve / to-reserve). */}
            {(action === "move_from_reserve" || action === "move_to_reserve") && (
              <>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">
                  {action === "move_from_reserve" ? "🎯 الوجهة" : "🎯 المصدر"}
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {([
                    { key: "offering" as const, label: "💎 الطرح", hint: "الحصص المعروضة للبيع" },
                    { key: "owner"   as const, label: "👤 المالك", hint: "المحفظة الرئيسية" },
                  ]).map((opt) => {
                    const isPicked = moveCounterpart === opt.key
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setMoveCounterpart(opt.key)}
                        className={cn(
                          "px-3 py-2.5 rounded-xl border text-right transition-colors",
                          isPicked
                            ? "bg-blue-400/[0.1] border-blue-400/[0.4]"
                            : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.06]",
                        )}
                      >
                        <div className="text-xs font-bold text-white">{opt.label}</div>
                        <div className="text-[10px] text-neutral-400 mt-0.5">{opt.hint}</div>
                      </button>
                    )
                  })}
                </div>

                <label className="text-xs text-neutral-400 mb-2 block font-bold">عدد الحصص</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={releaseAmount}
                  onChange={(e) => setReleaseAmount(e.target.value)}
                  placeholder="مثلاً: 1000"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20 mb-3"
                />

                <label className="text-xs text-neutral-400 mb-2 block font-bold">السبب (اختياري)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="مثلاً: استرداد بعد إعادة التقييم..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none mb-3"
                />

                <div className="bg-blue-400/[0.04] border border-blue-400/[0.15] rounded-lg p-2.5 text-[11px] text-blue-300 mb-4 leading-relaxed">
                  💡 من <b className="text-white">
                    {action === "move_from_reserve" ? "🏦 الاحتياطي" : BUCKET_LABEL[moveCounterpart]}
                  </b> إلى <b className="text-white">
                    {action === "move_from_reserve" ? BUCKET_LABEL[moveCounterpart] : "🏦 الاحتياطي"}
                  </b>.
                </div>
              </>
            )}

            {action === "add_shares" && (() => {
              const totalProject = adminRow?.total_shares ?? 0
              const offeringTotal = adminRow?.offering_total ?? 0
              const ambassadorTotal = adminRow?.ambassador_total ?? 0
              const reserveTotal = adminRow?.reserve_total ?? 0
              const ownerShares = Math.max(0, totalProject - offeringTotal - ambassadorTotal - reserveTotal)
              const cap90 = Math.floor(0.9 * totalProject)
              const maxAddable = Math.max(0, Math.min(ownerShares, cap90 - offeringTotal))
              const amt = Math.floor(Number(releaseAmount)) || 0
              const newOwner = Math.max(0, ownerShares - amt)
              const newOffering = offeringTotal + amt
              const ownerPctAfter = totalProject > 0 ? ((newOwner / totalProject) * 100).toFixed(1) : "0"
              const offeringPctAfter = totalProject > 0 ? ((newOffering / totalProject) * 100).toFixed(1) : "0"
              const exceeds90 = newOffering > cap90
              const ownerReachesZero = newOwner === 0 && amt > 0

              return (
                <>
                  <label className="text-xs text-neutral-400 mb-2 block font-bold">
                    عدد الحصص الجديدة للطرح
                    {maxAddable > 0 && (
                      <span className="text-neutral-600 font-normal mr-1">(الحد الأقصى: {fmtNum(maxAddable)})</span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    max={maxAddable > 0 ? maxAddable : undefined}
                    value={releaseAmount}
                    onChange={(e) => setReleaseAmount(e.target.value)}
                    placeholder="مثلاً: 5,000"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20 mb-3"
                  />
                  {amt > 0 && totalProject > 0 && (
                    <div className={cn(
                      "border rounded-lg p-3 mb-3 text-[11px] leading-relaxed",
                      exceeds90
                        ? "bg-red-400/[0.05] border-red-400/[0.2] text-red-300"
                        : "bg-white/[0.04] border-white/[0.08] text-neutral-300"
                    )}>
                      {exceeds90 && (
                        <div className="text-red-400 font-bold mb-2 text-xs">
                          ⛔ تجاوز الحد! الطرح لا يتجاوز 90٪ ({fmtNum(cap90)} حصة)
                        </div>
                      )}
                      <div className="flex justify-between mb-1">
                        <span>حصص المالك بعد الإضافة:</span>
                        <span className={cn("font-mono font-bold", ownerReachesZero ? "text-red-400" : "text-purple-400")}>
                          {fmtNum(newOwner)} <span className="text-neutral-500">({ownerPctAfter}٪)</span>
                        </span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span>المعروض للجمهور بعد الإضافة:</span>
                        <span className={cn("font-mono font-bold", exceeds90 ? "text-red-400" : "text-blue-400")}>
                          {fmtNum(newOffering)} <span className="text-neutral-500">({offeringPctAfter}٪)</span>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>إجمالي المشروع:</span>
                        <span className="font-mono font-bold text-neutral-400">{fmtNum(totalProject)}</span>
                      </div>
                      {ownerReachesZero && !exceeds90 && (
                        <div className="mt-2 pt-2 border-t border-white/[0.06] text-yellow-400 text-[10px]">
                          ⚠️ حصص المالك ستصبح صفر — سيتم تحويل ملكية المشروع تلقائياً إلى أعلى مستثمر
                        </div>
                      )}
                    </div>
                  )}
                  <label className="text-xs text-neutral-400 mb-2 block font-bold">السبب (اختياري)</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="مثلاً: زيادة رأس المال — جولة طرح ثانية..."
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none mb-3"
                  />
                  <div className="bg-purple-400/[0.04] border border-purple-400/[0.15] rounded-lg p-2.5 text-[11px] text-purple-300 mb-4 leading-relaxed">
                    💡 ستُنقل الحصص من <b className="text-white">حصص المالك</b> إلى{" "}
                    <b className="text-white">محفظة الطرح للجمهور</b> — تتاح للتداول مباشرةً.
                    الحد الأقصى للطرح الكلي: <b className="text-white">90٪</b> من إجمالي المشروع.
                  </div>
                </>
              )
            })()}

            <div className="flex gap-2">
              <button onClick={() => { setAction(null); setReason(""); setReleaseAmount("") }} className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
              <button onClick={handleAction} className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold border",
                action === "freeze" && "bg-yellow-500/[0.15] border-yellow-500/[0.3] text-yellow-400",
                action === "unfreeze" && "bg-green-500/[0.15] border-green-500/[0.3] text-green-400",
                action === "release" && "bg-blue-500/[0.15] border-blue-500/[0.3] text-blue-400",
                action === "add_shares" && "bg-purple-500/[0.15] border-purple-500/[0.3] text-purple-400",
                action === "suspend_trading" && "bg-red-500/[0.15] border-red-500/[0.3] text-red-400",
                action === "resume_trading" && "bg-green-500/[0.15] border-green-500/[0.3] text-green-400",
                action === "suspend_offering" && "bg-orange-500/[0.15] border-orange-500/[0.3] text-orange-400",
                action === "resume_offering" && "bg-green-500/[0.15] border-green-500/[0.3] text-green-400",
              )}>تأكيد</button>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}
