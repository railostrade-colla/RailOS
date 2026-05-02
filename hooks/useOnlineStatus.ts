"use client"

import { useEffect, useState } from "react"

/**
 * useOnlineStatus — يتابع حالة الاتصال بالإنترنت في الـ browser.
 *
 * يستخدم events `online` و `offline` المدعومة من المتصفّح.
 *
 * @returns
 *   - isOnline: boolean — حالة الاتصال الحالية
 *   - lastOnline: Date | null — آخر مرّة كان فيها متّصلاً
 *   - lastOffline: Date | null — آخر مرّة فُقد فيها الاتصال
 *
 * @example
 *   const { isOnline } = useOnlineStatus()
 *   if (!isOnline) return <OfflineBanner />
 */
export function useOnlineStatus() {
  // Default true — لتجنّب hydration mismatch في SSR
  const [isOnline, setIsOnline] = useState(true)
  const [lastOnline, setLastOnline] = useState<Date | null>(null)
  const [lastOffline, setLastOffline] = useState<Date | null>(null)

  useEffect(() => {
    // عند الـ mount، اقرأ الحالة الفعلية
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine)
    }

    const handleOnline = () => {
      setIsOnline(true)
      setLastOnline(new Date())
    }

    const handleOffline = () => {
      setIsOnline(false)
      setLastOffline(new Date())
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return { isOnline, lastOnline, lastOffline }
}

/**
 * withOfflineGuard — يحرس الدوال التي تتطلّب اتصال.
 *
 * يطلق Error إذا لم يكن المستخدم متّصلاً.
 *
 * @example
 *   const submitDeal = withOfflineGuard(async (data) => {
 *     return supabase.from('deals').insert(data)
 *   })
 *   // يُرمى خطأ "OFFLINE_MODE..." إذا أوفلاين
 */
export function withOfflineGuard<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  return ((...args: TArgs): TReturn => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("OFFLINE_MODE: لا يمكن إجراء هذه العملية بدون اتصال")
    }
    return fn(...args)
  }) as (...args: TArgs) => TReturn
}

/** يفحص الحالة الحالية للاتصال (synchronous helper). */
export function isCurrentlyOnline(): boolean {
  if (typeof navigator === "undefined") return true
  return navigator.onLine
}
