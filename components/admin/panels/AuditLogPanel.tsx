"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, X, Download, Trash2 } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  KPI, AdminEmpty,
} from "@/components/admin/ui"
import {
  ACTION_LABELS,
  ENTITY_TYPE_LABELS,
  ROLE_LABELS,
  isDestructive,
  type AuditLogEntry,
  type AuditAction,
  type AuditEntityType,
} from "@/lib/mock-data/auditLog"
import { getAuditLog } from "@/lib/data/audit-log"
import { cleanupAuditLogOld } from "@/lib/data/admin-utilities"
import { showSuccess, showError } from "@/lib/utils/toast"

const fmtNum = (n: number) => n.toLocaleString("en-US")

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

const DESTRUCTIVE_ACTIONS = new Set<AuditAction>([
  "freeze_project",
  "suspend_user",
  "suspend_ambassador",
  "ban_user",
  "remove_council_member",
  "force_end_contract",
  "cancel_auction",
])

/** Per-list stats — replaces getAuditLogStats() which read MOCK_AUDIT_LOG. */
function computeStats(log: AuditLogEntry[]) {
  const now = Date.now()
  let today = 0
  let thisWeek = 0
  let destructive = 0
  for (const e of log) {
    const t = new Date(e.created_at).getTime()
    if (Number.isFinite(t)) {
      if (now - t < DAY_MS) today++
      if (now - t < WEEK_MS) thisWeek++
    }
    if (DESTRUCTIVE_ACTIONS.has(e.action)) destructive++
  }
  return { today, this_week: thisWeek, destructive, total: log.length }
}

