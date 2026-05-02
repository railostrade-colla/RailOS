"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Bell,
  Globe,
  Lock,
  CreditCard,
  Palette,
  AlertTriangle,
  ChevronLeft,
  Fingerprint,
} from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, Tabs, Modal } from "@/components/ui"
import { showSuccess, showError, showInfo } from "@/lib/utils/toast"
import { CURRENT_USER } from "@/lib/mock-data"
import { LEVEL_LIMITS, fmtLimit } from "@/lib/utils/contractLimits"
import {
  isBiometricSupported,
  isBiometricEnabledForUser,
  registerBiometric,
  disableBiometric,
  resetBiometricPrompt,
} from "@/lib/auth/biometric"
import { cn } from "@/lib/utils/cn"

type SettingsTab = "notifications" | "general" | "security" | "finance" | "appearance"

const TABS: Array<{ id: SettingsTab; icon: string; label: string }> = [
  { id: "notifications", icon: "🔔", label: "الإشعارات" },
  { id: "general",       icon: "🌐", label: "العامة" },
  { id: "security",      icon: "🔒", label: "الأمان" },
  { id: "finance",       icon: "💳", label: "المالية" },
  { id: "appearance",    icon: "🎨", label: "المظهر" },
]

// ─── Toggle component ────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-medium">{label}</div>
        {description && <div className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={cn(
          "relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5",
          checked ? "bg-green-400" : "bg-white/[0.1]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
            checked ? "right-0.5" : "right-[18px]",
          )}
        />
      </button>
    </div>
  )
}

