"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { useTranslations } from "next-intl"
import {
  ChevronDown, User, Settings, LogOut, HelpCircle, Grid3x3, FileText
} from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { signOut } from "@/lib/supabase/auth-helpers"
import { showSuccess } from "@/lib/utils/toast"
import { Logo } from "@/components/brand/Logo"

const navItems = [
  { id: "home", href: "/dashboard" },
  { id: "market", href: "/market" },
  { id: "investment", href: "/investment" },
  { id: "community", href: "/community" },
] as const

const profileMenuItems = [
  { id: "profile", href: "/profile", icon: User },
  { id: "settings", href: "/settings", icon: Settings },
  { id: "terms", href: "/terms", icon: FileText },
] as const

export function DesktopHeader() {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const t = useTranslations("common")
  const tn = useTranslations("notifications")

  // Phase 11.03 — wire the dropdown logout button (was a no-op).
  // Hard navigation via window.location.replace clears all React
  // state, dedup caches, and realtime channels.
  const handleLogout = async () => {
    setProfileOpen(false)
    try {
      await signOut()
    } catch {
      // best-effort — navigate either way
    }
    showSuccess(tn("loggedOut"))
    if (typeof window !== "undefined") {
      window.location.replace("/login")
    }
  }

  // Phase 14.13 M2 Hotfix (Part A) — header follows the theme (light in
  // Light Mode). Only the logo box keeps `always-dark` (white SVG logo).
  return (
    <header className="app-chrome hidden lg:block sticky top-0 z-40 backdrop-blur-xl">
      <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">

        {/* RIGHT: Logo + Tabs */}
        <div className="flex items-center gap-6">
          {/* Logo — Phase 10.96: click reloads the app instead of navigating */}
          <button
            onClick={() => { if (typeof window !== "undefined") window.location.reload() }}
            className="no-shadow flex items-center hover:opacity-80 transition-opacity"
            aria-label={t("aria.refreshApp")}
          >
            <Logo size="md" />
          </button>

          <div className="w-px h-5 bg-white/10" aria-hidden="true" />

          <nav className="flex items-center gap-1" aria-label={t("aria.mainNav")}>
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-sm transition-colors",
                    isActive
                      ? "bg-white/[0.08] text-white font-medium"
                      : "text-neutral-400 hover:text-white hover:bg-white/[0.05]"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {t(`nav.${item.id}`)}
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
            aria-label={t("aria.support")}
            title={t("nav.support")}
          >
            <HelpCircle className="w-4 h-4 text-neutral-300" strokeWidth={1.5} />
          </Link>

          {/* Notifications — bell links straight to /notifications page */}
          <NotificationBell badgePosition="right" />

          {/* Menu (يفتح صفحة /menu) */}
          <Link
            href="/menu"
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-full border transition-colors",
              pathname.startsWith("/menu")
                ? "bg-white/[0.08] border-white/[0.15]"
                : "bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.08]"
            )}
            aria-label={t("aria.menu")}
            title={t("nav.menu")}
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
              aria-label={t("aria.accountMenu")}
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
                    <div className="text-sm text-white">{t("nav.user")}</div>
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
                          <span>{t(`nav.${item.id}`)}</span>
                        </Link>
                      )
                    })}
                  </div>

                  <div className="border-t border-white/[0.05] py-1">
                    <button
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:bg-red-500/[0.06] transition-colors text-start"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>{t("nav.logout")}</span>
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