export function AuditLogPanel() {
  const [search, setSearch] = useState("")
  const [adminFilter, setAdminFilter] = useState<string>("all")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [entityFilter, setEntityFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [destructiveOnly, setDestructiveOnly] = useState(false)
  const [selected, setSelected] = useState<AuditLogEntry | null>(null)
  const [page, setPage] = useState(0)

  // Cleanup state
  const [showCleanup, setShowCleanup] = useState(false)
  const [cleanupDays, setCleanupDays] = useState(90)
  const [cleanupSubmitting, setCleanupSubmitting] = useState(false)

  // Production mode — DB only.
  const [log, setLog] = useState<AuditLogEntry[]>([])
  useEffect(() => {
    let cancelled = false
    getAuditLog(500).then((rows) => {
      if (cancelled) return
      setLog(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const PAGE_SIZE = 10

  const stats = useMemo(() => computeStats(log), [log])

  // Build admin list from log itself
  const admins = useMemo(() => {
    const map = new Map<string, string>()
    log.forEach((e) => map.set(e.admin_id, e.admin_name))
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [log])

  const filtered = useMemo(() => {
    return log
      .filter((e) => adminFilter === "all" || e.admin_id === adminFilter)
      .filter((e) => actionFilter === "all" || e.action === actionFilter)
      .filter((e) => entityFilter === "all" || e.entity_type === entityFilter)
      .filter((e) => !dateFrom || e.created_at >= dateFrom)
      .filter((e) => !dateTo || e.created_at <= dateTo + " 23:59")
      .filter((e) => !destructiveOnly || isDestructive(e.action))
      .filter((e) =>
        !search ||
        e.admin_name.includes(search) ||
        e.entity_name.includes(search) ||
        e.id.toLowerCase().includes(search.toLowerCase())
      )
  }, [log, search, adminFilter, actionFilter, entityFilter, dateFrom, dateTo, destructiveOnly])

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const resetFilters = () => {
    setSearch("")
    setAdminFilter("all")
    setActionFilter("all")
    setEntityFilter("all")
    setDateFrom("")
    setDateTo("")
    setDestructiveOnly(false)
    setPage(0)
  }

  const reloadLog = () => {
    getAuditLog(500).then(setLog)
  }

  const handleCleanup = async () => {
    if (cleanupDays < 7) {
      showError("الحد الأدنى للاحتفاظ هو 7 أيام")
      return
    }
    setCleanupSubmitting(true)
    const result = await cleanupAuditLogOld(cleanupDays)
    setCleanupSubmitting(false)
    if (!result.success) {
      const map: Record<string, string> = {
        not_admin: "صلاحياتك لا تسمح",
        min_7_days: "الحد الأدنى 7 أيام",
        audit_log_missing: "جدول السجلات غير موجود",
        rls: "ممنوع بسبب RLS",
        missing_table: "الدالة غير منشورة — طبّق Migration 10.32",
      }
      showError(map[result.reason ?? ""] ?? "فشل التنظيف")
      return
    }
    showSuccess(`🧹 تم حذف ${fmtNum(result.deleted ?? 0)} سجل أقدم من ${cleanupDays} يوماً`)
    setShowCleanup(false)
    reloadLog()
  }

  const exportCSV = () => {
    const headers = ["ID", "Date", "Admin", "Role", "Action", "Entity Type", "Entity Name", "IP", "Reason"]
    const rows = filtered.map((e) => [
      e.id,
      e.created_at,
      e.admin_name,
      ROLE_LABELS[e.admin_role]?.label ?? e.admin_role ?? "—",
      ACTION_LABELS[e.action]?.label ?? e.action ?? "—",
      ENTITY_TYPE_LABELS[e.entity_type] ?? e.entity_type ?? "—",
      e.entity_name,
      e.ip_address || "",
      (e.reason || "").replace(/"/g, '""'),
    ])
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${cell}"`).join(","))
      .join("\n")
    // Add BOM for proper UTF-8 (Arabic) in Excel
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const today = new Date().toISOString().split("T")[0]
    const link = document.createElement("a")
    link.href = url
    link.download = `audit-log-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showSuccess(`📥 تم تصدير ${fmtNum(filtered.length)} إجراء إلى CSV`)
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <div className="flex justify-between items-start mb-4 gap-3">
        <div>
          <div className="text-lg font-bold text-white">📜 سجل التدقيق</div>
          <div className="text-xs text-neutral-500 mt-0.5">كل قرارات الإدارة — شفافية كاملة (للقراءة فقط)</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCleanup(true)}
            className="flex items-center gap-1.5 bg-red-400/[0.08] border border-red-400/[0.25] text-red-400 hover:bg-red-400/[0.12] rounded-md px-3 py-1.5 text-xs font-bold transition-colors"
            title="حذف السجلات الأقدم من N يوماً"
          >
            <Trash2 className="w-3.5 h-3.5" />
            تنظيف قديم
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 bg-blue-400/[0.1] border border-blue-400/[0.25] text-blue-400 hover:bg-blue-400/[0.15] rounded-md px-3 py-1.5 text-xs font-bold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="اليوم" val={stats.today} color="#60A5FA" />
        <KPI label="هذا الأسبوع" val={stats.this_week} color="#4ADE80" />
        <KPI label="إجراءات حسّاسة" val={stats.destructive} color="#F87171" accent="rgba(248,113,113,0.05)" />
        <KPI label="الإجمالي" val={fmtNum(stats.total)} color="#fff" />
      </div>

      {/* Filters card */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4 mb-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-3">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="بحث (admin/entity/id)..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
            />
          </div>
          <select
            value={adminFilter}
            onChange={(e) => { setAdminFilter(e.target.value); setPage(0) }}
            className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
          >
            <option value="all">كل الإداريين</option>
            {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-3">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0) }}
            className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
          >
            <option value="all">كل الإجراءات</option>
            {(Object.keys(ACTION_LABELS) as AuditAction[]).map((k) => (
              <option key={k} value={k}>{ACTION_LABELS[k].label}</option>
            ))}
          </select>
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(0) }}
            className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
          >
            <option value="all">كل الكيانات</option>
            {(Object.keys(ENTITY_TYPE_LABELS) as AuditEntityType[]).map((k) => (
              <option key={k} value={k}>{ENTITY_TYPE_LABELS[k]}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(0) }}
            className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
            placeholder="من تاريخ"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(0) }}
            className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
            placeholder="إلى تاريخ"
          />
          <div className="flex gap-2">
            <label className="flex-1 flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 cursor-pointer hover:bg-white/[0.06]">
              <input
                type="checkbox"
                checked={destructiveOnly}
                onChange={(e) => { setDestructiveOnly(e.target.checked); setPage(0) }}
                className="w-4 h-4"
              />
              <span className="text-xs text-red-400">⚠ حسّاسة فقط</span>
            </label>
            <ActionBtn label="🔄 إعادة" color="gray" sm onClick={resetFilters} />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <AdminEmpty title="لا توجد سجلّات" body="جرّب تعديل الفلترة" />
      ) : (
        <>
          <Table>
            <THead>
              <TH>الوقت</TH>
              <TH>الأدمن</TH>
              <TH>الإجراء</TH>
              <TH>النوع</TH>
              <TH>الكيان</TH>
              <TH>الـ IP</TH>
              <TH>إجراءات</TH>
            </THead>
            <TBody>
              {paginated.map((e) => {
                // Defensive: real DB rows may carry action/role/entity_type
                // values that were added after the mock label maps were
                // last updated (e.g. "bootstrap_super_admin", "create_project",
                // "market_open"). Falling back to a neutral label keeps
                // the panel rendering instead of throwing on .label access.
                const al = ACTION_LABELS[e.action] ?? { label: e.action ?? "—", color: "gray" as const }
                const rl = ROLE_LABELS[e.admin_role] ?? { label: e.admin_role ?? "—", color: "gray" as const }
                const et = ENTITY_TYPE_LABELS[e.entity_type] ?? (e.entity_type ?? "—")
                return (
                  <TR key={e.id}>
                    <TD><span className="font-mono text-[11px] text-neutral-400" dir="ltr">{e.created_at}</span></TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white">{e.admin_name}</span>
                        <Badge label={rl.label} color={rl.color} />
                      </div>
                    </TD>
                    <TD><Badge label={al.label} color={al.color} /></TD>
                    <TD><span className="text-[11px] text-neutral-400">{et}</span></TD>
                    <TD>
                      <div className="text-xs">
                        <div className="text-white max-w-xs truncate">{e.entity_name}</div>
                        <div className="text-[10px] text-neutral-500 font-mono">{e.entity_id}</div>
                      </div>
                    </TD>
                    <TD><span className="font-mono text-[10px] text-neutral-500" dir="ltr">{e.ip_address || "—"}</span></TD>
                    <TD>
                      <ActionBtn label="عرض" color="gray" sm onClick={() => setSelected(e)} />
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <div className="text-[11px] text-neutral-500 font-mono">
                صفحة {page + 1} من {totalPages} · {fmtNum(filtered.length)} سجل
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-xs rounded-md bg-white/[0.05] border border-white/[0.1] text-neutral-300 hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  السابق
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-xs rounded-md bg-white/[0.05] border border-white/[0.1] text-neutral-300 hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  التالي
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-base font-bold text-white">تفاصيل الإجراء</div>
                <div className="text-xs text-neutral-500 mt-1 font-mono">{selected.id}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isDestructive(selected.action) && (
              <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-xl p-3 mb-4 text-xs text-red-400">
                ⚠️ هذا إجراء حسّاس / تدميري
              </div>
            )}

            {/* Action info */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="text-[11px] font-bold text-neutral-400 mb-3">⚡ معلومات الإجراء</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">الإجراء</div>
                  <Badge
                    label={ACTION_LABELS[selected.action]?.label ?? selected.action ?? "—"}
                    color={ACTION_LABELS[selected.action]?.color ?? "gray"}
                  />
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">نوع الكيان</div>
                  <div className="text-white">{ENTITY_TYPE_LABELS[selected.entity_type] ?? selected.entity_type ?? "—"}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] text-neutral-500 mb-1">الكيان المتأثّر</div>
                  <div className="text-white font-bold">{selected.entity_name}</div>
                  <div className="text-[10px] text-neutral-500 font-mono">{selected.entity_id}</div>
                </div>
              </div>
            </div>

            {/* Admin info */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="text-[11px] font-bold text-neutral-400 mb-3">👤 الإداري</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">الاسم</div>
                  <div className="text-white font-bold">{selected.admin_name}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">الدور</div>
                  <Badge
                    label={ROLE_LABELS[selected.admin_role]?.label ?? selected.admin_role ?? "—"}
                    color={ROLE_LABELS[selected.admin_role]?.color ?? "gray"}
                  />
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">التاريخ والوقت</div>
                  <div className="text-white font-mono" dir="ltr">{selected.created_at}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">عنوان IP</div>
                  <div className="text-neutral-300 font-mono" dir="ltr">{selected.ip_address || "—"}</div>
                </div>
              </div>
            </div>

            {/* Reason */}
            {selected.reason && (
              <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-xl p-3 mb-4">
                <div className="text-[11px] text-yellow-400 font-bold mb-1">السبب المُسجَّل</div>
                <div className="text-xs text-neutral-200">{selected.reason}</div>
              </div>
            )}

            {/* Metadata (JSON viewer) */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="text-[11px] font-bold text-neutral-400 mb-2">🗄 Metadata</div>
              <pre className="bg-black border border-white/[0.05] rounded-lg p-3 text-[11px] text-neutral-300 font-mono overflow-x-auto whitespace-pre-wrap" dir="ltr">
                {JSON.stringify(selected.metadata, null, 2)}
              </pre>
            </div>

            {/* Read-only notice */}
            <div className="bg-neutral-400/[0.05] border border-neutral-400/[0.2] rounded-xl p-3 mb-4 text-[11px] text-neutral-400">
              🔒 سجل التدقيق للقراءة فقط. لا يمكن تعديل أو حذف الإدخالات.
            </div>

            <button
              onClick={() => setSelected(null)}
              className="w-full py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Cleanup modal */}
      {showCleanup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-red-400/[0.3] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                <div className="text-base font-bold text-white">🧹 تنظيف السجلات القديمة</div>
              </div>
              <button onClick={() => setShowCleanup(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-xl p-3 mb-4 text-xs text-yellow-300">
              ⚠️ سيتم <span className="font-bold">حذفها نهائياً</span> ولا يمكن استرجاعها.
              يُنصح بـ <span className="font-mono">Export CSV</span> أولاً.
            </div>

            <div className="mb-4">
              <label className="text-xs text-neutral-400 mb-1.5 block">
                احذف السجلات الأقدم من (بالأيام)
              </label>
              <input
                type="number"
                min={7}
                max={3650}
                value={cleanupDays}
                onChange={(e) => setCleanupDays(Math.max(7, Number(e.target.value) || 90))}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20 font-mono"
              />
              <div className="text-[11px] text-neutral-500 mt-1">
                الحد الأدنى 7 أيام (للحماية من الأخطاء). الافتراضي 90 يوم.
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCleanup(false)}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={handleCleanup}
                disabled={cleanupSubmitting || cleanupDays < 7}
                className="flex-1 py-3 rounded-xl bg-red-500/[0.15] border border-red-500/[0.3] text-red-400 text-sm font-bold hover:bg-red-500/[0.2] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cleanupSubmitting ? "جارٍ الحذف..." : "تأكيد الحذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
