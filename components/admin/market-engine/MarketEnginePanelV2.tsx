"use client"

/**
 * MarketEnginePanelV2 — Phase 13.45 / 13.46.
 *
 * The single, canonical place for the founder to control how
 * project share prices move. Replaces 7 sub-panels (Engine
 * Dashboard, Sector Caps, Commissions, Protection, Transfers
 * Monitoring, Decisions Log, Raise Price) with one unified
 * surface organised around two questions:
 *
 *   1. هل يتحرّك السعر تلقائياً مع كل صفقة؟  → ON/OFF + شروط
 *   2. هل أريد تعديل السعر الآن يدوياً؟       → اختيار مشروع + رفع
 *
 * Phase 13.46 will wire the dynamic-mode toggle + conditions to
 * a new market_engine_config row (one-row table) via RPC. The
 * manual-rise side already works through admin_force_market_rise
 * which stays as-is.
 */

import { useState } from "react"
import {
  Power,
  Settings as SettingsIcon,
  TrendingUp,
} from "lucide-react"
import { SectionHeader } from "@/components/admin/ui"
import { RaiseMarketPricePanel } from "@/components/admin/market-engine/RaiseMarketPricePanel"
import { cn } from "@/lib/utils/cn"

type Section = "dynamic" | "manual"

export function MarketEnginePanelV2() {
  const [section, setSection] = useState<Section>("dynamic")

  return (
    <div className="space-y-4">
      <SectionHeader
        title="⚙️ محرّك التسعير"
        subtitle="مكان واحد للتحكّم بكل ما يخصّ سعر السوق — تلقائي ويدوي"
      />

      {/* Section pills */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 max-w-md">
        <SectionPill
          icon={<Power className="w-3.5 h-3.5" />}
          label="🔄 الحركة الديناميكيّة"
          active={section === "dynamic"}
          onClick={() => setSection("dynamic")}
        />
        <SectionPill
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="📈 رفع يدوي"
          active={section === "manual"}
          onClick={() => setSection("manual")}
        />
      </div>

      {section === "dynamic" && <DynamicSection />}
      {section === "manual" && <ManualSection />}
    </div>
  )
}

// ─── Sub-component: dynamic mode ──────────────────────────────────
function DynamicSection() {
  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <SettingsIcon className="w-4 h-4 text-[#deff9a]" strokeWidth={2} />
        <div className="text-sm font-bold text-white">
          🔄 السعر يتبع الصفقات تلقائياً
        </div>
      </div>
      <p className="text-[11px] text-neutral-400 leading-relaxed">
        لمّا تُكمَل صفقة بين مستخدمَين، الـ trigger الموجود على جدول
        <span className="font-mono"> deals </span>
        يحدّث
        <span className="font-mono"> projects.current_market_price </span>
        إلى سعر تلك الصفقة. هذا المنطق الوحيد الذي يحرّك السعر
        ديناميكياً (Phase 11.12). يمكن إيقافه + تعديل شروطه عبر
        RPC <span className="font-mono">set_market_engine_state</span>
        الذي سيُضاف في Phase 13.46.
      </p>

      <div className="bg-[#deff9a]/[0.04] border border-[#deff9a]/[0.2] rounded-xl p-4">
        <div className="text-[11px] text-[#deff9a] font-bold mb-2">
          🛠️ Phase 13.46 — قيد البناء
        </div>
        <ul className="text-[11px] text-neutral-300 space-y-1.5 leading-relaxed list-disc pr-4">
          <li>زرّ تشغيل/إيقاف رئيسي</li>
          <li>حدّ أدنى لعدد صفقات اليوم قبل احتساب التغيّر</li>
          <li>سقف يومي (نسبة %) للحركة في أيّ اتجاه</li>
          <li>مهلة تهدئة بين تحديثَين متتاليَين لنفس المشروع</li>
          <li>سجلّ آخر 50 تحديث آليّ (مرئي للأدمن)</li>
        </ul>
      </div>
    </div>
  )
}

// ─── Sub-component: manual rise (existing panel preserved) ────────
function ManualSection() {
  return (
    <div className="space-y-3">
      <RaiseMarketPricePanel />
    </div>
  )
}

// ─── Pills ────────────────────────────────────────────────────────
function SectionPill({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors",
        active
          ? "bg-white/[0.1] text-white"
          : "text-neutral-400 hover:text-white",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
