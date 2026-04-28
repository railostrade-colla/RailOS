"use client"

import { useState, useEffect } from "react"
import { Download } from "lucide-react"
import { Modal } from "@/components/ui"

// Minimal type for the BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISSED_KEY = "pwa-prompt-dismissed"
const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const SHOW_DELAY_MS = 30_000 // 30 seconds

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    // Detect iOS
    const ua = navigator.userAgent
    const iOS = /iPad|iPhone|iPod/.test(ua) && !/Windows/.test(ua)
    setIsIOS(iOS)

    // Skip if already installed
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return

    // Skip if recently dismissed
    const dismissedAt = localStorage.getItem(DISMISSED_KEY)
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < DISMISS_WINDOW_MS) return

    let delayTimer: ReturnType<typeof setTimeout> | null = null

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      delayTimer = setTimeout(() => setShowPrompt(true), SHOW_DELAY_MS)
    }

    window.addEventListener("beforeinstallprompt", handler)

    // iOS doesn't support beforeinstallprompt — show manual prompt
    if (iOS) {
      delayTimer = setTimeout(() => setShowPrompt(true), SHOW_DELAY_MS)
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      if (delayTimer) clearTimeout(delayTimer)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === "accepted") setDeferredPrompt(null)
    }
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISSED_KEY, Date.now().toString())
    }
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  return (
    <Modal
      isOpen={showPrompt}
      onClose={handleDismiss}
      title="📱 ثبّت تطبيق رايلوس"
      size="sm"
    >
      <div className="space-y-4">
        <div className="text-5xl text-center mb-2">📲</div>

        <p className="text-sm text-neutral-300 text-center leading-relaxed">
          ثبّت التطبيق على جهازك للحصول على أفضل تجربة استخدام
        </p>

        <div className="space-y-2 bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-neutral-300">
            <span className="text-green-400">✓</span>
            <span>وصول سريع من الشاشة الرئيسية</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-300">
            <span className="text-green-400">✓</span>
            <span>إشعارات فورية</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-300">
            <span className="text-green-400">✓</span>
            <span>يعمل بدون إنترنت أحياناً</span>
          </div>
        </div>

        {isIOS ? (
          <div className="bg-blue-400/[0.06] border border-blue-400/25 rounded-xl p-4">
            <p className="text-xs text-white mb-2 font-bold">للتثبيت على iOS:</p>
            <ol className="text-[11px] text-neutral-300 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>اضغط زر المشاركة (مربع مع سهم)</li>
              <li>اختر &quot;إضافة إلى الشاشة الرئيسية&quot;</li>
              <li>اضغط &quot;إضافة&quot;</li>
            </ol>
          </div>
        ) : (
          <button
            onClick={handleInstall}
            className="w-full bg-neutral-100 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors"
          >
            <Download className="w-4 h-4" strokeWidth={2.5} />
            تثبيت الآن
          </button>
        )}

        <button
          onClick={handleDismiss}
          className="w-full text-xs text-neutral-500 hover:text-neutral-300 py-2 transition-colors"
        >
          تذكيري لاحقاً
        </button>
      </div>
    </Modal>
  )
}
