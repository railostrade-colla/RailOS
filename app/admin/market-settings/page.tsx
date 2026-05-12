"use client"

/**
 * /admin/market-settings — Phase 14.06 step 3.
 *
 * Live registry of every tunable knob in the market engine.
 *
 * Page-level responsibilities:
 *   • Load + cache `market_settings` + `market_settings_audit` once
 *     on mount (no realtime subscription — admin pages refresh on
 *     navigation, and stale config is acceptable for ≤ 1 page-life).
 *   • Apply three orthogonal filters in-memory: search query,
 *     category pill, "modified only" toggle. All filtering happens
 *     in `useMemo` — the DB layer always returns the full list.
 *   • Receive optimistic-update payloads from each SettingCard via
 *     `onApplied`, rewrite the matching row, then refresh the audit
 *     log so the panel below shows the new entry within ~200 ms.
 *
 * Auth: the `/admin` layout already enforces role gating; this page
 * doesn't need its own redirect. RLS deny-all on `market_settings`
 * is the ultimate guard — only super_admin sessions can mutate via
 * the SECURITY DEFINER RPCs.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Settings2, Sparkles, RefreshCw, Loader2 } from "lucide-react"
import { SearchBar } from "@/components/admin/market-settings/SearchBar"
import {
  CategoryFilter,
  type CategoryFilterValue,
} from "@/components/admin/market-settings/CategoryFilter"
import { SettingCard } from "@/components/admin/market-settings/SettingCard"
import { AuditLogPanel } from "@/components/admin/market-settings/AuditLogPanel"
import {
  getAllMarketSettings,
  getSettingAuditLog,
  getCategoryEmoji,
  getCategoryLabel,
  groupSettingsByCategory,
  type MarketSetting,
  type SettingAuditEntry,
  type SettingCategory,
} from "@/lib/data/market-settings"
import { cn } from "@/lib/utils/cn"

const AUDIT_PAGE_SIZE = 50
const AUDIT_HARD_CAP = 500

export default function MarketSettingsPage() {
  // ─── Data ─────────────────────────────────────────────────────
  const [settings, setSettings] = useState<MarketSetting[]>([])
  const [auditLog, setAuditLog] = useState<SettingAuditEntry[]>([])
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [loadingAudit, setLoadingAudit] = useState(true)
  const [auditLimit, setAuditLimit] = useState(AUDIT_PAGE_SIZE)
  const [auditFilter, setAuditFilter] = useState<string | "all">("all")

  // ─── Filters ──────────────────────────────────────────────────
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<CategoryFilterValue>("all")
  const [modifiedOnly, setModifiedOnly] = useState(false)

  // ─── Data loaders ─────────────────────────────────────────────
  const reloadSettings = useCallback(async () => {
    setLoadingSettings(true)
    const rows = await getAllMarketSettings()
    setSettings(rows)
    setLoadingSettings(false)
  }, [])

  const reloadAudit = useCallback(
    async (limit: number, filter: string | "all") => {
      setLoadingAudit(true)
      const rows = await getSettingAuditLog(
        filter === "all" ? undefined : filter,
        limit,
      )
      setAuditLog(rows)
      setLoadingAudit(false)
    },
    [],
  )

  useEffect(() => {
    void reloadSettings()
  }, [reloadSettings])

  useEffect(() => {
    void reloadAudit(auditLimit, auditFilter)
  }, [auditLimit, auditFilter, reloadAudit])

  // ─── Optimistic update from a SettingCard ────────────────────
  const handleApplied = useCallback((updated: MarketSetting) => {
    setSettings((prev) =>
      prev.map((s) => (s.key === updated.key ? updated : s)),
    )
  }, [])

  const handleAuditChanged = useCallback(() => {
    // Re-fetch audit log with current filter+limit so the new row
    // shows up at the top with the real `changed_by_name` from the
    // server (we don't try to optimistically guess the admin's
    // display name).
    void reloadAudit(auditLimit, auditFilter)
  }, [auditLimit, auditFilter, reloadAudit])

  // ─── Derived: filtered settings ──────────────────────────────
  const filteredSettings = useMemo(() => {
    const q = search.trim().toLowerCase()
    return settings.filter((s) => {
      if (category !== "all" && s.category !== category) return false
      if (modifiedOnly && !s.is_modified) return false
      if (q.length === 0) return true
      const haystack = [
        s.label_ar,
        s.description_ar ?? "",
        s.key,
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [settings, search, category, modifiedOnly])

  const grouped = useMemo(
    () => groupSettingsByCategory(filteredSettings),
    [filteredSettings],
  )

  // ─── Derived: stats ──────────────────────────────────────────
  const totalCount = settings.length
  const modifiedCount = useMemo(
    () => settings.filter((s) => s.is_modified).length,
    [settings],
  )
  const availableCategories = useMemo<SettingCategory[]>(
    () => Array.from(new Set(settings.map((s) => s.category))),
    [settings],
  )
  const categoryCounts = useMemo<Partial<Record<SettingCategory, number>>>(() => {
    const map: Partial<Record<SettingCategory, number>> = {}
    for (const s of settings) {
      map[s.category] = (map[s.category] ?? 0) + 1
    }
    return map
  }, [settings])

  // Audit dropdown options derived from the full list (so filtering
  // by a setting with no audit entries is still possible — the UI
  // will show "no entries" rather than hiding the option).
  const auditKeyOptions = useMemo(
    () =>
      [...settings]
        .sort((a, b) => a.label_ar.localeCompare(b.label_ar, "ar"))
        .map((s) => ({ key: s.key, label: s.label_ar })),
    [settings],
  )

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-7">
      {/* ─── Header ────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-green-400/20 to-yellow-400/20 border border-green-400/30 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-green-400" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">⚙️ إعدادات السوق</h1>
            <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
              كل قيمة في محرك التسعير قابلة للتعديل — بدون deployment ولا قيم
              ثابتة في الكود
            </p>
          </div>
        </div>

        {/* Reload button */}
        <button
          type="button"
          onClick={() => {
            void reloadSettings()
            void reloadAudit(auditLimit, auditFilter)
          }}
          disabled={loadingSettings}
          className="text-xs text-neutral-400 hover:text-white bg-white/[0.04] border border-white/[0.08] hover:border-white/20 rounded-xl px-3 py-2 flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          {loadingSettings ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
          )}
          تحديث
        </button>
      </header>

      {/* ─── Stat strip ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat
          label="إجمالي الإعدادات"
          value={String(totalCount)}
          icon="🗂"
        />
        <Stat
          label="إعدادات معدّلة"
          value={String(modifiedCount)}
          icon="✨"
          highlight={modifiedCount > 0 ? "yellow" : undefined}
        />
        <Stat
          label="الفئات"
          value={String(availableCategories.length)}
          icon="📂"
        />
        <Stat
          label="تعديلات مسجَّلة"
          value={String(auditLog.length)}
          icon="📜"
        />
      </div>

      {/* ─── Toolbar: search + modified-only ────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <SearchBar
          value={search}
          onChange={setSearch}
          className="flex-1 min-w-[200px]"
        />
        <label
          className={cn(
            "flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors text-xs",
            modifiedOnly
              ? "bg-yellow-400/15 border-yellow-400/40 text-yellow-300"
              : "bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:text-white",
          )}
        >
          <input
            type="checkbox"
            checked={modifiedOnly}
            onChange={(e) => setModifiedOnly(e.target.checked)}
            className="sr-only"
          />
          <Sparkles className="w-3.5 h-3.5" strokeWidth={2.5} />
          <span>المعدّلة فقط</span>
        </label>
      </div>

      {/* ─── Category filter ──────────────────────────────── */}
      <CategoryFilter
        available={availableCategories}
        value={category}
        onChange={setCategory}
        counts={categoryCounts}
        totalCount={totalCount}
      />

      {/* ─── Settings (grouped) ────────────────────────────── */}
      {loadingSettings && settings.length === 0 ? (
        <div className="py-16 text-center text-xs text-neutral-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          جاري تحميل الإعدادات...
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3 opacity-50">🔍</div>
          <div className="text-sm text-neutral-400">
            لا توجد إعدادات تطابق الفلتر
          </div>
          {(search || category !== "all" || modifiedOnly) && (
            <button
              type="button"
              onClick={() => {
                setSearch("")
                setCategory("all")
                setModifiedOnly(false)
              }}
              className="mt-3 text-xs text-green-400 hover:text-green-300 underline underline-offset-2"
            >
              مسح الفلاتر
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-7">
          {grouped.map(({ category: cat, items }) => (
            <section key={cat}>
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-base">{getCategoryEmoji(cat)}</span>
                {getCategoryLabel(cat)}
                <span className="text-[10px] text-neutral-500 font-normal">
                  ({items.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((s) => (
                  <SettingCard
                    key={s.key}
                    setting={s}
                    onApplied={handleApplied}
                    onAuditChanged={handleAuditChanged}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ─── Audit log ─────────────────────────────────────── */}
      <AuditLogPanel
        entries={auditLog}
        loading={loadingAudit}
        filterKey={auditFilter}
        availableKeys={auditKeyOptions}
        onFilterChange={(next) => {
          setAuditFilter(next)
          setAuditLimit(AUDIT_PAGE_SIZE)
        }}
        onLoadMore={() =>
          setAuditLimit((l) => Math.min(l + AUDIT_PAGE_SIZE, AUDIT_HARD_CAP))
        }
        canLoadMore={
          auditLog.length >= auditLimit && auditLimit < AUDIT_HARD_CAP
        }
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Stat tile
// ═══════════════════════════════════════════════════════════════════

function Stat({
  label,
  value,
  icon,
  highlight,
}: {
  label: string
  value: string
  icon: string
  highlight?: "yellow" | "green"
}) {
  return (
    <div
      className={cn(
        "bg-white/[0.04] border rounded-xl p-3",
        highlight === "yellow" && "border-yellow-400/30 bg-yellow-400/[0.04]",
        highlight === "green" && "border-green-400/30 bg-green-400/[0.04]",
        !highlight && "border-white/[0.08]",
      )}
    >
      <div className="text-[10px] text-neutral-500 mb-1 flex items-center gap-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "text-lg font-bold font-mono",
          highlight === "yellow" && "text-yellow-300",
          highlight === "green" && "text-green-300",
          !highlight && "text-white",
        )}
      >
        {value}
      </div>
    </div>
  )
}
