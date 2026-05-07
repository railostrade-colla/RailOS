"use client"

/**
 * Phase 10.97 — Admin → System → "إعدادات الدفع"
 * Lets super_admin publish:
 *   • master card number + holder name
 *   • Zain Cash / Asia Hawala phone for transfers
 *   • support phone (shown next to proof upload)
 *   • free-text payment instructions
 *
 * The values are read by the buy + fee-units modals via getPaymentSettings().
 */

import { useEffect, useState } from "react"
import { CreditCard, Phone, FileText, Save, Loader2 } from "lucide-react"
import { SectionHeader, ActionBtn } from "@/components/admin/ui"
import {
  getPaymentSettings,
  adminSetPaymentSettings,
  type PaymentSettings,
  EMPTY_PAYMENT_SETTINGS,
} from "@/lib/data/payment-settings"
import { showSuccess, showError } from "@/lib/utils/toast"

export function PaymentSettingsPanel() {
  const [data, setData] = useState<PaymentSettings>(EMPTY_PAYMENT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable fields (controlled inputs)
  const [cardNumber, setCardNumber] = useState("")
  const [cardHolder, setCardHolder] = useState("")
  const [transferPhone, setTransferPhone] = useState("")
  const [supportPhone, setSupportPhone] = useState("")
  const [instructions, setInstructions] = useState("")

  const reload = () => {
    setLoading(true)
    getPaymentSettings()
      .then((s) => {
        setData(s)
        setCardNumber(s.master_card_number ?? "")
        setCardHolder(s.master_card_holder ?? "")
        setTransferPhone(s.transfer_phone ?? "")
        setSupportPhone(s.support_phone ?? "")
        setInstructions(s.payment_instructions ?? "")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [])

  const dirty =
    cardNumber.trim()    !== (data.master_card_number ?? "") ||
    cardHolder.trim()    !== (data.master_card_holder ?? "") ||
    transferPhone.trim() !== (data.transfer_phone ?? "") ||
    supportPhone.trim()  !== (data.support_phone ?? "") ||
    instructions.trim()  !== (data.payment_instructions ?? "")

  const save = async () => {
    if (!dirty || saving) return
    setSaving(true)
    const result = await adminSetPaymentSettings({
      master_card_number: cardNumber.trim() || null,
      master_card_holder: cardHolder.trim() || null,
      transfer_phone:     transferPhone.trim() || null,
      support_phone:      supportPhone.trim() || null,
      payment_instructions: instructions.trim() || null,
    })
    setSaving(false)
    if (!result.success) {
      const map: Record<string, string> = {
        super_admin_only: "هذا الإجراء يتطلب Super Admin",
        unauthenticated: "سجّل الدخول أولاً",
        missing_table: "طبّق Migration 10.97 أولاً",
      }
      showError(map[result.reason ?? ""] ?? `فشل الحفظ${result.error ? ": " + result.error : ""}`)
      return
    }
    showSuccess("✅ تم حفظ إعدادات الدفع")
    reload()
  }

  return (
    <div className="p-6 max-w-3xl">
      <SectionHeader
        title="💳 إعدادات الدفع"
        subtitle="رقم الماستر كارد + الهاتف + التعليمات التي تظهر للمستخدمين عند الشراء أو طلب وحدات الرسوم"
      />

      {loading ? (
        <div className="text-xs text-neutral-500 text-center py-12">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          جارٍ التحميل...
        </div>
      ) : (
        <div className="space-y-4">
          {/* Master card */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
              <div className="text-sm font-bold text-white">بطاقة الماستر</div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">رقم البطاقة</label>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="5555 5555 5555 5555"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">اسم صاحب البطاقة</label>
                <input
                  type="text"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  placeholder="مثلاً: شركة رايلوس للاستثمار"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                />
              </div>
            </div>
          </div>

          {/* Phones */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Phone className="w-4 h-4 text-green-400" strokeWidth={1.5} />
              <div className="text-sm font-bold text-white">أرقام الهاتف</div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">
                  رقم التحويل (Zain Cash / Asia Hawala)
                </label>
                <input
                  type="text"
                  inputMode="tel"
                  dir="ltr"
                  value={transferPhone}
                  onChange={(e) => setTransferPhone(e.target.value)}
                  placeholder="+9647XXXXXXXXX"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
                />
                <div className="text-[10px] text-neutral-500 mt-1">
                  يتم نسخه من قبل المستخدم لتحويل المبلغ.
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">رقم الدعم</label>
                <input
                  type="text"
                  inputMode="tel"
                  dir="ltr"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  placeholder="+9647XXXXXXXXX"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
                />
                <div className="text-[10px] text-neutral-500 mt-1">
                  يظهر بجانب زر رفع صورة الإثبات للمستخدم.
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-purple-400" strokeWidth={1.5} />
              <div className="text-sm font-bold text-white">تعليمات الدفع</div>
            </div>
            <textarea
              rows={5}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={[
                "مثلاً:",
                "1. حوّل المبلغ بالضبط على رقم الماستر أعلاه أو على رقم Zain Cash.",
                "2. ارفع صورة وصل التحويل واضحة.",
                "3. ستراجع الإدارة الطلب خلال 24 ساعة.",
                "4. للاستفسار: راسلنا على رقم الدعم.",
              ].join("\n")}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none whitespace-pre-line"
            />
            <div className="text-[10px] text-neutral-500 mt-2">
              تظهر هذه التعليمات للمستخدم في نافذة الشراء المباشر ونافذة طلب وحدات الرسوم.
            </div>
          </div>

          {/* Save */}
          <div className="flex gap-2 sticky bottom-0 bg-black/80 backdrop-blur-sm py-3 -mx-6 px-6 border-t border-white/[0.05]">
            <button
              onClick={reload}
              disabled={!dirty || saving}
              className="px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-40"
            >
              تراجع
            </button>
            <ActionBtn
              label={saving ? "جارٍ الحفظ..." : dirty ? "💾 حفظ التعديلات" : "محفوظ"}
              color="green"
              onClick={save}
              disabled={!dirty || saving}
            />
          </div>
        </div>
      )}
    </div>
  )
}
