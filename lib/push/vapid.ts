/**
 * VAPID public-key constants + helpers (client-side only).
 *
 * The public key is shipped to the browser; the private key stays
 * server-side and is only read by the /api/push/send route.
 *
 * Required env vars:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY   — exposed to client
 *   VAPID_PRIVATE_KEY              — server-only
 *   VAPID_SUBJECT                  — `mailto:` URL (web-push spec)
 *
 * Generate keys via: `npx web-push generate-vapid-keys`
 */

export const VAPID_PUBLIC_KEY: string =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""

/**
 * Convert a URL-safe base64 string (Web Push key format) to a Uint8Array
 * suitable for `pushManager.subscribe({ applicationServerKey })`.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")

  const raw =
    typeof window !== "undefined"
      ? window.atob(base64)
      : Buffer.from(base64, "base64").toString("binary")

  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
