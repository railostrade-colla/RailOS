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

import { useState, useEffect, useMemo, useRef } from "react"
import { Image as ImageIcon, Sprout, Building2, Factory, Briefcase, Stethoscope, FileText, X, Plus, Upload, RefreshCw } from "lucide-react"
import { ActionBtn } from "@/components/admin/ui"
import { ALL_COMPANIES } from "@/lib/mock-data/companies"
import { createProjectWallet } from "@/lib/mock-data/projectWallets"
import { adminCreateCompany } from "@/lib/data/companies"
import { adminCreateProject, getAllProjects } from "@/lib/data/projects"
import { getAllCompanies } from "@/lib/data/companies"
import { showError, showSuccess } from "@/lib/utils/toast"
import { calculateTotalShares, calculateOfferedShares } from "@/lib/utils/finance"
import { generateSymbol } from "@/lib/utils/symbol-generator"
import {
  loadCurrentDraft,
  saveCurrentDraft,
  clearCurrentDraft,
  saveDraft as saveDraftToList,
  type DraftKind,
} from "@/lib/admin/entity-drafts"
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
  /** Image upload (data URL or Supabase Storage URL). */
  logo_url?: string
  /** Cover/main image. */
  cover_url?: string
  /** Structured description sections (NEW Phase 10.22). */
  vision?: string
  goals?: string
  management?: string
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

