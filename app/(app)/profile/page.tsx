"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Edit2,
  Lock,
  Bell,
  BarChart3,
  CreditCard,
  Globe,
  HelpCircle,
  LogOut,
  Crown,
  Calendar,
  Briefcase,
  TrendingUp,
  Trophy,
  Mail,
} from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader, StatCard, Badge, Modal } from "@/components/ui"
import { signOut } from "@/lib/supabase/auth-helpers"
import { showSuccess, showInfo } from "@/lib/utils/toast"
import {
  mockProfile,
  mockRecentTrades,
  getPortfolioSummary,
  HOLDINGS,
} from "@/lib/mock-data"
import { LEVEL_LABELS, LEVEL_ICONS, fmtLimit } from "@/lib/utils/contractLimits"
import { cn } from "@/lib/utils/cn"

// ─── Settings menu category ───────────────────────────────────
interface MenuItem {
  label: string
  description?: string
  onClick: () => void
  variant?: "default" | "danger"
}

interface MenuCategory {
  icon: string
  title: string
  items: MenuItem[]
}

export default function ProfilePage() {
  const router = useRouter()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const portfolio = getPortfolioSummary("me")
  const sectorsCount = new Set(HOLDINGS.filter((h) => (h.user_id ?? "me") === "me").map((h) => h.project.sector)).size

  const handleLogout = async () => {
    setLoggingOut(true)
    await signOut()
    showSuccess("تم تسجيل الخروج بنجاح")
    setTimeout(() => router.push("/login"), 600)
  }

  // ─── Settings menu config ────────────────────────────────────
  const menuCategories: MenuCategory[] = [
    {
      icon: "🔐",
      title: "الأمان والخصوصية",
      items: [
        { label: "تغيير كلمة المرور", description: "حدّث كلمة المرور الحالية", onClick: () => router.push("/reset-password") },
        { label: "المصادقة الثنائية", description: "حماية إضافية لحسابك", onClick: () => showInfo("ميزة المصادقة الثنائية قادمة قريباً") },
      ],
    },
    {
      icon: "🔔",
      title: "الإشعارات",
      items: [
        { label: "إعدادات الإشعارات", description: "تفضيلات الإشعارات الفورية", onClick: () => router.push("/settings?tab=notifications") },
        { label: "البريد الإلكتروني", description: "ملخصات أسبوعية وعروض", onClick: () => router.push("/settings?tab=notifications") },
      ],
    },
    {
      icon: "📊",
      title: "الحساب",
      items: [
        { label: "حدودي الشهرية", description: `حسب مستواك (${fmtLimit(portfolio.totalCost)} د.ع)`, onClick: () => router.push("/portfolio") },
        { label: "تاريخ النشاط", description: "كل صفقاتك وعملياتك", onClick: () => router.push("/orders") },
        { label: "التوثيق KYC", description: "حالة التوثيق الحالية", onClick: () => router.push("/kyc") },
      ],
    },
    {
      icon: "💳",
      title: "المالية",
      items: [
        { label: "وحدات الرسوم", description: "رصيد + شراء وحدات", onClick: () => router.push("/settings?tab=finance") },
        { label: "كشف الحسابات", description: "تنزيل سجل المعاملات", onClick: () => showInfo("جاري تجهيز كشف الحسابات...") },
      ],
    },
    {
      icon: "🌐",
      title: "التطبيق",
      items: [
        { label: "اللغة والمنطقة", description: "العربية + بغداد", onClick: () => router.push("/settings?tab=general") },
        { label: "المظهر", description: "الوضع الليلي + حجم الخط", onClick: () => router.push("/settings?tab=appearance") },
        { label: "حول التطبيق", description: "الإصدار والشروط", onClick: () => router.push("/about") },
      ],
    },
    {
      icon: "❓",
      title: "الدعم والمساعدة",
      items: [
        { label: "مركز المساعدة", description: "أسئلة شائعة وإجابات", onClick: () => router.push("/support") },
        { label: "تواصل معنا", description: "اتصال + WhatsApp + بريد", onClick: () => router.push("/support") },
        { label: "اقتراحات وملاحظات", description: "ساعدنا نتحسّن", onClick: () => router.push("/support") },
      ],
    },
  ]

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader title="ملفي الشخصي" subtitle="إدارة حسابك" showBack={false} />

          {/* ═══ § 1 Profile Card (Hero) ═══ */}
          <Card variant="gradient" color="purple" className="mb-6">
            <div className="flex items-start gap-4 mb-5 flex-wrap">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-400/[0.3] to-blue-400/[0.2] border border-purple-400/30 flex items-center justify-center text-3xl font-bold text-white flex-shrink-0">
                {mockProfile.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h2 className="text-lg font-bold text-white">{mockProfile.name}</h2>
                  <Badge color="purple" variant="soft" icon={LEVEL_ICONS[mockProfile.level]}>
                    {LEVEL_LABELS[mockProfile.level]}
                  </Badge>
                  {mockProfile.is_verified && (
                    <Badge color="green" variant="soft" size="xs">✓ موثق</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mb-3">
                  <Mail className="w-3 h-3" />
                  <span dir="ltr">user@railos.app</span>
                </div>
                <button
                  onClick={() => router.push("/profile-setup")}
                  className="bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Edit2 className="w-3 h-3" strokeWidth={2} />
                  تعديل الملف
                </button>
              </div>
            </div>

            {/* Quick stats inside hero */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard size="sm" label="تاريخ الانضمام" value="2026-01" icon={<Calendar className="w-3 h-3" />} />
              <StatCard size="sm" label="الصفقات" value={mockProfile.total_trades} color="blue" />
              <StatCard size="sm" label="نسبة النجاح" value={`${mockProfile.success_rate}%`} color="green" />
            </div>
          </Card>

          {/* ═══ § 2 Banner Premium ═══ */}
          <Card variant="highlighted" color="yellow" className="mb-6 relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-yellow-400/[0.15] border border-yellow-400/30 flex items-center justify-center flex-shrink-0">
                  <Crown className="w-6 h-6 text-yellow-400" strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-base font-bold text-white">Quick Sell Premium</h3>
                    <Badge color="yellow" variant="soft" size="xs">جديد</Badge>
                  </div>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    احصل على 15% خصم على عمولة البيع السريع
                  </p>
                </div>
              </div>

              {/* Features */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                {[
                  { icon: "⚡", text: "بيع فوري بدون انتظار" },
                  { icon: "💰", text: "خصم 15% على العمولة" },
                  { icon: "🎯", text: "أولوية في المعالجة" },
                ].map((f) => (
                  <div key={f.icon} className="bg-white/[0.05] border border-white/[0.08] rounded-lg p-2.5 text-center">
                    <div className="text-base mb-0.5">{f.icon}</div>
                    <div className="text-[10px] text-neutral-300 leading-tight">{f.text}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => router.push("/quick-sale")}
                className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-black py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4" strokeWidth={2.5} />
                اشترك الآن — 10,000 وحدة رسوم
              </button>
              <p className="text-[10px] text-neutral-500 text-center mt-2">إلغاء في أي وقت</p>
            </div>
          </Card>

          {/* ═══ § 3 Quick Stats ═══ */}
          <div className="mb-6">
            <SectionHeader title="📊 نظرة سريعة" subtitle="ملخص أدائك على المنصة" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <StatCard
                label="إجمالي محفظتي"
                value={fmtLimit(portfolio.totalValue) + " د.ع"}
                color="blue"
                icon={<Briefcase className="w-3 h-3" />}
              />
              <StatCard
                label="استثمارات نشطة"
                value={portfolio.holdingsCount}
                color="green"
              />
              <StatCard
                label="إجمالي الأرباح"
                value={(portfolio.totalProfit >= 0 ? "+" : "") + fmtLimit(portfolio.totalProfit)}
                color={portfolio.totalProfit >= 0 ? "green" : "red"}
                icon={<TrendingUp className="w-3 h-3" />}
              />
              <StatCard
                label="مستواي"
                value={LEVEL_LABELS[mockProfile.level]}
                color="purple"
                icon={<Trophy className="w-3 h-3" />}
              />
            </div>
          </div>

          {/* ═══ § 4 Settings Menu ═══ */}
          <SectionHeader title="⚙️ الإعدادات" subtitle="إدارة كاملة لحسابك" />
          <div className="space-y-4 mb-6">
            {menuCategories.map((cat) => (
              <Card key={cat.title}>
                <div className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                  <span className="text-base">{cat.icon}</span>
                  {cat.title}
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {cat.items.map((item) => (
                    <button
                      key={item.label}
                      onClick={item.onClick}
                      className="w-full flex items-center justify-between gap-3 py-2.5 hover:bg-white/[0.04] rounded-lg px-2 -mx-2 transition-colors text-right"
                    >
                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          "text-sm font-medium",
                          item.variant === "danger" ? "text-red-400" : "text-white",
                        )}>
                          {item.label}
                        </div>
                        {item.description && (
                          <div className="text-[11px] text-neutral-500 mt-0.5">{item.description}</div>
                        )}
                      </div>
                      <span className="text-neutral-500 flex-shrink-0">←</span>
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          {/* ═══ § 5 Logout ═══ */}
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full bg-red-400/[0.06] border border-red-400/25 hover:bg-red-400/[0.1] text-red-400 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={2} />
            تسجيل الخروج
          </button>

        </div>
      </div>

      {/* Logout confirmation Modal */}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => !loggingOut && setShowLogoutModal(false)}
        title="تسجيل الخروج"
        subtitle="هل أنت متأكد من رغبتك في تسجيل الخروج؟"
        variant="warning"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowLogoutModal(false)}
              disabled={loggingOut}
              className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-2.5 rounded-xl text-sm hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex-1 bg-red-400/[0.1] border border-red-400/30 text-red-400 py-2.5 rounded-xl text-sm font-bold hover:bg-red-400/[0.15] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loggingOut ? (
                <>
                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  جاري...
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4" strokeWidth={2} />
                  تسجيل الخروج
                </>
              )}
            </button>
          </>
        }
      >
        <p className="text-sm text-neutral-300 leading-relaxed">
          ستحتاج لتسجيل الدخول مرة أخرى للوصول لحسابك.
        </p>
      </Modal>
    </AppLayout>
  )
}
