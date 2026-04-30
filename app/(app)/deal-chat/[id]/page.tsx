"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Send, Image as ImageIcon, FileText, Check, X, AlertTriangle, Lock } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

type Role = "buyer" | "seller"
type DealStatus = "pending" | "accepted" | "paid" | "confirmed_payment" | "released" | "cancelled" | "expired"

const fmtIQD = (n: number) => n.toLocaleString("en-US")

// Mock deal — centralized
import { mockDeal, dealInitialMessages as initialMessages } from "@/lib/mock-data"

const myRole: Role = "buyer" // ← غيّرها لـ "seller" لاختبار العرض الآخر

function useCountdown(endsAt: string) {
  const [time, setTime] = useState(0)
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now()
      setTime(Math.max(0, Math.floor(diff / 1000)))
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [endsAt])
  const m = Math.floor(time / 60)
  const s = time % 60
  return { display: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, total: time }
}

export default function DealChatPage() {
  const router = useRouter()
  const params = useParams()
  const dealId = params?.id as string

  const [deal] = useState(mockDeal)
  const [messages, setMessages] = useState<any[]>(initialMessages)
  const [text, setText] = useState("")
  const [accepted, setAccepted] = useState(false)
  const [paymentProof, setPaymentProof] = useState("")
  const [confirmedPayment, setConfirmedPayment] = useState(false)
  const [released, setReleased] = useState(false)
  const [showLaws, setShowLaws] = useState(false)
  const [showConfirm, setShowConfirm] = useState<null | "pay" | "confirm_payment" | "release" | "cancel">(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { display: countdown, total: secondsLeft } = useCountdown(deal.expires_at)
  const isExpired = secondsLeft === 0
  const isUrgent = secondsLeft > 0 && secondsLeft < 180 // أقل من 3 دقائق

  const isBuyer = myRole === "buyer"
  const isSeller = myRole === "seller"

  const canBuyerPay = isBuyer && accepted && !paymentProof
  const canSellerConfirm = isSeller && paymentProof && !confirmedPayment
  const canSellerRelease = isSeller && confirmedPayment && !released
  const isDone = released
  const canCancel = !released && !isExpired

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMsg = () => {
    if (!text.trim()) return
    setMessages((p) => [
      ...p,
      { id: Date.now().toString(), sender: "me", type: "text", content: text, time: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" }) },
    ])
    setText("")
  }

  const acceptDeal = () => {
    setAccepted(true)
    setMessages((p) => [
      ...p,
      { id: Date.now().toString(), sender: "system", type: "system", content: "✅ قَبِل المشتري الصفقة. الآن خطوة الدفع.", time: "الآن" },
    ])
    showSuccess("تم القبول")
  }

  const sendPaymentProof = () => {
    setPaymentProof("payment_screenshot.jpg")
    setMessages((p) => [
      ...p,
      { id: Date.now().toString(), sender: "me", type: "payment_proof", content: "payment_screenshot.jpg", time: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" }) },
    ])
    showSuccess("تم إرسال إثبات الدفع")
    setShowConfirm(null)
  }

  const confirmPayment = () => {
    setConfirmedPayment(true)
    setMessages((p) => [
      ...p,
      { id: Date.now().toString(), sender: "system", type: "system", content: "✅ أكّد البائع استلام الدفع.", time: "الآن" },
    ])
    showSuccess("تم تأكيد استلام الدفع")
    setShowConfirm(null)
  }

  const releaseShares = () => {
    setReleased(true)
    setMessages((p) => [
      ...p,
      { id: Date.now().toString(), sender: "system", type: "system", content: "🚀 تم إطلاق الحصص للمشتري. الصفقة مكتملة!", time: "الآن" },
    ])
    showSuccess("تمت الصفقة بنجاح! 🎉")
    setShowConfirm(null)
    setTimeout(() => router.push("/orders"), 2000)
  }

  const cancelDeal = () => {
    setMessages((p) => [
      ...p,
      { id: Date.now().toString(), sender: "system", type: "system", content: "🚫 تم إلغاء الصفقة.", time: "الآن" },
    ])
    showError("تم إلغاء الصفقة")
    setShowConfirm(null)
    setTimeout(() => router.push("/orders"), 1500)
  }

  return (
    <AppLayout hideBottomNav hideFooter>
      <div className="relative min-h-screen flex flex-col">
        <GridBackground showCircles={false} />

        {/* Header */}
        <div className="sticky top-0 z-30 bg-black/85 backdrop-blur-xl border-b border-white/[0.08] px-4 py-3">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.back()}
              className="text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">{deal.project_name}</div>
              <div className="text-[10px] text-neutral-500">
                {deal.shares} حصة • {fmtIQD(deal.price_per_share)} د.ع/حصة
              </div>
            </div>
            <div className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold font-mono border",
              isExpired ? "bg-red-400/15 border-red-400/30 text-red-400" :
              isUrgent ? "bg-red-400/10 border-red-400/20 text-red-400" :
              "bg-green-400/10 border-green-400/20 text-green-400"
            )}>
              ⏱ {isExpired ? "انتهى" : countdown}
            </div>
          </div>

          {/* Total + قوانين */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-neutral-400">
              الإجمالي: <span className="text-white font-bold font-mono">{fmtIQD(deal.total)} د.ع</span>
            </span>
            <button
              onClick={() => setShowLaws(true)}
              className="bg-blue-400/[0.08] border border-blue-400/[0.16] text-blue-400 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1"
            >
              <FileText className="w-3 h-3" />
              القوانين
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {messages.map((m) => {
            if (m.type === "system") {
              return (
                <div key={m.id} className="text-center my-3">
                  <span className="bg-white/[0.05] border border-white/[0.08] text-neutral-400 px-3 py-1.5 rounded-full text-[11px] inline-block">
                    {m.content}
                  </span>
                </div>
              )
            }
            if (m.type === "payment_proof") {
              return (
                <div key={m.id} className={cn("flex", m.sender === "me" ? "justify-start" : "justify-end")}>
                  <div className="bg-yellow-400/[0.08] border border-yellow-400/30 rounded-2xl p-3 max-w-[75%]">
                    <div className="flex items-center gap-2 mb-2">
                      <ImageIcon className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs font-bold text-yellow-400">إثبات الدفع</span>
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 mb-2 flex items-center gap-2">
                      <ImageIcon className="w-12 h-12 text-neutral-400" strokeWidth={1.2} />
                      <span className="text-[11px] text-neutral-300 truncate">{m.content}</span>
                    </div>
                    <div className="text-[10px] text-neutral-500">{m.time}</div>
                  </div>
                </div>
              )
            }
            const isMe = m.sender === "me"
            return (
              <div key={m.id} className={cn("flex", isMe ? "justify-start" : "justify-end")}>
                <div className={cn(
                  "rounded-2xl px-3.5 py-2 max-w-[75%]",
                  isMe ? "bg-white text-black" : "bg-white/[0.06] border border-white/[0.08] text-white"
                )}>
                  <div className="text-sm leading-snug">{m.content}</div>
                  <div className={cn("text-[10px] mt-1", isMe ? "text-black/60" : "text-neutral-500")}>{m.time}</div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Status banner */}
        {!accepted && isBuyer && !isExpired && (
          <div className="px-4 py-2.5 bg-yellow-400/[0.06] border-t border-yellow-400/20">
            <div className="text-[11px] text-yellow-400 font-bold mb-2 text-center">
              تأكيد الموافقة على الصفقة
            </div>
            <button
              onClick={acceptDeal}
              className="w-full py-2.5 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200"
            >
              ✓ موافقة على شروط الصفقة
            </button>
          </div>
        )}

        {accepted && !paymentProof && isSeller && (
          <div className="px-4 py-2.5 bg-blue-400/[0.06] border-t border-blue-400/20 text-center">
            <span className="text-[11px] text-blue-400">⏳ في انتظار إرسال المشتري إثبات الدفع...</span>
          </div>
        )}

        {released && (
          <div className="px-4 py-2.5 bg-green-400/[0.08] border-t border-green-400/20 text-center">
            <span className="text-xs text-green-400 font-bold">✅ الصفقة مكتملة بنجاح</span>
          </div>
        )}

        {/* Action buttons */}
        {!isDone && !isExpired && (canBuyerPay || canSellerConfirm || isSeller || canCancel) && (
          <div className="px-4 py-2 flex gap-1.5 overflow-x-auto border-t border-white/[0.05]">
            {canBuyerPay && (
              <button
                onClick={() => setShowConfirm("pay")}
                className="flex-shrink-0 bg-yellow-400/[0.12] border border-yellow-400/[0.28] text-yellow-400 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap"
              >
                💳 الدفع وإرسال الإثبات
              </button>
            )}
            {canSellerConfirm && (
              <button
                onClick={() => setShowConfirm("confirm_payment")}
                className="flex-shrink-0 bg-green-400/[0.14] border border-green-400/[0.32] text-green-400 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap"
              >
                ✅ تأكيد استلام الدفع
              </button>
            )}
            {isSeller && !isDone && (
              <button
                onClick={() => canSellerRelease ? setShowConfirm("release") : showError("يجب تأكيد استلام الدفع أولاً")}
                className={cn(
                  "flex-shrink-0 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap border",
                  canSellerRelease
                    ? "bg-green-400/[0.14] border-green-400/[0.32] text-green-400"
                    : "bg-white/[0.04] border-white/[0.08] text-neutral-500"
                )}
              >
                🚀 إطلاق الحصص {!canSellerRelease && "🔒"}
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => setShowConfirm("cancel")}
                className="flex-shrink-0 bg-red-400/[0.07] border border-red-400/[0.18] text-red-400 rounded-full px-3 py-2 text-[11px] whitespace-nowrap"
              >
                🚫 إلغاء
              </button>
            )}
          </div>
        )}

        {/* Input */}
        {(accepted || isSeller) && !isDone && !isExpired && (
          <div className="px-4 py-3 border-t border-white/[0.08] flex gap-2 items-center bg-black/85 backdrop-blur-xl">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMsg()}
              placeholder="اكتب رسالة..."
              className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-full px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
            />
            <button
              onClick={sendMsg}
              disabled={!text.trim()}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                text.trim() ? "bg-neutral-100 text-black hover:bg-neutral-200" : "bg-white/[0.05] text-neutral-600 cursor-not-allowed"
              )}
            >
              <Send className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {/* Laws Modal */}
      {showLaws && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-5 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-blue-400" />
              <div className="text-base font-bold text-white">قوانين الصفقة</div>
            </div>
            <div className="space-y-2.5 mb-4">
              {[
                "تنفيذ الصفقة خلال 15 دقيقة من الفتح.",
                "المشتري يدفع ويرسل إثبات الدفع (صورة).",
                "البائع يؤكد الاستلام ثم يطلق الحصص.",
                "الإلغاء يُسجَّل ويؤثر على التقييم.",
                "أي نزاع يُرفع للدعم خلال 24 ساعة.",
              ].map((law, i) => (
                <div key={i} className="flex gap-2.5 items-start">
                  <span className="w-5 h-5 rounded-full bg-blue-400/10 border border-blue-400/20 flex items-center justify-center text-[10px] text-blue-400 font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-xs text-neutral-300 leading-relaxed">{law}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowLaws(false)}
              className="w-full py-3 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 transition-colors"
            >
              فهمت
            </button>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-5 w-full max-w-sm">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">
                {showConfirm === "pay" ? "💳" :
                 showConfirm === "confirm_payment" ? "✅" :
                 showConfirm === "release" ? "🚀" : "🚫"}
              </div>
              <div className="text-base font-bold text-white mb-1">
                {showConfirm === "pay" ? "تأكيد الدفع" :
                 showConfirm === "confirm_payment" ? "تأكيد استلام الدفع" :
                 showConfirm === "release" ? "إطلاق الحصص" : "إلغاء الصفقة"}
              </div>
              <div className="text-xs text-neutral-400 leading-relaxed">
                {showConfirm === "pay" ? "هل تأكدت من إرسال المبلغ وتجهيز إثبات الدفع؟" :
                 showConfirm === "confirm_payment" ? "هل استلمت المبلغ كاملاً وتأكدت من ذلك؟" :
                 showConfirm === "release" ? "ستنتقل الحصص للمشتري نهائياً، لا يمكن التراجع." :
                 "إلغاء الصفقة سيؤثر على تقييمك. هل أنت متأكد؟"}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  if (showConfirm === "pay") sendPaymentProof()
                  else if (showConfirm === "confirm_payment") confirmPayment()
                  else if (showConfirm === "release") releaseShares()
                  else cancelDeal()
                }}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold transition-colors",
                  showConfirm === "cancel"
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-neutral-100 text-black hover:bg-neutral-200"
                )}
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
