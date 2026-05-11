"use client"

/**
 * AdminQuickBuyToggle — Phase 13.59.
 *
 * Per-project admin control: enable/disable "sell to system" + set
 * the discount percentage. Standalone (own RPC) so it can live in
 * the EntityFormPanel (project edit) without touching the form's
 * save flow, or be embedded anywhere else that has a project_id.
 *
 * Reads the current state from `projects` on mount, writes through
 * `admin_set_project_quick_buy` RPC on save.
 */

import { useEffect, useState } from "react"
import { Zap, Save, Power } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { setAdminProjectQuickBuy } from "@/lib/data/admin-quick-buy"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

interface Props {
  projectId: string
  /** Optional initial values to avoid a fetch on mount. */
  initialEnabled?: boolean
  initialDiscountPct?: number
}

export function AdminQuickBuyToggle({
  projectId,
  initialEnabled,
  initialDiscountPct,
}: Props) {
  const [enabled, setEnabled] = useState<boolean>(initialEnabled ?? false)
  const [discountPct, setDiscountPct] = useState<string>(
    String(initialDiscountPct ?? 15),
  )
  const [loading, setLoading] = useState<boolean>(initialEnabled === undefined)
  const [saving, setSaving] = useState(false)
  const [originalEnabled, setOriginalEnabled] = useState<boolean>(initialEnabled ?? false)
  const [originalDiscount, setOriginalDiscount] = useState<number>(initialDiscountPct ?? 15)

  // Fetch existing config if not provided.
  useEffect(() => {
    if (initialEnabled !== undefined) return
    let cancelled = false
    const supabase = createClient()
    supabase
      .from("projects")
      .select("admin_quick_buy_enabled, admin_quick_buy_discount_pct")
      .eq("id", projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) {
          setLoading(false)
          return
        }
        type Row = {
          admin_quick_buy_enabled?: boolean | null
          admin_quick_buy_discount_pct?: number | string | null
        }
        const r = data as Row
        const en = !!r.admin_quick_buy_enabled
        const dc = Number(r.admin_quick_buy_discount_pct ?? 15)
        setEnabled(en)
        setOriginalEnabled(en)
        setDiscountPct(String(dc))
        setOriginalDiscount(dc)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [projectId, initialEnabled])

  const dirty =
    enabled !== originalEnabled || Number(discountPct) !== originalDiscount

  const handleSave = async () => {
    const dc = Number(discountPct)
    if (!Number.isFinite(dc) || dc < 0 || dc > 90) {
      showError("نسبة الخصم يجب أن تكون بين 0 و 90")
      return
    }
    setSaving(true)
    const r = await setAdminProjectQuickBuy({
      projectId,
      enabled,
      discountPct: dc,
    })
    setSaving(false)
    if (!r.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        not_admin: "صلاحيات الأدمن مطلوبة",
        invalid_input: "مدخلات غير صحيحة",
        invalid_discount: "نسبة الخصم يجب أن تكون بين 0 و 90",
        project_not_found: "المشروع غير موجود",
      }
      showError(map[r.error ?? ""] ?? r.error ?? "فشل الحفظ")
      return
    }
    showSuccess("✅ تم حفظ إعدادات البيع للنظام")
    setOriginalEnabled(enabled)
    setOriginalDiscount(dc)
  }

  if (loading) {
    return (
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 text-center">
        <div className="text-xs text-neutral-500 animate-pulse">جاري التحميل…</div>
      </div>
    )
  }

  return (
    <div className={cn(
      "border-2 rounded-2xl p-5 transition-colors",
      enabled
        ? "bg-[#deff9a]/[0.04] border-[#deff9a]/30"
        : "bg-white/[0.03] border-white/[0.08]",
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 min-w-0">
          <div className={cn(
            "mt-0.5 flex-shrink-0",
            enabled ? "text-[#deff9a]" : "text-neutral-500",
          )}>
            <Zap className="w-4 h-4" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              ⚡ البيع المباشر للنظام
              {enabled ? (
                <span className="bg-[#deff9a]/[0.15] border border-[#deff9a]/[0.3] text-[#deff9a] text-[9px] font-bold px-1.5 py-0.5 rounded">
                  مفعَّل
                </span>
              ) : (
                <span className="bg-white/[0.05] border border-white/[0.1] text-neutral-400 text-[9px] font-bold px-1.5 py-0.5 rounded">
                  معطَّل
                </span>
              )}
            </div>
            <div className="text-[11px] text-neutral-400 leading-relaxed mt-1">
              {enabled
                ? `يستطيع المستخدمون بيع حصصهم فوراً للنظام بسعر السوق ناقص ${Number(discountPct) || 0}%.`
                : "البيع للنظام مُعطَّل — يرى المستخدم رسالة \"غير متوفّر حالياً\"."}
            </div>
          </div>
        </div>
        <button
          onClick={() => setEnabled((v) => !v)}
          className={cn(
            "relative w-12 h-6 rounded-full transition-colors flex-shrink-0",
            enabled ? "bg-[#deff9a]" : "bg-white/[0.1]",
          )}
          aria-label={enabled ? "إيقاف الميزة" : "تفعيل الميزة"}
        >
          <span
            className={cn(
              "absolute top-0.5 w-5 h-5 rounded-full transition-all shadow-md",
              enabled ? "right-0.5 bg-black" : "right-6 bg-neutral-400",
            )}
          />
        </button>
      </div>

      <div className={cn("space-y-2", !enabled && "opacity-60")}>
        <label className="text-[10px] text-neutral-400 font-bold block">
          نسبة الخصم (٪ من سعر السوق)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={90}
            step={0.5}
            value={discountPct}
            onChange={(e) => setDiscountPct(e.target.value)}
            disabled={!enabled}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-[#deff9a]/40 disabled:opacity-50"
          />
          <span className="text-[10px] text-neutral-500 flex-shrink-0">%</span>
        </div>
        <div className="text-[10px] text-neutral-500 leading-snug">
          مثال: إذا سعر السوق 25,000 IQD وخصم 15% → سيستلم البائع 21,250 IQD لكل حصّة.
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !dirty}
        className={cn(
          "w-full mt-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors",
          dirty && !saving
            ? "bg-[#deff9a] text-black hover:bg-[#c9eb78]"
            : "bg-white/[0.05] border border-white/[0.08] text-neutral-500 cursor-not-allowed",
        )}
      >
        {dirty ? <Save className="w-3.5 h-3.5" strokeWidth={2.5} /> : <Power className="w-3.5 h-3.5" />}
        {saving ? "جاري الحفظ…" : dirty ? "حفظ" : "لا تغييرات"}
      </button>
    </div>
  )
}
