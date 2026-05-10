"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, Edit2, Trash2, AlertTriangle, X, Eye, FileEdit, Clock } from "lucide-react"
import { Badge, ActionBtn, Table, THead, TH, TBody, TR, TD, SectionHeader, AdminEmpty, KPI, InnerTabBar } from "@/components/admin/ui"
import { EntityFormPanel, type EntityFormData } from "./EntityFormPanel"
import { EntityDetailsView } from "./EntityDetailsView"
import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { ProjectWalletsPanel } from "./ProjectWalletsPanel"
import { getAllProjects, getProjectByIdAdmin, adminSetDiscoverTag } from "@/lib/data/projects"
import { getAllCompanies } from "@/lib/data/companies"
import { getAllProjectWalletsAdmin, adminDeleteProject } from "@/lib/data/admin-utilities"
import {
  loadDraftsList,
  loadDraftsListAsync,
  deleteDraft,
  type SavedDraft,
} from "@/lib/admin/entity-drafts"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

/**
 * Phase 10.59 — Projects section wraps the list panel + Project Wallets
 * panel as embedded tabs. Project Wallets used to live in the Shares
 * hub but the user wanted it grouped with project management.
 */
export function ProjectsPanel() {
  return (
    <EmbeddedTabsHub
      title="▣ المشاريع"
      subtitle="قائمة المشاريع + الشركات + المسودّات + محافظ المشاريع"
      tabs={[
        { key: "list", label: "📋 القائمة", hint: "كل المشاريع والشركات", Panel: ProjectsListPanel },
        { key: "wallets", label: "🏦 محافظ المشاريع", hint: "العرض + الاحتياطي + إطلاق للسوق", Panel: ProjectWalletsPanel },
      ]}
    />
  )
}

type MainTab = "list" | "create_project" | "create_company" | "view" | "edit"

// Row shape used by the panel — superset of project/company DB rows.
// Loaded async on mount; empty until then.
interface EntityRow {
  id: string
  name: string
  sector: string
  entity_type: "project" | "company"
  status: "active" | "pending" | "paused"
  quality: "low" | "medium" | "high"
  share_price: number
  total_shares: number
  available_shares: number
  project_value: number
  /** Phase 10.93 — trading & offering suspension state */
  trading_suspended: boolean
  trading_suspension_reason: string | null
  offering_suspended: boolean
  offering_suspension_reason: string | null
  /** Phase 13.17 — admin override pin for the home Discover surface */
  discover_tag: "trending" | "coming_soon" | "new" | null
}

/** Map a Project type DB enum back to the form's sector option. */
function dbToFormSector(t: string | null | undefined): EntityFormData["sector"] {
  if (t === "agriculture" || t === "real_estate" || t === "industrial"
      || t === "commercial" || t === "services" || t === "medical") {
    return t
  }
  return undefined
}

