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
import { Image as ImageIcon, Sprout, Building2, Factory, Briefcase, Stethoscope, FileText, X, Plus } from "lucide-react"
import { ActionBtn } from "@/components/admin/ui"
import { ALL_COMPANIES } from "@/lib/mock-data/companies"
import { createProjectWallet } from "@/lib/mock-data/projectWallets"
import { showError, showSuccess } from "@/lib/utils/toast"
import { calculateTotalShares, calculateOfferedShares } from "@/lib/utils/finance"
import type {
  ProjectEntityType,
  ProjectBuildStatus,
  ProjectQuality,
  ProjectInvestmentType,
  ProjectDistributionType,
  ProjectDocument,
} from "@/lib/mock-data/types"
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

  // Extended fields (admin form expansion)
  symbol?: string
  entity_type?: ProjectEntityType
  build_status?: ProjectBuildStatus
  quality?: ProjectQuality
  revenue?: string
  project_value?: string
  listing_percent?: string
  capital_needed?: string
  capital_raised?: string
  owner_percent?: string
  offer_percent?: string
  investment_type?: ProjectInvestmentType
  distribution_type?: ProjectDistributionType
  profit_source?: string
  owner_name?: string
  owner_phone?: string
  owner_email?: string
  detailed_address?: string
  logo?: string
  project_images?: string[]
  company_images?: string[]
  documents?: ProjectDocument[]
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

  // ─── §8 Extended classification ───
  const [symbol, setSymbol] = useState(initialData?.symbol ?? "")
  const [entityTypeField, setEntityTypeField] = useState<ProjectEntityType>(
    initialData?.entity_type ?? (isProject ? "project" : "company")
  )
  const [buildStatus, setBuildStatus] = useState<ProjectBuildStatus>(initialData?.build_status ?? "planning")
  const [quality, setQuality] = useState<ProjectQuality>(initialData?.quality ?? "medium")
  const [revenue, setRevenue] = useState(initialData?.revenue ?? "")

  // ─── §9 Extended financial ───
  const [projectValue, setProjectValue] = useState(initialData?.project_value ?? "")
  const [listingPercent, setListingPercent] = useState(initialData?.listing_percent ?? "40")
  const [investmentType, setInvestmentType] = useState<ProjectInvestmentType>(initialData?.investment_type ?? "direct")
  const [capitalNeeded, setCapitalNeeded] = useState(initialData?.capital_needed ?? "")
  const [capitalRaised, setCapitalRaised] = useState(initialData?.capital_raised ?? "0")
  const [ownerPercent, setOwnerPercent] = useState(initialData?.owner_percent ?? "60")
  const [offerPercent, setOfferPercent] = useState(initialData?.offer_percent ?? "40")

  // ─── §10 Distribution ───
  const [distributionType, setDistributionType] = useState<ProjectDistributionType>(initialData?.distribution_type ?? "quarterly")
  const [profitSource, setProfitSource] = useState(initialData?.profit_source ?? "")

  // ─── §11 Owner contact ───
  const [ownerName, setOwnerName] = useState(initialData?.owner_name ?? "")
  const [ownerPhone, setOwnerPhone] = useState(initialData?.owner_phone ?? "")
  const [ownerEmail, setOwnerEmail] = useState(initialData?.owner_email ?? "")
  const [detailedAddress, setDetailedAddress] = useState(initialData?.detailed_address ?? "")

  // ─── §12 Documents ───
  const [documents, setDocuments] = useState<ProjectDocument[]>(initialData?.documents ?? [])
  const [newDocName, setNewDocName] = useState("")
  const [newDocUrl, setNewDocUrl] = useState("")

  const sharePriceNum = Number(sharePrice) || 0
  const totalSharesNum = Number(totalShares) || 0
  const totalValue = sharePriceNum * totalSharesNum
  const totalPct = (Number(offeringPct) || 0) + (Number(ambassadorPct) || 0) + (Number(reservePct) || 0)

  // ─── Auto-calculations for preview cards ───
  const projectValueNum = Number(projectValue) || 0
  const listingPercentNum = Number(listingPercent) || 0
  const autoTotalShares = calculateTotalShares(projectValueNum, sharePriceNum)
  const autoOfferedShares = calculateOfferedShares(autoTotalShares, listingPercentNum)
  const capitalProgress = Number(capitalNeeded) > 0
    ? Math.min(100, (Number(capitalRaised) / Number(capitalNeeded)) * 100)
    : 0

  const addDocument = () => {
    if (!newDocName.trim() || !newDocUrl.trim()) {
      showError("اكتب اسم الوثيقة ورابطها")
      return
    }
    setDocuments([...documents, { name: newDocName.trim(), url: newDocUrl.trim() }])
    setNewDocName("")
    setNewDocUrl("")
  }
  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index))
  }

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

        {/* §8 Classification + Symbol (extended) */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 lg:col-span-2">
          <div className="text-sm font-bold text-white mb-4">8️⃣ التصنيف الموسَّع</div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">الرمز (Symbol)</label>
              <input
                type="text" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="مثلاً: RMD"
                maxLength={6}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">نوع الكيان</label>
              <select
                value={entityTypeField}
                onChange={(e) => setEntityTypeField(e.target.value as ProjectEntityType)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
              >
                <option value="company">🏢 شركة</option>
                <option value="project">🏗️ مشروع</option>
                <option value="individual">👤 فرد</option>
                <option value="partnership">🤝 شراكة</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">حالة الإنشاء</label>
              <select
                value={buildStatus}
                onChange={(e) => setBuildStatus(e.target.value as ProjectBuildStatus)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
              >
                <option value="planning">قيد الإنشاء</option>
                <option value="active">نشط / مُنشأ</option>
                <option value="completed">منجز</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">مؤشّر الجودة</label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as ProjectQuality)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
              >
                <option value="low">🔴 منخفض</option>
                <option value="medium">🟡 متوسط</option>
                <option value="high">🟢 عالي</option>
              </select>
            </div>
          </div>

          {buildStatus === "completed" && (
            <div className="mt-3">
              <label className="text-xs text-neutral-400 mb-1.5 block">الإيرادات (للمنجز فقط)</label>
              <input
                type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)}
                placeholder="مثلاً: 25000000"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
              />
            </div>
          )}
        </div>

        {/* §9 Extended financial — capital + percentages + auto-calculated previews */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 lg:col-span-2">
          <div className="text-sm font-bold text-white mb-4">9️⃣ المعلومات المالية الموسَّعة</div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">قيمة المشروع الكلّية (د.ع)</label>
              <input
                type="number" value={projectValue} onChange={(e) => setProjectValue(e.target.value)}
                placeholder="500000000"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">سعر الحصّة الابتدائي (د.ع)</label>
              <input
                type="number" value={sharePrice} onChange={(e) => setSharePrice(e.target.value)}
                placeholder="50000"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
              />
            </div>
          </div>

          {/* Auto-calc preview: total shares */}
          {autoTotalShares > 0 && (
            <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-xl p-3 mb-3 flex justify-between items-center">
              <span className="text-[11px] text-green-400">⚡ الحصص الإجمالية المحسوبة تلقائياً</span>
              <span className="text-base font-bold text-green-400 font-mono">{fmtNum(autoTotalShares)} حصة</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">نسبة الطرح (%)</label>
              <input
                type="number" value={listingPercent} onChange={(e) => setListingPercent(e.target.value)}
                placeholder="40"
                min="1" max="100"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">نوع الاستثمار</label>
              <select
                value={investmentType}
                onChange={(e) => setInvestmentType(e.target.value as ProjectInvestmentType)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
              >
                <option value="direct">مباشر</option>
                <option value="auction">مزاد</option>
              </select>
            </div>
          </div>

          {/* Auto-calc preview: offered shares */}
          {autoOfferedShares > 0 && (
            <div className="bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-xl p-3 mb-3 flex justify-between items-center">
              <span className="text-[11px] text-blue-400">📊 الحصص المطروحة للمستثمرين</span>
              <span className="text-base font-bold text-blue-400 font-mono">{fmtNum(autoOfferedShares)} حصة</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">رأس المال المطلوب (د.ع)</label>
              <input
                type="number" value={capitalNeeded} onChange={(e) => setCapitalNeeded(e.target.value)}
                placeholder="200000000"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">رأس المال المُحقَّق (د.ع)</label>
              <input
                type="number" value={capitalRaised} onChange={(e) => setCapitalRaised(e.target.value)}
                placeholder="0"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
              />
            </div>
          </div>

          {/* Capital progress preview */}
          {Number(capitalNeeded) > 0 && (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3 mb-3">
              <div className="flex justify-between text-[11px] mb-2">
                <span className="text-neutral-400">تقدّم رأس المال</span>
                <span className="text-yellow-400 font-mono font-bold">{capitalProgress.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 transition-all"
                  style={{ width: `${capitalProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">نسبة المالك (%)</label>
              <input
                type="number" value={ownerPercent} onChange={(e) => setOwnerPercent(e.target.value)}
                placeholder="60"
                min="0" max="100"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">نسبة المطروح (%)</label>
              <input
                type="number" value={offerPercent} onChange={(e) => setOfferPercent(e.target.value)}
                placeholder="40"
                min="0" max="100"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
              />
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

        {/* §🔟 Distribution mechanism + Profit source */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">🔟 آلية التوزيع</div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">آلية التوزيع</label>
              <select
                value={distributionType}
                onChange={(e) => setDistributionType(e.target.value as ProjectDistributionType)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
              >
                <option value="monthly">🗓 شهري</option>
                <option value="quarterly">📅 ربعي</option>
                <option value="semi_annual">📆 نصف سنوي</option>
                <option value="annual">🗃 سنوي</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">مصدر الأرباح</label>
              <input
                type="text" value={profitSource} onChange={(e) => setProfitSource(e.target.value)}
                placeholder="مثلاً: أرباح التشغيل، الإيجارات"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
              />
            </div>
          </div>
        </div>

        {/* §1️⃣1️⃣ Owner contact */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 lg:col-span-2">
          <div className="text-sm font-bold text-white mb-4">1️⃣1️⃣ بيانات المالك</div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">اسم المالك (الكامل)</label>
              <input
                type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                placeholder="أحمد محمد"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">رقم الهاتف</label>
              <input
                type="tel" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="07XXXXXXXXX"
                dir="ltr"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 font-mono"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="text-xs text-neutral-400 mb-1.5 block">البريد الإلكتروني</label>
            <input
              type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@example.com"
              dir="ltr"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">العنوان التفصيلي</label>
            <textarea
              value={detailedAddress} onChange={(e) => setDetailedAddress(e.target.value)}
              rows={2}
              placeholder="المحافظة / المنطقة / الشارع / رقم البناية"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
            />
          </div>
        </div>

        {/* §1️⃣2️⃣ Documents (Media gallery already in §2) */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 lg:col-span-2">
          <div className="text-sm font-bold text-white mb-4">1️⃣2️⃣ الأوراق الرسمية والمستندات</div>

          {/* Existing documents list */}
          {documents.length > 0 && (
            <div className="space-y-2 mb-3">
              {documents.map((doc, i) => (
                <div key={i} className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-2.5 flex items-center gap-3">
                  <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-bold truncate">{doc.name}</div>
                    <div className="text-[10px] text-neutral-500 truncate" dir="ltr">{doc.url}</div>
                  </div>
                  <button
                    onClick={() => removeDocument(i)}
                    className="text-red-400 hover:text-red-300 flex-shrink-0"
                    aria-label="حذف"
                  >
                    <X className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new document */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,2fr,auto] gap-2">
            <input
              type="text" value={newDocName} onChange={(e) => setNewDocName(e.target.value)}
              placeholder="اسم الوثيقة (مثلاً: عقد التأسيس)"
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
            />
            <input
              type="text" value={newDocUrl} onChange={(e) => setNewDocUrl(e.target.value)}
              placeholder="https://example.com/document.pdf"
              dir="ltr"
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 font-mono"
            />
            <button
              onClick={addDocument}
              className="bg-blue-500/[0.15] border border-blue-500/30 hover:bg-blue-500/[0.2] text-blue-400 rounded-xl px-4 py-2.5 text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              إضافة
            </button>
          </div>

          <div className="text-[10px] text-neutral-500 mt-2 leading-relaxed">
            مثال: عقد التأسيس، الترخيص التجاري، شهادة الملكية، الميزانية الأخيرة...
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
