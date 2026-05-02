"use client"

import { useEffect, useState } from "react"
import { Bell, X } from "lucide-react"
import { usePushNotifications } from "@/hooks/usePushNotifications"

const DISMISS_KEY = "push_prompt_dismissed_at"
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const APPEAR_DELAY_MS = 3000

/**
 * Shows once per session (after a 3s delay) inviting the user to opt
 * into Web Push. Suppressed for 7 days after a dismissal, and forever
 * after grant/denial — both are stored in localStorage.
 *
 * Renders nothing on:
 *   - SSR
 *   - browsers without Push support
 *   - users who already granted/denied permission
 *   - within 7 days of a previous dismissal
 */
export function PushPermissionPrompt() {
  const [open, setOpen] = useState(false)
  const { supported, permission, subscribe, loading } = usePushNotifications()

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!supported) return
    if (permission !== "default") return

    // Honor a recent dismissal.
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || "0")
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return

    const t = window.setTimeout(() => setOpen(true), APPEAR_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [supported, permission])

  if (!open) return null

  function handleDismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    }
    setOpen(false)
  }

  async function handleAccept() {
    const ok = await subscribe()
    if (ok) {
      setOpen(false)
    } else {
      // If user denied at OS level, hide the prompt and don't pester.
      handleDismiss()
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-x-4 bottom-4 md:inset-auto md:bottom-8 md:right-8 md:w-[400px] z-50
                   bg-[rgba(15,15,15,0.95)] backdrop-blur-2xl border border-white/[0.08]
                   rounded-2xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-label="فعّل الإشعارات"
      >
        <button
          onClick={handleDismiss}
          className="absolute top-3 left-3 p-1.5 rounded-lg hover:bg-white/[0.05] text-neutral-400 transition-colors"
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>

        <div className="p-6">
          <div className="w-14 h-14 rounded-full bg-blue-400/10 border border-blue-400/30 flex items-center justify-center mb-4">
            <Bell className="w-7 h-7 text-blue-400" strokeWidth={1.75} />
          </div>

          <h3 className="text-lg font-bold text-white mb-2">فعّل الإشعارات</h3>

          <p className="text-sm text-neutral-400 leading-relaxed mb-5">
            اسمح لنا بإرسال إشعارات لتبقى على اطلاع بصفقاتك ومشاريعك حتى عند
            عدم استخدامك للتطبيق.
          </p>

          <ul className="space-y-2 mb-5">
            {[
              "صفقات جديدة وتحديثاتها",
              "نتائج المزادات",
              "قرارات مجلس السوق",
              "يمكنك إيقافها متى شئت من الإعدادات",
            ].map((line) => (
              <li
                key={line}
                className="flex items-center gap-2 text-xs text-neutral-400"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                {line}
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black font-bold text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "جاري التفعيل..." : "فعّل الإشعارات"}
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2.5 bg-white/[0.05] border border-white/[0.1] text-white text-sm rounded-lg hover:bg-white/[0.08] transition-colors"
            >
              لاحقاً
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
