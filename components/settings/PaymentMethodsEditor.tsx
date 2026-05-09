"use client"

/**
 * PaymentMethodsEditor — Phase 12.7.
 *
 * Lives inside /settings → tab "المالية". Lets the user define how
 * counter-parties pay them off-platform (phone wallet, bank, mastercard).
 * Once a deal opens, the buyer sees these on the deal page with copy
 * buttons so they can transfer money outside the app.
 *
 * Save model: replace-whole-array. The RPC validates shape + count,
 * so the client just sanitises empties and dedupes the primary flag.
 */

import { useEffect, useState } from "react"
import { Plus, Trash2, Star, Save, Loader2 } from "lucide-react"
import { Card } from "@/components/ui"
import { showSuccess, showError } from "@/lib/utils/toast"
import {
  PAYMENT_METHOD_META,
  getMyPaymentMethods,
  saveMyPaymentMethods,
  type PaymentMethod,
  type PaymentMethodType,
} from "@/lib/data/payment-methods"
import { cn } from "@/lib/utils/cn"

const TYPES: PaymentMethodType[] = ["phone", "bank", "mastercard", "other"]

const empty = (): PaymentMethod => ({
  type: "phone",
  label: PAYMENT_METHOD_META.phone.label,
  value: "",
  holder_name: "",
  is_primary: false,
})

export function PaymentMethodsEditor() {
  const [items, setItems] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMyPaymentMethods().then((rows) => {
      if (cancelled) return
      setItems(rows.length === 0 ? [] : rows)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const updateAt = (idx: number, patch: Partial<PaymentMethod>) => {
    setDirty(true)
    setItems((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)))
  }

  const setPrimary = (idx: number) => {
    setDirty(true)
    setItems((prev) =>
      prev.map((m, i) => ({ ...m, is_primary: i === idx }))
    )
  }

  const removeAt = (idx: number) => {
    setDirty(true)
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const addRow = () => {
    setDirty(true)
    setItems((prev) => [
      ...prev,
      { ...empty(), is_primary: prev.length === 0 },
    ])
  }

  const handleSave = async () => {
    setSaving(true)
    const res = await saveMyPaymentMethods(items)
    setSaving(false)
    if (!res.success) {
      showError(res.error ?? "تعذّر الحفظ")
      return
    }
    showSuccess("✅ تمّ حفظ طرق الدفع")
    setDirty(false)
    // Re-read to get the canonical sanitised list (empties stripped).
    const fresh = await getMyPaymentMethods()
    setItems(fresh)
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-bold text-white">💳 طرق الدفع</div>
          <div className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">
            هذه الأرقام تظهر للمشتري بعد فتح الصفقة ليحوّل لك المبلغ خارج التطبيق.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-6 flex items-center justify-center text-neutral-500 text-xs">
          <Loader2 className="w-4 h-4 animate-spin ml-2" />
          جاري التحميل...
        </div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs text-neutral-500 mb-3">
            لا توجد طرق دفع بعد. أضف رقم حساب أو هاتف ليرى المشتري.
          </p>
          <button
            onClick={addRow}
            className="bg-blue-400/[0.12] border border-blue-400/30 text-blue-400 px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-400/[0.18] transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            إضافة طريقة دفع
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((m, idx) => (
            <PaymentMethodRow
              key={idx}
              method={m}
              onChange={(p) => updateAt(idx, p)}
              onRemove={() => removeAt(idx)}
              onMakePrimary={() => setPrimary(idx)}
            />
          ))}

          <button
            onClick={addRow}
            disabled={items.length >= 10}
            className={cn(
              "w-full border border-dashed rounded-lg py-2.5 text-xs flex items-center justify-center gap-1.5 transition-colors",
              items.length >= 10
                ? "border-white/[0.06] text-neutral-600 cursor-not-allowed"
                : "border-white/[0.12] text-neutral-400 hover:bg-white/[0.04] hover:text-white"
            )}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            {items.length >= 10 ? "بلغت الحد الأقصى (10)" : "إضافة طريقة أخرى"}
          </button>
        </div>
      )}

      {/* Save button — sticky-ish at the bottom of the card */}
      {!loading && (items.length > 0 || dirty) && (
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={cn(
            "w-full mt-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors",
            !dirty || saving
              ? "bg-white/[0.04] text-neutral-600 cursor-not-allowed"
              : "bg-green-500 text-black hover:bg-green-600"
          )}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" strokeWidth={2.5} />
              حفظ التغييرات
            </>
          )}
        </button>
      )}
    </Card>
  )
}

function PaymentMethodRow({
  method,
  onChange,
  onRemove,
  onMakePrimary,
}: {
  method: PaymentMethod
  onChange: (patch: Partial<PaymentMethod>) => void
  onRemove: () => void
  onMakePrimary: () => void
}) {
  const meta = PAYMENT_METHOD_META[method.type]

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-2.5">
      {/* Top row: type selector + primary star + remove */}
      <div className="flex items-center gap-2">
        <select
          value={method.type}
          onChange={(e) => {
            const t = e.target.value as PaymentMethodType
            onChange({ type: t, label: PAYMENT_METHOD_META[t].label })
          }}
          className="flex-1 bg-black/40 border border-white/[0.08] rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-white/20"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {PAYMENT_METHOD_META[t].icon} {PAYMENT_METHOD_META[t].label}
            </option>
          ))}
        </select>

        <button
          onClick={onMakePrimary}
          aria-label="جعلها الافتراضية"
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center transition-colors border",
            method.is_primary
              ? "bg-yellow-400/[0.12] border-yellow-400/30 text-yellow-400"
              : "bg-white/[0.04] border-white/[0.06] text-neutral-500 hover:text-yellow-400"
          )}
        >
          <Star
            className="w-4 h-4"
            strokeWidth={2}
            fill={method.is_primary ? "currentColor" : "none"}
          />
        </button>

        <button
          onClick={onRemove}
          aria-label="حذف"
          className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] text-neutral-500 hover:text-red-400 hover:bg-red-400/[0.08] hover:border-red-400/30 flex items-center justify-center transition-colors"
        >
          <Trash2 className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      {/* Custom label (only for "other") */}
      {method.type === "other" && (
        <input
          type="text"
          value={method.label ?? ""}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="مسمّى الطريقة (مثلاً: USDT TRC20)"
          maxLength={30}
          className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
        />
      )}

      {/* Value (the actual number) */}
      <div>
        <label className="block text-[10px] text-neutral-500 mb-1">الرقم</label>
        <input
          type="text"
          inputMode="numeric"
          value={method.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder={meta.placeholder}
          maxLength={60}
          dir="ltr"
          className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-neutral-600 outline-none focus:border-white/20"
        />
      </div>

      {/* Holder name (optional) */}
      <div>
        <label className="block text-[10px] text-neutral-500 mb-1">
          اسم صاحب الحساب <span className="text-neutral-700">(اختياري)</span>
        </label>
        <input
          type="text"
          value={method.holder_name ?? ""}
          onChange={(e) => onChange({ holder_name: e.target.value })}
          placeholder="مثلاً: علي محمد"
          maxLength={40}
          className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
        />
      </div>
    </div>
  )
}
