"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Bell, BellOff, Moon } from "lucide-react"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import {
  getPreferences,
  updatePreferences,
  type NotificationPreferences,
} from "@/lib/data/notification-preferences"
import { cn } from "@/lib/utils/cn"

/** Per-category toggles; label/desc resolve via i18n keys. */
const NOTIFICATION_TYPES: ReadonlyArray<{
  key: keyof NotificationPreferences
  labelKey: string
  descKey: string
}> = [
  { key: "deals_enabled",     labelKey: "typeDeals",     descKey: "typeDealsDesc" },
  { key: "projects_enabled",  labelKey: "typeProjects",  descKey: "typeProjectsDesc" },
  { key: "kyc_enabled",       labelKey: "typeKyc",       descKey: "typeKycDesc" },
  { key: "level_enabled",     labelKey: "typeLevel",     descKey: "typeLevelDesc" },
  { key: "auctions_enabled",  labelKey: "typeAuctions",  descKey: "typeAuctionsDesc" },
  { key: "council_enabled",   labelKey: "typeCouncil",   descKey: "typeCouncilDesc" },
  { key: "support_enabled",   labelKey: "typeSupport",   descKey: "typeSupportDesc" },
  { key: "disputes_enabled",  labelKey: "typeDisputes",  descKey: "typeDisputesDesc" },
  { key: "system_enabled",    labelKey: "typeSystem",    descKey: "typeSystemDesc" },
]

interface ToggleProps {
  on: boolean
  onChange: () => void
  disabled?: boolean
}

function Toggle({ on, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      className={cn(
        "relative w-10 h-5 rounded-full transition-colors flex-shrink-0",
        on ? "bg-green-400" : "bg-white/[0.1]",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
          on ? "right-0.5" : "right-[18px]",
        )}
      />
    </button>
  )
}

export function NotificationSettings() {
  const t = useTranslations("notifyUI")
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { supported, permission, subscribed, subscribe, unsubscribe, loading: pushBusy } =
    usePushNotifications()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const data = await getPreferences()
      if (cancelled) return
      setPrefs(data)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function toggle(key: keyof NotificationPreferences) {
    if (!prefs) return
    const current = prefs[key]
    if (typeof current !== "boolean") return

    setSaving(true)
    const next = !current
    setPrefs({ ...prefs, [key]: next } as NotificationPreferences)
    await updatePreferences({ [key]: next } as Partial<NotificationPreferences>)
    setSaving(false)
  }

  async function handlePushToggle() {
    if (subscribed) {
      await unsubscribe()
    } else {
      await subscribe()
    }
  }

  if (loading || !prefs) {
    return (
      <div className="p-6 text-center text-sm text-neutral-400">
        {t("loading")}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ─── Push (browser-level) ─────────────────────────── */}
      <section className="bg-white/[0.05] border border-white/[0.06] rounded-2xl p-5">
        <h2 className="text-base font-bold text-white mb-3">{t("externalNotifs")}</h2>

        {!supported && (
          <div className="p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-xl text-xs text-yellow-400 mb-3">
            {t("browserUnsupported")}
          </div>
        )}

        {supported && permission === "denied" && (
          <div className="p-3 bg-red-400/10 border border-red-400/20 rounded-xl text-xs text-red-400 mb-3">
            {t("blocked")}
          </div>
        )}

        {supported && permission !== "denied" && (
          <div className="flex items-center justify-between gap-3 p-3 bg-black/40 rounded-xl">
            <div className="flex items-center gap-3 min-w-0">
              {subscribed ? (
                <Bell className="w-5 h-5 text-green-400 flex-shrink-0" strokeWidth={1.75} />
              ) : (
                <BellOff className="w-5 h-5 text-neutral-400 flex-shrink-0" strokeWidth={1.75} />
              )}
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">
                  {t("evenWhenClosed")}
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  {subscribed ? t("enabledCheck") : t("notEnabled")}
                </div>
              </div>
            </div>
            <Toggle on={subscribed} onChange={handlePushToggle} disabled={pushBusy} />
          </div>
        )}
      </section>

      {/* ─── Master push/email ───────────────────────────── */}
      <section className="bg-white/[0.05] border border-white/[0.06] rounded-2xl p-5">
        <h2 className="text-base font-bold text-white mb-3">{t("channels")}</h2>
        <div className="space-y-1">
          <div className="flex items-center justify-between p-3 hover:bg-white/[0.02] rounded-xl">
            <div className="min-w-0">
              <div className="text-sm font-bold text-white">{t("webPush")}</div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                {t("requiresPermissionAbove")}
              </div>
            </div>
            <Toggle
              on={prefs.push_enabled}
              onChange={() => toggle("push_enabled")}
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between p-3 hover:bg-white/[0.02] rounded-xl">
            <div className="min-w-0">
              <div className="text-sm font-bold text-white">{t("email")}</div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                {t("emailDesc")}
              </div>
            </div>
            <Toggle
              on={prefs.email_enabled}
              onChange={() => toggle("email_enabled")}
              disabled={saving}
            />
          </div>
        </div>
      </section>

      {/* ─── Per-category toggles ───────────────────────── */}
      <section className="bg-white/[0.05] border border-white/[0.06] rounded-2xl p-5">
        <h2 className="text-base font-bold text-white mb-3">{t("notifTypes")}</h2>
        <div className="space-y-1">
          {NOTIFICATION_TYPES.map((nt) => (
            <div
              key={String(nt.key)}
              className="flex items-center justify-between p-3 hover:bg-white/[0.02] rounded-xl"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">{t(nt.labelKey)}</div>
                <div className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                  {t(nt.descKey)}
                </div>
              </div>
              <Toggle
                on={Boolean(prefs[nt.key])}
                onChange={() => toggle(nt.key)}
                disabled={saving}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ─── Quiet hours ────────────────────────────────── */}
      <section className="bg-white/[0.05] border border-white/[0.06] rounded-2xl p-5">
        <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          <Moon className="w-5 h-5" strokeWidth={1.75} />
          {t("quietHours")}
        </h2>
        <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white">{t("disableAtNight")}</div>
            <div className="text-[11px] text-neutral-400 mt-0.5">
              {t("quietFromPre")}<span className="font-mono">{shortTime(prefs.quiet_hours_start)}</span>{" "}
              {t("quietToPre")}<span className="font-mono">{shortTime(prefs.quiet_hours_end)}</span>
            </div>
          </div>
          <Toggle
            on={prefs.quiet_hours_enabled}
            onChange={() => toggle("quiet_hours_enabled")}
            disabled={saving}
          />
        </div>
      </section>

      {/* ─── Sound + vibration ──────────────────────────── */}
      <section className="bg-white/[0.05] border border-white/[0.06] rounded-2xl p-5">
        <h2 className="text-base font-bold text-white mb-3">{t("soundVibration")}</h2>
        <div className="space-y-1">
          <div className="flex items-center justify-between p-3 hover:bg-white/[0.02] rounded-xl">
            <div className="text-sm font-bold text-white">{t("sound")}</div>
            <Toggle
              on={prefs.sound_enabled}
              onChange={() => toggle("sound_enabled")}
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between p-3 hover:bg-white/[0.02] rounded-xl">
            <div className="text-sm font-bold text-white">{t("vibration")}</div>
            <Toggle
              on={prefs.vibration_enabled}
              onChange={() => toggle("vibration_enabled")}
              disabled={saving}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

/** Trim 'HH:MM:SS' → 'HH:MM' for display. */
function shortTime(t: string): string {
  if (!t) return ""
  return t.slice(0, 5)
}
