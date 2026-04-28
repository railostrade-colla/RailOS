"use client"

/**
 * Unified Create/Edit form for Projects AND Companies.
 * Both entities have tradable shares + auto-created wallet.
 *
 * Used by:
 * - Projects.tsx (main entry — view/create/edit)
 * - CreateProjectPanel (URL: /admin?tab=create_project)
 * - CreateCompanyPanel (URL: /admin?tab=create_company)
 */

import { useState } from "react"
import { Save, Send, Image as ImageIcon, Sprout, Building2, Factory, Briefcase, Stethoscope } from "lucide-react"
import { ActionBtn } from "@/components/admin/ui"
import { ALL_COMPANIES } from "@/lib/mock-data/companies"
import { createProjectWallet } from "@/lib/mock-data/projectWallets"
import { showError, showSuccess } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

export type EntityType = "project" | "company"
export type EntityMode = "create" | "edit"
export type EntitySector = "agriculture" | "real_estate" | "industrial" | "commercial" | "services" | "medical"
export type RiskLevel = "low" | "medium" | "high"
export type EntityStatus = "draft" | "active"

export interface EntityFormData {
  id?: string
  name?: string
  parent_company_id?: string  // فقط للمشروع
  sector?: EntitySector
  short_desc?: string
  long_desc?: string
  city?: string
  address?: string
  coords?: string
  share_price?: string
  total_shares?: string
  offering_pct?: string
  ambassador_pct?: string
  reserve_pct?: string
  offering_start?: string
  offering_end?: string
  return_min?: string
  return_max?: string
  duration_months?: string
  risk_level?: RiskLevel
}

const SECTOR_OPTIONS = [
  { id: "agriculture",  label: "زراعي",   icon: Sprout },
  { id: "real_estate",  label: "عقاري",   icon: Building2 },
  { id: "industrial",   label: "صناعي",   icon: Factory },
  { id: "commercial",   label: "تجاري",   icon: Briefcase },
  { id: "services",     label: "خدمي",     icon: Briefcase },
  { id: "medical",      label: "طبّي",     icon: Stethoscope },
] as const

const RISK_OPTIONS: { id: RiskLevel; label: string; color: "green" | "yellow" | "red" }[] = [
  { id: "low",    label: "منخفض",  color: "green"  },
  { id: "medium", label: "متوسط",  color: "yellow" },
  { id: "high",   label: "مرتفع",   color: "red"    },
]

export interface EntityFormPanelProps {
  mode: EntityMode
  entityType: EntityType
  initialData?: EntityFormData
  /** Called after successful save/cancel — usually navigates away. */
  onDone?: () => void
}

