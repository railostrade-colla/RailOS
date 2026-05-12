"use client"

/**
 * AuditLogPanel — Phase 14.06 step 3.
 *
 * Read-only timeline of `market_settings_audit` rows.
 *
 * Parent owns the data and pagination decisions; this component is
 * purely presentational. When a row is added (after the parent
 * detects a save), the parent passes the new array down and we
 * re-render. The "Load more" button bumps the parent's limit.
 */

import { useMemo } from "react"
import {
  History,
  ArrowLeft,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Equal,
} from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { SettingAuditEntry } from "@/lib/data/market-settings"

export interface AuditLogPanelProps {
  entries: SettingAuditEntry[]
  loading?: boolean
  /** Optional setting-key filter for the dropdown — see parent's state. */
  filterKey: string | "all"
  /** All unique keys to render as filter options. */
  availableKeys: Array<{ key: string; label: string }>
  onFilterChange: (next: string | "all") => void
  /** Click handler for "load more" — parent bumps its limit. */
  onLoadMore?: () => void
  /** Disable "load more" when at the cap (500 server-side). */
  canLoadMore?: boolean
}

export function AuditLogPanel({
  entries,
  loading = false,
  filterKey,
  availableKeys,
  onFilterChange,
  onLoadMore,
  canLoadMore = true,
}: AuditLogPanelProps) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400/20 to-purple-400/20 border border-blue-400/30 flex items-center justify-center">
            <History className="w-5 h-5 text-blue-400" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">📜 سجل التعديلات</h2>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              كل تغيير على الإعدادات يُسجَّل هنا — للشفافية والمراجعة
            </p>
          </div>
        </div>

        {/* Filter dropdown */}
        <div className="relative">
          <select
            value={filterKey}
            onChange={(e) => onFilterChange(e.target.value)}
            className="appearance-none bg-black/40 border border-white/[0.08] rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-white/20 cursor-pointer"
          >
            <option value="all">كل الإعدادات</option>
            {availableKeys.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none"
            strokeWidth={2}
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && entries.length === 0 && (
        <div className="py-8 text-center text-xs text-neutral-500">
          جاري تحميل السجل...
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="py-10 text-center">
          <div className="text-3xl mb-2 opacity-50">📭</div>
          <div className="text-xs text-neutral-500 leading-relaxed">
            {filterKey === "all"
              ? "لا توجد تعديلات بعد. عدّل أي إعداد ليظهر هنا."
              : "لا توجد تعديلات لهذا الإعداد."}
          </div>
        </div>
      )}

      {/* Entries */}
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry, idx) => (
            <AuditRow key={`${entry.setting_key}-${entry.changed_at}-${idx}`} entry={entry} />
          ))}
        </div>
      )}

      {/* Load more */}
      {entries.length > 0 && onLoadMore && canLoadMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          className="w-full mt-3 py-2 rounded-xl text-xs text-neutral-400 bg-white/[0.04] hover:bg-white/[0.06] hover:text-white border border-white/[0.06] transition-colors disabled:opacity-50"
        >
          {loading ? "جاري التحميل..." : "عرض المزيد"}
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Internal row component
// ═══════════════════════════════════════════════════════════════════

function AuditRow({ entry }: { entry: SettingAuditEntry }) {
  const delta = entry.new_value - entry.old_value
  const direction: "up" | "down" | "flat" =
    delta > 0 ? "up" : delta < 0 ? "down" : "flat"

  const when = useMemo(() => {
    const d = new Date(entry.changed_at)
    if (Number.isNaN(d.getTime())) return entry.changed_at
    return d.toLocaleString("ar-IQ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [entry.changed_at])

  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {/* Setting + values */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-white truncate">
              {entry.setting_label}
            </span>
            <span className="text-[9px] font-mono text-neutral-600">
              ({entry.setting_key})
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1.5 text-xs font-mono">
            <span className="text-neutral-400">{entry.old_value}</span>
            <ArrowLeft className="w-3 h-3 text-neutral-600" strokeWidth={2.5} />
            <span
              className={cn(
                "font-bold flex items-center gap-1",
                direction === "up" && "text-green-400",
                direction === "down" && "text-red-400",
                direction === "flat" && "text-neutral-400",
              )}
            >
              {entry.new_value}
              {direction === "up" && <TrendingUp className="w-3 h-3" strokeWidth={2.5} />}
              {direction === "down" && (
                <TrendingDown className="w-3 h-3" strokeWidth={2.5} />
              )}
              {direction === "flat" && <Equal className="w-3 h-3" strokeWidth={2.5} />}
            </span>
          </div>

          {entry.reason && (
            <p className="text-[10px] text-neutral-400 mt-1.5 leading-relaxed line-clamp-2">
              <span className="text-neutral-600">السبب:</span> {entry.reason}
            </p>
          )}
        </div>

        {/* Who + when */}
        <div className="text-left shrink-0">
          <div className="text-[11px] text-neutral-300 font-bold">
            {entry.changed_by_name ?? "غير معروف"}
          </div>
          <div className="text-[9px] text-neutral-500 mt-0.5">{when}</div>
        </div>
      </div>
    </div>
  )
}
