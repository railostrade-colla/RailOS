"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { Shield, FileText, Lock, Headphones, BookOpen, Users, TrendingUp, Briefcase, Mail, MessageCircle, Phone } from "lucide-react"
import { APP_VERSION, APP_NAME, APP_NAME_EN, APP_DESCRIPTION, COPYRIGHT_YEAR } from "@/lib/utils/version"
import { cn } from "@/lib/utils/cn"

export function Footer({ compact = false }: { compact?: boolean }) {
  const router = useRouter()

  const sections = [
    {
      title: "المنصة",
      links: [
        { label: "السوق", path: "/market", icon: TrendingUp },
        { label: "الاستثمار", path: "/investment", icon: Briefcase },
        { label: "المجتمع", path: "/community", icon: Users },
        { label: "السفير", path: "/ambassador", icon: Shield },
      ],
    },
    {
      title: "الدعم",
      links: [
        { label: "الدعم الفني", path: "/support", icon: Headphones },
        { label: "دليل التطبيق", path: "/app-guide", icon: BookOpen },
        { label: "دليل الاستثمار", path: "/investment-guide", icon: BookOpen },
      ],
    },
    {
      title: "قانوني",
      links: [
        { label: "من نحن", path: "/about", icon: Shield },
        { label: "الشروط والأحكام", path: "/terms", icon: FileText },
        { label: "سياسة الخصوصية", path: "/privacy", icon: Lock },
      ],
    },
  ]

  // Compact version للموبايل أو الصفحات الصغيرة
  if (compact) {
    return (
      <div className="border-t border-white/[0.08] pt-5 pb-3 mt-8">
        <button
          onClick={() => router.push("/about")}
          className="flex items-center gap-2.5 mb-4 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/[0.1] flex items-center justify-center bg-black">
            <Image src="/logo.png" alt={APP_NAME} width={32} height={32} className="w-full h-full object-contain" />
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-white">{APP_NAME}</div>
            <div className="text-[10px] text-neutral-500">{APP_DESCRIPTION}</div>
          </div>
        </button>

        <div className="flex gap-4 mb-4 flex-wrap">
          {[
            { label: "من نحن", path: "/about" },
            { label: "الشروط", path: "/terms" },
            { label: "الخصوصية", path: "/privacy" },
            { label: "الدعم", path: "/support" },
          ].map((link) => (
            <button
              key={link.path}
              onClick={() => router.push(link.path)}
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="flex justify-between items-center mb-3">
          <div className="text-[10px] text-neutral-500 font-mono">v{APP_VERSION}</div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-neutral-500">النظام يعمل</span>
          </div>
        </div>

        <div className="text-[10px] text-neutral-500 text-center pt-2 border-t border-white/[0.04]">
          © {COPYRIGHT_YEAR} {APP_NAME} — جميع الحقوق محفوظة
        </div>
      </div>
    )
  }

  // Full version للشاشات الكبيرة
  return (
    <footer className="border-t border-white/[0.08] mt-12 pt-8 pb-4">
      {/* Top section: Brand + Sections */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-4 md:gap-6 mb-8">

        {/* Brand */}
        <div className="col-span-3 md:col-span-1">
          <button
            onClick={() => router.push("/about")}
            className="flex items-center gap-3 mb-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/[0.1] flex items-center justify-center bg-black">
              <Image src="/logo.png" alt={APP_NAME} width={40} height={40} className="w-full h-full object-contain" />
            </div>
            <div className="text-right">
              <div className="text-base font-bold text-white">{APP_NAME}</div>
              <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">{APP_NAME_EN}</div>
            </div>
          </button>
          <div className="text-xs text-neutral-400 leading-relaxed mb-4">
            {APP_DESCRIPTION}. تواصل آمن بين المستثمرين، صفقات موثقة، عوائد عادلة.
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-1.5">
            <div className="bg-green-400/[0.06] border border-green-400/20 text-green-400 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" />
              KYC موثق
            </div>
            <div className="bg-blue-400/[0.06] border border-blue-400/20 text-blue-400 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              مشفّر
            </div>
          </div>
        </div>

        {/* Link Sections */}
        {sections.map((section) => (
          <div key={section.title}>
            <div className="text-[11px] font-bold text-white mb-3 tracking-wider uppercase">
              {section.title}
            </div>
            <div className="space-y-2">
              {section.links.map((link) => {
                const Icon = link.icon
                return (
                  <button
                    key={link.path}
                    onClick={() => router.push(link.path)}
                    className="flex items-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors group"
                  >
                    <Icon className="w-3 h-3 text-neutral-500 group-hover:text-white transition-colors" strokeWidth={1.5} />
                    {link.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Middle section: Contact + Status — صف أفقي دائماً */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <a
          href="mailto:railostrade@gmail.com"
          className="bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors rounded-xl p-3 flex flex-col items-center text-center"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-400/10 border border-blue-400/20 flex items-center justify-center mb-2">
            <Mail className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
          </div>
          <div className="text-[10px] text-neutral-500 mb-0.5">البريد</div>
          <div className="text-[10px] lg:text-[11px] font-bold text-white truncate w-full leading-tight" dir="ltr">
            railostrade@gmail.com
          </div>
        </a>

        <a
          href="tel:+9647721726518"
          className="bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors rounded-xl p-3 flex flex-col items-center text-center"
        >
          <div className="w-9 h-9 rounded-lg bg-green-400/10 border border-green-400/20 flex items-center justify-center mb-2">
            <Phone className="w-4 h-4 text-green-400" strokeWidth={1.5} />
          </div>
          <div className="text-[10px] text-neutral-500 mb-0.5">الهاتف</div>
          <div className="text-[10px] lg:text-[11px] font-bold text-white leading-tight" dir="ltr">
            07721726518
          </div>
        </a>

        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 flex flex-col items-center text-center">
          <div className="w-9 h-9 rounded-lg bg-purple-400/10 border border-purple-400/20 flex items-center justify-center mb-2">
            <Headphones className="w-4 h-4 text-purple-400" strokeWidth={1.5} />
          </div>
          <div className="text-[10px] text-neutral-500 mb-0.5">ساعات العمل</div>
          <div className="text-[10px] lg:text-[11px] font-bold text-white leading-tight">
            8 ص - 10 م
          </div>
        </div>
      </div>

      {/* Bottom section: Version + Status + Copyright */}
      <div className="border-t border-white/[0.06] pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <div className="flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.08] rounded-md px-2.5 py-1">
            <span className="text-[10px] text-neutral-500">إصدار</span>
            <span className="text-[10px] font-bold text-white font-mono" dir="ltr">v{APP_VERSION}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-green-400/[0.06] border border-green-400/20 rounded-md px-2.5 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-green-400 font-bold">النظام يعمل</span>
          </div>
        </div>

        <div className="text-[10px] text-neutral-500 text-center">
          © {COPYRIGHT_YEAR} {APP_NAME} — جميع الحقوق محفوظة
        </div>
      </div>
    </footer>
  )
}
