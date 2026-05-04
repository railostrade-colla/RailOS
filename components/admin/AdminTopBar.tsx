"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Bell, MessageCircle, Coins, Shield, ChevronDown, User, Sun, LogOut } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { showSuccess } from "@/lib/utils/toast"

interface AdminNotification {
  id: string
  type: "kyc" | "dispute" | "fee" | "support" | "ambassador" | "healthcare"
  icon: string
  title: string
  body: string
  time: string
  href: string
}

/**
 * Production mode — every notification surface returns an empty list.
 * The previous implementation read from MOCK_KYC_SUBMISSIONS / MOCK_DISPUTES
 * etc. and surfaced fake "9+ pending" badges on a fresh deployment.
 *
 * TODO (Phase 10.37): wire each surface to its real DB count via a single
 * `get_admin_notifications()` RPC. Until then we surface zeros so admins
 * aren't lied to.
 */
function getAdminNotifications(_limit: number = 10): AdminNotification[] {
  return []
}

function getUnreadCounts() {
  return {
    kyc: 0,
    disputes: 0,
    fees: 0,
    support: 0,
    ambassadors: 0,
    healthcare: 0,
    all: 0,
  }
}

type DropdownId = null | "notifications" | "messages" | "fees" | "kyc" | "profile"

export function AdminTopBar() {
  const router = useRouter()
  const [open, setOpen] = useState<DropdownId>(null)
  const ref = useRef<HTMLDivElement>(null)

  const counts = getUnreadCounts()
  const totalNotifs = counts.kyc + counts.disputes + counts.fees + counts.support + counts.ambassadors + counts.healthcare

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const allNotifs = open === "notifications" ? getAdminNotifications(10) : []
  // Production mode — empty until the real DB-backed notifications RPC ships.
  const recentSupport: { id: string; user_name: string; subject: string; created_at: string }[] = []
  const recentFees: { id: string; user_name: string; requested_units: number; payment_method: string }[] = []
  const recentKyc: { id: string; user_name: string; city?: string; submitted_at: string }[] = []

  const handleNavigate = (href: string) => {
    setOpen(null)
    router.push(href)
  }

  return (
    <div ref={ref} className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/[0.06] px-5 py-2.5 flex items-center justify-between" dir="rtl">

      {/* Right side (RTL): icons */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <IconBtn
          icon={<Bell className="w-4 h-4" strokeWidth={1.5} />}
          badge={totalNotifs}
          active={open === "notifications"}
          onClick={() => setOpen(open === "notifications" ? null : "notifications")}
        />

        {/* Messages */}
        <IconBtn
          icon={<MessageCircle className="w-4 h-4" strokeWidth={1.5} />}
          badge={counts.support}
          active={open === "messages"}
          onClick={() => setOpen(open === "messages" ? null : "messages")}
        />

        {/* Fee requests */}
        <IconBtn
          icon={<Coins className="w-4 h-4" strokeWidth={1.5} />}
          badge={counts.fees}
          active={open === "fees"}
          onClick={() => setOpen(open === "fees" ? null : "fees")}
        />

        {/* KYC */}
        <IconBtn
          icon={<Shield className="w-4 h-4" strokeWidth={1.5} />}
          badge={counts.kyc}
          active={open === "kyc"}
          onClick={() => setOpen(open === "kyc" ? null : "kyc")}
        />
      </div>

      {/* Left side (RTL): admin profile */}
      <button
        onClick={() => setOpen(open === "profile" ? null : "profile")}
        className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors",
          open === "profile" ? "bg-white/[0.08] border-white/[0.15]" : "bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.06]"
        )}
      >
        <div className="w-7 h-7 rounded-full bg-purple-400/[0.15] border border-purple-400/[0.3] flex items-center justify-center text-xs font-bold text-purple-300">
          A
        </div>
        <div className="text-right hidden lg:block">
          <div className="text-xs text-white font-bold leading-none">Admin@Main</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">مؤسّس</div>
        </div>
        <ChevronDown className="w-3 h-3 text-neutral-500" />
      </button>

      {/* ═══ Notifications dropdown ═══ */}
      {open === "notifications" && (
        <Dropdown title={`🔔 الإشعارات (${totalNotifs})`} onSeeAll={() => handleNavigate("/admin?tab=alerts")} side="right" rightOffset="ml-44 lg:ml-56">
          {allNotifs.length === 0 ? (
            <div className="text-xs text-neutral-500 text-center py-6">لا إشعارات جديدة</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {allNotifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNavigate(n.href)}
                  className="w-full text-right p-3 hover:bg-white/[0.04] border-b border-white/[0.04] last:border-0 transition-colors flex items-start gap-2.5"
                >
                  <span className="text-base flex-shrink-0">{n.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-bold truncate">{n.title}</div>
                    {n.body && <div className="text-[10px] text-neutral-500 truncate mt-0.5">{n.body}</div>}
                    <div className="text-[9px] text-neutral-600 mt-0.5 font-mono">{n.time}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Dropdown>
      )}

      {/* ═══ Messages dropdown ═══ */}
      {open === "messages" && (
        <Dropdown title={`💬 الرسائل (${counts.support})`} onSeeAll={() => handleNavigate("/admin?tab=support_inbox")} ctaLabel="📥 صندوق الدعم" side="right" rightOffset="ml-32 lg:ml-44">
          {recentSupport.length === 0 ? (
            <div className="text-xs text-neutral-500 text-center py-6">لا تذاكر جديدة</div>
          ) : (
            <div>
              {recentSupport.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleNavigate("/admin?tab=support_inbox")}
                  className="w-full text-right p-3 hover:bg-white/[0.04] border-b border-white/[0.04] last:border-0 transition-colors"
                >
                  <div className="text-xs text-white font-bold truncate">{t.user_name}</div>
                  <div className="text-[11px] text-neutral-400 truncate mt-0.5">{t.subject}</div>
                  <div className="text-[9px] text-neutral-600 mt-0.5 font-mono">{t.created_at}</div>
                </button>
              ))}
            </div>
          )}
        </Dropdown>
      )}

      {/* ═══ Fees dropdown ═══ */}
      {open === "fees" && (
        <Dropdown title={`💎 طلبات الرسوم (${counts.fees})`} onSeeAll={() => handleNavigate("/admin?tab=fees")} side="right" rightOffset="ml-20 lg:ml-32">
          <div className="text-xs text-neutral-500 text-center py-6">لا طلبات معلّقة</div>
        </Dropdown>
      )}

      {/* ═══ KYC dropdown ═══ */}
      {open === "kyc" && (
        <Dropdown title={`🛡️ طلبات KYC (${counts.kyc})`} onSeeAll={() => handleNavigate("/admin?tab=kyc")} side="right" rightOffset="ml-8 lg:ml-20">
          {recentKyc.length === 0 ? (
            <div className="text-xs text-neutral-500 text-center py-6">لا طلبات معلّقة</div>
          ) : (
            <div>
              {recentKyc.map((k) => (
                <button
                  key={k.id}
                  onClick={() => handleNavigate("/admin?tab=kyc")}
                  className="w-full text-right p-3 hover:bg-white/[0.04] border-b border-white/[0.04] last:border-0 transition-colors"
                >
                  <div className="text-xs text-white font-bold truncate">{k.user_name}</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">{k.city || "—"}</div>
                  <div className="text-[9px] text-neutral-600 mt-0.5 font-mono">{k.submitted_at}</div>
                </button>
              ))}
            </div>
          )}
        </Dropdown>
      )}

      {/* ═══ Profile dropdown (left side) ═══ */}
      {open === "profile" && (
        <div className="absolute top-full left-5 mt-2 w-64 bg-[#0a0a0a] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden">
          <div className="p-3 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="text-xs text-white font-bold">Admin@Main</div>
            <div className="text-[10px] text-neutral-500 mt-0.5" dir="ltr">founder@railos.iq</div>
          </div>
          <div className="p-1">
            <DropdownMenuItem icon={<User className="w-3.5 h-3.5" />} label="الملف الشخصي" onClick={() => handleNavigate("/admin?tab=admin_users")} />
            <DropdownMenuItem icon={<Sun className="w-3.5 h-3.5" />} label="تبديل الوضع" onClick={() => showSuccess("🌗 تبديل الوضع (placeholder)")} />
            <DropdownMenuItem icon={<LogOut className="w-3.5 h-3.5" />} label="تسجيل الخروج" onClick={() => router.push("/admin-login")} danger />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────

function IconBtn({ icon, badge, active, onClick }: { icon: React.ReactNode; badge: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-9 h-9 rounded-lg border flex items-center justify-center transition-colors",
        active ? "bg-white/[0.08] border-white/[0.15] text-white" : "bg-white/[0.04] border-white/[0.06] text-neutral-300 hover:bg-white/[0.06]"
      )}
    >
      {icon}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center font-mono">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  )
}

function Dropdown({
  title, children, onSeeAll, ctaLabel, rightOffset,
}: {
  title: string
  children: React.ReactNode
  onSeeAll: () => void
  ctaLabel?: string
  side?: "right" | "left"
  rightOffset?: string
}) {
  return (
    <div className={cn("absolute top-full mt-2 w-80 max-w-[90vw] bg-[#0a0a0a] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden z-50", rightOffset || "right-5")}>
      <div className="p-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="text-xs text-white font-bold">{title}</div>
      </div>
      {children}
      <button
        onClick={onSeeAll}
        className="w-full p-2.5 bg-white/[0.04] hover:bg-white/[0.06] text-[11px] text-blue-400 font-bold border-t border-white/[0.06] transition-colors"
      >
        {ctaLabel || "عرض الكل ←"}
      </button>
    </div>
  )
}

function DropdownMenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors text-right",
        danger ? "text-red-400 hover:bg-red-500/[0.08]" : "text-neutral-300 hover:bg-white/[0.05]"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
