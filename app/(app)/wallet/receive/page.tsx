"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, Download, Share2, Check, ShieldCheck, Clock, ArrowDownToLine, Link2 } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess, showError } from "@/lib/utils/toast"
// Phase 4.3: user info is real (from Supabase). Recent senders + receive
// stats stay mock — they need a `share_transfers` table that doesn't
// exist yet (Phase 4.X).
import { RECENT_SENDERS } from "@/lib/mock-data"
import { getCurrentWalletInfo, type WalletUserInfo } from "@/lib/data/wallet"
import { cn } from "@/lib/utils/cn"

// TODO Phase 4.X — derive from a real share_transfers table.
const RECEIVE_STATS = {
  total_received: 0,
  last_received: "—",
  total_senders: 0,
}

/**
 * Format a UUID into a human-readable wallet ID:
 *   "8ee1e529-03ae-4a89-..."  →  "RX-8EE1-E529"
 *
 * The QR encodes the FULL UUID (so scanners get the full identifier);
 * this short form is just for the on-screen label and copy button.
 */
const formatID = (id: string): string => {
  if (!id) return "RX-—"
  const cleaned = id.replace(/-/g, "").toUpperCase().slice(0, 8)
  if (cleaned.length < 8) return "RX-" + cleaned
  return "RX-" + cleaned.slice(0, 4) + "-" + cleaned.slice(4, 8)
}

