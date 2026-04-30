/**
 * Biometric Authentication helpers (WebAuthn-based).
 *
 * في Dev/Mock mode: نحفظ flags في localStorage ونسمح للمتصفح بمحاولة WebAuthn.
 * في Production: استدعِ Supabase Edge Functions:
 *   - /generate-registration-options
 *   - /verify-registration
 *   - /generate-authentication-options
 *   - /verify-authentication
 */

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser"

// ──────────────────────────────────────────────────────────────────────────
// Capability check
// ──────────────────────────────────────────────────────────────────────────

export function isBiometricSupported(): boolean {
  if (typeof window === "undefined") return false
  return browserSupportsWebAuthn()
}

// ──────────────────────────────────────────────────────────────────────────
// LocalStorage keys
// ──────────────────────────────────────────────────────────────────────────

const enabledKey = (userId: string) => `biometric_enabled_${userId}`
const emailKey = (userId: string) => `biometric_email_${userId}`
const credentialKey = (userId: string) => `biometric_credential_${userId}`
const promptDismissedKey = "biometric_prompt_dismissed"

// ──────────────────────────────────────────────────────────────────────────
// Result type
// ──────────────────────────────────────────────────────────────────────────

export interface BiometricResult {
  success: boolean
  error?: string
  email?: string
  userId?: string
}

// ──────────────────────────────────────────────────────────────────────────
// Register biometric (called after first successful login)
// ──────────────────────────────────────────────────────────────────────────

export async function registerBiometric(userId: string, email: string): Promise<BiometricResult> {
  if (!isBiometricSupported()) {
    return { success: false, error: "متصفحك لا يدعم البصمة" }
  }

  try {
    // ─── Mock mode: استخدم challenge عشوائي محلياً ───
    // في production: GET /api/webauthn/register-options
    const userIdBytes = new TextEncoder().encode(userId)
    const challenge = crypto.getRandomValues(new Uint8Array(32))

    const optionsJSON = {
      challenge: btoa(String.fromCharCode(...challenge))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      rp: {
        name: "Railos",
        id: typeof window !== "undefined" ? window.location.hostname : "localhost",
      },
      user: {
        id: btoa(String.fromCharCode(...userIdBytes))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { alg: -7,   type: "public-key" as const },  // ES256
        { alg: -257, type: "public-key" as const },  // RS256
      ],
      timeout: 60_000,
      attestation: "none" as const,
      authenticatorSelection: {
        residentKey: "preferred" as const,
        userVerification: "preferred" as const,
        authenticatorAttachment: "platform" as const,
      },
    }

    const credential = await startRegistration({ optionsJSON })

    // ─── Persist locally (in production: POST credential → server) ───
    localStorage.setItem(enabledKey(userId), "true")
    localStorage.setItem(emailKey(userId), email)
    localStorage.setItem(credentialKey(userId), credential.id)

    return { success: true, email, userId }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "فشل تسجيل البصمة"
    if (msg.includes("NotAllowedError") || msg.includes("cancelled")) {
      return { success: false, error: "تم إلغاء التسجيل" }
    }
    return { success: false, error: msg }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Authenticate with biometric
// ──────────────────────────────────────────────────────────────────────────

export async function loginWithBiometric(): Promise<BiometricResult> {
  if (!isBiometricSupported()) {
    return { success: false, error: "متصفحك لا يدعم البصمة" }
  }

  // ابحث عن أي مستخدم مُفعَّل عنده bio
  const enabledKeyName = Object.keys(localStorage).find((k) =>
    k.startsWith("biometric_enabled_")
  )
  if (!enabledKeyName) {
    return { success: false, error: "لم يتم تفعيل البصمة على هذا الجهاز" }
  }

  const userId = enabledKeyName.replace("biometric_enabled_", "")
  const email = localStorage.getItem(emailKey(userId)) ?? ""
  const credentialId = localStorage.getItem(credentialKey(userId)) ?? ""

  try {
    // ─── Mock mode: challenge محلي ───
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const optionsJSON = {
      challenge: btoa(String.fromCharCode(...challenge))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      timeout: 60_000,
      rpId: typeof window !== "undefined" ? window.location.hostname : "localhost",
      userVerification: "preferred" as const,
      allowCredentials: credentialId
        ? [{ id: credentialId, type: "public-key" as const }]
        : [],
    }

    await startAuthentication({ optionsJSON })

    return { success: true, email, userId }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "فشل التحقّق"
    if (msg.includes("NotAllowedError") || msg.includes("cancelled")) {
      return { success: false, error: "تم إلغاء التحقّق" }
    }
    return { success: false, error: msg }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Status helpers
// ──────────────────────────────────────────────────────────────────────────

export function isBiometricEnabledForUser(userId: string): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(enabledKey(userId)) === "true"
}

export function hasAnyBiometricEnabled(): boolean {
  if (typeof window === "undefined") return false
  return Object.keys(localStorage).some((k) => k.startsWith("biometric_enabled_"))
}

export function disableBiometric(userId: string): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(enabledKey(userId))
  localStorage.removeItem(emailKey(userId))
  localStorage.removeItem(credentialKey(userId))
}

// ──────────────────────────────────────────────────────────────────────────
// Prompt dismissal (for "don't ask again")
// ──────────────────────────────────────────────────────────────────────────

export function isBiometricPromptDismissed(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(promptDismissedKey) === "true"
}

export function dismissBiometricPrompt(): void {
  if (typeof window === "undefined") return
  localStorage.setItem(promptDismissedKey, "true")
}

export function resetBiometricPrompt(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(promptDismissedKey)
}
