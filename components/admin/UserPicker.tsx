"use client"

/**
 * UserPicker — reusable admin search-and-select for users (Phase 8.1).
 *
 * Drop-in replacement for the inline "find a user" UI scattered across
 * admin panels (Gifts, Council "add member", future: Orphans sponsor
 * lookup, Admin Users invite, etc.). One controlled component:
 *
 *   <UserPicker
 *     value={selected}
 *     onChange={setSelected}
 *     excludeIds={existingMemberIds}
 *     placeholder="ابحث بالاسم أو username..."
 *   />
 *
 * Supports optional role filtering (e.g. only show non-admins for a
 * sponsor picker, or hide existing council members).
 */

import { useEffect, useState } from "react"
import { Search, X, Check, ShieldCheck, Users, Star } from "lucide-react"
import { searchUsers, type UserSearchResult } from "@/lib/data/users-search"
import { cn } from "@/lib/utils/cn"

export interface UserPickerValue {
  id: string
  display_name: string
}

interface Props {
  /** Currently selected user, or null. Controlled by the parent. */
  value: UserPickerValue | null
  onChange: (user: UserPickerValue | null) => void
  /** Placeholder for the search input. */
  placeholder?: string
  /** ids to hide from results (e.g. already-selected partners). */
  excludeIds?: string[]
  /** When true, hide users with role=admin/super_admin from results. */
  hideAdmins?: boolean
  /** When true, hide active council members from results. */
  hideCouncilMembers?: boolean
  /** Disabled state — picker is read-only. */
  disabled?: boolean
  /** Optional label rendered above the field. */
  label?: string
  /** Optional helper text below the field. */
  helper?: string
}

const DEBOUNCE_MS = 250
const RESULT_LIMIT = 8

export function UserPicker({
  value,
  onChange,
  placeholder = "ابحث بالاسم أو username (حرفان على الأقل)...",
  excludeIds,
  hideAdmins = false,
  hideCouncilMembers = false,
  disabled = false,
  label,
  helper,
}: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  // Debounced search effect
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const t = window.setTimeout(async () => {
      const rows = await searchUsers(query, {
        excludeIds,
        limit: RESULT_LIMIT,
      })
      const filtered = rows.filter((r) => {
        if (hideAdmins && (r.role === "admin" || r.role === "super_admin")) return false
        if (hideCouncilMembers && r.is_council_member) return false
        return true
      })
      setResults(filtered)
      setLoading(false)
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [query, excludeIds, hideAdmins, hideCouncilMembers])

  const handleSelect = (u: UserSearchResult) => {
    onChange({ id: u.id, display_name: u.display_name })
    setQuery("")
    setResults([])
    setOpen(false)
  }

  const handleClear = () => {
    onChange(null)
    setQuery("")
    setResults([])
  }

  return (
    <div>
      {label && (
        <label className="text-xs text-neutral-400 mb-1.5 block font-bold">
          {label}
        </label>
      )}

      {value ? (
        <div className="bg-purple-500/[0.08] border border-purple-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-purple-500/[0.15] border border-purple-500/[0.3] flex items-center justify-center text-xs font-bold text-purple-300 flex-shrink-0">
              {value.display_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm text-white font-bold truncate">
                {value.display_name}
              </div>
              <div className="text-[10px] text-neutral-500 font-mono">
                #{value.id.slice(0, 8)}
              </div>
            </div>
          </div>
          {!disabled && (
            <button
              onClick={handleClear}
              className="text-neutral-400 hover:text-white p-1 flex-shrink-0"
              aria-label="إزالة"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              disabled={disabled}
              placeholder={placeholder}
              className={cn(
                "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            />
            {loading && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <div className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {open && query.trim().length >= 2 && (
            <div className="mt-2 bg-[#0a0a0a] border border-white/[0.1] rounded-xl overflow-hidden shadow-xl max-h-80 overflow-y-auto">
              {results.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-neutral-500">
                  {loading ? "جاري البحث..." : "لا توجد نتائج"}
                </div>
              ) : (
                results.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleSelect(u)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-right border-b border-white/[0.05] last:border-0"
                  >
                    <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {u.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white font-bold truncate">
                        {u.display_name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {u.username && (
                          <span className="text-[10px] text-neutral-500 font-mono" dir="ltr">
                            @{u.username}
                          </span>
                        )}
                        {u.level && u.level !== "basic" && (
                          <span className="text-[9px] text-yellow-400 flex items-center gap-0.5">
                            <Star className="w-2 h-2 fill-yellow-400" strokeWidth={0} />
                            {u.level === "elite" ? "elite" : u.level === "pro" ? "محترف" : "متقدم"}
                          </span>
                        )}
                        {u.role === "admin" && (
                          <span className="text-[9px] text-blue-400 flex items-center gap-0.5">
                            <ShieldCheck className="w-2 h-2" strokeWidth={2.5} />
                            أدمن
                          </span>
                        )}
                        {u.role === "super_admin" && (
                          <span className="text-[9px] text-red-400 flex items-center gap-0.5">
                            <ShieldCheck className="w-2 h-2" strokeWidth={2.5} />
                            مدير عام
                          </span>
                        )}
                        {u.is_council_member && (
                          <span className="text-[9px] text-purple-400 flex items-center gap-0.5">
                            <Users className="w-2 h-2" strokeWidth={2.5} />
                            مجلس
                          </span>
                        )}
                      </div>
                    </div>
                    <Check className="w-4 h-4 text-neutral-600 flex-shrink-0" strokeWidth={2} />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {helper && (
        <div className="text-[10px] text-neutral-500 mt-1.5">{helper}</div>
      )}
    </div>
  )
}
