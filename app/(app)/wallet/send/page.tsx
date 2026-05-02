"use client"

import { useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, X, AlertTriangle, Check, Search, Camera, Upload, ArrowDownToLine, Coins, Send, Users, Clock } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess, showError, showInfo } from "@/lib/utils/toast"
import { createInvoice } from "@/lib/data/invoices"
import { LEVEL_LIMITS, fmtLimit } from "@/lib/utils/contractLimits"
import {
  CURRENT_USER_ID_WALLET as CURRENT_USER_ID,
  CURRENT_USER_LEVEL,
  CURRENT_USER_USED_THIS_MONTH,
  CURRENT_FEE_BALANCE,
  MOCK_HOLDINGS_SEND as MOCK_HOLDINGS,
  RECENT_RECIPIENTS,
  MOCK_USERS_DB,
} from "@/lib/mock-data"
import { cn } from "@/lib/utils/cn"

const sectorIcon = (s: string) =>
  s?.includes("زراع") ? "🌾" :
  s?.includes("تجار") ? "🏪" :
  s?.includes("صناع") ? "🏭" :
  s?.includes("عقار") ? "🏢" : "💼"

// تنسيق ID للعرض
const formatID = (id: string) => id.toUpperCase().replace(/^U_/, "RX-")

// ─── المكوّن الرئيسي ───
export default function SendSharesPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [recipientId, setRecipientId] = useState("")
  const [recipientUser, setRecipientUser] = useState<typeof MOCK_USERS_DB[string] | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [selectedHolding, setSelectedHolding] = useState<typeof MOCK_HOLDINGS[0] | null>(null)
  const [showHoldingDropdown, setShowHoldingDropdown] = useState(false)
  const [qty, setQty] = useState("")
  const [note, setNote] = useState("")

  // Modals
  const [showScanner, setShowScanner] = useState(false)
  const [scannerInput, setScannerInput] = useState("")
  const [showConfirm, setShowConfirm] = useState(false)
  const [sending, setSending] = useState(false)

  // Calculations
  // ✦ القاعدة: المنصّة لا تخصم رسوماً بالحصص — كل العمولات بوحدات الرسوم فقط.
  const qtyNum = parseInt(qty) || 0
  const sharePrice = selectedHolding?.project?.share_price || 0
  const totalValue = qtyNum * sharePrice
  const TRANSFER_FEE_PERCENT = 2.5
  // العمولة الوحيدة — مدفوعة من رصيد وحدات الرسوم (وليس من الحصص نفسها).
  const transferFee = Math.ceil((totalValue * TRANSFER_FEE_PERCENT) / 100)

  // Validations
  const isSelfSending = recipientUser?.id === CURRENT_USER_ID
  const hasEnoughBalance = selectedHolding ? qtyNum <= selectedHolding.shares_owned : false
  const hasEnoughFeeBalance = CURRENT_FEE_BALANCE >= transferFee
  const monthlyLimit = LEVEL_LIMITS[CURRENT_USER_LEVEL]
  const monthlyRemaining = monthlyLimit - CURRENT_USER_USED_THIS_MONTH
  const exceedsMonthlyLimit = totalValue > monthlyRemaining

  // Errors
  const qtyError = useMemo(() => {
    if (qty === "") return null
    if (qtyNum < 1) return "الكمية يجب أن تكون 1 على الأقل"
    if (selectedHolding && qtyNum > selectedHolding.shares_owned) {
      return "تجاوزت رصيدك المتاح (" + selectedHolding.shares_owned + " حصة)"
    }
    return null
  }, [qty, qtyNum, selectedHolding])

  // Handlers
  const handleVerifyRecipient = async (id?: string) => {
    const targetId = (id || recipientId).trim().toLowerCase()
    if (!targetId) {
      showError("أدخل ID المستلم أولاً")
      return
    }
    if (targetId === CURRENT_USER_ID) {
      showError("لا يمكن الإرسال إلى نفسك")
      setRecipientUser(null)
      return
    }
    setVerifying(true)
    await new Promise((r) => setTimeout(r, 600))
    const found = MOCK_USERS_DB[targetId]
    if (found) {
      setRecipientUser(found)
      showSuccess("تم التحقق من المستلم")
    } else {
      setRecipientUser(null)
      showError("المستخدم غير موجود")
    }
    setVerifying(false)
  }

  const handleSelectRecent = (recipient: typeof RECENT_RECIPIENTS[0]) => {
    setRecipientId(recipient.id)
    handleVerifyRecipient(recipient.id)
  }

  const handleQtyChange = (v: string) => {
    if (v === "") {
      setQty("")
      return
    }
    const num = parseInt(v) || 0
    if (selectedHolding && num > selectedHolding.shares_owned) {
      setQty(String(selectedHolding.shares_owned))
      return
    }
    setQty(v)
  }

  const handleScannerSubmit = () => {
    if (!scannerInput.trim()) {
      showError("أدخل ID المحفظة")
      return
    }
    setRecipientId(scannerInput)
    setShowScanner(false)
    setScannerInput("")
    handleVerifyRecipient(scannerInput)
  }

  const handleBarcodeImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    showInfo("ميزة قراءة الباركود من صورة قادمة قريباً")
  }

  const handleOpenConfirm = () => {
    if (!recipientUser) {
      showError("تحقق من المستلم أولاً")
      return
    }
    if (!selectedHolding) {
      showError("اختر الحصة المراد إرسالها")
      return
    }
    if (qtyNum < 1 || qtyError) {
      showError("راجع عدد الحصص")
      return
    }
    if (!hasEnoughFeeBalance) {
      showError("رصيد وحدات الرسوم غير كافٍ")
      return
    }
    if (exceedsMonthlyLimit) {
      showError("العملية تتجاوز حدّك الشهري")
      return
    }
    setShowConfirm(true)
  }

  const handleSubmit = async () => {
    if (!recipientUser || !selectedHolding) return
    setSending(true)
    await new Promise((r) => setTimeout(r, 1200))

    // ─── 📄 إنشاء الفاتورة الرسمية للتحويل ───
    const invoice = createInvoice({
      type: "transfer_send",
      from: { id: CURRENT_USER_ID, name: "أنا" },
      to: { id: recipientUser.id, name: recipientUser.name },
      project_id: selectedHolding.project_id,
      project_name: selectedHolding.project.name,
      shares_amount: qtyNum,
      price_per_share: selectedHolding.project.share_price,
      platform_fee_units: transferFee,
      notes: note.trim() || undefined,
    })

    showSuccess(`✅ تم إرسال ${qtyNum} حصة + إصدار الفاتورة ${invoice.id}`)
    setShowConfirm(false)
    setSending(false)
    setTimeout(() => router.replace(`/invoices/${invoice.id}`), 800)
  }

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader
            title="إرسال الحصص"
            subtitle="حوّل حصصك إلى مستثمر آخر بأمان"
            backHref="/wallet"
          />

          {/* تنبيه هام */}
          <div className="bg-red-500/[0.06] border border-red-500/25 rounded-xl p-3.5 mb-5 flex gap-3 items-start">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
            <div className="text-[11px] text-red-300 leading-relaxed">
              <span className="font-bold">لا يمكن التراجع</span> عن عملية الإرسال بعد التأكيد. تحقق من جميع البيانات بعناية.
            </div>
          </div>

          {/* الحد الشهري + رصيد الرسوم */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3">
              <div className="text-[10px] text-neutral-500 mb-1">الحد الشهري المتبقي</div>
              <div className="text-base font-bold text-white font-mono">
                {fmtLimit(monthlyRemaining)} د.ع
              </div>
              <div className="h-1 bg-white/[0.05] rounded-full mt-2 overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all",
                    exceedsMonthlyLimit ? "bg-red-500" : "bg-blue-400"
                  )}
                  style={{ width: ((CURRENT_USER_USED_THIS_MONTH / monthlyLimit) * 100) + "%" }}
                />
              </div>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3">
              <div className="text-[10px] text-neutral-500 mb-1 flex items-center gap-1">
                <Coins className="w-3 h-3 text-yellow-400" strokeWidth={2} />
                وحدات الرسوم
              </div>
              <div className="text-base font-bold text-yellow-400 font-mono">
                {CURRENT_FEE_BALANCE.toLocaleString("en-US")}
              </div>
              <div className="text-[10px] text-neutral-600 mt-1">رصيد متاح</div>
            </div>
          </div>

          {/* القسم 1: المستلم */}
          <div className="mb-5">
            <div className="text-[11px] text-neutral-400 mb-2 font-bold flex items-center gap-1.5">
              <Users className="w-3 h-3" strokeWidth={2} />
              ID محفظة المستلم
            </div>

            <div className="flex gap-2 mb-2">
              <input
                value={recipientId}
                onChange={(e) => {
                  setRecipientId(e.target.value)
                  setRecipientUser(null)
                }}
                placeholder="أدخل ID المستخدم..."
                className="flex-1 bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none font-mono transition-colors"
                dir="ltr"
              />
              <button
                onClick={() => handleVerifyRecipient()}
                disabled={verifying || !recipientId.trim()}
                className="bg-white/[0.06] border border-white/[0.1] text-white text-xs font-bold px-4 rounded-xl hover:bg-white/[0.1] disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {verifying ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" strokeWidth={2} />
                )}
                تحقق
              </button>
            </div>

            {/* أزرار Scanner */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] rounded-xl py-2.5 text-[11px] text-neutral-300 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
                رفع صورة باركود
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBarcodeImage}
                  className="hidden"
                />
              </button>
              <button
                onClick={() => setShowScanner(true)}
                className="flex items-center justify-center gap-1.5 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] rounded-xl py-2.5 text-[11px] text-neutral-300 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" strokeWidth={1.5} />
                مسح باركود
              </button>
            </div>

            {/* بطاقة المستلم بعد التحقق */}
            {recipientUser && (
              <div className="bg-green-400/[0.06] border border-green-400/25 rounded-xl p-3 flex items-center gap-3 mt-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border border-white/10 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {recipientUser.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white truncate">{recipientUser.name}</span>
                    {recipientUser.verified && (
                      <span className="bg-green-400/[0.15] border border-green-400/30 text-green-400 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Check className="w-2 h-2" strokeWidth={3} />
                        موثق
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                    {formatID(recipientUser.id)}
                  </div>
                </div>
                <Check className="w-5 h-5 text-green-400 flex-shrink-0" strokeWidth={2.5} />
              </div>
            )}

            {/* آخر المستلمين */}
            {!recipientUser && RECENT_RECIPIENTS.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] text-neutral-500 font-bold mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" strokeWidth={2} />
                  آخر المستلمين
                </div>
                <div className="space-y-1.5">
                  {RECENT_RECIPIENTS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => handleSelectRecent(r)}
                      className="w-full flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] rounded-lg px-3 py-2 transition-colors text-right"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border border-white/10 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
                        {r.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-white truncate">{r.name}</span>
                          {r.verified && <Check className="w-2.5 h-2.5 text-green-400" strokeWidth={3} />}
                        </div>
                        <div className="text-[9px] text-neutral-600">{r.last_sent}</div>
                      </div>
                      <Send className="w-3 h-3 text-neutral-500 flex-shrink-0" strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* القسم 2: اختيار الحصة */}
          <div className="mb-5">
            <div className="text-[11px] text-neutral-400 mb-2 font-bold">الحصة المراد إرسالها</div>

            {MOCK_HOLDINGS.length === 0 ? (
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5 text-center">
                <div className="text-3xl mb-2 opacity-40">📦</div>
                <div className="text-xs text-neutral-500">لا توجد حصص في محفظتك</div>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowHoldingDropdown(!showHoldingDropdown)}
                  className={cn(
                    "w-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.07] flex items-center justify-between px-4 py-3 text-right transition-colors",
                    showHoldingDropdown ? "rounded-t-xl border-b-0" : "rounded-xl"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl flex-shrink-0">
                      {selectedHolding ? sectorIcon(selectedHolding.project.sector) : "💼"}
                    </span>
                    <div className="text-right min-w-0">
                      <div className="text-sm font-bold text-white truncate">
                        {selectedHolding ? selectedHolding.project.name : "اختر الحصة..."}
                      </div>
                      {selectedHolding && (
                        <div className="text-[10px] text-neutral-500 mt-0.5">
                          متاح: <span className="font-mono text-yellow-400">{selectedHolding.shares_owned}</span> حصة
                          <span className="mr-2">· <span className="font-mono">{selectedHolding.project.share_price.toLocaleString("en-US")}</span> د.ع/حصة</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronDown
                    className={cn("w-4 h-4 text-neutral-400 transition-transform flex-shrink-0", showHoldingDropdown && "rotate-180")}
                    strokeWidth={1.5}
                  />
                </button>

                {showHoldingDropdown && (
                  <div className="absolute top-full left-0 right-0 z-30 bg-[#0a0a0a] border border-white/[0.08] border-t-white/[0.04] rounded-b-xl overflow-hidden shadow-2xl">
                    {MOCK_HOLDINGS.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => {
                          setSelectedHolding(h)
                          setShowHoldingDropdown(false)
                          setQty("")
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-right border-b border-white/[0.02] last:border-0"
                      >
                        <span className="text-xl flex-shrink-0">{sectorIcon(h.project.sector)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-white truncate">{h.project.name}</div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">
                            متاح: <span className="font-mono text-yellow-400">{h.shares_owned}</span> حصة
                          </div>
                        </div>
                        {selectedHolding?.id === h.id && (
                          <Check className="w-4 h-4 text-green-400 flex-shrink-0" strokeWidth={3} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* القسم 3: الكمية */}
          {selectedHolding && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] text-neutral-400 font-bold">عدد الحصص</div>
                <button
                  onClick={() => setQty(String(selectedHolding.shares_owned))}
                  className="text-[10px] text-blue-400 hover:text-blue-300"
                >
                  الكل ({selectedHolding.shares_owned})
                </button>
              </div>
              <input
                type="number"
                value={qty}
                onChange={(e) => handleQtyChange(e.target.value)}
                placeholder="0"
                min="1"
                max={selectedHolding.shares_owned}
                className={cn(
                  "w-full bg-white/[0.05] border rounded-xl px-4 py-3 text-base font-bold text-white outline-none text-center font-mono transition-colors",
                  qtyError
                    ? "border-red-500/60 focus:border-red-500 bg-red-500/[0.04]"
                    : "border-white/[0.08] focus:border-white/20"
                )}
                dir="ltr"
              />
              {qtyError ? (
                <div className="flex items-start gap-1 mt-1.5 text-[10px] text-red-400">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" strokeWidth={2} />
                  <span className="leading-tight">{qtyError}</span>
                </div>
              ) : qtyNum > 0 ? (
                <div className="text-[10px] text-neutral-500 mt-1.5 flex items-center justify-between">
                  <span>سيستلم المستلم كاملاً: <span className="text-green-400 font-mono font-bold">{qtyNum}</span> حصة</span>
                  <span>رسوم التحويل: <span className="text-yellow-400 font-mono">{transferFee.toLocaleString("en-US")}</span> وحدة</span>
                </div>
              ) : null}
            </div>
          )}

          {/* القسم 4: ملاحظة */}
          <div className="mb-5">
            <div className="text-[11px] text-neutral-400 mb-2 font-bold flex items-center gap-1">
              ملاحظة
              <span className="text-[10px] text-neutral-600 font-normal">(اختياري)</span>
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: تحويل استثماري، شراكة..."
              maxLength={120}
              className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
            />
          </div>

          {/* تحذير الحد الشهري */}
          {exceedsMonthlyLimit && totalValue > 0 && (
            <div className="bg-red-500/[0.06] border border-red-500/25 rounded-xl p-3.5 mb-5 flex gap-3 items-start">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <div className="text-[11px] text-red-300 leading-relaxed">
                <div className="font-bold mb-1">العملية تتجاوز حدّك الشهري</div>
                قيمة العملية <span className="font-mono font-bold">{fmtLimit(totalValue)}</span> د.ع تتخطى المتبقي <span className="font-mono font-bold">{fmtLimit(monthlyRemaining)}</span> د.ع.
              </div>
            </div>
          )}

          {/* ملخص العملية */}
          {qtyNum > 0 && selectedHolding && !qtyError && (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 mb-5 backdrop-blur">
              <div className="text-xs font-bold text-white mb-3">ملخص العملية</div>
              <div className="space-y-2">
                {[
                  { label: "المستلم", value: recipientUser?.name || "—", color: "white" },
                  { label: "المشروع", value: selectedHolding.project.name, color: "white" },
                  { label: "الحصص المُرسَلة", value: qtyNum + " حصة", color: "white" },
                  { label: "يستلم المستلم", value: qtyNum + " حصة (كاملاً)", color: "green" },
                  { label: "رصيدك بعد الإرسال", value: (selectedHolding.shares_owned - qtyNum) + " حصة", color: "white" },
                  { label: "رسوم التحويل", value: transferFee.toLocaleString("en-US") + " وحدة", color: "yellow" },
                  { label: "رصيد وحدات الرسوم بعد الخصم", value: (CURRENT_FEE_BALANCE - transferFee).toLocaleString("en-US") + " وحدة", color: "yellow" },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 border-b border-white/[0.04] last:border-0">
                    <span className="text-[11px] text-neutral-500">{row.label}</span>
                    <span
                      className={cn(
                        "text-xs font-bold",
                        row.color === "red" ? "text-red-400" :
                        row.color === "green" ? "text-green-400" :
                        row.color === "yellow" ? "text-yellow-400" : "text-white"
                      )}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* أزرار */}
          <div className="flex gap-2.5">
            <button
              onClick={() => router.push("/wallet")}
              className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-3.5 rounded-xl text-sm hover:bg-white/[0.08] transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleOpenConfirm}
              disabled={
                !recipientUser ||
                !selectedHolding ||
                qtyNum < 1 ||
                !!qtyError ||
                !hasEnoughBalance ||
                !hasEnoughFeeBalance ||
                exceedsMonthlyLimit
              }
              className={cn(
                "flex-[2] py-3.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                recipientUser && selectedHolding && qtyNum >= 1 && !qtyError && hasEnoughBalance && hasEnoughFeeBalance && !exceedsMonthlyLimit
                  ? "bg-neutral-100 text-black hover:bg-neutral-200"
                  : "bg-white/[0.05] text-neutral-600 cursor-not-allowed"
              )}
            >
              <Send className="w-4 h-4" strokeWidth={2} />
              مراجعة وإرسال
            </button>
          </div>

        </div>
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setShowScanner(false)}
        >
          <div
            className="bg-[#0a0a0a] border-t border-white/[0.1] sm:border sm:rounded-2xl rounded-t-3xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-base font-bold text-white">مسح باركود المحفظة</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">صوّب الكاميرا على الباركود</div>
              </div>
              <button onClick={() => setShowScanner(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* مكان الكاميرا (placeholder) */}
            <div className="bg-black border border-white/[0.08] rounded-xl aspect-square flex items-center justify-center mb-4 relative overflow-hidden">
              <Camera className="w-12 h-12 text-neutral-700" strokeWidth={1} />
              <div className="absolute inset-8 border-2 border-white/30 rounded-2xl">
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-green-400 rounded-tr-2xl" />
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-green-400 rounded-tl-2xl" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-green-400 rounded-br-2xl" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-green-400 rounded-bl-2xl" />
              </div>
            </div>

            <div className="text-[11px] text-neutral-500 text-center mb-2">أو أدخل ID المحفظة يدوياً</div>
            <input
              value={scannerInput}
              onChange={(e) => setScannerInput(e.target.value)}
              placeholder="u_a8f9_3c2b"
              className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white outline-none font-mono mb-3 transition-colors"
              dir="ltr"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowScanner(false)}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={handleScannerSubmit}
                className="flex-[2] py-3 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200"
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirm && recipientUser && selectedHolding && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => !sending && setShowConfirm(false)}
        >
          <div
            className="bg-[#0a0a0a] border-t border-white/[0.1] sm:border sm:rounded-2xl rounded-t-3xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-blue-400/[0.12] border border-blue-400/30 flex items-center justify-center mx-auto mb-3">
                <Send className="w-6 h-6 text-blue-400" strokeWidth={1.5} />
              </div>
              <div className="text-base font-bold text-white">تأكيد الإرسال</div>
              <div className="text-[11px] text-neutral-500 mt-1">راجع التفاصيل قبل التنفيذ</div>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 mb-4 space-y-2.5">
              {[
                ["المستلم", recipientUser.name],
                ["ID المستلم", formatID(recipientUser.id)],
                ["المشروع", selectedHolding.project.name],
                ["الحصص المُرسَلة", qtyNum + " حصة"],
                ["يستلم المستلم", qtyNum + " حصة (كاملاً)"],
                ["رسوم التحويل (وحدات)", transferFee.toLocaleString("en-US") + " وحدة"],
                ["خصم من رصيد الرسوم", transferFee.toLocaleString("en-US") + " وحدة"],
                ...(note ? [["الملاحظة", note] as [string, string]] : []),
              ].map(([l, v], i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="text-[11px] text-neutral-500 flex-shrink-0">{l}</span>
                  <span className="text-xs font-bold text-white text-left">{v}</span>
                </div>
              ))}
            </div>

            <div className="bg-red-500/[0.04] border border-red-500/20 rounded-xl p-3 mb-4 flex gap-2 items-start">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <div className="text-[11px] text-red-300 leading-relaxed">
                <span className="font-bold">العملية نهائية</span> ولا يمكن التراجع عنها بعد التأكيد.
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={sending}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                رجوع
              </button>
              <button
                onClick={handleSubmit}
                disabled={sending}
                className={cn(
                  "flex-[2] py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  sending ? "bg-white/[0.05] text-neutral-600" : "bg-neutral-100 text-black hover:bg-neutral-200"
                )}
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" strokeWidth={3} />
                    تأكيد الإرسال
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
