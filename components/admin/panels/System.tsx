"use client"

import { useState } from "react"
import { Plus, Shield } from "lucide-react"
import { Badge, ActionBtn, Table, THead, TH, TBody, TR, TD, SectionHeader, KPI, InnerTabBar } from "@/components/admin/ui"
import { mockAdminUsers } from "@/lib/admin/mock-data"
import { AdminUsersPanel } from "./AdminUsersPanel"
import { showSuccess } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

type SystemSubTab = "market_settings" | "settings" | "site_pages" | "system_messages" | "admins"

export function SystemPanel() {
  const [subTab, setSubTab] = useState<SystemSubTab>("market_settings")
  const [marketSettings, setMarketSettings] = useState({
    market_open: true,
    auctions_enabled: true,
    quick_sell_enabled: true,
    deal_duration_minutes: 15,
    welcome_bonus: 1000,
  })
  const [appSettings, setAppSettings] = useState({
    maintenance_mode: false,
    new_signups: true,
    notifications: true,
  })

  const tabs = [
    { key: "market_settings", label: "⚙ ضبط السوق" },
    { key: "settings", label: "🔧 الإعدادات" },
    { key: "site_pages", label: "📄 الصفحات القانونية" },
    { key: "system_messages", label: "✉️ رسائل النظام" },
    { key: "admins", label: "🛡 الأدمنز" },
  ]

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => {
        onChange(!checked)
        showSuccess("تم الحفظ")
      }}
      className={cn("relative w-12 h-6 rounded-full transition-colors", checked ? "bg-green-400" : "bg-white/[0.15]")}
    >
      <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all", checked ? "right-0.5" : "right-6")} />
    </button>
  )

  return (
    <div className="p-6 max-w-screen-2xl">

      <SectionHeader title="⚙ النظام" subtitle="إعدادات المنصة والصفحات القانونية والأدمنز" />

      <InnerTabBar tabs={tabs} active={subTab} onSelect={(k) => setSubTab(k as SystemSubTab)} />

      {/* Market Settings */}
      {subTab === "market_settings" && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 max-w-2xl">
          <div className="text-base font-bold text-white mb-1">⚙ ضبط السوق</div>
          <div className="text-xs text-neutral-500 mb-5">التحكم في حالة السوق والميزات</div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              <div>
                <div className="text-sm font-bold text-white">السوق مفتوح</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">السماح بفتح صفقات جديدة</div>
              </div>
              <Toggle checked={marketSettings.market_open} onChange={(v) => setMarketSettings({ ...marketSettings, market_open: v })} />
            </div>

            <div className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              <div>
                <div className="text-sm font-bold text-white">المزادات مفعّلة</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">السماح بإنشاء مزادات جديدة</div>
              </div>
              <Toggle checked={marketSettings.auctions_enabled} onChange={(v) => setMarketSettings({ ...marketSettings, auctions_enabled: v })} />
            </div>

            <div className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              <div>
                <div className="text-sm font-bold text-white">البيع السريع</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">السماح بنشر إعلانات بيع سريع</div>
              </div>
              <Toggle checked={marketSettings.quick_sell_enabled} onChange={(v) => setMarketSettings({ ...marketSettings, quick_sell_enabled: v })} />
            </div>

            <div className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              <div>
                <div className="text-sm font-bold text-white">مدة الصفقة (دقائق)</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">الوقت المسموح لإتمام الصفقة في غرفة الصفقات</div>
              </div>
              <input
                type="number"
                min="5"
                max="60"
                value={marketSettings.deal_duration_minutes}
                onChange={(e) => setMarketSettings({ ...marketSettings, deal_duration_minutes: parseInt(e.target.value) || 15 })}
                className="w-20 bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/20 text-center font-mono"
              />
            </div>

            <div className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              <div>
                <div className="text-sm font-bold text-white">مكافأة الترحيب</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">عدد الوحدات الممنوحة عند التسجيل</div>
              </div>
              <input
                type="number"
                min="0"
                value={marketSettings.welcome_bonus}
                onChange={(e) => setMarketSettings({ ...marketSettings, welcome_bonus: parseInt(e.target.value) || 0 })}
                className="w-28 bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/20 text-center font-mono"
              />
            </div>
          </div>

          <button
            onClick={() => showSuccess("تم حفظ إعدادات السوق")}
            className="w-full mt-5 bg-neutral-100 text-black py-3 rounded-xl text-sm font-bold hover:bg-neutral-200"
          >
            حفظ التغييرات
          </button>
        </div>
      )}

      {/* App Settings */}
      {subTab === "settings" && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 max-w-2xl">
          <div className="text-base font-bold text-white mb-1">🔧 إعدادات التطبيق</div>
          <div className="text-xs text-neutral-500 mb-5">التحكم في حالة التطبيق العامة</div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              <div>
                <div className="text-sm font-bold text-white">وضع الصيانة</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">إيقاف التطبيق مؤقتاً للمستخدمين</div>
              </div>
              <Toggle checked={appSettings.maintenance_mode} onChange={(v) => setAppSettings({ ...appSettings, maintenance_mode: v })} />
            </div>

            <div className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              <div>
                <div className="text-sm font-bold text-white">السماح بالتسجيل</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">تمكين تسجيل مستخدمين جدد</div>
              </div>
              <Toggle checked={appSettings.new_signups} onChange={(v) => setAppSettings({ ...appSettings, new_signups: v })} />
            </div>

            <div className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              <div>
                <div className="text-sm font-bold text-white">الإشعارات</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">تفعيل نظام الإشعارات</div>
              </div>
              <Toggle checked={appSettings.notifications} onChange={(v) => setAppSettings({ ...appSettings, notifications: v })} />
            </div>
          </div>
        </div>
      )}

      {/* Site Pages */}
      {subTab === "site_pages" && (
        <div className="space-y-3 max-w-3xl">
          {[
            { id: "terms", label: "الشروط والأحكام", path: "/terms", last_updated: "2026-04-20" },
            { id: "privacy", label: "سياسة الخصوصية", path: "/privacy", last_updated: "2026-04-15" },
            { id: "about", label: "عن رايلوس", path: "/about", last_updated: "2026-03-10" },
            { id: "guide", label: "دليل التطبيق", path: "/app-guide", last_updated: "2026-04-25" },
            { id: "investment-guide", label: "دليل الاستثمار", path: "/investment-guide", last_updated: "2026-04-22" },
          ].map((p) => (
            <div key={p.id} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">{p.label}</div>
                <div className="text-[11px] text-neutral-500 mt-0.5 font-mono">{p.path} • آخر تحديث: {p.last_updated}</div>
              </div>
              <ActionBtn label="تعديل" color="blue" onClick={() => showSuccess("نموذج التعديل قيد التطوير")} />
            </div>
          ))}
        </div>
      )}

      {/* System Messages */}
      {subTab === "system_messages" && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 max-w-2xl">
          <div className="text-base font-bold text-white mb-1">✉️ رسائل النظام</div>
          <div className="text-xs text-neutral-500 mb-5">إرسال إشعار جماعي لكل المستخدمين</div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block font-bold">العنوان</label>
              <input
                type="text"
                placeholder="مثال: تحديث جديد للتطبيق"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block font-bold">الرسالة</label>
              <textarea
                rows={4}
                placeholder="اكتب الرسالة هنا..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block font-bold">النوع</label>
              <div className="flex gap-2">
                {["info", "warning", "success"].map((type) => (
                  <button
                    key={type}
                    className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
                  >
                    {type === "info" ? "ℹ️ معلومة" : type === "warning" ? "⚠️ تحذير" : "✅ نجاح"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => showSuccess("تم إرسال الرسالة لجميع المستخدمين")}
            className="w-full mt-5 bg-neutral-100 text-black py-3 rounded-xl text-sm font-bold hover:bg-neutral-200"
          >
            إرسال للجميع
          </button>
        </div>
      )}

      {/* Admins — uses the unified AdminUsersPanel */}
      {subTab === "admins" && (
        <div className="-mx-6 -mb-6">
          <AdminUsersPanel />
        </div>
      )}
    </div>
  )
}
