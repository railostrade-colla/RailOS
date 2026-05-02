"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  getPushPermission,
  isPushSupported,
  requestPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/subscribe"

const SW_URL = "/sw-push.js"

export function usePushNotifications() {
  const [supported, setSupported] = useState<boolean>(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [subscribed, setSubscribed] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    const supp = isPushSupported()
    if (!mountedRef.current) return
    setSupported(supp)

    if (!supp) {
      setPermission("denied")
      setSubscribed(false)
      return
    }

    const perm = getPushPermission()
    setPermission(perm)

    if (perm === "granted") {
      try {
        const reg = await navigator.serviceWorker.getRegistration(SW_URL)
        const sub = await reg?.pushManager.getSubscription()
        if (mountedRef.current) setSubscribed(!!sub)
      } catch {
        if (mountedRef.current) setSubscribed(false)
      }
    } else {
      setSubscribed(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    refresh()
    return () => {
      mountedRef.current = false
    }
  }, [refresh])

  const subscribe = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    try {
      const granted = await requestPushPermission()
      if (!granted) {
        setPermission("denied")
        return false
      }
      const ok = await subscribeToPush()
      if (ok) {
        setSubscribed(true)
        setPermission("granted")
      }
      return ok
    } finally {
      setLoading(false)
    }
  }, [])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    try {
      const ok = await unsubscribeFromPush()
      if (ok) setSubscribed(false)
      return ok
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    supported,
    permission,
    subscribed,
    loading,
    subscribe,
    unsubscribe,
    refresh,
  }
}
