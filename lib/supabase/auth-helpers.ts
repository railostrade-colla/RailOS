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