export function EntityFormPanel({ mode, entityType, initialData: initialDataProp, onDone }: EntityFormPanelProps) {
  const isProject = entityType === "project"
  const isEdit = mode === "edit"
  const draftKind: DraftKind = isProject ? "project" : "company"

  // ─── Restore in-progress autosave on mount (create-mode only) ───
  // If admin had typed something and navigated away, repopulate.
  // Edit-mode never reads from autosave (uses passed-in initialData).
  const initialData = useMemo<EntityFormData | undefined>(() => {
    if (isEdit) return initialDataProp
    if (initialDataProp) return initialDataProp
    if (typeof window === "undefined") return undefined
    return loadCurrentDraft(draftKind) ?? undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // §1
  const [name, setName] = useState(initialData?.name ?? "")
  // Auto-generated 3-letter UPPERCASE symbol (transliterated from
  // Arabic name). Editable by the admin if they want a custom one.
  const [symbol, setSymbol] = useState(initialData?.symbol ?? "")
  const [symbolEditedManually, setSymbolEditedManually] = useState(false)
  // Image uploads — store as base64 data URLs locally; in production
  // these would upload to Supabase Storage and store the URL.
  const [logoUrl, setLogoUrl] = useState<string>(initialData?.logo_url ?? "")
  const [coverUrl, setCoverUrl] = useState<string>(initialData?.cover_url ?? "")
  const logoInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  // Default to "بلا" (empty string) for new projects so the admin
  // explicitly opts into a parent company instead of inheriting the
  // first one in the list by mistake.
  const [companyId, setCompanyId] = useState<string>(initialData?.parent_company_id ?? "")
  const [sector, setSector] = useState<EntitySector>(initialData?.sector ?? "real_estate")
  const [shortDesc, setShortDesc] = useState(initialData?.short_desc ?? "")
  // Three structured description sections (NEW)
  const [visionText, setVisionText] = useState<string>(initialData?.vision ?? "")
  const [goalsText, setGoalsText] = useState<string>(initialData?.goals ?? "")
  const [managementText, setManagementText] = useState<string>(initialData?.management ?? "")
  const [longDesc, setLongDesc] = useState(initialData?.long_desc ?? "")
  // Symbols already taken on the platform — used to auto-pick a
  // unique 3-letter symbol when admin types a new project name.
  const [takenSymbols, setTakenSymbols] = useState<string[]>([])
  // §3 location
  const [city, setCity] = useState(initialData?.city ?? "")
  const [address, setAddress] = useState(initialData?.address ?? "")
  const [coords, setCoords] = useState(initialData?.coords ?? "")
  // §4 price
  const [sharePrice, setSharePrice] = useState(initialData?.share_price ?? "")
  const [totalShares, setTotalShares] = useState(initialData?.total_shares ?? "")
  // §5 split — defaults sum to 100% INCLUDING owner% (60+30+2+8=100)
  const [offeringPct, setOfferingPct] = useState(initialData?.offering_pct ?? "30")
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

  // ─── §8 Extended classification (symbol moved to §1) ───
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
  const projectValueNum0 = Number(projectValue) || 0

  // ─── Auto-calc total_shares from project_value / share_price ───
  // The user requested: "عند ادخال سعر الحصة الابتدائي يتم تقسيم
  //   قيمة المشروع الكلية على سعر الحصة" — the result is a fixed,
  //   read-only count that the admin can't override.
  useEffect(() => {
    if (sharePriceNum > 0 && projectValueNum0 > 0) {
      const auto = Math.floor(projectValueNum0 / sharePriceNum)
      setTotalShares(String(auto))
    }
  }, [sharePriceNum, projectValueNum0])

  const totalSharesNum = Number(totalShares) || 0
  const totalValue = sharePriceNum * totalSharesNum
  // Owner% is now part of the 100% wallet split (see §5 below).
  const ownerPctNum = Number(ownerPercent) || 0
  const totalPct =
    ownerPctNum +
    (Number(offeringPct) || 0) +
    (Number(ambassadorPct) || 0) +
    (Number(reservePct) || 0)

  // ─── Load taken symbols once + auto-generate on name change ───
  useEffect(() => {
    let cancelled = false
    Promise.all([getAllProjects(), getAllCompanies()])
      .then(([projects, companies]) => {
        if (cancelled) return
        const takenP = (projects as Array<{ symbol?: string }>)
          .map((p) => p.symbol)
          .filter((s): s is string => Boolean(s))
        const takenC = (companies as Array<{ symbol?: string }>)
          .map((c) => c.symbol)
          .filter((s): s is string => Boolean(s))
        setTakenSymbols([...takenP, ...takenC])
      })
      .catch(() => {
        // best-effort; symbol generator falls back to random on collision
      })
    return () => { cancelled = true }
  }, [])

  // Auto-regenerate the symbol whenever the name changes — unless the
  // admin has manually edited it (then we respect their choice).
  useEffect(() => {
    if (symbolEditedManually) return
    if (!name.trim()) {
      setSymbol("")
      return
    }
    const next = generateSymbol(name, takenSymbols)
    setSymbol(next)
  }, [name, takenSymbols, symbolEditedManually])

  // ─── Auto-save the in-progress form to localStorage ───
  // Debounced 400ms so we don't write on every keystroke. Cleared
  // explicitly on publish + on cancel (see Footer actions below).
  // Edit-mode skips autosave because the source-of-truth is DB.
  useEffect(() => {
    if (isEdit) return
    const t = setTimeout(() => {
      saveCurrentDraft(draftKind, {
        name, symbol, parent_company_id: companyId, sector,
        short_desc: shortDesc, long_desc: longDesc,
        vision: visionText, goals: goalsText, management: managementText,
        logo_url: logoUrl, cover_url: coverUrl,
        city, address, coords,
        share_price: sharePrice, total_shares: totalShares,
        offering_pct: offeringPct, ambassador_pct: ambassadorPct, reserve_pct: reservePct,
        offering_start: offeringStart, offering_end: offeringEnd,
        return_min: returnMin, return_max: returnMax,
        duration_months: durationMonths, risk_level: riskLevel,
        entity_type: entityTypeField, build_status: buildStatus,
        quality, revenue, project_value: projectValue,
        listing_percent: listingPercent, capital_needed: capitalNeeded,
        capital_raised: capitalRaised, owner_percent: ownerPercent,
        offer_percent: offerPercent, investment_type: investmentType,
        distribution_type: distributionType, profit_source: profitSource,
        owner_name: ownerName, owner_phone: ownerPhone, owner_email: ownerEmail,
        detailed_address: detailedAddress, documents,
      })
    }, 400)
    return () => clearTimeout(t)
    // We intentionally watch every field — the effect rebuilds the
    // payload from current state, which is cheap.
  }, [
    isEdit, draftKind,
    name, symbol, companyId, sector, shortDesc, longDesc,
    visionText, goalsText, managementText, logoUrl, coverUrl,
    city, address, coords, sharePrice, totalShares,
    offeringPct, ambassadorPct, reservePct,
    offeringStart, offeringEnd, returnMin, returnMax,
    durationMonths, riskLevel, entityTypeField, buildStatus,
    quality, revenue, projectValue, listingPercent, capitalNeeded,
    capitalRaised, ownerPercent, offerPercent, investmentType,
    distributionType, profitSource, ownerName, ownerPhone, ownerEmail,
    detailedAddress, documents,
  ])

  // ─── Auto-calculations for preview cards ───
  const projectValueNum = Number(projectValue) || 0
  const listingPercentNum = Number(listingPercent) || 0
  const autoTotalShares = calculateTotalShares(projectValueNum, sharePriceNum)
  const autoOfferedShares = calculateOfferedShares(autoTotalShares, listingPercentNum)
  const capitalProgress = Number(capitalNeeded) > 0
    ? Math.min(100, (Number(capitalRaised) / Number(capitalNeeded)) * 100)
    : 0

  // ─── Owner% drives offered% automatically ───
  // User requested: "نسبة المالك بعدها يحدد تلقائي نسبة المطروح في
  //   السوق للتداول ويحدد عدد الحصص المطروحة والباقية ملك المالك."
  useEffect(() => {
    const offered = Math.max(0, 100 - ownerPctNum)
    setOfferPercent(String(offered))
  }, [ownerPctNum])

  const ownerSharesCount = Math.floor(totalSharesNum * ownerPctNum / 100)
  const offeredSharesCount = Math.max(0, totalSharesNum - ownerSharesCount)

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
    // companyId is now OPTIONAL for projects — empty string means
    // "بلا (مشروع مباشر)" and is allowed.
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

  /** Snapshot every form field into one EntityFormData blob. */
  const collectFormData = (): EntityFormData => ({
    name, symbol, parent_company_id: companyId, sector,
    short_desc: shortDesc, long_desc: longDesc,
    vision: visionText, goals: goalsText, management: managementText,
    logo_url: logoUrl, cover_url: coverUrl,
    city, address, coords,
    share_price: sharePrice, total_shares: totalShares,
    offering_pct: offeringPct, ambassador_pct: ambassadorPct, reserve_pct: reservePct,
    offering_start: offeringStart, offering_end: offeringEnd,
    return_min: returnMin, return_max: returnMax,
    duration_months: durationMonths, risk_level: riskLevel,
    entity_type: entityTypeField, build_status: buildStatus,
    quality, revenue, project_value: projectValue,
    listing_percent: listingPercent, capital_needed: capitalNeeded,
    capital_raised: capitalRaised, owner_percent: ownerPercent,
    offer_percent: offerPercent, investment_type: investmentType,
    distribution_type: distributionType, profit_source: profitSource,
    owner_name: ownerName, owner_phone: ownerPhone, owner_email: ownerEmail,
    detailed_address: detailedAddress, documents,
  })

  const handleSave = async (status: EntityStatus) => {
    // Drafts always succeed — promote the autosave into the saved-
    // drafts list and clear the autosave so the form resets when
    // the admin returns to it.
    if (status === "draft" && !isEdit) {
      const saved = await saveDraftToList(draftKind, collectFormData())
      clearCurrentDraft(draftKind)
      showSuccess(`💾 تم حفظ المسودّة "${saved.title}" — تجدها في تبويب المسودّات`)
      onDone?.()
      return
    }

    // Active publish: validate. If incomplete, ask the admin to
    // confirm rather than blocking entirely (some fields may be
    // legitimately empty for early-stage projects).
    if (status === "active" && !isValid) {
      const proceed = window.confirm(
        "بعض الحقول الإجبارية فارغة أو النسب لا تساوي 100%.\n\n" +
        "هل تريد المتابعة بالنشر مع البيانات الحالية؟"
      )
      if (!proceed) return
    }
    if (isEdit) {
      showSuccess(status === "active"
        ? `✅ تم حفظ التعديلات + نشر${isProject ? " المشروع" : " الشركة"}`
        : "💾 تم حفظ التعديلات كمسودّة"
      )
      // Edit mode never had an autosave entry to clear.
      onDone?.()
      return
    }

    // ── Companies → DB ──
    if (!isProject && status === "active") {
      const result = await adminCreateCompany({
        name: name.trim(),
        sector: sector,
        city: city.trim() || undefined,
        description: shortDesc.trim() || longDesc.trim() || undefined,
        share_price: Number(sharePrice) || 0,
        risk_level: riskLevel,
        founded_year: durationMonths ? Number(durationMonths) : undefined,
      })
      if (!result.success) {
        const map: Record<string, string> = {
          unauthenticated: "سجّل دخولك أولاً",
          not_admin: "صلاحياتك لا تسمح",
          invalid_name: "اسم الشركة مطلوب",
          invalid_sector: "القطاع مطلوب",
          invalid_risk: "مستوى الخطر غير صحيح",
          invalid_share_price: "سعر الحصة غير صحيح",
          missing_table: "الجداول غير منشورة بعد",
        }
        showError(map[result.reason ?? ""] ?? "فشل إنشاء الشركة")
        return
      }
      showSuccess(`✅ تم نشر شركة "${name}" في قاعدة البيانات`)
      clearCurrentDraft(draftKind)
      onDone?.()
      return
    }

    // ── Projects → DB (Phase 10.20+) ──
    if (isProject && status === "active") {
      // Build a single description blob from the structured sections
      // so the existing single-column `description` field captures
      // everything until we add separate columns later.
      const fullDescription = [
        longDesc.trim(),
        visionText.trim() ? `# الرؤية\n${visionText.trim()}` : "",
        goalsText.trim() ? `# الأهداف\n${goalsText.trim()}` : "",
        managementText.trim() ? `# الإدارة\n${managementText.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")

      const result = await adminCreateProject({
        name: name.trim(),
        short_description: shortDesc.trim(),
        description: fullDescription || shortDesc.trim(),
        project_type: sector,
        share_price: Number(sharePrice) || 0,
        total_shares: Number(totalShares) || 0,
        // Wallet split now includes owner% — but the RPC still takes
        // only the 3 wallet percentages (offering/ambassador/reserve).
        // We pass the 3 sub-percentages directly; owner% lives outside
        // the wallet system as a top-level "kept by owner" tag.
        offering_percentage: Number(offeringPct) || 30,
        ambassador_percentage: Number(ambassadorPct) || 2,
        reserve_percentage: Number(reservePct) || 8,
        location_city: city.trim() || undefined,
        offering_start_date: offeringStart || undefined,
        offering_end_date: offeringEnd || undefined,
        // companyId === "" means "بلا (مشروع مباشر)" → null in DB
        company_id: companyId.trim() ? companyId : null,
        status: "active",
      })
      if (!result.success) {
        const map: Record<string, string> = {
          unauthenticated: "سجّل دخولك أولاً",
          not_admin: "صلاحياتك لا تسمح",
          invalid_name: "اسم المشروع مطلوب",
          invalid_share_price: "سعر الحصة غير صحيح",
          invalid_total_shares: "عدد الحصص غير صحيح",
          company_not_found: "الشركة الأمّ غير موجودة",
          missing_table: "الجداول غير منشورة بعد — شغّل migrations المرحلة 10",
          rls: "صلاحياتك لا تسمح",
        }
        showError(map[result.reason ?? ""] ?? `فشل إنشاء المشروع${result.error ? ": " + result.error : ""}`)
        return
      }
      showSuccess(`✅ تم نشر "${name}" + إنشاء 3 محافظ (عرض/سفير/احتياطي)`)
      clearCurrentDraft(draftKind)
      onDone?.()
      return
    }

    // Drafts stay on the legacy mock flow until we add a draft RPC.
    if (status === "draft") {
      showSuccess("💾 تم حفظ المسودّة")
      onDone?.()
      return
    }

    // Fallback (shouldn't reach here)
    const newId = `${isProject ? "p" : "c"}-${Date.now()}`
    const wallet = createProjectWallet(newId, name)
    showSuccess(`✅ تم نشر "${name}" + إنشاء محفظة (${wallet.id})`)
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
                <label className="text-xs text-neutral-400 mb-1.5 block">الشركة الأمّ</label>
                <select
                  value={companyId} onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                >
                  {/* خيار "بلا" — مشروع مباشر بدون شركة أم. القيمة "" تُحفظ كـ NULL في DB. */}
                  <option value="">— بلا (مشروع مباشر) —</option>
                  {ALL_COMPANIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="text-[10px] text-neutral-500 mt-1.5">
                  اختر "بلا" إذا كان المشروع غير تابع لأي شركة موجودة على المنصة.
                </div>
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

          {/* الرمز التلقائي (Symbol) — يُولّد من اسم المشروع */}
          <div className="mt-3">
            <label className="text-xs text-neutral-400 mb-1.5 block flex items-center justify-between">
              <span>
                الرمز (Symbol) — يُولّد تلقائياً من الاسم
              </span>
              <button
                type="button"
                onClick={() => {
                  setSymbolEditedManually(false)
                  if (name.trim()) setSymbol(generateSymbol(name, takenSymbols))
                }}
                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                title="إعادة توليد الرمز"
              >
                <RefreshCw className="w-3 h-3" />
                إعادة التوليد
              </button>
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => {
                const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3)
                setSymbol(v)
                setSymbolEditedManually(true)
              }}
              placeholder="MZR"
              maxLength={3}
              dir="ltr"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-base text-white font-mono font-bold tracking-widest text-center outline-none focus:border-white/20"
            />
            <div className="text-[10px] text-neutral-500 mt-1">
              ٣ حروف إنجليزية كبيرة فريدة. يتغيّر تلقائياً مع تغيّر الاسم — أو حرّره يدوياً.
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

          {/* الرؤية */}
          <div className="mt-3">
            <label className="text-xs text-neutral-400 mb-1.5 block">الرؤية</label>
            <textarea
              value={visionText}
              onChange={(e) => setVisionText(e.target.value)}
              rows={3}
              placeholder={isProject ? "ما الرؤية طويلة الأمد لهذا المشروع؟" : "ما الرؤية طويلة الأمد لهذه الشركة؟"}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
            />
          </div>

          {/* الأهداف */}
          <div className="mt-3">
            <label className="text-xs text-neutral-400 mb-1.5 block">الأهداف</label>
            <textarea
              value={goalsText}
              onChange={(e) => setGoalsText(e.target.value)}
              rows={3}
              placeholder="الأهداف المحدّدة للمرحلة الأولى — يمكنك استخدام نقاط (- ...)"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
            />
          </div>

          {/* الإدارة */}
          <div className="mt-3">
            <label className="text-xs text-neutral-400 mb-1.5 block">الإدارة</label>
            <textarea
              value={managementText}
              onChange={(e) => setManagementText(e.target.value)}
              rows={3}
              placeholder="فريق الإدارة وخبراتهم — مثلاً: المدير التنفيذي، رئيس العمليات، ..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
            />
          </div>

          <div className="mt-3">
            <label className="text-xs text-neutral-400 mb-1.5 block">وصف كامل (اختياري)</label>
            <textarea
              value={longDesc} onChange={(e) => setLongDesc(e.target.value)} rows={4}
              placeholder={isProject ? "تفاصيل إضافية ترغب في إظهارها للمستثمرين..." : "نشاط الشركة، تاريخها، إنجازاتها، ..."}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
            />
          </div>
        </div>

        {/* §2 Logo + Cover image */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">2️⃣ الشعار + الصورة الرئيسية</div>

          {/* Logo */}
          <div className="mb-4">
            <label className="text-xs text-neutral-400 mb-1.5 block">
              الشعار (PNG/SVG/JPG — حد أقصى 2MB)
            </label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.size > 2 * 1024 * 1024) {
                  showError("الحجم الأقصى 2MB")
                  return
                }
                const reader = new FileReader()
                reader.onload = (ev) => {
                  const url = ev.target?.result
                  if (typeof url === "string") setLogoUrl(url)
                }
                reader.readAsDataURL(file)
              }}
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="w-full bg-white/[0.04] border-2 border-dashed border-white/[0.15] rounded-xl p-4 hover:border-white/[0.25] transition-colors flex flex-col items-center gap-2 relative overflow-hidden"
            >
              {logoUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="logo preview" className="w-20 h-20 object-contain rounded-lg" />
                  <span className="text-[11px] text-blue-400">اضغط لتغيير الشعار</span>
                </>
              ) : (
                <>
                  <Upload className="w-7 h-7 text-neutral-400" strokeWidth={1.5} />
                  <span className="text-xs text-neutral-300 font-bold">رفع الشعار</span>
                  <span className="text-[10px] text-neutral-500">PNG / SVG / JPG</span>
                </>
              )}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={() => setLogoUrl("")}
                className="mt-2 text-[11px] text-red-400 hover:text-red-300"
              >
                ✕ حذف الشعار
              </button>
            )}
          </div>

          {/* Cover */}
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">
              الصورة الرئيسية (الغلاف) — حد أقصى 5MB
            </label>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.size > 5 * 1024 * 1024) {
                  showError("الحجم الأقصى 5MB")
                  return
                }
                const reader = new FileReader()
                reader.onload = (ev) => {
                  const url = ev.target?.result
                  if (typeof url === "string") setCoverUrl(url)
                }
                reader.readAsDataURL(file)
              }}
            />
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="w-full bg-white/[0.04] border-2 border-dashed border-white/[0.15] rounded-xl py-6 hover:border-white/[0.25] transition-colors flex flex-col items-center gap-2 relative overflow-hidden"
            >
              {coverUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverUrl} alt="cover preview" className="w-full h-28 object-cover rounded-lg" />
                  <span className="text-[11px] text-blue-400">اضغط لتغيير الصورة</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-8 h-8 text-neutral-400" strokeWidth={1.5} />
                  <span className="text-xs text-neutral-300 font-bold">رفع الصورة الرئيسية</span>
                  <span className="text-[10px] text-neutral-500">PNG / JPG / WebP</span>
                </>
              )}
            </button>
            {coverUrl && (
              <button
                type="button"
                onClick={() => setCoverUrl("")}
                className="mt-2 text-[11px] text-red-400 hover:text-red-300"
              >
                ✕ حذف الصورة
              </button>
            )}
          </div>
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

        {/* §4 Unified Financial — merges price/shares + project value
            + capital + investment type. Removes duplicates that used
            to live in old §9. */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 lg:col-span-2">
          <div className="text-sm font-bold text-white mb-4">4️⃣ المعلومات المالية</div>

          {/* Phase 10.58 — financial fields LOCKED in edit mode.
              The user explicitly asked: project value, share price,
              and total shares are immutable after creation. To
              increase the tradeable share count, use the wallet
              panel's "release shares to market" action (super_admin). */}
          {isEdit && (
            <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.25] rounded-xl p-3 mb-4 flex items-start gap-2.5">
              <span className="text-base">🔒</span>
              <div className="text-[11px] leading-relaxed">
                <div className="text-yellow-400 font-bold mb-1">الحقول المالية مقفلة في وضع التعديل</div>
                <div className="text-neutral-300">
                  قيمة المشروع وسعر الحصة الابتدائي وعدد الحصص لا يُعدَّلون بعد الإنشاء.
                  لزيادة الحصص المعروضة في السوق، استخدم زرّ
                  <span className="font-bold text-white"> 📤 إطلاق حصص للسوق </span>
                  من صفحة <span className="font-bold text-white">محافظ المشاريع</span> (Super Admin فقط).
                </div>
              </div>
            </div>
          )}

          {/* Row 1: project value + share price (locked in edit) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">قيمة المشروع الكلّية (د.ع) *</label>
              <input
                type="number" value={projectValue}
                onChange={(e) => !isEdit && setProjectValue(e.target.value)}
                readOnly={isEdit} disabled={isEdit}
                placeholder="500000000"
                className={cn(
                  "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20",
                  isEdit && "opacity-60 cursor-not-allowed"
                )}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">سعر الحصّة الابتدائي (د.ع) *</label>
              <input
                type="number" value={sharePrice}
                onChange={(e) => !isEdit && setSharePrice(e.target.value)}
                readOnly={isEdit} disabled={isEdit}
                placeholder="50000"
                className={cn(
                  "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20",
                  isEdit && "opacity-60 cursor-not-allowed"
                )}
              />
              {isEdit && (
                <div className="text-[10px] text-neutral-500 mt-1">
                  💡 السعر الابتدائي يُحفظ كمرجع. السعر الحالي في السوق يتحدّث ديناميكياً.
                </div>
              )}
            </div>
          </div>

          {/* Auto-calculated total shares */}
          <div className="bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-xl p-3 mb-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-blue-400 flex items-center gap-1.5">
                ⚡ إجمالي الحصص
                <span className="text-[9px] bg-blue-400/[0.15] border border-blue-400/[0.3] rounded px-1.5 py-0.5">
                  محسوب تلقائياً
                </span>
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">= قيمة المشروع ÷ سعر الحصة</div>
            </div>
            <span className="text-lg font-bold text-blue-400 font-mono">
              {totalSharesNum > 0 ? fmtNum(totalSharesNum) : "—"}
            </span>
          </div>

          {/* Row 2: capital needed + raised */}
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
                <div className="h-full bg-yellow-400 transition-all" style={{ width: `${capitalProgress}%` }} />
              </div>
            </div>
          )}

          {/* Row 3: investment type */}
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">نوع الاستثمار</label>
            <select
              value={investmentType}
              onChange={(e) => setInvestmentType(e.target.value as ProjectInvestmentType)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
            >
              <option value="direct">🛒 مباشر — شراء بسعر ثابت</option>
              <option value="auction">🔨 مزاد — أعلى سعر يفوز</option>
              <option value="direct_auction">🛒+🔨 مباشر + مزاد — الطريقتان متاحتان</option>
            </select>
            <div className="text-[10px] text-neutral-500 mt-1.5 leading-relaxed">
              <strong className="text-neutral-300">مباشر:</strong> المستثمر يشتري الحصص فوراً بالسعر المحدّد ·{" "}
              <strong className="text-neutral-300">مزاد:</strong> الحصص تُطرح عبر مزاد ويفوز أعلى عرض ·{" "}
              <strong className="text-neutral-300">مباشر + مزاد:</strong> جزء يُباع مباشرة + جزء عبر مزاد بالتوازي
            </div>
          </div>
        </div>

        {/* §5 Wallet split — 4 components: owner + offering + ambassador + reserve = 100% */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">5️⃣ توزيع المحافظ (المجموع 100%)</div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block flex items-center gap-1.5">
                <span>المالك / الشركة (%)</span>
                <span className="text-[9px] text-purple-400">يحتفظ بها المالك</span>
              </label>
              <input
                type="number"
                value={ownerPercent}
                onChange={(e) => !isEdit && setOwnerPercent(e.target.value)}
                readOnly={isEdit} disabled={isEdit}
                className={cn(
                  "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20",
                  isEdit && "opacity-60 cursor-not-allowed"
                )}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block flex items-center gap-1.5">
                <span>طرح للجمهور (%)</span>
                <span className="text-[9px] text-green-400">للتداول في السوق</span>
              </label>
              <input
                type="number" value={offeringPct}
                onChange={(e) => !isEdit && setOfferingPct(e.target.value)}
                readOnly={isEdit} disabled={isEdit}
                className={cn(
                  "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20",
                  isEdit && "opacity-60 cursor-not-allowed"
                )}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">سفير (%)</label>
              <input
                type="number" value={ambassadorPct}
                onChange={(e) => !isEdit && setAmbassadorPct(e.target.value)}
                readOnly={isEdit} disabled={isEdit}
                className={cn(
                  "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20",
                  isEdit && "opacity-60 cursor-not-allowed"
                )}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">احتياطي (%)</label>
              <input
                type="number" value={reservePct}
                onChange={(e) => !isEdit && setReservePct(e.target.value)}
                readOnly={isEdit} disabled={isEdit}
                className={cn(
                  "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20",
                  isEdit && "opacity-60 cursor-not-allowed"
                )}
              />
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
            {totalSharesNum > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-purple-400/[0.05] border border-purple-400/[0.2] rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-neutral-500 mb-0.5">حصص المالك</div>
                  <div className="text-sm font-bold text-purple-400 font-mono">
                    {fmtNum(ownerSharesCount)}
                  </div>
                </div>
                <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-neutral-500 mb-0.5">الحصص المطروحة</div>
                  <div className="text-sm font-bold text-green-400 font-mono">
                    {fmtNum(offeredSharesCount)}
                  </div>
                </div>
              </div>
            )}
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

        {/* §8 Classification (extended) — symbol moved to §1 */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 lg:col-span-2">
          <div className="text-sm font-bold text-white mb-4">8️⃣ التصنيف الموسَّع</div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
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

        {/* §9 — حذف بالكامل: المحتوى المالي انتقل إلى §4، نسب
            الملكية انتقلت إلى §5، وحقل listingPercent تم استبداله
            بحقل ownerPercent في توزيع المحافظ. */}

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
      <div className="flex gap-2 mt-5 flex-wrap">
        <ActionBtn
          label="✕ إلغاء"
          color="red"
          onClick={() => {
            const ok = window.confirm(
              "إلغاء الإنشاء سيمسح البيانات المُدخلة. متابعة؟",
            )
            if (!ok) return
            clearCurrentDraft(draftKind)
            onDone?.()
          }}
        />
        <ActionBtn label="💾 حفظ كمسودّة" color="gray" onClick={() => handleSave("draft")} />
        <ActionBtn
          label={
            isEdit
              ? "✅ حفظ التعديلات + النشر"
              : isValid
                ? `📤 نشر${isProject ? " المشروع" : " الشركة"} + إنشاء المحفظة`
                : `📤 نشر${isValid ? "" : " (مع تحذير)"}`
          }
          color="green"
          onClick={() => handleSave("active")}
        />
      </div>
      {!isValid && !isEdit && (
        <div className="mt-2 text-[10px] text-yellow-400 leading-relaxed">
          ⚠️ بعض الحقول غير مكتملة. يمكنك المتابعة بالنشر — سيُطلب تأكيدك أولاً.
        </div>
      )}
    </div>
  )
}
