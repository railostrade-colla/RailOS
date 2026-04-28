"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Bell, MessageCircle, Coins, Shield, ChevronDown, User, Sun, Moon, LogOut } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { MOCK_KYC_SUBMISSIONS } from "@/lib/mock-data/kyc"
import { MOCK_DISPUTES } from "@/lib/mock-data/disputes"
import { MOCK_FEE_REQUESTS, FEE_REQUEST_PAYMENT_LABELS } from "@/lib/mock-data/feeUnits"
import { ADMIN_SUPPORT_TICKETS } from "@/lib/mock-data/support"
import { MOCK_AMBASSADORS_ADMIN } from "@/lib/mock-data/ambassadors"
import { MOCK_HEALTHCARE_APPLICATIONS } from "@/lib/mock-data/healthcare"
import { showSuccess } from "@/lib/utils/toast"

const fmtNum = (n: number) => n.toLocaleString("en-US")

interface AdminNotification {
  id: string
  type: "kyc" | "dispute" | "fee" | "support" | "ambassador" | "healthcare"
  icon: string
  title: string
  body: string
  time: string
  href: string
}

function getAdminNotifications(limit: number = 10): AdminNotification[] {
  const list: AdminNotification[] = []

  MOCK_KYC_SUBMISSIONS.filter((k) => k.status === "pending").slice(0, 3).forEach((k) =>
    list.push({ id: `n-${k.id}`, type: "kyc", icon: "🛡️", title: `طلب KYC من ${k.user_name}`, body: k.city || "", time: k.submitted_at, href: "/admin?tab=kyc" })
  )
  MOCK_DISPUTES.filter((d) => d.status === "open").slice(0, 2).forEach((d) =>
    list.push({ id: `n-${d.id}`, type: "dispute", icon: "⚖️", title: `نزاع جديد ${d.id}`, body: `${d.buyer_name} ↔ ${d.seller_name}`, time: d.opened_at, href: "/admin?tab=disputes" })
  )
  MOCK_FEE_REQUESTS.filter((r) => r.status === "pending").slice(0, 2).forEach((r) =>
    list.push({ id: `n-${r.id}`, type: "fee", icon: "💎", title: `طلب شحن من ${r.user_name}`, body: `${fmtNum(r.requested_units)} وحدة`, time: r.submitted_at, href: "/admin?tab=fee_units_requests" })
  )
  ADMIN_SUPPORT_TICKETS.filter((t) => t.status === "new").slice(0, 2).forEach((t) =>
    list.push({ id: `n-${t.id}`, type: "support", icon: "💬", title: `تذكرة دعم ${t.id}`, body: t.subject, time: t.created_at, href: "/admin?tab=support_inbox" })
  )
  MOCK_AMBASSADORS_ADMIN.filter((a) => a.application_status === "pending").slice(0, 2).forEach((a) =>
    list.push({ id: `n-${a.id}`, type: "ambassador", icon: "🌟", title: `طلب سفير من ${a.user_name}`, body: a.user_email, time: a.applied_at, href: "/admin?tab=ambassadors_admin" })
  )
  MOCK_HEALTHCARE_APPLICATIONS.filter((a) => a.status === "pending").slice(0, 2).forEach((a) =>
    list.push({ id: `n-${a.id}`, type: "healthcare", icon: "🏥", title: `طلب رعاية من ${a.user_name}`, body: a.diagnosis.slice(0, 40) + "...", time: a.submitted_at, href: "/admin?tab=healthcare_admin" })
  )

  return list.sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, limit)
}

function getUnreadCounts() {
  return {
    kyc:        MOCK_KYC_SUBMISSIONS.filter((k) => k.status === "pending").length,
    disputes:   MOCK_DISPUTES.filter((d) => d.status === "open").length,
    fees:       MOCK_FEE_REQUESTS.filter((r) => r.status === "pending").length,
    support:    ADMIN_SUPPORT_TICKETS.filter((t) => t.status === "new").length,
    ambassadors: MOCK_AMBASSADORS_ADMIN.filter((a) => a.application_status === "pending").length,
    healthcare: MOCK_HEALTHCARE_APPLICATIONS.filter((a) => a.status === "pending").length,
    all: 0, // computed below
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
  const recentSupport = open === "messages" ? ADMIN_SUPPORT_TICKETS.filter((t) => t.status === "new").slice(0, 5) : []
  const recentFees = open === "fees" ? MOCK_FEE_REQUESTS.filter((r) => r.status === "pending").slice(0, 5) : []
  const recentKyc = open === "kyc" ? MOCK_KYC_SUBMISSIONS.filter((k) => k.status === "pending").slice(0, 5) : []

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
        <Dropdown title={`💎 طلبات الرسوم (${counts.fees})`} onSeeAll={() => handleNavigate("/admin?tab=fee_units_requests")} side="right" rightOffset="ml-20 lg:ml-32">
          {recentFees.length === 0 ? (
            <div className="text-xs text-neutral-500 text-center py-6">لا طلبات معلّقة</div>
          ) : (
            <div>
              {recentFees.map((r) => {
                const pm = FEE_REQUEST_PAYMENT_LABELS[r.payment_method]
                return (
                  <div key={r.id} className="p-3 border-b border-white/[0.04] last:border-0">
                    <div className="flex items-start gap-2">
                      <span className="text-base flex-shrink-0">{pm.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white font-bold truncate">{r.user_name}</div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">
                          <span className="font-mono">{fmtNum(r.requested_units)}</span> وحدة · {pm.label}
                        </div>
                      </div>
                      <button
                        onClick={() => { showSuccess("✅ Quick approve"); }}
                        className="text-[10px] bg-green-500/[0.15] border border-green-500/[0.3] text-green-400 px-2 py-1 rounded hover:bg-green-500/[0.2]"
                      >
                        ✓
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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