function SelectRow({
  label,
  value,
  options,
  onChange,
  description,
}: {
  label: string
  value: string
  options: { id: string; label: string }[]
  onChange: (id: string) => void
  description?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-medium">{label}</div>
        {description && <div className="text-[11px] text-neutral-500 mt-0.5">{description}</div>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/[0.05] border border-white/[0.1] focus:border-white/20 rounded-lg px-3 py-1.5 text-xs text-white outline-none flex-shrink-0"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

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
      className="w-full flex items-center justify-between gap-3 py-2.5 hover:bg-white/[0.04] rounded-lg px-2 -mx-2 transition-colors text-right"
    >
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm font-medium", variant === "danger" ? "text-red-400" : "text-white")}>{label}</div>
        {description && <div className="text-[11px] text-neutral-500 mt-0.5">{description}</div>}
      </div>
      <ChevronLeft className="w-4 h-4 text-neutral-500 flex-shrink-0" strokeWidth={2} />
    </button>
  )
}

// ════════════════════════════════════════════════════════════════
function SettingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = (searchParams?.get("tab") as SettingsTab | null) ?? "notifications"

  const [tab, setTab] = useState<SettingsTab>(initialTab)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Notifications
  const [n_dealAccept, setNDealAccept] = useState(true)
  const [n_dealReject, setNDealReject] = useState(true)
  const [n_adExpire, setNAdExpire] = useState(true)
  const [n_walletReceive, setNWalletReceive] = useState(true)
  const [n_walletTx, setNWalletTx] = useState(false)
  const [n_walletProfit, setNWalletProfit] = useState(true)
  const [n_marketNew, setNMarketNew] = useState(true)
  const [n_marketTrending, setNMarketTrending] = useState(false)
  const [n_marketAlerts, setNMarketAlerts] = useState(true)
  const [n_systemUpdate, setNSystemUpdate] = useState(true)
  const [n_systemNews, setNSystemNews] = useState(true)
  const [n_systemPromo, setNSystemPromo] = useState(false)

  // General
  const [language, setLanguage] = useState("ar")
  const [timezone, setTimezone] = useState("baghdad")
  const [currency, setCurrency] = useState("IQD")
  const [timeFormat, setTimeFormat] = useState("24h")
  const [autoLocation, setAutoLocation] = useState(true)

  // Appearance
  const [theme, setTheme] = useState("dark")
  const [fontSize, setFontSize] = useState("medium")
  const [density, setDensity] = useState("comfortable")
  const [animations, setAnimations] = useState(true)

  // Security — biometric
  const [bioSupported, setBioSupported] = useState(false)
  const [bioEnabled, setBioEnabled] = useState(false)
  const [bioBusy, setBioBusy] = useState(false)

  useEffect(() => {
    setBioSupported(isBiometricSupported())
    setBioEnabled(isBiometricEnabledForUser(CURRENT_USER.id))
  }, [])

  const handleToggleBiometric = async (next: boolean) => {
    setBioBusy(true)
    if (next) {
      const result = await registerBiometric(CURRENT_USER.id, CURRENT_USER.email ?? CURRENT_USER.name)
      if (result.success) {
        setBioEnabled(true)
        showSuccess("تم تفعيل البصمة 👆")
      } else {
        showError(result.error ?? "تعذّر التفعيل")
      }
    } else {
      disableBiometric(CURRENT_USER.id)
      resetBiometricPrompt()
      setBioEnabled(false)
      showSuccess("تم إلغاء تفعيل البصمة")
    }
    setBioBusy(false)
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader title="⚙️ الإعدادات" subtitle="إدارة تفضيلاتك" backHref="/profile" />

          <div className="mb-6">
            <Tabs
              tabs={TABS}
              activeTab={tab}
              onChange={(id) => setTab(id as SettingsTab)}
              size="sm"
            />
          </div>

          {/* ═══ Notifications ═══ */}
          {tab === "notifications" && (
            <div className="space-y-4">
              <Card>
                <div className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-400" strokeWidth={2} />
                  إشعارات الصفقات
                </div>
                <div className="divide-y divide-white/[0.04]">
                  <Toggle checked={n_dealAccept} onChange={setNDealAccept} label="عند قبول صفقة جديدة" description="تنبيه فوري عند موافقة الطرف الآخر" />
                  <Toggle checked={n_dealReject} onChange={setNDealReject} label="عند رفض صفقة" />
                  <Toggle checked={n_adExpire} onChange={setNAdExpire} label="عند اقتراب انتهاء إعلانك" />
                </div>
              </Card>

              <Card>
                <div className="text-xs font-bold text-white mb-3">💼 إشعارات المحفظة</div>
                <div className="divide-y divide-white/[0.04]">
                  <Toggle checked={n_walletReceive} onChange={setNWalletReceive} label="استلام حصص" />
                  <Toggle checked={n_walletTx} onChange={setNWalletTx} label="تنفيذ معاملة" />
                  <Toggle checked={n_walletProfit} onChange={setNWalletProfit} label="توزيع أرباح" description="عند استلامك توزيعاً ربعياً أو سنوياً" />
                </div>
              </Card>

              <Card>
                <div className="text-xs font-bold text-white mb-3">📈 إشعارات السوق</div>
                <div className="divide-y divide-white/[0.04]">
                  <Toggle checked={n_marketNew} onChange={setNMarketNew} label="مشاريع جديدة" />
                  <Toggle checked={n_marketTrending} onChange={setNMarketTrending} label="فرص رائجة" />
                  <Toggle checked={n_marketAlerts} onChange={setNMarketAlerts} label="تنبيهات أسعار" />
                </div>
              </Card>

              <Card>
                <div className="text-xs font-bold text-white mb-3">🔄 إشعارات النظام</div>
                <div className="divide-y divide-white/[0.04]">
                  <Toggle checked={n_systemUpdate} onChange={setNSystemUpdate} label="تحديثات التطبيق" />
                  <Toggle checked={n_systemNews} onChange={setNSystemNews} label="أخبار المنصة" />
                  <Toggle checked={n_systemPromo} onChange={setNSystemPromo} label="عروض ترويجية" />
                </div>
              </Card>

              <button
                onClick={() => showSuccess("تم حفظ تفضيلات الإشعارات")}
                className="w-full bg-neutral-100 text-black py-3 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-colors"
              >
                حفظ التغييرات
              </button>
            </div>
          )}

          {/* ═══ General ═══ */}
          {tab === "general" && (
            <Card>
              <div className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4 text-green-400" strokeWidth={2} />
                الإعدادات العامة
              </div>
              <div className="divide-y divide-white/[0.04]">
                <SelectRow
                  label="اللغة"
                  value={language}
                  onChange={setLanguage}
                  options={[
                    { id: "ar", label: "العربية" },
                    { id: "en", label: "English (قريباً)" },
                  ]}
                />
                <SelectRow
                  label="المنطقة الزمنية"
                  value={timezone}
                  onChange={setTimezone}
                  options={[
                    { id: "baghdad", label: "بغداد (GMT+3)" },
                    { id: "dubai", label: "دبي (GMT+4)" },
                    { id: "riyadh", label: "الرياض (GMT+3)" },
                  ]}
                />
                <SelectRow
                  label="العملة"
                  value={currency}
                  onChange={setCurrency}
                  options={[
                    { id: "IQD", label: "د.ع IQD" },
                    { id: "USD", label: "$ USD" },
                  ]}
                />
                <SelectRow
                  label="تنسيق الوقت"
                  value={timeFormat}
                  onChange={setTimeFormat}
                  options={[
                    { id: "24h", label: "24 ساعة" },
                    { id: "12h", label: "12 ساعة (AM/PM)" },
                  ]}
                />
                <Toggle checked={autoLocation} onChange={setAutoLocation} label="الموقع التلقائي" description="استخدم موقعك لتحسين التوصيات" />
              </div>
            </Card>
          )}

          {/* ═══ Security ═══ */}
          {tab === "security" && (
            <div className="space-y-4">
              {/* Biometric login */}
              <Card>
                <div className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-blue-400" strokeWidth={2} />
                  تسجيل الدخول السريع
                </div>

                {!bioSupported ? (
                  <div className="text-[11px] text-neutral-500 leading-relaxed bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                    متصفحك أو جهازك لا يدعم البصمة / Face ID. جرّب من جهاز محمول أو متصفّح حديث.
                  </div>
                ) : (
                  <Toggle
                    checked={bioEnabled}
                    onChange={handleToggleBiometric}
                    label={bioBusy ? "جاري التحديث..." : "تسجيل الدخول بالبصمة / Face ID"}
                    description={
                      bioEnabled
                        ? "مفعَّل — يمكنك الدخول بسرعة بدون كلمة مرور"
                        : "ادخل التطبيق بسرعة بدون كتابة كلمة المرور"
                    }
                  />
                )}
              </Card>

              <Card>
                <div className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-400" strokeWidth={2} />
                  الأمان والحماية
                </div>
                <div className="divide-y divide-white/[0.04]">
                  <ActionRow label="تغيير كلمة المرور" description="حدّث كلمة المرور الحالية" onClick={() => router.push("/reset-password")} />
                  <ActionRow label="المصادقة الثنائية (2FA)" description="طبقة حماية إضافية لحسابك" onClick={() => showInfo("ميزة المصادقة الثنائية قادمة قريباً")} />
                  <ActionRow label="جلسات نشطة" description="الأجهزة المسجّل دخولها حالياً" onClick={() => showInfo("سيتم عرض الأجهزة قريباً")} />
                  <ActionRow label="سجل تسجيل الدخول" description="آخر 30 يوم من النشاط" onClick={() => showInfo("سجل الدخول قادم قريباً")} />
                </div>
              </Card>

              <Card variant="highlighted" color="red">
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
              </Card>
            </div>
          )}

          {/* ═══ Finance ═══ */}
          {tab === "finance" && (
            <Card>
              <div className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-yellow-400" strokeWidth={2} />
                الإعدادات المالية
              </div>
              <div className="divide-y divide-white/[0.04]">
                <div className="py-2.5 flex justify-between items-center">
                  <div>
                    <div className="text-sm text-white font-medium">حدّي الشهري الحالي</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">حسب مستواك ({CURRENT_USER.level})</div>
                  </div>
                  <span className="text-sm font-bold text-yellow-400 font-mono">{fmtLimit(LEVEL_LIMITS[CURRENT_USER.level])} د.ع</span>
                </div>
                <ActionRow label="وحدات الرسوم" description="رصيد + شراء وحدات إضافية" onClick={() => showInfo("ستتاح إدارة وحدات الرسوم قريباً")} />
                <ActionRow label="البيانات البنكية" description="حسابات السحب والإيداع" onClick={() => router.push("/profile-setup")} />
                <ActionRow label="كشف الحسابات" description="تنزيل سجل المعاملات (PDF)" onClick={() => showInfo("جاري تجهيز كشف الحسابات...")} />
              </div>
            </Card>
          )}

          {/* ═══ Appearance ═══ */}
          {tab === "appearance" && (
            <Card>
              <div className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                <Palette className="w-4 h-4 text-pink-400" strokeWidth={2} />
                المظهر والعرض
              </div>
              <div className="divide-y divide-white/[0.04]">
                <SelectRow
                  label="الوضع"
                  value={theme}
                  onChange={setTheme}
                  options={[
                    { id: "dark", label: "داكن (افتراضي)" },
                    { id: "light", label: "فاتح (قريباً)" },
                    { id: "auto", label: "تلقائي" },
                  ]}
                />
                <SelectRow
                  label="حجم الخط"
                  value={fontSize}
                  onChange={setFontSize}
                  options={[
                    { id: "small", label: "صغير" },
                    { id: "medium", label: "متوسط" },
                    { id: "large", label: "كبير" },
                  ]}
                />
                <SelectRow
                  label="كثافة العرض"
                  value={density}
                  onChange={setDensity}
                  options={[
                    { id: "compact", label: "مدمج" },
                    { id: "comfortable", label: "مريح" },
                  ]}
                />
                <Toggle checked={animations} onChange={setAnimations} label="الحركات والتأثيرات" description="عطّلها لتحسين الأداء" />
              </div>
            </Card>
          )}

        </div>
      </div>

      {/* Delete confirmation Modal */}
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

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  )
}
