"use client"

import { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, AlertTriangle, X, Eye, FileEdit, Clock } from "lucide-react"
import { Badge, ActionBtn, Table, THead, TH, TBody, TR, TD, SectionHeader, AdminEmpty, KPI, InnerTabBar } from "@/components/admin/ui"
import { EntityFormPanel, type EntityFormData } from "./EntityFormPanel"
import { EntityDetailsView } from "./EntityDetailsView"
import { getAllProjects, getProjectByIdAdmin } from "@/lib/data/projects"
import { getAllCompanies } from "@/lib/data/companies"
import { getAllProjectWalletsAdmin } from "@/lib/data/admin-utilities"
import {
  loadDraftsList,
  loadDraftsListAsync,
  deleteDraft,
  type SavedDraft,
} from "@/lib/admin/entity-drafts"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

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
}

/** Map a Project type DB enum back to the form's sector option. */
function dbToFormSector(t: string | null | undefined): EntityFormData["sector"] {
  if (t === "agriculture" || t === "real_estate" || t === "industrial"
      || t === "commercial" || t === "services" || t === "medical") {
    return t
  }
  return undefined
}

/** Pre-populate the edit form from a FULL DB row (Phase 10.53). */
function fullRowToInitialData(
  row: Record<string, unknown>,
  fallbackRow: EntityRow,
): EntityFormData {
  const get = <T,>(key: string): T | undefined => row[key] as T | undefined
  const numStr = (v: unknown): string =>
    v === null || v === undefined || v === "" ? "" : String(v)

  return {
    id:            (get<string>("id") ?? fallbackRow.id),
    name:          (get<string>("name") ?? fallbackRow.name),
    parent_company_id: get<string>("company_id") ?? "",
    sector:        dbToFormSector(get<string>("project_type")),
    short_desc:    get<string>("short_description") ?? "",
    long_desc:     get<string>("description") ?? "",
    city:          get<string>("location_city") ?? "",
    share_price:   numStr(get<number | string>("share_price") ?? fallbackRow.share_price),
    total_shares:  numStr(get<number | string>("total_shares") ?? fallbackRow.total_shares),
    offering_pct:  numStr(get<number | string>("offering_percentage") ?? "90"),
    ambassador_pct:numStr(get<number | string>("ambassador_percentage") ?? "2"),
    reserve_pct:   numStr(get<number | string>("reserve_percentage") ?? "8"),
    offering_start:get<string>("offering_start_date") ?? "",
    offering_end:  get<string>("offering_end_date") ?? "",
    symbol:        get<string>("symbol") ?? "",
    project_value: numStr(get<number | string>("total_value")),
    capital_needed:numStr(get<number | string>("total_value")),
    capital_raised:numStr(get<number | string>("total_value")),
    detailed_address: get<string>("location_address") ?? "",
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
    ambassador_pct:"2",
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

export function ProjectsPanel() {
  const [mainTab, setMainTab] = useState<MainTab>("list")
  const [filter, setFilter] = useState<string>("all")
  const [deleteTarget, setDeleteTarget] = useState<EntityRow | null>(null)
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

      // Build a map: project_id → offering wallet's available_shares.
      // The aggregator returns one row per project with offering+
      // ambassador+reserve combined, but we want offering specifically
      // — fetch via the admin RPC layer in a follow-up if needed.
      // For now, derive offering from the project's offering_percentage
      // applied to total_shares.
      const offeringMap = new Map<string, number>()
      for (const w of walletAggregates) {
        offeringMap.set(w.project_id, 0) // placeholder; computed per-row below
      }

      const projectRows: EntityRow[] = (projects as Array<{
        id: string
        name: string
        sector?: string
        share_price?: number | string
        total_shares?: number | string
        available_shares?: number | string
        status?: string
      }>).map((p) => {
        const total = Number(p.total_shares ?? 0)
        const price = Number(p.share_price ?? 0)
        // "available" reflects offering shares (what's actually for sale).
        // We approximate as 90% of total when the wallet exists; falls
        // back to project.available_shares as a safety net.
        const offeringApprox = Math.floor(total * 0.9)
        const available = offeringMap.has(p.id)
          ? offeringApprox
          : Number(p.available_shares ?? 0)
        return {
          id: p.id,
          name: p.name,
          sector: p.sector ?? "—",
          entity_type: "project" as const,
          status: (p.status === "active" ? "active" : p.status === "draft" ? "pending" : "paused") as EntityRow["status"],
          quality: "medium" as const,
          share_price: price,
          total_shares: total,
          available_shares: available,
          project_value: price * total,
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

  const handleDelete = () => {
    if (!deleteTarget) return
    if (confirmText !== deleteTarget.name) {
      showError("الاسم غير مطابق")
      return
    }
    showSuccess("تم الحذف بنجاح")
    setDeleteTarget(null)
    setConfirmText("")
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
                disabled={confirmText !== deleteTarget.name}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold transition-colors",
                  confirmText === deleteTarget.name
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-white/[0.05] text-neutral-600 cursor-not-allowed"
                )}
              >
                حذف نهائي
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
