"use client"

import {
  Users, Building2, FileText, TrendingUp, Cpu, Wallet, Vote,
  Heart, Bell, Headphones, Settings, ScrollText,
} from "lucide-react"
import { AdminCategoryCard } from "./AdminCategoryCard"

/**
 * Phase 14.13 Unified UI Part 4 — the 12-category admin navigation
 * grid, rendered on the dashboard BELOW the real-data widgets (KPI /
 * pending queue / live feed). Every href targets an EXISTING surface:
 * a ?tab= panel resolved by app/admin/page.tsx, or a real App-Router
 * admin page. No routes were restructured; the Sidebar still works.
 */
const SECTIONS = [
  { icon: Users,      title: "المستخدمون",          subtitle: "إدارة الحسابات، KYC",      color: "#60A5FA", href: "/admin?tab=users" },
  { icon: Building2,  title: "المشاريع",            subtitle: "المشاريع، الحصص",          color: "#C084FC", href: "/admin?tab=projects" },
  { icon: FileText,   title: "العقود والصفقات",     subtitle: "التداول، الإثباتات",       color: "#4ADE80", href: "/admin?tab=contracts_admin" },
  { icon: TrendingUp, title: "السوق",               subtitle: "الإعلانات، المزادات",      color: "#FBBF24", href: "/admin?tab=market" },
  { icon: Cpu,        title: "محرّك السوق",         subtitle: "السعر، مراقبة التشغيل",    color: "#F472B6", href: "/admin/engine-monitor" },
  { icon: Wallet,     title: "المالية",             subtitle: "الفواتير، العمولات",       color: "#22C55E", href: "/admin?tab=invoices_admin" },
  { icon: Vote,       title: "المجلس",              subtitle: "الانتخابات، المقترحات",    color: "#818CF8", href: "/admin?tab=council_admin" },
  { icon: Heart,      title: "البرامج الاجتماعية",  subtitle: "الرعاية، الأيتام، الخصومات", color: "#FB7185", href: "/admin?tab=social_programs" },
  { icon: Bell,       title: "الإشعارات",           subtitle: "إرسال، إدارة",             color: "#FACC15", href: "/admin?tab=broadcaster" },
  { icon: Headphones, title: "الدعم",               subtitle: "التذاكر، الردود",          color: "#22D3EE", href: "/admin?tab=support_inbox" },
  { icon: Settings,   title: "إعدادات النظام",      subtitle: "تكوين، صلاحيات",           color: "#94A3B8", href: "/admin?tab=system" },
  { icon: ScrollText, title: "سجل الأحداث",         subtitle: "كل الأحداث، التتبع",        color: "#FB923C", href: "/admin?tab=audit_log" },
] as const

export function AdminSectionsGrid() {
  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-bold text-white">الأقسام</h2>
        <p className="text-[11px] text-neutral-500 mt-0.5">
          الوصول السريع لكل أقسام لوحة التحكم
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SECTIONS.map((s) => (
          <AdminCategoryCard
            key={s.href}
            icon={s.icon}
            title={s.title}
            subtitle={s.subtitle}
            color={s.color}
            href={s.href}
          />
        ))}
      </div>
    </div>
  )
}
