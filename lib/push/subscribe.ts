"use client"

/**
 * Client-side Push subscription helpers.
 * — Registers the dedicated SW (`/sw-push.js`) without touching any
 *   future PWA service worker.
 * — Persists the subscription in `push_subscriptions` (Supabase).
 * — All functions are no-ops on unsupported environments (e.g. SSR
 *   or older browsers).
 */

import { createClient } from "@/lib/supabase/client"
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "./vapid"

const SW_URL = "/sw-push.js"
const SW_SCOPE = "/"

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

export function getPushPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied"
  return Notification.permission
}

export async function requestPushPermission(): Promise<boolean> {
  if (!isPushSupported()) return false
  const result = await Notification.requestPermission()
  return result === "granted"
}

/**
 * Detects mobile vs desktop vs tablet from UA — best-effort, used
 * only as metadata in the DB row (not for security decisions).
 */
function detectDeviceType(): "mobile" | "desktop" | "tablet" | "unknown" {
  if (typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent
  if (/iPad|Tablet/i.test(ua)) return "tablet"
  if (/Mobile|Android|iPhone/i.test(ua)) return "mobile"
  if (/Mozilla|Chrome|Safari|Firefox|Edge/i.test(ua)) return "desktop"
  return "unknown"
}

/**
 * Registers the SW, requests permission (if needed), creates a Push
 * subscription, and upserts it into `push_subscriptions`.
 * Returns `true` when the user is fully subscribed, `false` otherwise.
 */
export async function subscribeToPush(): Promise<boolean> {
  try {
    if (!isPushSupported()) return false
    if (!VAPID_PUBLIC_KEY) {
      // eslint-disable-next-line no-console
      console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing")
      return false
    }

    const registration = await navigator.serviceWorker.register(SW_URL, {
      scope: SW_SCOPE,
    })
    await navigator.serviceWorker.ready

    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast to BufferSource — TS 5 widened Uint8Array's buffer generic
        // (ArrayBuffer | SharedArrayBuffer); PushManager wants the strict form.
        applicationServerKey: urlBase64ToUint8Array(
          VAPID_PUBLIC_KEY,
        ) as unknown as BufferSource,
      })
    }

    const subJSON = subscription.toJSON() as {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
    }

    if (!subJSON.endpoint || !subJSON.keys?.p256dh || !subJSON.keys?.auth) {
      return false
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: subJSON.endpoint,
        p256dh_key: subJSON.keys.p256dh,
        auth_key: subJSON.keys.auth,
        user_agent: navigator.userAgent,
        device_type: detectDeviceType(),
        is_active: true,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    )

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[push] persisting subscription failed:", error.message)
      return false
    }

    return true
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[push] subscribe failed:", err)
    return false
  }
}

/**
 * Unsubscribes the current device from Push and marks the row inactive
 * in Supabase. Idempotent — safe to call without an active subscription.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    if (!isPushSupported()) return true
    const registration = await navigator.serviceWorker.getRegistration(SW_URL)
    if (!registration) return true

    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return true

    await subscription.unsubscribe()

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return true

    await supabase
      .from("push_subscriptions")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("endpoint", subscription.endpoint)

    return true
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[push] unsubscribe failed:", err)
    return false
  }
}
