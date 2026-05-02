/* RailOS — Push Notifications Service Worker
 * Scope: dedicated to Web Push only (does NOT cache app shell or
 * compete with any future PWA Service Worker).
 *
 * Payload contract (from /api/push/send):
 *   { title, message, action_url?, action_label?, priority?, type?, notification_id? }
 *
 * Date: 2026-05-02
 */

self.addEventListener("install", function (event) {
  // Activate immediately on update — don't wait for old SW to die.
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", function (event) {
  if (!event.data) return

  let data = {}
  try {
    data = event.data.json()
  } catch (e) {
    // Non-JSON payload — fall back to raw text
    data = { title: "RailOS", message: event.data.text() }
  }

  const title = data.title || "RailOS"
  const options = {
    body: data.message || data.body || "",
    icon: "/icon.png",
    badge: "/icon.png",
    vibrate: [200, 100, 200],
    dir: "rtl",
    lang: "ar",
    tag: data.tag || "railos-notification",
    renotify: true,
    data: {
      url: data.action_url || "/notifications",
      notificationId: data.notification_id || null,
    },
    actions: data.action_label
      ? [
          { action: "open", title: data.action_label },
          { action: "close", title: "إغلاق" },
        ]
      : [],
    requireInteraction: data.priority === "urgent",
    silent: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", function (event) {
  event.notification.close()

  if (event.action === "close") return

  const targetUrl = (event.notification.data && event.notification.data.url) || "/"

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        // If a tab on this origin is open, focus + navigate it.
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            if ("navigate" in client) {
              client.navigate(targetUrl)
            }
            return client.focus()
          }
        }
        // Otherwise, open a new window.
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      }),
  )
})

// Optional: react to subscription expiring/being rotated by browser.
self.addEventListener("pushsubscriptionchange", function (event) {
  // Browsers fire this when the subscription is invalidated. The new one
  // can be re-created here, but doing so requires the VAPID public key
  // which we don't ship into the SW. The client-side hook handles
  // re-subscription on next page load instead, so we just no-op here.
  event.waitUntil(Promise.resolve())
})
