"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff, Moon } from "lucide-react"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import {
  getPreferences,
  updatePreferences,
  type NotificationPreferences,
} from "@/lib/data/notification-preferences"
import { cn } from "@/lib/utils/cn"

/** Per-category toggles with Arabic labels + descriptions. */
const NOTIFICATION_TYPES: ReadonlyArray<{
  key: keyof NotificationPreferences
  label: string
  desc: string
}> = [
  { key: "deals_enabled",     label: "الصفقات",                desc: "إنشاء، إكمال، إلغاء الصفقات" },
  { key: "projects_enabled",  label: "المشاريع",               desc: "موافقة أو رفض المشاريع" },
  { key: "kyc_enabled",       label: "التحقق من الهوية (KYC)", desc: "حالة التحقق" },
  { key: "level_enabled",     label: "المستوى",                desc: "ترقية المستوى الاستثماري" },
  { key: "auctions_enabled",  label: "المزادات",               desc: "الفوز والمزايدات الجديدة" },
  { key: "council_enabled",   label: "مجلس السوق",             desc: "إعلانات وقرارات المجلس" },
  { key: "support_enabled",   label: "الدعم الفني",             desc: "الردود على تذاكرك" },
  { key: "disputes_enabled",  label: "النزاعات",               desc: "فتح وحل النزاعات" },
  { key: "system_enabled",    label: "النظام",                 desc: "تحديثات وإعلانات النظام" },
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
        جاري التحميل...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ─── Push (browser-level) ─────────────────────────── */}
      <section className="bg-white/[0.05] border border-white/[0.06] rounded-2xl p-5">
        <h2 className="text-base font-bold text-white mb-3">الإشعارات الخارجية</h2>

        {!supported && (
          <div className="p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-xl text-xs text-yellow-400 mb-3">
            ⚠ متصفحك لا يدعم الإشعارات الخارجية
          </div>
        )}

        {supported && permission === "denied" && (
          <div className="p-3 bg-red-400/10 border border-red-400/20 rounded-xl text-xs text-red-400 mb-3">
            ❌ تم حظر الإشعارات. فعّلها من إعدادات المتصفح ثم عُد إلى هنا.
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
                  إشعارات حتى عند إغلاق التطبيق
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  {subscribed ? "مفعّل ✓" : "غير مفعّل"}
                </div>
              </div>
            </div>
            <Toggle on={subscribed} onChange={handlePushToggle} disabled={pushBusy} />
          </div>
        )}
      </section>

      {/* ─── Master push/email ───────────────────────────── */}
      <section className="bg-white/[0.05] border border-white/[0.06] rounded-2xl p-5">
        <h2 className="text-base font-bold text-white mb-3">القنوات</h2>
        <div className="space-y-1">
          <div className="flex items-center justify-between p-3 hover:bg-white/[0.02] rounded-xl">
            <div className="min-w-0">
              <div className="text-sm font-bold text-white">دفعات Web</div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                يتطلّب تفعيل الإذن أعلاه
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
              <div className="text-sm font-bold text-white">البريد الإلكتروني</div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                ملخّص يومي وتنبيهات مهمّة
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
        <h2 className="text-base font-bold text-white mb-3">أنواع الإشعارات</h2>
        <div className="space-y-1">
          {NOTIFICATION_TYPES.map((t) => (
            <div
              key={String(t.key)}
              className="flex items-center justify-between p-3 hover:bg-white/[0.02] rounded-xl"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">{t.label}</div>
                <div className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                  {t.desc}
                </div>
              </div>
              <Toggle
                on={Boolean(prefs[t.key])}
                onChange={() => toggle(t.key)}
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
          ساعات الهدوء
        </h2>
        <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white">إيقاف الإشعارات ليلاً</div>
            <div className="text-[11px] text-neutral-400 mt-0.5">
              من <span className="font-mono">{shortTime(prefs.quiet_hours_start)}</span>{" "}
              إلى <span className="font-mono">{shortTime(prefs.quiet_hours_end)}</span>
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
        <h2 className="text-base font-bold text-white mb-3">الصوت والاهتزاز</h2>
        <div className="space-y-1">
          <div className="flex items-center justify-between p-3 hover:bg-white/[0.02] rounded-xl">
            <div className="text-sm font-bold text-white">الصوت</div>
            <Toggle
              on={prefs.sound_enabled}
              onChange={() => toggle("sound_enabled")}
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between p-3 hover:bg-white/[0.02] rounded-xl">
            <div className="text-sm font-bold text-white">الاهتزاز</div>
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
