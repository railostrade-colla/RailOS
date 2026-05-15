"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
      showError("جاري تحميل بياناتك — حاول بعد لحظة")
      return
    }
    setBioBusy(true)
    if (next) {
      const result = await registerBiometric(userId, userEmailOrName)
      if (result.success) {
        setBioEnabled(true)
        showSuccess("تم تفعيل البصمة 👆")
      } else {
        showError(result.error ?? "تعذّر التفعيل")
      }
    } else {
      disableBiometric(userId)
      resetBiometricPrompt()
      setBioEnabled(false)
      showSuccess("تم إلغاء تفعيل البصمة")
    }
    setBioBusy(false)
  }

  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
          <SettingsSectionHeader
            title="الأمان والخصوصية"
            subtitle="كلمة السر، البصمة، الجلسات"
            backHref="/settings"
          />

          <div className="flex flex-col gap-3">
            <SettingsOptionCard
              title="تسجيل الدخول السريع"
              description="ادخل التطبيق بالبصمة / Face ID بدون كلمة مرور"
            >
              {!bioSupported ? (
                <div className="text-[11px] text-neutral-500 leading-relaxed bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                  متصفحك أو جهازك لا يدعم البصمة / Face ID. جرّب من جهاز محمول أو متصفّح حديث.
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-blue-400 flex-shrink-0" strokeWidth={2} />
                  <div className="flex-1">
                    <SettingsToggle
                      checked={bioEnabled}
                      onChange={handleToggleBiometric}
                      label={bioBusy ? "جاري التحديث..." : "تسجيل الدخول بالبصمة / Face ID"}
                      description={
                        bioEnabled
                          ? "مفعَّل — يمكنك الدخول بسرعة بدون كلمة مرور"
                          : "ادخل التطبيق بسرعة بدون كتابة كلمة المرور"
                      }
                    />
                  </div>
                </div>
              )}
            </SettingsOptionCard>

            <SettingsOptionCard title="الأمان والحماية">
              <div className="divide-y divide-white/[0.04]">
                <ActionRow label="تغيير كلمة المرور" description="حدّث كلمة المرور الحالية" onClick={() => router.push("/reset-password")} />
                <ActionRow label="المصادقة الثنائية (2FA)" description="طبقة حماية إضافية لحسابك" onClick={() => showInfo("ميزة المصادقة الثنائية قادمة قريباً")} />
                <ActionRow label="جلسات نشطة" description="الأجهزة المسجّل دخولها حالياً" onClick={() => showInfo("سيتم عرض الأجهزة قريباً")} />
                <ActionRow label="سجل تسجيل الدخول" description="آخر 30 يوم من النشاط" onClick={() => showInfo("سجل الدخول قادم قريباً")} />
              </div>
            </SettingsOptionCard>

            <div className="bg-red-400/[0.06] border border-red-400/20 rounded-2xl p-4">
              <div className="text-xs font-bold text-red-400 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" strokeWidth={2} />
                منطقة خطرة
              </div>
              <p className="text-[11px] text-red-300/80 leading-relaxed mb-3">
                حذف الحساب نهائي ولا يمكن التراجع عنه. كل بياناتك واستثماراتك ستحذف.
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="bg-red-400/[0.1] border border-red-400/30 hover:bg-red-400/[0.15] text-red-400 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
              >
                حذف الحساب نهائياً
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="حذف الحساب نهائياً"
        subtitle="هذا الإجراء لا يمكن التراجع عنه"
        variant="danger"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowDeleteModal(false)}
              className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-2.5 rounded-xl text-sm hover:bg-white/[0.08] transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={() => {
                setShowDeleteModal(false)
                showInfo("لإكمال الحذف، تواصل مع الدعم")
              }}
              className="flex-1 bg-red-400/[0.1] border border-red-400/30 text-red-400 py-2.5 rounded-xl text-sm font-bold hover:bg-red-400/[0.15] transition-colors"
            >
              حذف
            </button>
          </>
        }
      >
        <p className="text-sm text-neutral-300 leading-relaxed">
          ستفقد جميع: بياناتك الشخصية + استثماراتك + سجل المعاملات + KYC.
        </p>
        <p className="text-[11px] text-yellow-400/80 leading-relaxed mt-3">
          ⚠️ يفضّل التواصل مع الدعم أولاً لمراجعة الخيارات.
        </p>
      </Modal>
    </AppLayout>
  )
}