export default function ReceivePage() {
  const router = useRouter()
  const [copiedID, setCopiedID] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Real user info from Supabase (Phase 4.3)
  const [user, setUser] = useState<WalletUserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getCurrentWalletInfo().then((u) => {
      if (cancelled) return
      setUser(u)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const userId = user?.id ?? ""
  const userName = user?.full_name || user?.username || "مستخدم"
  const userVerified = user?.is_verified ?? false

  const formattedID = formatID(userId)
  const inviteLink = userId
    ? "https://railos.app/send?to=" + userId
    : "https://railos.app/send"
  const qrUrl = userId
    ? "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" + encodeURIComponent(userId) + "&bgcolor=0a0a0a&color=ffffff&qzone=2&format=png"
    : ""

  const handleCopyID = async () => {
    if (!userId) return
    try {
      await navigator.clipboard.writeText(userId)
      setCopiedID(true)
      showSuccess("تم نسخ الـ ID")
      setTimeout(() => setCopiedID(false), 2000)
    } catch {
      showError("تعذر النسخ")
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopiedLink(true)
      showSuccess("تم نسخ رابط الدعوة")
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      showError("تعذر النسخ")
    }
  }

  const handleDownload = async () => {
    if (!qrUrl) return
    setDownloading(true)
    try {
      const response = await fetch(qrUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "railos-qr-" + userId.slice(0, 8) + ".png"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showSuccess("تم حفظ الباركود ✓")
    } catch {
      showError("تعذّر تحميل الباركود")
    }
    setDownloading(false)
  }

  const handleShare = async () => {
    const shareData = {
      title: "باركود استلام الحصص — رايلوس",
      text: userName + "\nID المحفظة: " + formattedID + "\n\nاستخدم هذا الرابط لإرسال الحصص:\n" + inviteLink,
      url: inviteLink,
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {}
    } else {
      handleCopyLink()
    }
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-2xl mx-auto pb-20">

          <PageHeader
            title="استلام الحصص"
            subtitle="شارك باركودك أو رابطك مع المُرسل"
            backHref="/wallet"
          />

          {/* تنبيه آمان */}
          <div className="bg-green-400/[0.06] border border-green-400/20 rounded-xl p-3.5 mb-5 flex gap-3 items-start">
            <ShieldCheck className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
            <div className="text-[11px] text-green-300 leading-relaxed">
              <span className="font-bold">آمن للمشاركة:</span> الباركود يحتوي فقط على ID محفظتك ولا يكشف أي معلومات شخصية حساسة.
            </div>
          </div>

          {/* بطاقة QR الرئيسية */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-6 mb-4 backdrop-blur">

            {/* اسم المستخدم */}
            <div className="text-center mb-5">
              <div className="flex items-center justify-center gap-2 mb-2">
                {loading ? (
                  <span className="inline-block h-5 w-32 bg-white/[0.08] rounded animate-pulse" />
                ) : (
                  <>
                    <div className="text-lg font-bold text-white">{userName}</div>
                    {userVerified && (
                      <div className="bg-green-400/[0.15] border border-green-400/30 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" strokeWidth={3} />
                        موثق
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ID box */}
              <button
                onClick={handleCopyID}
                className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] rounded-lg px-3 py-1.5 transition-colors"
              >
                <span className="text-xs font-mono text-white tracking-wider">{formattedID}</span>
                {copiedID ? (
                  <Check className="w-3.5 h-3.5 text-green-400" strokeWidth={2.5} />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-neutral-400" strokeWidth={1.5} />
                )}
              </button>
            </div>

            {/* QR Code */}
            <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-5 flex items-center justify-center mb-4">
              {qrUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrUrl}
                  alt="QR Code"
                  className="w-full max-w-[280px] aspect-square rounded-lg"
                />
              ) : (
                <div className="w-full max-w-[280px] aspect-square rounded-lg bg-white/[0.04] animate-pulse" />
              )}
            </div>

            {/* نوع الاستلام */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 flex items-center justify-between mb-3">
              <span className="text-[11px] text-neutral-500">نوع الاستلام</span>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ArrowDownToLine className="w-3 h-3 text-green-400" strokeWidth={2} />
                حصص استثمارية
              </span>
            </div>

            {/* أزرار الإجراء */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex flex-col items-center gap-1.5 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] rounded-xl py-3 disabled:opacity-50 transition-colors"
              >
                {downloading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-white" strokeWidth={1.5} />
                )}
                <span className="text-[11px] text-white font-bold">تحميل</span>
              </button>
              <button
                onClick={handleCopyLink}
                className="flex flex-col items-center gap-1.5 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] rounded-xl py-3 transition-colors"
              >
                {copiedLink ? (
                  <Check className="w-4 h-4 text-green-400" strokeWidth={2.5} />
                ) : (
                  <Link2 className="w-4 h-4 text-white" strokeWidth={1.5} />
                )}
                <span className="text-[11px] text-white font-bold">نسخ الرابط</span>
              </button>
              <button
                onClick={handleShare}
                className="flex flex-col items-center gap-1.5 bg-neutral-100 text-black rounded-xl py-3 hover:bg-neutral-200 transition-colors"
              >
                <Share2 className="w-4 h-4" strokeWidth={1.5} />
                <span className="text-[11px] font-bold">مشاركة</span>
              </button>
            </div>
          </div>

          {/* إحصائيات الاستلامات */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3">
              <div className="text-[10px] text-neutral-500 mb-1">الاستلامات</div>
              <div className="text-base font-bold text-white font-mono">{RECEIVE_STATS.total_received}</div>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3">
              <div className="text-[10px] text-neutral-500 mb-1">المُرسلين</div>
              <div className="text-base font-bold text-white font-mono">{RECEIVE_STATS.total_senders}</div>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3">
              <div className="text-[10px] text-neutral-500 mb-1">آخر استلام</div>
              <div className="text-xs font-bold text-white">{RECEIVE_STATS.last_received}</div>
            </div>
          </div>

          {/* آخر المُرسلين */}
          {RECENT_SENDERS.length > 0 && (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 mb-5">
              <div className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neutral-400" strokeWidth={2} />
                آخر من أرسلوا لك
              </div>
              <div className="space-y-2">
                {RECENT_SENDERS.map((s, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border border-white/10 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
                        {s.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-white truncate">{s.name}</span>
                          {s.verified && <Check className="w-2.5 h-2.5 text-green-400" strokeWidth={3} />}
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-0.5 truncate">
                          <span className="font-mono text-yellow-400">{s.shares}</span> حصة · {s.project}
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-neutral-600 flex-shrink-0 mr-2">{s.date}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* تعليمات الاستخدام */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
            <div className="text-xs font-bold text-white mb-3">📌 كيفية الاستخدام</div>
            <div className="space-y-2.5">
              {[
                "شارك الباركود أو ID المحفظة (RX-A8F9-3C2B) مع المُرسل",
                "يقوم المُرسل بإدخال ID محفظتك أو مسح الباركود",
                "تأكيد الاستلام وظهور الحصص في محفظتك تلقائياً",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <span className="text-[11px] text-neutral-300 leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
