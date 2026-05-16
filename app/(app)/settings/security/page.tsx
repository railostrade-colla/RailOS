"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Fingerprint, AlertTriangle, ChevronLeft } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { Modal } from "@/components/ui"
import {
  SettingsSectionHeader,
  SettingsOptionCard,
  SettingsToggle,
} from "@/components/settings"
import { showSuccess, showError, showInfo } from "@/lib/utils/toast"
import {
  isBiometricSupported,
  isBiometricEnabledForUser,
  registerBiometric,
  disableBiometric,
  resetBiometricPrompt,
} from "@/lib/auth/biometric"
import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/data/profile"
import { cn } from "@/lib/utils/cn"

/**
 * Phase 14.13 Unified UI Part 2 — Security sub-page. The biometric
 * (WebAuthn) flow is relocated VERBATIM from the old tabbed settings
 * page (Phase 14.07d guard preserved: never register against a
 * phantom mock user). Danger-zone + delete modal also preserved.
 */
function ActionRow({
  label,
  description,
  onClick,
  variant = "default",
}: {
  label: string
  description?: string
  onClick: () => void
  variant?: "default" | "danger"
}) {
  return (
    <button
      onClick={onClick}
      className="no-shadow w-full flex items-center justify-between gap-3 py-2.5 hover:bg-white/[0.04] rounded-lg px-2 -mx-2 transition-colors text-right"
    >
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm font-medium", variant === "danger" ? "text-red-400" : "text-white")}>{label}</div>
        {description && <div className="text-[11px] text-neutral-500 mt-0.5">{description}</div>}
      </div>
      <ChevronLeft className="w-4 h-4 text-neutral-500 flex-shrink-0" strokeWidth={2} />
    </button>
  )
}

export default function SecuritySettingsPage() {
  const router = useRouter()
  const t = useTranslations("settings")
  const tc = useTranslations("common")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null)
  const [bioSupported, setBioSupported] = useState(false)
  const [bioEnabled, setBioEnabled] = useState(false)
  const [bioBusy, setBioBusy] = useState(false)

  const userId = profile?.id ?? ""
  const userEmailOrName =
    profile?.email?.trim() ||
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    ""

  useEffect(() => {
    setBioSupported(isBiometricSupported())
    let cancelled = false
    getCurrentUserProfile().then((p) => {
      if (cancelled || !p) return
      setProfile(p)
      setBioEnabled(isBiometricEnabledForUser(p.id))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setBioEnabled(isBiometricEnabledForUser(userId))
  }, [userId])

  const handleToggleBiometric = async (next: boolean) => {
    if (!profile || !userId) {
      showError(t("loadingData"))
      return
    }
    setBioBusy(true)
    if (next) {
      const result = await registerBiometric(userId, userEmailOrName)
      if (result.success) {
        setBioEnabled(true)
        showSuccess(t("bioEnabledToast"))
      } else {
        showError(result.error ?? t("bioEnableFailed"))
      }
    } else {
      disableBiometric(userId)
      resetBiometricPrompt()
      setBioEnabled(false)
      showSuccess(t("bioDisabledToast"))
    }
    setBioBusy(false)
  }

  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
          <SettingsSectionHeader
            title={t("secTitle")}
            subtitle={t("secSubtitle")}
            backHref="/settings"
          />

          <div className="flex flex-col gap-3">
            <SettingsOptionCard
              title={t("quickLogin")}
              description={t("quickLoginDesc")}
            >
              {!bioSupported ? (
                <div className="text-[11px] text-neutral-500 leading-relaxed bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                  {t("bioUnsupported")}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-blue-400 flex-shrink-0" strokeWidth={2} />
                  <div className="flex-1">
                    <SettingsToggle
                      checked={bioEnabled}
                      onChange={handleToggleBiometric}
                      label={bioBusy ? t("bioUpdating") : t("bioToggleLabel")}
                      description={
                        bioEnabled
                          ? t("bioEnabledDesc")
                          : t("bioDisabledDesc")
                      }
                    />
                  </div>
                </div>
              )}
            </SettingsOptionCard>

            <SettingsOptionCard title={t("secAndProtection")}>
              <div className="divide-y divide-white/[0.04]">
                <ActionRow label={t("changePassword")} description={t("changePasswordDesc")} onClick={() => router.push("/reset-password")} />
                <ActionRow label={t("twoFa")} description={t("twoFaDesc")} onClick={() => showInfo(t("twoFaSoon"))} />
                <ActionRow label={t("activeSessions")} description={t("activeSessionsDesc")} onClick={() => showInfo(t("devicesSoon"))} />
                <ActionRow label={t("loginLog")} description={t("loginLogDesc")} onClick={() => showInfo(t("loginLogSoon"))} />
              </div>
            </SettingsOptionCard>

            <div className="bg-red-400/[0.06] border border-red-400/20 rounded-2xl p-4">
              <div className="text-xs font-bold text-red-400 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" strokeWidth={2} />
                {t("dangerZone")}
              </div>
              <p className="text-[11px] text-red-300/80 leading-relaxed mb-3">
                {t("dangerZoneDesc")}
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="bg-red-400/[0.1] border border-red-400/30 hover:bg-red-400/[0.15] text-red-400 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
              >
                {t("deleteAccount")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t("deleteAccount")}
        subtitle={t("deleteModalSubtitle")}
        variant="danger"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowDeleteModal(false)}
              className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-2.5 rounded-xl text-sm hover:bg-white/[0.08] transition-colors"
            >
              {tc("buttons.cancel")}
            </button>
            <button
              onClick={() => {
                setShowDeleteModal(false)
                showInfo(t("contactSupportDelete"))
              }}
              className="flex-1 bg-red-400/[0.1] border border-red-400/30 text-red-400 py-2.5 rounded-xl text-sm font-bold hover:bg-red-400/[0.15] transition-colors"
            >
              {t("deleteBtn")}
            </button>
          </>
        }
      >
        <p className="text-sm text-neutral-300 leading-relaxed">
          {t("deleteWarn")}
        </p>
        <p className="text-[11px] text-yellow-400/80 leading-relaxed mt-3">
          {t("deleteWarnHint")}
        </p>
      </Modal>
    </AppLayout>
  )
}
