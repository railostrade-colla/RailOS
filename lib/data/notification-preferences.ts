import { createClient } from "@/lib/supabase/client"

/**
 * Per-user notification preferences. Mirrors the `notification_preferences`
 * table created by `supabase/migrations/20260502_add_notification_preferences.sql`.
 */
export interface NotificationPreferences {
  user_id: string

  push_enabled: boolean
  email_enabled: boolean

  deals_enabled: boolean
  projects_enabled: boolean
  kyc_enabled: boolean
  level_enabled: boolean
  auctions_enabled: boolean
  council_enabled: boolean
  support_enabled: boolean
  disputes_enabled: boolean
  system_enabled: boolean

  quiet_hours_enabled: boolean
  quiet_hours_start: string // 'HH:MM' or 'HH:MM:SS'
  quiet_hours_end: string

  sound_enabled: boolean
  vibration_enabled: boolean

  updated_at?: string
}

/**
 * Reads the current user's preferences. If no row exists yet (e.g. the
 * profile pre-dates the migration trigger), inserts a default one and
 * returns it.
 */
export async function getPreferences(): Promise<NotificationPreferences | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[prefs] fetch failed:", error.message)
    return null
  }

  if (data) return data as NotificationPreferences

  // Backfill — table trigger should have inserted, but in case of a
  // pre-migration profile, do it here too.
  const { data: created, error: insertErr } = await supabase
    .from("notification_preferences")
    .insert({ user_id: user.id })
    .select()
    .single()

  if (insertErr) {
    // eslint-disable-next-line no-console
    console.error("[prefs] insert default failed:", insertErr.message)
    return null
  }
  return created as NotificationPreferences
}

/** Patches the current user's preferences row. */
export async function updatePreferences(
  updates: Partial<Omit<NotificationPreferences, "user_id" | "updated_at">>,
): Promise<boolean> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from("notification_preferences")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[prefs] update failed:", error.message)
    return false
  }
  return true
}
