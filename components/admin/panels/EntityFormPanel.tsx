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
import { adminCreateProject, adminUpdateProject, getAllProjects } from "@/lib/data/projects"
import { getAllCompanies } from "@/lib/data/companies"
import { showError, showSuccess } from "@/lib/utils/toast"
import { calculateTotalShares, calculateOfferedShares } from "@/lib/utils/finance"
import { AdminQuickBuyToggle } from "@/components/admin/panels/AdminQuickBuyToggle"
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

// ── Comma-formatting helpers for large IQD inputs ─────────────────
// commaFmt: raw numeric string → display string with commas
//   "1000000000" → "1,000,000,000"
const commaFmt = (raw: string | number): string => {
  const str = typeof raw === "number" ? String(raw) : raw
  const digits = str.replace(/,/g, "")
  if (!digits) return ""
  const n = Number(digits)
  return isNaN(n) ? str : n.toLocaleString("en-US")
}
// commaParse: typed value → stripped digits only (no commas)
//   "1,000,000" → "1000000"
const commaParse = (v: string): string => v.replace(/[^0-9]/g, "")

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
  reserve_pct?: string
  offering_start?: string
  offering_end?: string
  return_min?: string
  return_max?: string
  duration_months?: string
  /** Phase 10.90: when true, project has no scheduled end and the
   *  months input is hidden. */
  duration_open?: boolean
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
  // Phase 10.90 — multi-image gallery (project work, team, ops, etc.)
  // shown in the project-details image carousel.
  const [galleryImages, setGalleryImages] = useState<string[]>(
    initialData?.project_images ?? initialData?.company_images ?? [],
  )
  const galleryInputRef = useRef<HTMLInputElement>(null)
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
  // §5 split — Phase 10.90: only TWO admin-editable buckets remain:
  //   • owner_percent      — kept by the company / not for sale
  //   • offering_percentage — listed on the public market
  // Phase 10.86 retired the ambassador bucket (now a runtime grant);
  // Phase 10.90 retires the reserve bucket per the founder's spec.
  // owner + offering = 100. Defaults: 70 + 30 = 100.
  const [offeringPct, setOfferingPct] = useState(initialData?.offering_pct ?? "30")
  // §6 dates — Phase 10.90: removed manual start + end inputs.
  // offering_start_date is auto-set to NOW() when the project is
  // published; offering_end_date is no longer used (project either
  // has an open-ended duration or a months-bounded one — see below).
  const [offeringStart, setOfferingStart] = useState(initialData?.offering_start ?? "")
  // Reserved here only so the legacy autosave/draft hooks still
  // compile; we never expose an input for it any more.
  const [offeringEnd] = useState(initialData?.offering_end ?? "")
  // §7 returns + risk
  // Phase 10.87: the input field is now MONTHLY (not annual). The
  // annual return is derived dynamically (× 12) and shown read-only.
  // Defaults: 1% monthly = 12% annual / 1.5% monthly = 18% annual.
  const [returnMin, setReturnMin] = useState(initialData?.return_min ?? "1")
  const [returnMax, setReturnMax] = useState(initialData?.return_max ?? "1.5")
  const [durationMonths, setDurationMonths] = useState(initialData?.duration_months ?? "36")
  // Phase 10.90: open-ended vs fixed-months toggle. When `durationOpen`
  // is true the months input is hidden and the project has no scheduled
  // end. When false the admin enters a number of months.
  const [durationOpen, setDurationOpen] = useState<boolean>(
    initialData?.duration_open ?? !initialData?.duration_months,
  )
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

  // ─── §12 Documents (Phase 10.90: file upload, no more URL inputs) ──
  const [documents, setDocuments] = useState<ProjectDocument[]>(initialData?.documents ?? [])
  const docInputRef = useRef<HTMLInputElement>(null)

  // ─── Phase 10.94 — publish confirmation modal ───
  // When admin clicks "نشر" we DON'T submit immediately — we open a
  // review modal so the admin can double-check the data first. The
  // actual save runs on confirm.
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const sharePriceNum = Number(sharePrice) || 0
  const projectValueNum0 = Number(projectValue) || 0

  // ─── Auto-calc total_shares from project_value / share_price ───
  // The user requested: "عند ادخال سعر الحصة الابتدائي يتم تقسيم
  //   قيمة المشروع الكلية على سعر الحصة" — the result is a fixed,
  //   read-only count that the admin can't override.
  useEffect(() => {
    if (sharePriceNum > 0 && projectValueNum0 > 0) {
      // Use Math.round to avoid floating-point drift:
      // e.g. 1_000_000_000 / 25_000 can yield 40_000.000...01 in IEEE 754,
      // and Math.floor would still give 40_000 — but for values that land
      // just below an integer (39_999.999…) Math.floor silently drops 1.
      // Math.round gives the user-intended exact integer in all cases.
      const auto = Math.round(projectValueNum0 / sharePriceNum)
      setTotalShares(String(auto))
    }
  }, [sharePriceNum, projectValueNum0])

  const totalSharesNum = Number(totalShares) || 0
  const totalValue = sharePriceNum * totalSharesNum
  // Phase 10.90: only TWO buckets remain in §5 (owner + offering).
  // Reserve is auto = 0; ambassador retired in 10.86. Sum must = 100.
  const ownerPctNum = Number(ownerPercent) || 0
  const totalPct = ownerPctNum + (Number(offeringPct) || 0)

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
        offering_pct: offeringPct,
        offering_start: offeringStart, offering_end: offeringEnd,
        return_min: returnMin, return_max: returnMax,
        duration_months: durationMonths, duration_open: durationOpen,
        risk_level: riskLevel,
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
    offeringPct,
    offeringStart, offeringEnd, returnMin, returnMax,
    durationMonths, durationOpen, riskLevel, entityTypeField, buildStatus,
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

  // ─── Owner% drives offered% automatically (Phase 10.90) ───
  // With reserve + ambassador buckets retired the math collapses to a
  // simple complement: offering = 100 − owner. We mirror the value
  // into BOTH `offerPercent` (legacy field used by §9) and the new
  // wallet-split `offeringPct` field used by §5 so they never drift.
  useEffect(() => {
    const offered = Math.max(0, 100 - ownerPctNum)
    setOfferPercent(String(offered))
    setOfferingPct(String(offered))
  }, [ownerPctNum])

  // Compute the OFFERING bucket first with Math.round so floating-point
  // in the percentage doesn't silently add/drop 1 share.  The owner
  // bucket gets the exact remainder so the two always sum to totalSharesNum.
  const offeredSharesCount = Math.round(totalSharesNum * (Number(offeringPct) || 0) / 100)
  const ownerSharesCount   = Math.max(0, totalSharesNum - offeredSharesCount)

  // Phase 10.90 — uploads a real file (PDF / DOCX / ZIP / image) and
  // stores it as a base64 data URL on the document record. No external
  // hosting required — the file travels with the project payload and
  // the read-only details view renders it as a download link.
  const handleDocumentUpload = (file: File) => {
    if (!file) return
    // Soft cap at 5 MB so the form payload doesn't explode. The DB
    // column is TEXT (no hard limit) but anything larger should go
    // through Supabase Storage in a future iteration.
    const MAX_BYTES = 5 * 1024 * 1024
    if (file.size > MAX_BYTES) {
      showError("الحد الأقصى لكل وثيقة 5MB")
      return
    }
    // Phase 13.50 — strict white-list of MIME types. Previously the
    // accept= attribute filtered by extension only; the browser still
    // happily set file.type from a forged extension, so a `.txt`
    // could carry text/html bytes and become a stored XSS via the
    // data: URL link. This list rejects HTML / SVG / scripts at the
    // boundary.
    const ALLOWED_MIME = new Set<string>([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/zip",
      "application/x-zip-compressed",
      "application/x-rar-compressed",
      "application/vnd.rar",
      "image/png",
      "image/jpeg",
      "image/webp",
      "text/plain",
    ])
    if (!ALLOWED_MIME.has(file.type)) {
      showError("نوع الملف غير مسموح. الأنواع المتاحة: PDF / Word / Excel / PPT / ZIP / RAR / صور / TXT")
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const url = ev.target?.result
      if (typeof url !== "string") return
      setDocuments((prev) => [
        ...prev,
        {
          name: file.name,
          url,
          size: file.size,
          mime_type: file.type || undefined,
        },
      ])
    }
    reader.onerror = () => showError("فشل قراءة الملف")
    reader.readAsDataURL(file)
  }
  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index))
  }

  // Phase 10.90 — offering_start_date is auto-set on publish, and the
  // end date / reserve fields are gone. The only date-side requirement
  // left is "if duration is fixed-months, the months value must be > 0".
  const isValid =
    name.trim().length >= 3 &&
    // companyId is OPTIONAL — empty = "بلا (مشروع مباشر)".
    shortDesc.trim().length >= 20 &&
    sharePriceNum > 0 &&
    totalSharesNum > 0 &&
    Math.abs(totalPct - 100) < 0.01 &&
    (durationOpen || (Number(durationMonths) || 0) > 0) &&
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
    offering_pct: offeringPct,
    offering_start: offeringStart, offering_end: offeringEnd,
    return_min: returnMin, return_max: returnMax,
    duration_months: durationMonths, duration_open: durationOpen,
    risk_level: riskLevel,
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

    // Phase 10.94: validation feedback is now shown inside the publish
    // confirmation modal (يحذّر المستخدم قبل الضغط على «تأكيد ونشر»),
    // so we no longer block here with a native window.confirm.
    // ── Phase 10.94: persist project edits to DB ──
    if (isEdit && isProject) {
      const projectId = initialData?.id
      if (!projectId) {
        showError("معرّف المشروع غير موجود — أعد فتح التعديل")
        return
      }
      const fullDescription = [
        longDesc.trim(),
        visionText.trim() ? `# الرؤية\n${visionText.trim()}` : "",
        goalsText.trim() ? `# الأهداف\n${goalsText.trim()}` : "",
        managementText.trim() ? `# الإدارة\n${managementText.trim()}` : "",
      ].filter(Boolean).join("\n\n")

      const result = await adminUpdateProject({
        id: projectId,
        name: name.trim(),
        short_description: shortDesc.trim() || undefined,
        description: fullDescription || shortDesc.trim() || undefined,
        project_type: sector,
        company_id: companyId.trim() ? companyId : null,
        logo_url: logoUrl.trim() || undefined,
        cover_url: coverUrl.trim() || undefined,
        gallery_images: galleryImages,
        documents: documents,
        location_city: city.trim() || undefined,
        location_address: address.trim() || undefined,
        detailed_address: detailedAddress.trim() || undefined,
        offering_start_date: offeringStart || undefined,
        duration_open: durationOpen,
        duration_months: durationOpen ? undefined : Number(durationMonths) || undefined,
        // Convert MONTHLY input back to ANNUAL for DB
        expected_return_min: (Number(returnMin) || 0) * 12,
        expected_return_max: (Number(returnMax) || 0) * 12,
        risk_level: riskLevel,
        distribution_type: distributionType,
        profit_source: profitSource.trim() || undefined,
        owner_name: ownerName.trim() || undefined,
        owner_phone: ownerPhone.trim() || undefined,
        owner_email: ownerEmail.trim() || undefined,
        // Status update — passes "active" if admin clicked publish, else keeps current
        status: status === "active" ? "active" : undefined,
      })
      if (!result.success) {
        const map: Record<string, string> = {
          unauthenticated: "سجّل دخولك أولاً",
          not_admin: "صلاحياتك لا تسمح",
          invalid_name: "اسم المشروع مطلوب",
          project_not_found: "المشروع غير موجود",
          company_not_found: "الشركة الأمّ غير موجودة",
          missing_table: "طبّق Migration 10.94 أولاً",
          rls: "صلاحياتك لا تسمح",
        }
        showError(map[result.reason ?? ""] ?? `فشل حفظ التعديلات${result.error ? ": " + result.error : ""}`)
        return
      }
      showSuccess(status === "active"
        ? `✅ تم حفظ التعديلات + نشر "${name}"`
        : `💾 تم حفظ التعديلات`
      )
      onDone?.()
      return
    }
    if (isEdit) {
      // Companies edit not yet wired to DB — keep toast-only fallback.
      showSuccess(status === "active"
        ? `✅ تم حفظ التعديلات + نشر "${name}"`
        : "💾 تم حفظ التعديلات كمسودّة"
      )
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
        // Phase 10.86: ambassador wallet bucket retired. We now pass
        // ambassador_percentage=0 so the auto-created ambassador
        // wallet stays empty — the 2% ambassador grant is paid at
        // runtime from the offering wallet on a per-investor first-
        // investment basis (see migration 20260507 follow-up).
        offering_percentage: Number(offeringPct) || 30,
        ambassador_percentage: 0,
        // Phase 10.90: reserve bucket retired in the form. We pass 0
        // so the auto-created reserve wallet stays empty.
        reserve_percentage: 0,
        location_city: city.trim() || undefined,
        // Phase 10.90: offering_start_date is the publish date by
        // default (admin no longer enters a start date). Empty input
        // → auto today's ISO date.
        offering_start_date:
          (offeringStart && offeringStart.trim()) ||
          new Date().toISOString().slice(0, 10),
        // offering_end_date retired — no input in §6.
        offering_end_date: undefined,
        // companyId === "" means "بلا (مشروع مباشر)" → null in DB
        company_id: companyId.trim() ? companyId : null,
        status: "active",
        // Phase 10.87: form collects MONTHLY % values; we multiply by
        // 12 so the DB receives ANNUAL figures (matches finance.ts +
        // existing project-detail rendering conventions).
        expected_return_min: (Number(returnMin) || 0) * 12,
        expected_return_max: (Number(returnMax) || 0) * 12,
        // Phase 10.88: persist brand assets so the admin details view
        // and the app project page can show the real logo instead of
        // the generic sector emoji.
        logo_url: logoUrl.trim() || undefined,
        cover_url: coverUrl.trim() || undefined,
        // Phase 10.90: full-form payload
        duration_open: durationOpen,
        duration_months: durationOpen ? undefined : Number(durationMonths) || undefined,
        documents: documents,
        gallery_images: galleryImages,
        owner_name: ownerName?.trim() || undefined,
        owner_phone: ownerPhone?.trim() || undefined,
        owner_email: ownerEmail?.trim() || undefined,
        detailed_address: detailedAddress?.trim() || undefined,
        profit_source: profitSource?.trim() || undefined,
        distribution_type: distributionType,
        risk_level: riskLevel,
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
      showSuccess(`✅ تم نشر "${name}" + إنشاء محافظ المشروع (عرض/احتياطي)`)
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
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.size > 2 * 1024 * 1024) {
                  showError("الحجم الأقصى 2MB")
                  return
                }
                // Phase 13.50 — strict white-list. Excludes
                // image/svg+xml because SVG can carry script tags.
                const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"])
                if (!ALLOWED.has(file.type)) {
                  showError("نوع غير مسموح للشعار (PNG/JPEG/WEBP فقط)")
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
                  <span className="text-[10px] text-neutral-500">PNG / JPG / WEBP</span>
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

          {/* Phase 10.90 — Multi-image gallery (project work / team /
              ops). Each image is base64-encoded and travels with the
              project payload — shown in the project-details carousel. */}
          <div className="lg:col-span-2 mt-4">
            <label className="text-xs text-neutral-400 mb-1.5 block flex items-center gap-1.5">
              <span>معرض الصور</span>
              <span className="text-[9px] text-neutral-500">
                صور عمل، صور الإدارة، صور المنشأة — تظهر في معرض صفحة المشروع
              </span>
            </label>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files
                if (!files || files.length === 0) return
                const MAX_BYTES = 3 * 1024 * 1024
                // Phase 13.50 — defence in depth: even if accept= is
                // bypassed, reject anything that isn't a raster image.
                // Excludes image/svg+xml (script-bearing) and any
                // non-image MIME the browser might let through.
                const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"])
                Array.from(files).forEach((file) => {
                  if (file.size > MAX_BYTES) {
                    showError(`${file.name}: أكبر من 3MB`)
                    return
                  }
                  if (!ALLOWED.has(file.type)) {
                    showError(`${file.name}: نوع غير مسموح (PNG/JPEG/WEBP فقط)`)
                    return
                  }
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    const url = ev.target?.result
                    if (typeof url === "string") {
                      setGalleryImages((prev) => [...prev, url])
                    }
                  }
                  reader.readAsDataURL(file)
                })
                if (e.target) e.target.value = ""
              }}
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
              {galleryImages.map((src, i) => (
                <div
                  key={i}
                  className="relative bg-white/[0.04] border border-white/[0.08] rounded-lg overflow-hidden aspect-square group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`صورة ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryImages(galleryImages.filter((_, idx) => idx !== i))
                    }
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="حذف"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="aspect-square bg-white/[0.04] border-2 border-dashed border-white/[0.15] hover:border-white/[0.25] rounded-lg flex flex-col items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-6 h-6 text-neutral-400" strokeWidth={1.5} />
                <span className="text-[10px] text-neutral-500">إضافة صورة</span>
              </button>
            </div>
            <div className="text-[10px] text-neutral-500">
              يمكنك رفع عدّة صور دفعة واحدة — حدّ أقصى 3MB لكل صورة
            </div>
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
                  لزيادة الحصص المعروضة للجمهور، استخدم زرّ
                  <span className="font-bold text-white"> ➕ إضافة حصص للطرح </span>
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
                type="text" inputMode="numeric"
                value={commaFmt(projectValue)}
                onChange={(e) => !isEdit && setProjectValue(commaParse(e.target.value))}
                readOnly={isEdit} disabled={isEdit}
                placeholder="500,000,000"
                className={cn(
                  "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20",
                  isEdit && "opacity-60 cursor-not-allowed"
                )}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">سعر الحصّة الابتدائي (د.ع) *</label>
              <input
                type="text" inputMode="numeric"
                value={commaFmt(sharePrice)}
                onChange={(e) => !isEdit && setSharePrice(commaParse(e.target.value))}
                readOnly={isEdit} disabled={isEdit}
                placeholder="50,000"
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
                type="text" inputMode="numeric"
                value={commaFmt(capitalNeeded)}
                onChange={(e) => setCapitalNeeded(commaParse(e.target.value))}
                placeholder="200,000,000"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">رأس المال المُحقَّق (د.ع)</label>
              <input
                type="text" inputMode="numeric"
                value={commaFmt(capitalRaised)}
                onChange={(e) => setCapitalRaised(commaParse(e.target.value))}
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

        {/* §5 Wallet split — 3 components: owner + offering + reserve = 100%
            Phase 10.86: removed dedicated "ambassador" bucket. The 2%
            ambassador commission is now a runtime per-investor reward
            taken from the offering wallet on first investment via a
            referral link, not a pre-allocated wallet. */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">5️⃣ توزيع المحافظ (المجموع 100%)</div>
          <div className="bg-purple-400/[0.04] border border-purple-400/[0.15] rounded-lg p-2.5 text-[11px] text-purple-300 mb-3 leading-relaxed">
            💡 السفير لم يعد يأخذ محفظة مسبقة. عند استثمار مستخدم جديد عبر
            رابط الإحالة يحصل السفير تلقائياً على <b className="text-white">2%</b> من
            قيمة استثمار المستخدم (حصصاً من محفظة العرض)، لمرة واحدة فقط
            لكل مستخدم جديد.
          </div>
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

        {/* §6 Dates — Phase 10.90:
              • offering_start_date is set to today on publish (no input)
              • offering_end_date retired
              • duration is either مفتوحة (open-ended) or محددة بالأشهر */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">6️⃣ مدّة المشروع</div>
          <div className="bg-blue-400/[0.04] border border-blue-400/[0.15] rounded-lg p-2.5 text-[11px] text-blue-300 mb-3 leading-relaxed">
            💡 تاريخ بدء الطرح يُسجَّل تلقائياً يوم نشر المشروع — لا حاجة لإدخاله يدوياً.
          </div>
          <div className="space-y-3">
            {/* Open vs fixed-months toggle */}
            <div>
              <label className="text-xs text-neutral-400 mb-2 block">
                {isProject ? "مدّة المشروع" : "مدّة الطرح"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDurationOpen(true)}
                  className={cn(
                    "py-2.5 rounded-lg text-xs font-bold border transition-colors",
                    durationOpen
                      ? "bg-purple-400/[0.15] border-purple-400/[0.4] text-purple-400"
                      : "bg-white/[0.04] border-white/[0.08] text-neutral-400"
                  )}
                >
                  ♾️ مدّة مفتوحة
                </button>
                <button
                  type="button"
                  onClick={() => setDurationOpen(false)}
                  className={cn(
                    "py-2.5 rounded-lg text-xs font-bold border transition-colors",
                    !durationOpen
                      ? "bg-blue-400/[0.15] border-blue-400/[0.4] text-blue-400"
                      : "bg-white/[0.04] border-white/[0.08] text-neutral-400"
                  )}
                >
                  📅 محدّدة بالأشهر
                </button>
              </div>
            </div>
            {!durationOpen && (
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">عدد الأشهر *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(e.target.value)}
                  placeholder="مثلاً: 36"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
                />
              </div>
            )}
            {durationOpen && (
              <div className="bg-purple-400/[0.04] border border-purple-400/[0.15] rounded-lg p-3 text-[11px] text-purple-300 leading-relaxed">
                ♾️ المشروع بمدّة مفتوحة — يستمرّ حتى يقرّر المالك إنهاءه. لا تاريخ
                انتهاء مُسبق.
              </div>
            )}
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
                type="text" inputMode="numeric"
                value={commaFmt(revenue)}
                onChange={(e) => setRevenue(commaParse(e.target.value))}
                placeholder="25,000,000"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
              />
            </div>
          )}
        </div>

        {/* §9 — حذف بالكامل: المحتوى المالي انتقل إلى §4، نسب
            الملكية انتقلت إلى §5، وحقل listingPercent تم استبداله
            بحقل ownerPercent في توزيع المحافظ. */}

        {/* §7 Returns + risk
            Phase 10.87 — the input is the MONTHLY return; the annual
            return is derived dynamically (× 12) below. */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">7️⃣ العائد والمخاطر</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">عائد شهري أدنى (%)</label>
              <input
                type="number" step="0.01" value={returnMin}
                onChange={(e) => setReturnMin(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">عائد شهري أقصى (%)</label>
              <input
                type="number" step="0.01" value={returnMax}
                onChange={(e) => setReturnMax(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
              />
            </div>
          </div>
          {/* Dynamic annual return (read-only, computed live × 12) */}
          {(() => {
            const mn = Number(returnMin) || 0
            const mx = Number(returnMax) || 0
            const annualMin = (mn * 12)
            const annualMax = (mx * 12)
            const fmt = (v: number) =>
              Number.isInteger(v) ? String(v) : v.toFixed(2)
            return (
              <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-xl p-3 mb-3">
                <div className="flex justify-between items-center">
                  <div className="text-[11px] text-neutral-400">
                    العائد السنوي المحسوب
                    <span className="text-[9px] text-neutral-500 mr-1.5">(تلقائي × 12 شهر)</span>
                  </div>
                  <div className="text-sm font-bold text-green-400 font-mono">
                    {fmt(annualMin)}% — {fmt(annualMax)}%
                  </div>
                </div>
              </div>
            )
          })()}
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

        {/* §1️⃣2️⃣ Documents — Phase 10.90: file uploads, NOT URLs.
            Each picked file is base64-encoded and stored on the
            project payload so admins don't need external hosting. */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 lg:col-span-2">
          <div className="text-sm font-bold text-white mb-4">1️⃣2️⃣ الأوراق الرسمية والمستندات</div>

          {/* Existing documents list */}
          {documents.length > 0 && (
            <div className="space-y-2 mb-3">
              {documents.map((doc, i) => {
                const isUpload = doc.url?.startsWith("data:")
                const sizeKb = doc.size ? (doc.size / 1024).toFixed(1) : null
                return (
                  <div key={i} className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-2.5 flex items-center gap-3">
                    <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white font-bold truncate">{doc.name}</div>
                      <div className="text-[10px] text-neutral-500 flex items-center gap-2">
                        {isUpload ? (
                          <span className="bg-green-400/[0.1] text-green-400 px-1.5 py-0.5 rounded text-[9px]">
                            ✓ مرفوع
                          </span>
                        ) : (
                          <span className="bg-neutral-400/[0.1] text-neutral-400 px-1.5 py-0.5 rounded text-[9px]">
                            رابط خارجي
                          </span>
                        )}
                        {doc.mime_type && <span>{doc.mime_type}</span>}
                        {sizeKb && <span>{sizeKb} KB</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => removeDocument(i)}
                      className="text-red-400 hover:text-red-300 flex-shrink-0"
                      aria-label="حذف"
                    >
                      <X className="w-4 h-4" strokeWidth={2} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Upload button (file picker) */}
          <input
            ref={docInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.png,.jpg,.jpeg,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleDocumentUpload(file)
              if (e.target) e.target.value = ""  // allow re-uploading same file
            }}
          />
          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            className="w-full bg-white/[0.04] border-2 border-dashed border-white/[0.15] hover:border-white/[0.25] rounded-xl p-5 transition-colors flex flex-col items-center gap-2"
          >
            <Upload className="w-6 h-6 text-blue-400" strokeWidth={1.5} />
            <span className="text-xs text-white font-bold">رفع وثيقة</span>
            <span className="text-[10px] text-neutral-500">
              PDF / Word / Excel / ZIP / صور — حدّ أقصى 5MB لكل ملف
            </span>
          </button>

          <div className="text-[10px] text-neutral-500 mt-2 leading-relaxed">
            مثال: عقد التأسيس، الترخيص التجاري، شهادة الملكية، الميزانية الأخيرة...
          </div>
        </div>

        {/* Phase 13.59 — Admin quick-buy toggle (per-project).
            Only relevant when editing an existing project (we need
            a real project_id for the RPC). Its own save flow means
            it doesn't depend on the main form submit. */}
        {isEdit && isProject && initialData?.id && (
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
            <div className="text-sm font-bold text-white mb-3">
              ⚡ البيع المباشر للنظام
            </div>
            <AdminQuickBuyToggle projectId={initialData.id} />
          </div>
        )}

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
          onClick={() => setShowPublishConfirm(true)}
        />
      </div>
      {!isValid && !isEdit && (
        <div className="mt-2 text-[10px] text-yellow-400 leading-relaxed">
          ⚠️ بعض الحقول غير مكتملة. يمكنك المتابعة بالنشر — سيُطلب تأكيدك أولاً.
        </div>
      )}

      {/* Phase 10.94 — Publish/Edit confirmation modal */}
      {showPublishConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-base font-bold text-white">
                  {isEdit
                    ? "✅ تأكيد حفظ التعديلات"
                    : `📤 مراجعة وتأكيد النشر`}
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {isEdit
                    ? "راجع التعديلات قبل الحفظ"
                    : "راجع البيانات أدناه — بعد التأكيد سيُنشر المشروع وتُنشأ محافظه تلقائياً"}
                </div>
              </div>
              <button
                onClick={() => setShowPublishConfirm(false)}
                className="text-neutral-500 hover:text-white"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 mb-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-500">الاسم</span>
                <span className="text-white font-bold">{name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">القطاع</span>
                <span className="text-white">{sector}</span>
              </div>
              {isProject && (
                <>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">قيمة المشروع</span>
                    <span className="text-yellow-400 font-mono">{commaFmt(projectValue || "0")} د.ع</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">سعر الحصة</span>
                    <span className="text-yellow-400 font-mono">{commaFmt(sharePrice || "0")} د.ع</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">إجمالي الحصص</span>
                    <span className="text-blue-400 font-mono">{fmtNum(totalSharesNum)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">الطرح للجمهور</span>
                    <span className="text-purple-400 font-mono">{offeringPct}٪ ({fmtNum(Math.round(totalSharesNum * (Number(offeringPct) || 0) / 100))} حصة)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">حصص المالك</span>
                    <span className="text-neutral-300 font-mono">{ownerPercent}٪ ({fmtNum(Math.round(totalSharesNum * (Number(ownerPercent) || 0) / 100))} حصة)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">العائد المتوقع (شهري)</span>
                    <span className="text-green-400">{returnMin}٪ – {returnMax}٪</span>
                  </div>
                </>
              )}
              {city && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">المدينة</span>
                  <span className="text-white">{city}</span>
                </div>
              )}
            </div>

            {!isValid && !isEdit && (
              <div className="bg-yellow-400/[0.06] border border-yellow-400/[0.2] rounded-lg p-3 mb-4 text-[11px] text-yellow-300 leading-relaxed">
                ⚠️ بعض الحقول الإجبارية فارغة أو النسب لا تساوي 100٪. يمكنك المتابعة لكن قد يحتاج المشروع إلى تعديلات لاحقاً.
              </div>
            )}

            <div className="bg-blue-400/[0.04] border border-blue-400/[0.15] rounded-lg p-2.5 mb-4 text-[11px] text-blue-300 leading-relaxed">
              💡 {isEdit
                ? "لا يمكن تعديل إجمالي الحصص أو سعر الحصة هنا. لزيادة الحصص استخدم زر «إضافة حصص للطرح» في محفظة المشروع."
                : "بعد النشر ستُقفل قيمة المشروع وسعر الحصة وإجمالي الحصص. لزيادة الحصص لاحقاً استخدم محفظة المشروع."}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowPublishConfirm(false)}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={async () => {
                  setSubmitting(true)
                  setShowPublishConfirm(false)
                  await handleSave("active")
                  setSubmitting(false)
                }}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-green-500/[0.15] border border-green-500/[0.3] text-green-400 text-sm font-bold hover:bg-green-500/[0.2] disabled:opacity-50"
              >
                {submitting
                  ? "جارٍ الحفظ..."
                  : isEdit
                    ? "✅ تأكيد وحفظ التعديلات"
                    : "📤 تأكيد ونشر المشروع"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
