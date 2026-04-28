"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Bell, ChevronDown, User, Settings, LogOut, HelpCircle, Grid3x3, FileText
} from "lucide-react"
import { cn } from "@/lib/utils/cn"

const navItems = [
  { id: "home", label: "الرئيسية", href: "/dashboard" },
  { id: "market", label: "السوق", href: "/market" },
  { id: "investment", label: "الاستثمار", href: "/investment" },
  { id: "community", label: "المجتمع", href: "/community" },
]

const profileMenuItems = [
  { label: "الملف الشخصي", href: "/profile", icon: User },
  { label: "الإعدادات", href: "/settings", icon: Settings },
  { label: "الشروط والأحكام", href: "/terms", icon: FileText },
]

export function DesktopHeader() {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <header className="hidden lg:block sticky top-0 z-40 bg-black/60 backdrop-blur-xl">
      <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">

        {/* RIGHT: Logo + Tabs */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity" aria-label="رايلوس">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/[0.1] flex items-center justify-center bg-black flex-shrink-0">
              <Image src="/logo.png" alt="رايلوس" width={40} height={40} className="w-full h-full object-contain" />
            </div>
            <div className="text-right leading-none">
              <div className="text-base font-bold text-white">رايلوس</div>
              <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider mt-1">RAILOS</div>
            </div>
          </Link>

          <div className="w-px h-5 bg-white/10" aria-hidden="true" />

          <nav className="flex items-center gap-1" aria-label="التنقل الرئيسي">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-sm transition-colors",
                    isActive
                      ? "bg-white/[0.08] text-white font-medium"
                      : "text-neutral-400 hover:text-white hover:bg-white/[0.05]"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* LEFT: Icons + Profile */}
        <div className="flex items-center gap-2">

          {/* Support */}
          <Link
            href="/support"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
            aria-label="الدعم"
            title="الدعم والمساعدة"
          >
            <HelpCircle className="w-4 h-4 text-neutral-300" strokeWidth={1.5} />
          </Link>

          {/* Notifications */}
          <Link
            href="/notifications"
            className="relative w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
            aria-label="الإشعارات"
          >
            <Bell className="w-4 h-4 text-neutral-300" strokeWidth={1.5} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-400 rounded-full shadow-[0_0_4px_rgba(248,113,113,0.6)]" />
          </Link>

          {/* Menu (يفتح صفحة /menu) */}
          <Link
            href="/menu"
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-full border transition-colors",
              pathname.startsWith("/menu")
                ? "bg-white/[0.08] border-white/[0.15]"
                : "bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.08]"
            )}
            aria-label="القائمة الرئيسية"
            title="القائمة"
          >
            <Grid3x3 className="w-4 h-4 text-neutral-300" strokeWidth={1.5} />
          </Link>

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className={cn(
                "flex items-center gap-1.5 pr-3 pl-1 py-1 border rounded-full transition-colors",
                profileOpen
                  ? "bg-white/[0.08] border-white/[0.15]"
                  : "bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.08]"
              )}
              aria-label="قائمة الحساب"
              aria-expanded={profileOpen}
            >
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 text-neutral-400 transition-transform",
                  profileOpen && "rotate-180"
                )}
                strokeWidth={2}
              />
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-950 border border-white/10 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-neutral-300" strokeWidth={1.5} />
              </div>
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                <div className="absolute top-full mt-2 left-0 w-56 bg-[rgba(15,15,15,0.95)] backdrop-blur-2xl border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.05]">
                    <div className="text-sm text-white">المستخدم</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">railostrade@gmail.com</div>
                  </div>

                  <div className="py-1">
                    {profileMenuItems.map((item) => {
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-neutral-300 hover:bg-white/[0.05] transition-colors"
                          onClick={() => setProfileOpen(false)}
                        >
                          <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                          <span>{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>

                  <div className="border-t border-white/[0.05] py-1">
                    <button
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:bg-red-500/[0.06] transition-colors text-right"
                      onClick={() => setProfileOpen(false)}
                    >
                      <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
