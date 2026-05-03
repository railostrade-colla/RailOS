import { createClient } from "./client"

/**
 * Supabase Auth helpers (client-side).
 * للاستخدام داخل "use client" components فقط.
 */

export async function signUpWithEmail(
  email: string,
  password: string,
  metadata?: { full_name?: string }
) {
  const supabase = createClient()
  return await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  })
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = createClient()
  return await supabase.auth.signInWithPassword({ email, password })
}

/**
 * Persist the ambassador referral code in a short-lived HttpOnly cookie
 * scoped to the OAuth callback path. The callback route reads + clears
 * it after exchanging the OAuth code for a session.
 *
 * We can't set HttpOnly cookies from the client; this helper sets a
 * non-HttpOnly cookie with restrictive SameSite + Secure flags, which
 * is acceptable for a non-secret transient hint. The actual binding
 * happens server-side via link_referral_by_code (RLS-enforced).
 */
function rememberReferralCode(refCode: string) {
  if (typeof document === "undefined") return
  const trimmed = refCode.trim()
  if (!trimmed) return
  // 5-minute lifetime, SameSite=Lax so it survives the Google redirect.
  const expires = new Date(Date.now() + 5 * 60 * 1000).toUTCString()
  const secure = typeof window !== "undefined" && window.location.protocol === "https:"
  document.cookie = `ref_code=${encodeURIComponent(trimmed)}; path=/; expires=${expires}; SameSite=Lax${secure ? "; Secure" : ""}`
}

/**
 * Kick off Google OAuth. Optionally remembers a referral code in a
 * cookie so the /api/auth/callback route can attach the user to the
 * referrer once the session lands.
 *
 * @param redirectPath  Where to land in the app after sign-in
 *                      (default: /dashboard).
 * @param refCode       Optional ambassador referral code to attach.
 */
export async function signInWithGoogle(
  redirectPath: string = "/dashboard",
  refCode?: string,
) {
  if (refCode) rememberReferralCode(refCode)

  const supabase = createClient()
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "")

  const next = encodeURIComponent(redirectPath || "/dashboard")
  const redirectTo = `${origin}/api/auth/callback?next=${next}`

  return await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      // Force account picker so users can switch Google accounts.
      queryParams: { prompt: "select_account" },
    },
  })
}

export async function signOut() {
  const supabase = createClient()
  return await supabase.auth.signOut()
}

export async function resetPasswordForEmail(email: string) {
  const supabase = createClient()
  return await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
}

export async function updatePassword(newPassword: string) {
  const supabase = createClient()
  return await supabase.auth.updateUser({ password: newPassword })
}

export async function getCurrentUser() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return { user, profile }
}
