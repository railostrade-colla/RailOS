"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Edit2, LogOut, Crown, Calendar, Briefcase, TrendingUp, Trophy,
  Mail, User, Wallet, Lock, BarChart3, Gift, Settings,
} from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader, StatCard, Badge, Modal } from "@/components/ui"
import { SettingsCategoryCard } from "@/components/settings"
import { signOut } from "@/lib/supabase/auth-helpers"
import { showSuccess } from "@/lib/utils/toast"
// Profile + portfolio numbers both come from Supabase (Phases 4.1 + I).
import { fmtLimit } from "@/lib/utils/contractLimits"
import {
  getCurrentUserProfile,
  getMyProfileExtras,
  type CurrentUserProfile,
  type UserProfileExtras,
} from "@/lib/data/profile"
import { getPortfolioData, type PortfolioSummary } from "@/lib/data/portfolio"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"

// Skeleton bar — same dark tone as inactive surfaces, with a subtle pulse.
function Skel({ className }: { className: string }) {
  return <span className={cn("inline-block bg-white/[0.08] rounded animate-pulse", className)} />
}

/**
 * Phase 14.13 Unified UI Part 3 — Profile redesigned to match the new
 * Settings language: centered hero (avatar + level + KYC) → quick
 * stats → vertical category cards → logout. ALL data hooks (profile /
 * portfolio / extras / follows) and the logout flow are preserved
 * verbatim. The old settings menu's stale `/settings?tab=` links are
 * replaced with the real Part-2 sub-page routes.
 */