export function EntityFormPanel({ mode, entityType, initialData, onDone }: EntityFormPanelProps) {
  const isProject = entityType === "project"
  const isEdit = mode === "edit"

  // §1
  const [name, setName] = useState(initialData?.name ?? "")
  const [companyId, setCompanyId] = useState<string>(initialData?.parent_company_id ?? (isProject ? (ALL_COMPANIES[0]?.id || "") : ""))
  const [sector, setSector] = useState<EntitySector>(initialData?.sector ?? "real_estate")
  const [shortDesc, setShortDesc] = useState(initialData?.short_desc ?? "")
  const [longDesc, setLongDesc] = useState(initialData?.long_desc ?? "")
  // §3 location
  const [city, setCity] = useState(initialData?.city ?? "")
  const [address, setAddress] = useState(initialData?.address ?? "")
  const [coords, setCoords] = useState(initialData?.coords ?? "")
  // §4 price
  const [sharePrice, setSharePrice] = useState(initialData?.share_price ?? "")
  const [totalShares, setTotalShares] = useState(initialData?.total_shares ?? "")
  // §5 split
  const [offeringPct, setOfferingPct] = useState(initialData?.offering_pct ?? "90")
  const [ambassadorPct, setAmbassadorPct] = useState(initialData?.ambassador_pct ?? "2")
  const [reservePct, setReservePct] = useState(initialData?.reserve_pct ?? "8")
  // §6 dates
  const [offeringStart, setOfferingStart] = useState(initialData?.offering_start ?? "")
  const [offeringEnd, setOfferingEnd] = useState(initialData?.offering_end ?? "")
  // §7 returns + risk
  const [returnMin, setReturnMin] = useState(initialData?.return_min ?? "12")
  const [returnMax, setReturnMax] = useState(initialData?.return_max ?? "18")
  const [durationMonths, setDurationMonths] = useState(initialData?.duration_months ?? "36")
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(initialData?.risk_level ?? "medium")

  const sharePriceNum = Number(sharePrice) || 0
  const totalSharesNum = Number(totalShares) || 0
  const totalValue = sharePriceNum * totalSharesNum
  const totalPct = (Number(offeringPct) || 0) + (Number(ambassadorPct) || 0) + (Number(reservePct) || 0)

  const isValid =
    name.trim().length >= 3 &&
    (!isProject || !!companyId) &&  // companyId only required for projects
    shortDesc.trim().length >= 20 &&
    sharePriceNum > 0 &&
    totalSharesNum > 0 &&
    Math.abs(totalPct - 100) < 0.01 &&
    !!offeringStart &&
    !!offeringEnd &&
    !!city.trim()

  const titlePrefix = isEdit
    ? (isProject ? "✏️ تعديل المشروع" : "✏️ تعديل الشركة")
    : (isProject ? "➕ إنشاء مشروع جديد" : "➕ إنشاء شركة جديدة")

  const subtitle = isProject
    ? "استمارة شاملة لمشروع — يُنشأ wallet تلقائياً عند النشر"
    : "استمارة شاملة للشركة — حصص قابلة للتداول + wallet تلقائي"

  const handleSave = (status: EntityStatus) => {
    if (status === "active" && !isValid) {
      showError("بعض الحقول الإجبارية فارغة أو النسب لا تساوي 100%")
      return
    }
    if (isEdit) {
      showSuccess(status === "active"
        ? `✅ تم حفظ التعديلات + نشر${isProject ? " المشروع" : " الشركة"}`
        : "💾 تم حفظ التعديلات كمسودّة"
      )
    } else {
      if (status === "active") {
        const newId = `${isProject ? "p" : "c"}-${Date.now()}`
        const wallet = createProjectWallet(newId, name)
        showSuccess(`✅ تم نشر "${name}" + إنشاء محفظة (${wallet.id})`)
      } else {
        showSuccess("💾 تم حفظ المسودّة")
      }
    }
    onDone?.()
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-5">
        <div className="text-lg font-bold text-white">{titlePrefix}{name && isEdit ? ` — ${name}` : ""}</div>
        <div className="text-xs text-neutral-500 mt-0.5">{subtitle}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* §1 Basic info */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 lg:col-span-2">
          <div className="text-sm font-bold text-white mb-4">1️⃣ معلومات أساسية</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">{isProject ? "اسم المشروع *" : "اسم الشركة *"}</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder={isProject ? "مثلاً: مزرعة التمور الذكية" : "مثلاً: شركة الواحة الزراعية"}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
              />
            </div>
            {isProject ? (
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">الشركة الأمّ *</label>
                <select
                  value={companyId} onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                >
                  {ALL_COMPANIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">سنة التأسيس</label>
                <input
                  type="number" value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)}
                  placeholder="2018"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
                />
              </div>
            )}
          </div>

          <div className="mt-3">
            <label className="text-xs text-neutral-400 mb-2 block">{isProject ? "نوع المشروع *" : "قطاع الشركة *"}</label>
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
              {SECTOR_OPTIONS.map((t) => {
                const Icon = t.icon
                return (
                  <button
                    key={t.id}
                    onClick={() => setSector(t.id as EntitySector)}
                    className={cn(
                      "py-2.5 rounded-lg border transition-colors text-center flex flex-col items-center gap-1",
                      sector === t.id
                        ? "bg-blue-400/[0.15] border-blue-400/[0.4] text-blue-400"
                        : "bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:text-white"
                    )}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                    <span className="text-[10px]">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-3">
            <label className="text-xs text-neutral-400 mb-1.5 block">وصف قصير * (20-150 حرف)</label>
            <input
              type="text" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)}
              placeholder="ملخّص جذّاب يظهر في البطاقة"
              maxLength={150}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
            />
            <div className="text-[10px] text-neutral-500 text-left mt-1 font-mono">{shortDesc.length} / 150</div>
          </div>

          <div className="mt-3">
            <label className="text-xs text-neutral-400 mb-1.5 block">وصف كامل</label>
            <textarea
              value={longDesc} onChange={(e) => setLongDesc(e.target.value)} rows={4}
              placeholder={isProject ? "تفاصيل المشروع، الخطّة، فريق الإدارة، ..." : "نشاط الشركة، تاريخها، إنجازاتها، ..."}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
            />
          </div>
        </div>

        {/* §2 Cover + gallery */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">2️⃣ {isProject ? "الصور" : "الشعار + الصور"}</div>
          <button className="w-full bg-white/[0.04] border-2 border-dashed border-white/[0.15] rounded-xl py-8 hover:border-white/[0.25] transition-colors flex flex-col items-center gap-2 mb-2">
            <ImageIcon className="w-8 h-8 text-neutral-400" strokeWidth={1.5} />
            <span className="text-xs text-neutral-300 font-bold">{isProject ? "صورة الغلاف" : "شعار الشركة"}</span>
            <span className="text-[10px] text-neutral-500">اضغط للرفع (placeholder)</span>
          </button>
          <button className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 hover:bg-white/[0.06] text-xs text-neutral-300 transition-colors">
            + إضافة معرض صور (placeholder)
          </button>
        </div>

        {/* §3 Location */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">3️⃣ {isProject ? "الموقع" : "المقرّ الرئيسي"}</div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">المدينة *</label>
              <input
                type="text" value={city} onChange={(e) => setCity(e.target.value)}
                placeholder="بغداد"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">العنوان</label>
              <input
                type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="حيّ الكرّادة، شارع 12"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">الإحداثيات (lat,lng)</label>
              <input
                type="text" value={coords} onChange={(e) => setCoords(e.target.value)}
                placeholder="33.3152, 44.3661"
                dir="ltr"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 font-mono"
              />
            </div>
          </div>
        </div>

        {/* §4 Price + shares */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">4️⃣ السعر والحصص</div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">سعر الحصّة (د.ع) *</label>
              <input
                type="number" value={sharePrice} onChange={(e) => setSharePrice(e.target.value)}
                placeholder="100000"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">إجمالي الحصص *</label>
              <input
                type="number" value={totalShares} onChange={(e) => setTotalShares(e.target.value)}
                placeholder="10000"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
              />
            </div>
            <div className="bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-xl p-3 flex justify-between">
              <span className="text-[11px] text-blue-400">القيمة الإجمالية</span>
              <span className="text-base font-bold text-blue-400 font-mono">{fmtNum(totalValue)} د.ع</span>
            </div>
          </div>
        </div>

        {/* §5 Wallet split */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">5️⃣ توزيع المحافظ</div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">طرح للجمهور (%)</label>
              <input type="number" value={offeringPct} onChange={(e) => setOfferingPct(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">سفير (%)</label>
              <input type="number" value={ambassadorPct} onChange={(e) => setAmbassadorPct(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">احتياطي (%)</label>
              <input type="number" value={reservePct} onChange={(e) => setReservePct(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20" />
            </div>
            <div className={cn(
              "rounded-xl p-3 flex justify-between text-xs border",
              Math.abs(totalPct - 100) < 0.01
                ? "bg-green-400/[0.05] border-green-400/[0.2] text-green-400"
                : "bg-red-400/[0.05] border-red-400/[0.2] text-red-400"
            )}>
              <span>المجموع</span>
              <span className="font-mono font-bold">{totalPct}% / 100%</span>
            </div>
          </div>
        </div>

        {/* §6 Dates */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">6️⃣ تواريخ الطرح</div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">بدء الطرح *</label>
              <input type="date" value={offeringStart} onChange={(e) => setOfferingStart(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">انتهاء الطرح *</label>
              <input type="date" value={offeringEnd} onChange={(e) => setOfferingEnd(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">{isProject ? "مدّة المشروع (شهور)" : "مدّة الطرح (شهور)"}</label>
              <input type="number" value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20" />
            </div>
          </div>
        </div>

        {/* §7 Returns + risk */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">7️⃣ العائد والمخاطر</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">عائد أدنى (%)</label>
              <input type="number" value={returnMin} onChange={(e) => setReturnMin(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white font-mono outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">عائد أقصى (%)</label>
              <input type="number" value={returnMax} onChange={(e) => setReturnMax(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white font-mono outline-none focus:border-white/20" />
            </div>
          </div>
          <label className="text-xs text-neutral-400 mb-1.5 block">مستوى المخاطر</label>
          <div className="grid grid-cols-3 gap-2">
            {RISK_OPTIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRiskLevel(r.id)}
                className={cn(
                  "py-2.5 rounded-lg text-xs font-bold border transition-colors",
                  riskLevel === r.id
                    ? r.color === "green" ? "bg-green-400/[0.15] border-green-400/[0.4] text-green-400" :
                      r.color === "yellow" ? "bg-yellow-400/[0.15] border-yellow-400/[0.4] text-yellow-400" :
                                             "bg-red-400/[0.15] border-red-400/[0.4] text-red-400"
                    : "bg-white/[0.04] border-white/[0.08] text-neutral-400"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Footer actions */}
      <div className="flex gap-2 mt-5">
        <ActionBtn label="💾 حفظ كمسودّة" color="gray" onClick={() => handleSave("draft")} />
        <ActionBtn
          label={
            isEdit
              ? "✅ حفظ التعديلات + النشر"
              : isValid
                ? `📤 نشر${isProject ? " المشروع" : " الشركة"} + إنشاء المحفظة`
                : `📤 نشر (املأ كل الحقول)`
          }
          color="green"
          onClick={() => handleSave("active")}
          disabled={!isValid}
        />
      </div>
    </div>
  )
}