/** Pre-populate the edit form from a FULL DB row (Phase 10.94 — full mapping). */
function fullRowToInitialData(
  row: Record<string, unknown>,
  fallbackRow: EntityRow,
): EntityFormData {
  const get = <T,>(key: string): T | undefined => row[key] as T | undefined
  const numStr = (v: unknown): string =>
    v === null || v === undefined || v === "" ? "" : String(v)
  const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v))

  // Description may come back as one big blob with our # الرؤية / # الأهداف
  // / # الإدارة sections. Split it back so each section pre-fills its own
  // textarea instead of dumping everything into long_desc.
  const fullDesc = String(get<string>("description") ?? "")
  let longDesc = fullDesc
  let visionText = ""
  let goalsText = ""
  let managementText = ""
  const visionMatch = fullDesc.match(/#\s*الرؤية\s*\n([\s\S]*?)(?=\n#\s|$)/)
  const goalsMatch = fullDesc.match(/#\s*الأهداف\s*\n([\s\S]*?)(?=\n#\s|$)/)
  const mgmtMatch = fullDesc.match(/#\s*الإدارة\s*\n([\s\S]*?)(?=\n#\s|$)/)
  if (visionMatch || goalsMatch || mgmtMatch) {
    visionText = visionMatch?.[1]?.trim() ?? ""
    goalsText = goalsMatch?.[1]?.trim() ?? ""
    managementText = mgmtMatch?.[1]?.trim() ?? ""
    // long_desc = everything before the first # section
    const firstHashIdx = fullDesc.indexOf("# ")
    longDesc = firstHashIdx > 0 ? fullDesc.slice(0, firstHashIdx).trim() : ""
  }

  // Returns: DB stores ANNUAL %; the form input is MONTHLY (÷ 12).
  const annualMin = Number(get<number | string>("expected_return_min") ?? get<number | string>("return_min") ?? 0)
  const annualMax = Number(get<number | string>("expected_return_max") ?? get<number | string>("return_max") ?? 0)
  const monthlyMin = annualMin > 0 ? (annualMin / 12).toFixed(2) : ""
  const monthlyMax = annualMax > 0 ? (annualMax / 12).toFixed(2) : ""

  // Date columns may come back as full timestamps; the input expects YYYY-MM-DD.
  const dateStr = (v: unknown): string => {
    if (!v) return ""
    const s = String(v)
    return s.length >= 10 ? s.slice(0, 10) : s
  }

  // Documents + gallery (jsonb) — already arrays in JS land
  const documentsRaw = get<unknown>("documents")
  const documents = Array.isArray(documentsRaw)
    ? (documentsRaw as Array<Record<string, unknown>>).map((d) => ({
        name: String(d.name ?? ""),
        url: String(d.url ?? ""),
        size: typeof d.size === "number" ? d.size : undefined,
        mime_type: typeof d.mime_type === "string" ? d.mime_type : undefined,
      }))
    : []
  const galleryRaw = get<unknown>("gallery_images")
  const galleryImages = Array.isArray(galleryRaw)
    ? (galleryRaw as unknown[]).filter((g): g is string => typeof g === "string")
    : []

  // Wallet split: owner = 100 − offering
  const offeringPct = Number(get<number | string>("offering_percentage") ?? 30)
  const ownerPct = Math.max(0, 100 - offeringPct)

  return {
    id:                 (get<string>("id") ?? fallbackRow.id),
    name:               (get<string>("name") ?? fallbackRow.name),
    parent_company_id:  str(get<string>("company_id")),
    sector:             dbToFormSector(get<string>("project_type")),
    symbol:             str(get<string>("symbol")),

    // Descriptions (split back into structured sections)
    short_desc:         str(get<string>("short_description")),
    long_desc:          longDesc,
    vision:             visionText,
    goals:              goalsText,
    management:         managementText,

    // Brand assets
    logo_url:           str(get<string>("logo_url")),
    cover_url:          str(get<string>("cover_url") ?? get<string>("cover_image_url")),
    project_images:     galleryImages,
    documents:          documents,

    // Location
    city:               str(get<string>("location_city")),
    address:            str(get<string>("location_address")),
    detailed_address:   str(get<string>("detailed_address")),

    // Price + shares (LOCKED in edit mode but still pre-filled for display)
    share_price:        numStr(get<number | string>("share_price") ?? fallbackRow.share_price),
    total_shares:       numStr(get<number | string>("total_shares") ?? fallbackRow.total_shares),
    project_value:      numStr(get<number | string>("total_value")),

    // Wallet split
    offering_pct:       String(offeringPct),
    owner_percent:      String(ownerPct),
    offer_percent:      String(offeringPct),
    reserve_pct:        numStr(get<number | string>("reserve_percentage") ?? "0"),
    listing_percent:    String(offeringPct),

    // Dates + duration
    offering_start:     dateStr(get<string>("offering_start_date")),
    offering_end:       dateStr(get<string>("offering_end_date")),
    duration_open:      Boolean(get<boolean>("duration_open") ?? !get("duration_months")),
    duration_months:    numStr(get<number | string>("duration_months")),

    // Returns (monthly in form, annual in DB)
    return_min:         monthlyMin,
    return_max:         monthlyMax,

    // Risk + classification
    risk_level:         (get<string>("risk_level") as EntityFormData["risk_level"]) ?? "medium",
    distribution_type:  (get<string>("distribution_type") as EntityFormData["distribution_type"]) ?? "quarterly",
    investment_type:    (get<string>("investment_type") as EntityFormData["investment_type"]) ?? "direct",

    // Profit + capital
    profit_source:      str(get<string>("profit_source")),
    capital_needed:     numStr(get<number | string>("total_value")),
    capital_raised:     numStr(get<number | string>("total_value")),

    // Owner contact
    owner_name:         str(get<string>("owner_name")),
    owner_phone:        str(get<string>("owner_phone")),
    owner_email:        str(get<string>("owner_email")),
  }
}

/**
 * Quick (sync) prefill from the list row only — used as a placeholder
 * before the async DB fetch resolves so the form can mount immediately.
 */
function rowToInitialData(row: EntityRow): EntityFormData {
  return {
    id:            row.id,
    name:          row.name,
    sector:        undefined,
    short_desc:    row.name + " — " + row.sector,
    share_price:   String(row.share_price || ""),
    total_shares:  String(row.total_shares || ""),
    offering_pct:  "90",
    reserve_pct:   "8",
  }
}

const fmtNum = (n: number) => n.toLocaleString("en-US")

const sectorIcon = (s: string) => {
  if (s?.includes("زراع")) return "🌾"
  if (s?.includes("تجار")) return "🏪"
  if (s?.includes("عقار")) return "🏢"
  if (s?.includes("صناع")) return "🏭"
  if (s?.includes("تقن")) return "💻"
  return "🏢"
}

function ProjectsListPanel() {
  const [mainTab, setMainTab] = useState<MainTab>("list")
  const [filter, setFilter] = useState<string>("all")
  const [deleteTarget, setDeleteTarget] = useState<EntityRow | null>(null)
  // Phase 13.34 — flips to false the first time a discover_tag write
  // fails because the column doesn't exist. Subsequent rows then
  // render a disabled "تلقائي" pill instead of triggering more errors.
  const [discoverTagAvailable, setDiscoverTagAvailable] = useState(true)
  const [confirmText, setConfirmText] = useState("")
  const [selectedEntity, setSelectedEntity] = useState<EntityRow | null>(null)

  // ─── Live entities from DB ────────────────────────────────
  const [entities, setEntities] = useState<EntityRow[]>([])

  // Full form-data for the edit panel. Loaded on demand when the
  // founder clicks Edit so every field (vision, goals, dates, owner%,
  // etc.) pre-fills correctly.
  const [editFullData, setEditFullData] = useState<EntityFormData | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Phase 10.53 — pull project rows + their offering-wallet shares
    // in parallel so the "حصص متاحة" column reflects what's actually
    // up for trading (offering wallet) rather than the project's
    // total share count.
    Promise.all([
      getAllProjects(),
      getAllCompanies(),
      getAllProjectWalletsAdmin(500),
    ]).then(([projects, companies, walletAggregates]) => {
      if (cancelled) return

      // Build a map: project_id → offering wallet's REAL available_shares.
      // The Phase 10.57 RPC returns offering_available per project, so we
      // use that directly instead of the old 90% hardcode.
      const offeringAvailMap = new Map<string, number>()
      // Phase 10.93: suspension state from wallet aggregates
      const suspensionMap = new Map<string, {
        trading_suspended: boolean
        trading_suspension_reason: string | null
        offering_suspended: boolean
        offering_suspension_reason: string | null
      }>()
      for (const w of walletAggregates) {
        offeringAvailMap.set(w.project_id, w.offering_available)
        suspensionMap.set(w.project_id, {
          trading_suspended: w.trading_suspended ?? false,
          trading_suspension_reason: w.trading_suspension_reason ?? null,
          offering_suspended: w.offering_suspended ?? false,
          offering_suspension_reason: w.offering_suspension_reason ?? null,
        })
      }

      const projectRows: EntityRow[] = (projects as Array<{
        id: string
        name: string
        sector?: string
        share_price?: number | string
        total_shares?: number | string
        available_shares?: number | string
        offering_percentage?: number | string
        status?: string
        discover_tag?: string | null
      }>).map((p) => {
        const total = Number(p.total_shares ?? 0)
        const price = Number(p.share_price ?? 0)
        const offeringPct = Number(p.offering_percentage ?? 0)

        // Priority order for "حصص متاحة":
        //   1. Real offering_available from the wallet (most accurate — reflects sold shares)
        //   2. offering_percentage × total_shares (correct for new projects without sales)
        //   3. project.available_shares (legacy fallback)
        let available: number
        if (offeringAvailMap.has(p.id)) {
          available = offeringAvailMap.get(p.id)!
        } else if (offeringPct > 0) {
          available = Math.round(total * offeringPct / 100)
        } else {
          available = Number(p.available_shares ?? 0)
        }

        const susp = suspensionMap.get(p.id)
        // Phase 13.24 — robust status mapping. Old logic only matched
        // exact "active"/"draft" strings and fell to "paused" for
        // everything else, including legacy values like "published"
        // and projects whose status column was never set despite
        // having released shares + completed deals.
        //
        // New rules:
        //   • "active" or "published"             → active
        //   • "draft" / "pending" / "review"      → pending
        //   • "paused" / "frozen" / "archived"    → paused
        //   • anything else (incl. null/unknown)  → if the project
        //     has shares released to market (offering wallet exists)
        //     OR its `status` column is missing on legacy DBs, treat
        //     as active. Otherwise default to "pending" so admin
        //     review queue gets the row.
        const dbStatus = (p.status ?? "").toString().toLowerCase()
        const hasOfferingWallet = offeringAvailMap.has(p.id)
        const mappedStatus: EntityRow["status"] =
          dbStatus === "active" || dbStatus === "published"
            ? "active"
            : dbStatus === "draft" || dbStatus === "pending" || dbStatus === "review"
              ? "pending"
              : dbStatus === "paused" || dbStatus === "frozen" || dbStatus === "archived"
                ? "paused"
                : hasOfferingWallet
                  ? "active"  // shares are out — it's working
                  : "pending"
        return {
          id: p.id,
          name: p.name,
          sector: p.sector ?? "—",
          entity_type: "project" as const,
          status: mappedStatus,
          quality: "medium" as const,
          share_price: price,
          total_shares: total,
          available_shares: available,
          project_value: price * total,
          trading_suspended: susp?.trading_suspended ?? false,
          trading_suspension_reason: susp?.trading_suspension_reason ?? null,
          offering_suspended: susp?.offering_suspended ?? false,
          offering_suspension_reason: susp?.offering_suspension_reason ?? null,
          discover_tag:
            (p.discover_tag === "trending" || p.discover_tag === "coming_soon" || p.discover_tag === "new")
              ? p.discover_tag
              : null,
        }
      })
      const companyRows: EntityRow[] = (companies as Array<{
        id: string
        name: string
        sector?: string
        share_price?: number | string
      }>).map((c) => ({
        id: c.id,
        name: c.name,
        sector: c.sector ?? "—",
        entity_type: "company" as const,
        status: "active" as const,
        quality: "medium" as const,
        share_price: Number(c.share_price ?? 0),
        total_shares: 0,
        available_shares: 0,
        project_value: 0,
        trading_suspended: false,
        trading_suspension_reason: null,
        offering_suspended: false,
        offering_suspension_reason: null,
        discover_tag: null,
      }))
      setEntities([...projectRows, ...companyRows])
    })
    return () => { cancelled = true }
  }, [])

  // ─── Edit handler — async loads full project data first ───
  const startEdit = async (entity: EntityRow) => {
    if (entity.entity_type !== "project") {
      // Companies use the simple row prefill for now.
      setEditFullData(rowToInitialData(entity))
      setMainTab("edit")
      return
    }
    setEditLoading(true)
    setEditFullData(rowToInitialData(entity)) // immediate placeholder
    setMainTab("edit")
    try {
      const fullRow = await getProjectByIdAdmin(entity.id)
      if (fullRow) {
        setEditFullData(fullRowToInitialData(fullRow, entity))
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[Projects] failed to load full project data:", err)
    }
    setEditLoading(false)
  }

  // ─── Drafts (NEW Phase 10.25) ─────────────────────────────
  // Loaded from localStorage on mount and refreshed whenever the
  // tab changes to "drafts" so newly-saved drafts appear without
  // a full page reload.
  const [projectDrafts, setProjectDrafts] = useState<SavedDraft[]>([])
  const [companyDrafts, setCompanyDrafts] = useState<SavedDraft[]>([])
  const [draftToResume, setDraftToResume] = useState<SavedDraft | null>(null)
  const [draftKindResume, setDraftKindResume] = useState<"project" | "company">("project")

  const refreshDrafts = () => {
    // Synchronous first paint from localStorage cache.
    setProjectDrafts(loadDraftsList("project"))
    setCompanyDrafts(loadDraftsList("company"))
    // Then refresh from DB in the background so cross-device drafts appear.
    loadDraftsListAsync("project").then(setProjectDrafts)
    loadDraftsListAsync("company").then(setCompanyDrafts)
  }

  useEffect(() => {
    refreshDrafts()
  }, [mainTab, filter])

  const backToList = () => {
    setMainTab("list")
    setSelectedEntity(null)
    setDraftToResume(null)
    refreshDrafts()
  }

  const filtered = entities.filter((p) => {
    if (filter === "all") return true
    if (filter === "company") return p.entity_type === "company"
    if (filter === "project") return p.entity_type === "project"
    if (filter === "pending") return p.status === "pending"
    return true
  })

  const draftsTotal = projectDrafts.length + companyDrafts.length

  const tabs = [
    { key: "all", label: "الكل", count: entities.length },
    { key: "project", label: "مشاريع", count: entities.filter((p) => p.entity_type === "project").length },
    { key: "company", label: "شركات", count: entities.filter((p) => p.entity_type === "company").length },
    { key: "pending", label: "قيد المراجعة", count: entities.filter((p) => p.status === "pending").length },
    { key: "drafts", label: "📝 مسودّاتي", count: draftsTotal },
  ]

  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteTarget) return
    if (confirmText !== deleteTarget.name) {
      showError("الاسم غير مطابق")
      return
    }
    if (deleteTarget.entity_type !== "project") {
      // Companies aren't yet wired to a delete RPC.
      showError("حذف الشركات غير مفعّل بعد")
      return
    }
    setDeleting(true)
    const result = await adminDeleteProject(deleteTarget.id)
    setDeleting(false)

    if (!result.success) {
      const reasonMap: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        not_admin: "صلاحياتك لا تسمح",
        not_found: "المشروع غير موجود",
        missing_table: "الـ migration غير منشورة — طبّق Migration 10.54",
        rls: "ممنوع بسبب RLS",
      }
      showError(reasonMap[result.reason ?? ""] ?? "فشل الحذف")
      return
    }

    if (result.mode === "soft_cancel") {
      showSuccess(`⚠️ تم إلغاء "${deleteTarget.name}" (لديه حصص نشطة فلم يُحذف نهائياً)`)
    } else {
      showSuccess(`🗑️ تم حذف "${deleteTarget.name}" نهائياً`)
    }

    // Remove from local list immediately + close modal
    setEntities((prev) => prev.filter((e) => e.id !== deleteTarget.id))
    setDeleteTarget(null)
    setConfirmText("")
    if (selectedEntity?.id === deleteTarget.id) {
      setSelectedEntity(null)
      setMainTab("list")
    }
  }

  // ─── Sub-views: create / view / edit (mode-based) ───
  if (mainTab === "create_project") {
    return (
      <div>
        <div className="px-6 pt-4">
          <button onClick={backToList} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            ← العودة لقائمة المشاريع
          </button>
        </div>
        <EntityFormPanel
          mode="create"
          entityType="project"
          initialData={
            draftToResume && draftKindResume === "project"
              ? draftToResume.data
              : undefined
          }
          onDone={backToList}
        />
      </div>
    )
  }
  if (mainTab === "create_company") {
    return (
      <div>
        <div className="px-6 pt-4">
          <button onClick={backToList} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            ← العودة لقائمة المشاريع
          </button>
        </div>
        <EntityFormPanel
          mode="create"
          entityType="company"
          initialData={
            draftToResume && draftKindResume === "company"
              ? draftToResume.data
              : undefined
          }
          onDone={backToList}
        />
      </div>
    )
  }
  if (mainTab === "view" && selectedEntity) {
    return (
      <EntityDetailsView
        entity={selectedEntity}
        onEdit={() => startEdit(selectedEntity)}
        onBack={backToList}
      />
    )
  }
  if (mainTab === "edit" && selectedEntity) {
    return (
      <div>
        <div className="px-6 pt-4 flex items-center gap-3">
          <button
            onClick={() => setMainTab("view")}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            ← العودة لتفاصيل {selectedEntity.entity_type === "project" ? "المشروع" : "الشركة"}
          </button>
          {editLoading && (
            <span className="text-[11px] text-neutral-500">جاري تحميل البيانات الكاملة…</span>
          )}
        </div>
        <EntityFormPanel
          mode="edit"
          entityType={selectedEntity.entity_type as "project" | "company"}
          initialData={editFullData ?? rowToInitialData(selectedEntity)}
          onDone={() => setMainTab("view")}
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-screen-2xl">

      <div className="flex justify-between items-start mb-4 gap-3">
        <div>
          <div className="text-lg font-bold text-white">▣ المشاريع والشركات</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {entities.length} عنصر إجمالاً ({entities.filter((p) => p.entity_type === "project").length} مشروع · {entities.filter((p) => p.entity_type === "company").length} شركة)
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMainTab("create_company")}
            className="bg-purple-400/[0.1] border border-purple-400/[0.25] text-purple-400 hover:bg-purple-400/[0.15] px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            شركة جديدة
          </button>
          <button
            onClick={() => setMainTab("create_project")}
            className="bg-neutral-100 text-black px-3 py-2 rounded-lg text-xs font-bold hover:bg-neutral-200 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            مشروع جديد
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="مشاريع نشطة" val={entities.filter((p) => p.entity_type === "project" && p.status === "active").length} color="#60A5FA" />
        <KPI label="معلقة - مراجعة" val={entities.filter((p) => p.status === "pending").length} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
        <KPI label="إجمالي القيمة" val={fmtNum(entities.reduce((s, p) => s + p.project_value, 0)) + " د.ع"} color="#FBBF24" />
        <KPI label="حصص متاحة" val={fmtNum(entities.reduce((s, p) => s + p.available_shares, 0))} color="#4ADE80" />
      </div>

      <InnerTabBar tabs={tabs} active={filter} onSelect={setFilter} />

      {/* ─── Drafts tab — list saved drafts with resume/delete ─── */}
      {filter === "drafts" ? (
        <DraftsList
          projectDrafts={projectDrafts}
          companyDrafts={companyDrafts}
          onResume={(draft, kind) => {
            setDraftToResume(draft)
            setDraftKindResume(kind)
            setMainTab(kind === "project" ? "create_project" : "create_company")
          }}
          onDelete={async (id, kind) => {
            await deleteDraft(kind, id)
            refreshDrafts()
            showSuccess("تم حذف المسودّة")
          }}
        />
      ) : filtered.length === 0 ? (
        <AdminEmpty title="لا توجد نتائج" body="جرب تغيير الفلترة" />
      ) : (
        <Table>
          <THead>
            <TH>الاسم</TH>
            <TH>النوع</TH>
            <TH>القطاع</TH>
            <TH>قيمة الحصة</TH>
            <TH>الحصص</TH>
            <TH>قيمة المشروع</TH>
            <TH>الحالة</TH>
            <TH>الجودة</TH>
            <TH>🌟 الواجهة</TH>
            <TH>إجراءات</TH>
          </THead>
          <TBody>
            {filtered.map((p) => {
              const handleView = () => { setSelectedEntity(p); setMainTab("view") }
              const handleEdit = () => { setSelectedEntity(p); startEdit(p) }
              return (
              <TR key={p.id} onClick={handleView}>
                <TD>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{sectorIcon(p.sector)}</span>
                    <span className="font-bold">{p.name}</span>
                  </div>
                </TD>
                <TD>
                  <Badge label={p.entity_type === "project" ? "مشروع" : "شركة"} color={p.entity_type === "project" ? "blue" : "purple"} />
                </TD>
                <TD><span className="text-neutral-400">{p.sector}</span></TD>
                <TD><span className="font-mono">{p.share_price ? fmtNum(p.share_price) : "—"}</span></TD>
                <TD><span className="text-green-400 font-mono">{fmtNum(p.available_shares)}/{fmtNum(p.total_shares)}</span></TD>
                <TD><span className="font-mono text-yellow-400">{fmtNum(p.project_value)}</span></TD>
                <TD>
                  <Badge
                    label={p.status === "active" ? "نشط" : p.status === "pending" ? "مراجعة" : "متوقف"}
                    color={p.status === "active" ? "green" : p.status === "pending" ? "yellow" : "gray"}
                  />
                </TD>
                <TD>
                  <Badge
                    label={p.quality === "high" ? "★ عالية" : p.quality === "medium" ? "متوسطة" : "منخفضة"}
                    color={p.quality === "high" ? "purple" : p.quality === "medium" ? "blue" : "gray"}
                  />
                </TD>
                <TD>
                  {p.entity_type === "project" ? (
                    <DiscoverTagSelect
                      value={p.discover_tag}
                      disabled={!discoverTagAvailable}
                      onChange={async (tag) => {
                        const r = await adminSetDiscoverTag(p.id, tag)
                        if (!r.success) {
                          // Phase 13.34 — detect "column missing"
                          // and disable the dropdown for the rest
                          // of the session instead of error-spamming.
                          if (r.error?.includes("discover_tag") || r.error?.includes("Phase 13.17")) {
                            setDiscoverTagAvailable(false)
                            showError(
                              "ميزة تثبيت الواجهة غير مفعّلة في قاعدة البيانات — أضف عمود discover_tag إلى projects",
                            )
                            return
                          }
                          showError(
                            r.error === "not_admin"
                              ? "صلاحياتك لا تسمح"
                              : r.error === "invalid_tag"
                                ? "خيار غير صالح"
                                : r.error ?? "تعذّر الحفظ"
                          )
                          return
                        }
                        // Optimistic update
                        setEntities((prev) =>
                          prev.map((e) => (e.id === p.id ? { ...e, discover_tag: tag } : e))
                        )
                        showSuccess(
                          tag === null
                            ? "أُزيل من تثبيت الواجهة"
                            : tag === "trending"
                              ? "🌟 ثُبِّت في رائج"
                              : tag === "coming_soon"
                                ? "⏳ ثُبِّت في قريباً"
                                : "🆕 ثُبِّت في جديد"
                        )
                      }}
                    />
                  ) : (
                    <span className="text-[10px] text-neutral-600">—</span>
                  )}
                </TD>
                <TD>
                  <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <ActionBtn label="👁 تفاصيل" color="gray" sm onClick={handleView} />
                    {p.status === "pending" && (
                      <>
                        <ActionBtn label="قبول" color="green" sm onClick={() => showSuccess("تم القبول")} />
                        <ActionBtn label="رفض" color="red" sm onClick={() => showSuccess("تم الرفض")} />
                      </>
                    )}
                    {p.status === "active" && (
                      <ActionBtn label="✏ تعديل" color="blue" sm onClick={handleEdit} />
                    )}
                    <ActionBtn label="حذف" color="red" sm onClick={(e?: React.MouseEvent) => { e?.stopPropagation?.(); setDeleteTarget(p) }} />
                  </div>
                </TD>
              </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-red-500/[0.3] rounded-2xl p-5 w-full max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/[0.1] border border-red-500/[0.3] flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1">
                <div className="text-base font-bold text-red-400 mb-1">حذف نهائي</div>
                <div className="text-xs text-neutral-400 leading-relaxed">
                  هذا الإجراء لا يمكن التراجع عنه. سيتم حذف "{deleteTarget.name}" وجميع البيانات المرتبطة به.
                </div>
              </div>
              <button onClick={() => { setDeleteTarget(null); setConfirmText("") }} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="text-xs text-neutral-400 mb-2 block">
              للتأكيد، اكتب اسم المشروع: <span className="text-red-400 font-bold">{deleteTarget.name}</span>
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/30 mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteTarget(null); setConfirmText("") }}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmText !== deleteTarget.name || deleting}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold transition-colors",
                  confirmText === deleteTarget.name && !deleting
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-white/[0.05] text-neutral-600 cursor-not-allowed"
                )}
              >
                {deleting ? "جاري الحذف..." : "حذف نهائي"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── DraftsList sub-component ──────────────────────────────────

interface DraftsListProps {
  projectDrafts: SavedDraft[]
  companyDrafts: SavedDraft[]
  onResume: (draft: SavedDraft, kind: "project" | "company") => void
  onDelete: (id: string, kind: "project" | "company") => void | Promise<void>
}

function DraftsList({ projectDrafts, companyDrafts, onResume, onDelete }: DraftsListProps) {
  const total = projectDrafts.length + companyDrafts.length
  if (total === 0) {
    return (
      <AdminEmpty
        title="لا توجد مسودّات محفوظة"
        body="ابدأ بإنشاء مشروع أو شركة، واضغط '💾 حفظ كمسودّة' لتظهر هنا."
      />
    )
  }

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("ar-IQ", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    } catch {
      return iso
    }
  }

  const renderSection = (
    title: string,
    icon: string,
    drafts: SavedDraft[],
    kind: "project" | "company",
  ) => {
    if (drafts.length === 0) return null
    return (
      <div className="mb-5">
        <div className="text-xs font-bold text-neutral-300 mb-2 flex items-center gap-2">
          <span>{icon}</span>
          <span>{title}</span>
          <span className="text-neutral-500">({drafts.length})</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {drafts.map((d) => (
            <div
              key={d.id}
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3 hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{d.title}</div>
                  <div className="text-[10px] text-neutral-500 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    آخر حفظ: {fmtDate(d.saved_at)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onResume(d, kind)}
                  className="flex-1 bg-blue-400/[0.1] border border-blue-400/[0.25] text-blue-400 text-[11px] font-bold rounded-lg py-1.5 hover:bg-blue-400/[0.15] flex items-center justify-center gap-1.5"
                >
                  <FileEdit className="w-3 h-3" />
                  استئناف
                </button>
                <button
                  onClick={() => onDelete(d.id, kind)}
                  className="bg-red-400/[0.1] border border-red-400/[0.25] text-red-400 text-[11px] font-bold rounded-lg px-3 py-1.5 hover:bg-red-400/[0.15]"
                  title="حذف"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {renderSection("مسودّات المشاريع", "🏗️", projectDrafts, "project")}
      {renderSection("مسودّات الشركات", "🏢", companyDrafts, "company")}
    </div>
  )
}

// ─── Phase 13.17 — Discover-tag inline selector ────────────────────
//
// Tiny inline dropdown for the Projects table. The 4 options map to:
//   null         — no pin (project shows up via auto-rules only)
//   trending     — pinned to "🌟 رائج" tab
//   coming_soon  — pinned to "⏳ قريباً" tab
//   new          — pinned to "🆕 جديد" tab
// Click outside to dismiss; clicking a row issues admin_set_discover_tag.
type DiscoverTag = "trending" | "coming_soon" | "new" | null
const TAG_OPTIONS: { value: DiscoverTag; label: string; icon: string; color: string }[] = [
  { value: null,          label: "تلقائي",  icon: "—",  color: "text-neutral-400" },
  { value: "trending",    label: "رائج",     icon: "🌟", color: "text-yellow-300" },
  { value: "coming_soon", label: "قريباً",   icon: "⏳", color: "text-blue-300" },
  { value: "new",         label: "جديد",     icon: "🆕", color: "text-green-300" },
]

function DiscoverTagSelect({
  value,
  onChange,
  disabled,
}: {
  value: DiscoverTag
  onChange: (tag: DiscoverTag) => void | Promise<void>
  /** Phase 13.34 — pass true when the schema doesn't have the
   *  discover_tag column yet so the trigger renders inert. */
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const current = TAG_OPTIONS.find((o) => o.value === value) ?? TAG_OPTIONS[0]
  const lockedOut = !!disabled

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => { if (!lockedOut) setOpen((v) => !v) }}
        disabled={busy || lockedOut}
        className={cn(
          "px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors flex items-center gap-1.5 min-w-[110px] justify-center",
          value
            ? "bg-white/[0.06] border-white/[0.12] hover:bg-white/[0.1]"
            : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]",
          (busy || lockedOut) && "opacity-50 cursor-not-allowed",
          current.color,
        )}
        title={lockedOut
          ? "أضف عمود discover_tag إلى جدول projects لتفعيل التثبيت"
          : "ضع المشروع في الرائج / قريباً / جديد"}
      >
        <span className="text-[12px]">{current.icon}</span>
        <span>{current.label}</span>
      </button>
      {open && (
        // Phase 13.33 — fixed width matches/exceeds the trigger so
        // the panel doesn't render shorter than its tab. Opens
        // upward (bottom-full + mb-1) to avoid clipping at the
        // bottom of the table.
        <div
          className="absolute bottom-full left-0 mb-1 z-50 w-[150px] bg-[#0a0a0a] border border-white/[0.12] rounded-lg shadow-2xl ring-1 ring-black/40 overflow-hidden"
        >
          {TAG_OPTIONS.map((opt) => {
            const active = opt.value === value
            return (
              <button
                key={opt.value ?? "none"}
                onClick={async () => {
                  if (opt.value === value) {
                    setOpen(false)
                    return
                  }
                  setBusy(true)
                  setOpen(false)
                  try {
                    await onChange(opt.value)
                  } finally {
                    setBusy(false)
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-[11px] text-right transition-colors border-b border-white/[0.04] last:border-0",
                  active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
                  opt.color,
                )}
              >
                <span className="text-[13px]">{opt.icon}</span>
                <span className="font-bold">{opt.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
