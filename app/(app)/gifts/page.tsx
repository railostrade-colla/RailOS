"use client"

/**
 * /gifts — user-facing list of gifts received from admins (Phase 10).
 *
 * Shows all gifts (active / used / expired) with status badges and
 * direct CTAs to redeem (e.g. free_contract → /contracts/create).
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Gift, Clock, Check, X, ArrowLeft } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { getMyUnusedGifts, type UserGiftRow } from "@/lib/data/gifts"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"

const GIFT_TYPE_LABELS: Record<string, { label: string; icon: string; ctaLabel?: string; ctaHref?: string }> = {
  free_contract: {
    label: "عقد جماعي مجاني",
    icon: "🤝",
    ctaLabel: "استخدم لإنشاء عقد",
    ctaHref: "/contracts/create",
  },
  fee_units: { label: "وحدات رسوم", icon: "💎" },
  fee_discount: { label: "خصم رسوم", icon: "💸" },
}

const fmtDate = (iso: string | null | undefined) => iso?.slice(0, 10) ?? ""

export default function GiftsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [allGifts, setAllGifts] = useState<UserGiftRow[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setLoading(false)
        return
      }
      // Pull every gift, not just unused — users like seeing history.
      const { data } = await supabase
        .from("user_gifts")
        .select(
          `id, user_id, gift_type, gift_value, is_used, used_at,
           used_target_id, expires_at, granted_by, granted_reason, created_at,
           granter:profiles!granted_by ( full_name, username )`,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)

      if (cancelled) return
      const now = Date.now()
      interface RawRow {
        id: string
        user_id: string
        gift_type: string
        gift_value: Record<string, unknown> | null
        is_used: boolean
        used_at: string | null
        used_target_id: string | null
        expires_at: string | null
        granted_by: string | null
        granted_reason: string | null
        created_at: string
        granter?: { full_name?: string | null; username?: string | null }
                | { full_name?: string | null; username?: string | null }[]
                | null
      }
      const rows = (data as RawRow[] | null) ?? []
      const mapped: UserGiftRow[] = rows.map((r) => {
        const g = Array.isArray(r.granter) ? r.granter[0] : r.granter
        const status: UserGiftRow["status"] = r.is_used
          ? "used"
          : r.expires_at && new Date(r.expires_at).getTime() < now
            ? "expired"
            : "active"
        return {
          id: r.id,
          user_id: r.user_id,
          user_name: "",
          gift_type: r.gift_type,
          gift_value: r.gift_value,
          is_used: r.is_used,
          used_at: r.used_at,
          used_target_id: r.used_target_id,
          expires_at: r.expires_at,
          granted_by: r.granted_by,
          granted_by_name: g?.full_name?.trim() || g?.username?.trim() || "الإدارة",
          granted_reason: r.granted_reason,
          created_at: r.created_at,
          status,
        }
      })
      setAllGifts(mapped)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
    void getMyUnusedGifts // force keep import for future use
  }, [])

  const active = allGifts.filter((g) => g.status === "active")
  const used = allGifts.filter((g) => g.status === "used")
  const expired = allGifts.filter((g) => g.status === "expired")

  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
          <PageHeader
            title="🎁 هداياي"
            subtitle="الهدايا المُمنوحة لك من الإدارة"
            backHref="/portfolio"
          />

          {loading ? (
            <div className="text-center py-16 text-sm text-neutral-400">جاري التحميل...</div>
          ) : allGifts.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-purple-500/[0.08] border border-purple-500/[0.2] flex items-center justify-center mx-auto mb-4">
                <Gift className="w-10 h-10 text-purple-400" strokeWidth={1.5} />
              </div>
              <div className="text-base font-bold text-white mb-1">لا توجد هدايا بعد</div>
              <div className="text-xs text-neutral-500">ستظهر هنا عندما تمنحك الإدارة هدية</div>
            </div>
          ) : (
            <>
              {/* Active */}
              {active.length > 0 && (
                <div className="mb-6">
                  <div className="text-xs font-bold text-green-400 mb-3 px-1">
                    ✨ هدايا نشطة ({active.length})
                  </div>
                  <div className="space-y-3">
                    {active.map((g) => {
                      const meta = GIFT_TYPE_LABELS[g.gift_type] ?? {
                        label: g.gift_type,
                        icon: "🎁",
                      }
                      return (
                        <div
                          key={g.id}
                          className="bg-gradient-to-l from-purple-500/[0.08] to-pink-500/[0.04] border border-purple-500/[0.25] rounded-2xl p-4"
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/[0.15] border border-purple-500/[0.3] flex items-center justify-center text-2xl flex-shrink-0">
                              {meta.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-white mb-0.5">{meta.label}</div>
                              {g.granted_reason && (
                                <div className="text-[11px] text-neutral-300 leading-relaxed">{g.granted_reason}</div>
                              )}
                              <div className="text-[10px] text-neutral-500 mt-1.5 flex items-center gap-2 flex-wrap">
                                <span>من: {g.granted_by_name}</span>
                                <span>·</span>
                                <span dir="ltr">{fmtDate(g.created_at)}</span>
                                {g.expires_at && (
                                  <>
                                    <span>·</span>
                                    <span className="flex items-center gap-1 text-yellow-400">
                                      <Clock className="w-2.5 h-2.5" />
                                      ينتهي {fmtDate(g.expires_at)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          {meta.ctaHref && (
                            <button
                              onClick={() => router.push(meta.ctaHref!)}
                              className="w-full bg-purple-500/[0.15] border border-purple-500/[0.3] text-purple-300 hover:bg-purple-500/[0.2] py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                            >
                              {meta.ctaLabel ?? "استخدم الآن"}
                              <ArrowLeft className="w-3 h-3" strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Used + Expired */}
              {(used.length > 0 || expired.length > 0) && (
                <div>
                  <div className="text-xs font-bold text-neutral-500 mb-3 px-1">📜 السجل</div>
                  <div className="space-y-2">
                    {[...used, ...expired].map((g) => {
                      const meta = GIFT_TYPE_LABELS[g.gift_type] ?? {
                        label: g.gift_type,
                        icon: "🎁",
                      }
                      const isUsed = g.status === "used"
                      return (
                        <div
                          key={g.id}
                          className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 flex items-center gap-3"
                        >
                          <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-base flex-shrink-0 opacity-60">
                            {meta.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-neutral-300 font-bold truncate">{meta.label}</div>
                            <div className="text-[10px] text-neutral-500 mt-0.5 flex items-center gap-1.5">
                              {isUsed ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-green-400" />
                                  <span>مُستخدَمة {g.used_at && `(${fmtDate(g.used_at)})`}</span>
                                </>
                              ) : (
                                <>
                                  <X className="w-2.5 h-2.5 text-red-400" />
                                  <span>منتهية الصلاحية</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap",
                              isUsed
                                ? "bg-blue-400/10 border-blue-400/30 text-blue-400"
                                : "bg-neutral-500/10 border-neutral-500/30 text-neutral-400",
                            )}
                          >
                            {isUsed ? "مُستخدَمة" : "منتهية"}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
