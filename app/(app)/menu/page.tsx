"use client"

import Link from "next/link"
import {
  Coins, Zap, Star, Shield, Settings, Newspaper,
  HelpCircle, BookOpen, TrendingUp, FileText, Lock, Info, Heart, Building2,
  HeartPulse, Users, Gift,
} from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"

interface MenuItem {
  label: string
  description: string
  href: string
  icon: typeof Coins
  iconColor: string
  iconBg: string
  iconBorder: string
}

const menuItems: MenuItem[] = [
  // الأساسية - معاملات
  {
    label: "وحدات الرسوم",
    description: "شحن وإدارة رصيدك",
    href: "/portfolio?tab=fee_units",
    icon: Coins,
    iconColor: "text-yellow-400",
    iconBg: "bg-yellow-400/10",
    iconBorder: "border-yellow-400/30",
  },
  {
    label: "البيع السريع",
    description: "اشترك واربح فرصاً حصرية",
    href: "/quick-sell",
    icon: Zap,
    iconColor: "text-orange-400",
    iconBg: "bg-orange-400/10",
    iconBorder: "border-orange-400/30",
  },
  {
    label: "سفير رايلوس",
    description: "اربح من إحالاتك",
    href: "/ambassador",
    icon: Star,
    iconColor: "text-purple-400",
    iconBg: "bg-purple-400/10",
    iconBorder: "border-purple-400/30",
  },
  {
    label: "KYC والأمان",
    description: "التحقق من هويتك",
    href: "/kyc",
    icon: Shield,
    iconColor: "text-green-400",
    iconBg: "bg-green-400/10",
    iconBorder: "border-green-400/30",
  },
  {
    label: "متابعتي",
    description: "مشاريع وشركات تتابعها",
    href: "/following",
    icon: Heart,
    iconColor: "text-red-400",
    iconBg: "bg-red-400/10",
    iconBorder: "border-red-400/30",
  },
  {
    label: "مجلس السوق",
    description: "الجهة الرقابية والتصويت",
    href: "/council",
    icon: Building2,
    iconColor: "text-purple-400",
    iconBg: "bg-purple-400/10",
    iconBorder: "border-purple-400/30",
  },

  // البرامج الاجتماعية
  {
    label: "الرعاية الصحية",
    description: "علاج وتأمين وتبرّعات",
    href: "/healthcare",
    icon: HeartPulse,
    iconColor: "text-red-400",
    iconBg: "bg-red-400/10",
    iconBorder: "border-red-400/30",
  },
  {
    label: "رعاية الأيتام",
    description: "كفالة طفل ودعم تعليمه",
    href: "/orphans",
    icon: Users,
    iconColor: "text-blue-400",
    iconBg: "bg-blue-400/10",
    iconBorder: "border-blue-400/30",
  },
  {
    label: "الخصومات",
    description: "خصومات حصرية في الماركات",
    href: "/discounts",
    icon: Gift,
    iconColor: "text-orange-400",
    iconBg: "bg-orange-400/10",
    iconBorder: "border-orange-400/30",
  },

  // الإعدادات والمحتوى
  {
    label: "الإعدادات",
    description: "تخصيص حسابك",
    href: "/settings",
    icon: Settings,
    iconColor: "text-blue-400",
    iconBg: "bg-blue-400/10",
    iconBorder: "border-blue-400/30",
  },
  {
    label: "الأخبار",
    description: "آخر تحديثات السوق",
    href: "/news",
    icon: Newspaper,
    iconColor: "text-cyan-400",
    iconBg: "bg-cyan-400/10",
    iconBorder: "border-cyan-400/30",
  },
  {
    label: "الدعم والمساعدة",
    description: "تواصل مع فريق الدعم",
    href: "/support",
    icon: HelpCircle,
    iconColor: "text-pink-400",
    iconBg: "bg-pink-400/10",
    iconBorder: "border-pink-400/30",
  },

  // الأدلة
  {
    label: "دليل التطبيق",
    description: "كيف تستخدم Railos",
    href: "/app-guide",
    icon: BookOpen,
    iconColor: "text-violet-400",
    iconBg: "bg-violet-400/10",
    iconBorder: "border-violet-400/30",
  },
  {
    label: "دليل الاستثمار",
    description: "نصائح ودراسات",
    href: "/investment-guide",
    icon: TrendingUp,
    iconColor: "text-teal-400",
    iconBg: "bg-teal-400/10",
    iconBorder: "border-teal-400/30",
  },

  // القانوني
  {
    label: "شروط الاستخدام",
    description: "اتفاقية الاستخدام",
    href: "/terms",
    icon: FileText,
    iconColor: "text-neutral-300",
    iconBg: "bg-neutral-300/5",
    iconBorder: "border-neutral-300/20",
  },
  {
    label: "سياسة الخصوصية",
    description: "كيف نحمي بياناتك",
    href: "/privacy",
    icon: Lock,
    iconColor: "text-red-400",
    iconBg: "bg-red-400/10",
    iconBorder: "border-red-400/30",
  },
  {
    label: "عن Railos",
    description: "تعرف علينا",
    href: "/about",
    icon: Info,
    iconColor: "text-neutral-300",
    iconBg: "bg-neutral-300/5",
    iconBorder: "border-neutral-300/20",
  },
]

export default function MenuPage() {
  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-screen-2xl mx-auto">

          <PageHeader
            badge="MAIN MENU · 17 SHORTCUTS"
            title="القائمة الرئيسية"
            description="كل اختصارات Railos في مكان واحد"
            showBack={true}
          />

          {/* Grid - 4 cols always (mobile flat, desktop carded) */}
          <div className="grid grid-cols-4 gap-2 lg:gap-3 max-w-6xl mx-auto lg:mx-0">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex flex-col items-center text-center lg:items-start lg:text-right p-2 lg:p-4 rounded-xl transition-all lg:bg-neutral-950/50 lg:hover:bg-neutral-900/60 lg:border lg:border-neutral-900 lg:hover:border-neutral-800"
                >
                  <div
                    className={`w-12 h-12 ${item.iconBg} border ${item.iconBorder} rounded-lg flex items-center justify-center mb-2 lg:mb-3 group-hover:scale-105 transition-transform`}
                  >
                    <Icon
                      className={`w-5 h-5 ${item.iconColor}`}
                      strokeWidth={1.5}
                    />
                  </div>
                  <div className="text-[11px] lg:text-sm text-white font-medium mb-0 lg:mb-1 leading-tight">
                    {item.label}
                  </div>
                  <div className="hidden lg:block text-[10px] text-neutral-500 leading-relaxed">
                    {item.description}
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Footer info */}
          <div className="mt-10 text-center">
            <div className="text-[10px] text-neutral-600 tracking-wider font-mono">
              RAILOS v2.0 · 17 SHORTCUTS · MORE COMING SOON
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