export default function ProfilePage() {
  const router = useRouter()
  const t = useTranslations("profile")
  const tc = useTranslations("common")
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const [profile, setProfile] = useState<CurrentUserProfile | null>(null)
  const [dbPortfolio, setDbPortfolio] = useState<PortfolioSummary | null>(null)
  const [extras, setExtras] = useState<UserProfileExtras | null>(null)
  const [followsCount, setFollowsCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // Phase 10.81 (Task 23) — fetch profile + portfolio + onboarding
    // extras + watchlist count in parallel. Each failure is isolated
    // so a single missing source doesn't blank the whole page.
    Promise.all([
      getCurrentUserProfile(),
      getPortfolioData(),
      getMyProfileExtras(),
      (async () => {
        try {
          const sb = createClient()
          const { data: auth } = await sb.auth.getUser()
          if (!auth?.user?.id) return 0
          const { count } = await sb
            .from("follows")
            .select("id", { count: "exact", head: true })
            .eq("user_id", auth.user.id)
          return count ?? 0
        } catch {
          return 0
        }
      })(),
    ]).then(([p, port, ext, fc]) => {
      if (cancelled) return
      setProfile(p)
      if (port) setDbPortfolio(port.summary)
      setExtras(ext)
      setFollowsCount(fc)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Real portfolio only — production mode (zeros until DB returns).
  const portfolio = dbPortfolio
    ? {
        totalValue: dbPortfolio.totalValue,
        totalCost: dbPortfolio.totalCost,
        totalProfit: dbPortfolio.totalProfit,
        holdingsCount: dbPortfolio.holdingsCount,
      }
    : {
        totalValue: 0,
        totalCost: 0,
        totalProfit: 0,
        holdingsCount: 0,
      }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await signOut()
    } catch {
      // best-effort — we navigate either way so a stale session
      // can't trap the user inside the (app) shell.
    }
    showSuccess(t("logoutSuccess"))
    // Phase 11.03 — HARD navigation. window.location.replace clears all
    // React state, dedup caches, realtime channels, and prevents the
    // back button from returning into a logged-out session.
    if (typeof window !== "undefined") {
      window.location.replace("/login")
    }
  }

  // ─── Category cards (real routes only — no stale ?tab= links) ──
  const categories = [
    {
      icon: User,
      title: t("catPersonalTitle"),
      subtitle: t("catPersonalSub"),
      color: "#F472B6",
      href: "/profile-setup",
    },
    {
      icon: Wallet,
      title: t("catWalletTitle"),
      subtitle: t("catWalletSub"),
      color: "#60A5FA",
      href: "/portfolio",
    },
    {
      icon: Lock,
      title: t("catSecurityTitle"),
      subtitle: t("catSecuritySub"),
      color: "#4ADE80",
      href: "/settings/security",
    },
    {
      icon: BarChart3,
      title: t("catActivityTitle"),
      subtitle: t("catActivitySub"),
      color: "#FBBF24",
      href: "/orders",
    },
    {
      icon: Gift,
      title: t("catAmbassadorTitle"),
      subtitle: t("catAmbassadorSub"),
      color: "#C084FC",
      href: "/ambassador",
    },
    {
      icon: Settings,
      title: t("catSettingsTitle"),
      subtitle: t("catSettingsSub"),
      color: "#22D3EE",
      href: "/settings",
    },
  ] as const

  const avatarChar = profile?.full_name?.charAt(0) ?? "?"

  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader title={t("pageTitle")} subtitle={t("pageSubtitle")} showBack={false} />

          {/* ═══ § 1 Hero — centered avatar + level + KYC ═══ */}
          <Card variant="gradient" color="purple" className="mb-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-400/[0.3] to-blue-400/[0.2] border border-purple-400/30 flex items-center justify-center text-4xl font-bold text-white">
                {loading ? <Skel className="w-10 h-10 rounded-md" /> : avatarChar}
              </div>

              <div className="flex items-center gap-2 mt-4 mb-1 flex-wrap justify-center">
                {loading ? (
                  <>
                    <Skel className="h-5 w-32" />
                    <Skel className="h-4 w-16 rounded-full" />
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-bold text-white">
                      {profile?.full_name ?? "—"}
                    </h2>
                    <Badge color="purple" variant="soft" icon={profile?.level_icon ?? "⭐"}>
                      {profile?.level_label ?? "—"}
                    </Badge>
                    {profile?.is_verified && (
                      <Badge color="green" variant="soft" size="xs">{t("verifiedBadge")}</Badge>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mb-4">
                <Mail className="w-3 h-3" />
                {loading ? (
                  <Skel className="h-3 w-40" />
                ) : (
                  <span dir="ltr">{profile?.email ?? "—"}</span>
                )}
              </div>

              <button
                onClick={() => router.push("/profile-setup")}
                className="bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Edit2 className="w-3 h-3" strokeWidth={2} />
                {t("editProfile")}
              </button>
            </div>

            {/* Quick stats inside hero */}
            <div className="grid grid-cols-3 gap-2 mt-5">
              <StatCard
                size="sm"
                label={t("joinDate")}
                value={loading ? "..." : (profile?.joined_year_month || "—")}
                icon={<Calendar className="w-3 h-3" />}
              />
              <StatCard
                size="sm"
                label={t("tradesLabel")}
                value={loading ? "..." : (profile?.total_trades ?? 0)}
                color="blue"
              />
              <StatCard
                size="sm"
                label={t("successRateP")}
                value={loading ? "..." : `${profile?.success_rate ?? 0}%`}
                color="green"
              />
            </div>
          </Card>

          {/* ═══ § 2 Banner Premium ═══ */}
          {/* TODO Phase 4.X: Hide if user already has an active row in
              quick_sale_subscriptions (currently always visible). */}
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
                    <Badge color="yellow" variant="soft" size="xs">{t("premiumNew")}</Badge>
                  </div>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    {t("premiumDesc")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                {[
                  { icon: "⚡", text: t("feat1") },
                  { icon: "💰", text: t("feat2") },
                  { icon: "🎯", text: t("feat3") },
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
                {t("subscribeNow")}
              </button>
              <p className="text-[10px] text-neutral-500 text-center mt-2">{t("cancelAnytime")}</p>
            </div>
          </Card>

          {/* ═══ § 3 Quick Stats ═══ */}
          <div className="mb-6">
            <SectionHeader title={t("quickGlance")} subtitle={t("quickGlanceSub")} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <StatCard
                label={t("totalPortfolio")}
                value={fmtLimit(portfolio.totalValue) + " " + t("iqd")}
                color="blue"
                icon={<Briefcase className="w-3 h-3" />}
              />
              <StatCard
                label={t("activeInvestments")}
                value={portfolio.holdingsCount}
                color="green"
              />
              <StatCard
                label={t("totalProfit")}
                value={(portfolio.totalProfit >= 0 ? "+" : "") + fmtLimit(portfolio.totalProfit)}
                color={portfolio.totalProfit >= 0 ? "green" : "red"}
                icon={<TrendingUp className="w-3 h-3" />}
              />
              <StatCard
                label={t("myLevel")}
                value={loading ? "..." : (profile?.level_label ?? "—")}
                color="purple"
                icon={<Trophy className="w-3 h-3" />}
              />
            </div>
            {/* Phase 10.81 — extra row: watchlist count + KYC + onboarding */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-2.5">
              <StatCard
                label={t("iFollow")}
                value={loading ? "..." : followsCount}
                color="blue"
              />
              <StatCard
                label={t("kycStatus")}
                value={loading ? "..." :
                  profile?.kyc_status === "approved" ? t("kycVerified") :
                  profile?.kyc_status === "pending" ? t("kycPending") :
                  profile?.kyc_status === "rejected" ? t("kycRejected") : "—"
                }
                color={profile?.kyc_status === "approved" ? "green" : "yellow"}
              />
              <StatCard
                label={t("profession")}
                value={loading ? "..." : (extras?.profession ?? "—")}
                color="purple"
              />
              <StatCard
                label={t("city")}
                value={loading ? "..." : (extras?.city ?? "—")}
                color="blue"
              />
            </div>
          </div>

          {/* ═══ § 4 Category cards ═══ */}
          <SectionHeader title={t("settingsSection")} subtitle={t("settingsSectionSub")} />
          <div className="flex flex-col gap-3 mb-6">
            {categories.map((c) => (
              <SettingsCategoryCard
                key={c.href}
                icon={c.icon}
                title={c.title}
                subtitle={c.subtitle}
                color={c.color}
                href={c.href}
              />
            ))}
          </div>

          {/* ═══ § 5 Logout ═══ */}
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full bg-red-400/[0.06] border border-red-400/25 hover:bg-red-400/[0.1] text-red-400 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={2} />
            {t("logout")}
          </button>

        </div>
      </div>

      {/* Logout confirmation Modal */}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => !loggingOut && setShowLogoutModal(false)}
        title={t("logout")}
        subtitle={t("logoutConfirmSub")}
        variant="warning"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowLogoutModal(false)}
              disabled={loggingOut}
              className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-2.5 rounded-xl text-sm hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
            >
              {tc("buttons.cancel")}
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex-1 bg-red-400/[0.1] border border-red-400/30 text-red-400 py-2.5 rounded-xl text-sm font-bold hover:bg-red-400/[0.15] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loggingOut ? (
                <>
                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  {t("working")}
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4" strokeWidth={2} />
                  {t("logout")}
                </>
              )}
            </button>
          </>
        }
      >
        <p className="text-sm text-neutral-300 leading-relaxed">
          {t("logoutWarn")}
        </p>
      </Modal>
    </AppLayout>
  )
}
