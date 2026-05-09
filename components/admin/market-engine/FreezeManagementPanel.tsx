"use client"

/** Phase 12 — Manual freeze management. */

import { useEffect, useState } from "react"
import { Snowflake, Unlock } from "lucide-react"
import {
  listActiveFreezes,
  adminFreezeProject,
  adminUnfreezeProject,
} from "@/lib/market/freezes"
import type { ManualFreeze } from "@/lib/market/phase12-types"
import { showSuccess, showError } from "@/lib/utils/toast"
import { createClient } from "@/lib/supabase/client"

interface ProjectLite { id: string; name: string }

export function FreezeManagementPanel() {
  const [freezes, setFreezes] = useState<ManualFreeze[]>([])
  const [projects, setProjects] = useState<ProjectLite[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  // New-freeze form state
  const [newProjectId, setNewProjectId] = useState("")
  const [newReason, setNewReason] = useState("")
  const [newEndDate, setNewEndDate] = useState("")

  const reload = async () => {
    setLoading(true)
    const [list, projs] = await Promise.all([
      listActiveFreezes(),
      (async () => {
        const supabase = createClient()
        const { data } = await supabase
          .from("projects")
          .select("id, name")
          .eq("status", "active")
          .order("name")
        return (data ?? []) as ProjectLite[]
      })(),
    ])
    setFreezes(list)
    setProjects(projs)
    setLoading(false)
  }
  useEffect(() => { void reload() }, [])

  const handleFreeze = async () => {
    if (!newProjectId || !newReason.trim()) {
      showError("اختر المشروع واكتب السبب")
      return
    }
    setBusy("new")
    const res = await adminFreezeProject({
      projectId: newProjectId,
      reason: newReason.trim(),
      endDate: newEndDate || null,
    })
    setBusy(null)
    if (!res.success) { showError(res.reason ?? "فشل التجميد"); return }
    showSuccess("تم التجميد ✓")
    setNewProjectId(""); setNewReason(""); setNewEndDate("")
    void reload()
  }

  const handleUnfreeze = async (projectId: string) => {
    const notes = prompt("سبب إلغاء التجميد:") ?? ""
    setBusy(projectId)
    const res = await adminUnfreezeProject({ projectId, notes })
    setBusy(null)
    if (!res.success) { showError(res.reason ?? "فشل إلغاء التجميد"); return }
    showSuccess("تم إلغاء التجميد ✓")
    void reload()
  }

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? id.slice(0, 8)

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <Snowflake className="w-4 h-4 text-cyan-400" strokeWidth={2} />
        <span className="text-sm font-bold text-white">التجميد اليدوي</span>
      </div>

      {/* New freeze form */}
      <div className="p-4 border-b border-white/[0.06] grid grid-cols-1 lg:grid-cols-12 gap-2">
        <select
          value={newProjectId}
          onChange={(e) => setNewProjectId(e.target.value)}
          className="lg:col-span-3 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
        >
          <option value="">— اختر مشروعاً —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          type="text"
          value={newReason}
          onChange={(e) => setNewReason(e.target.value)}
          placeholder="سبب التجميد"
          className="lg:col-span-5 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
        />
        <input
          type="date"
          value={newEndDate}
          onChange={(e) => setNewEndDate(e.target.value)}
          className="lg:col-span-2 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white outline-none font-mono"
        />
        <button
          onClick={handleFreeze}
          disabled={busy === "new"}
          className="lg:col-span-2 bg-cyan-500/15 border border-cyan-500/30 hover:bg-cyan-500/25 text-cyan-400 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <Snowflake className="w-3 h-3" strokeWidth={2.5} />
          تجميد
        </button>
      </div>

      {/* Active freezes list */}
      <div className="divide-y divide-white/[0.04]">
        {loading ? (
          <div className="text-center py-6 text-xs text-neutral-500">جاري التحميل...</div>
        ) : freezes.length === 0 ? (
          <div className="text-center py-6 text-xs text-neutral-500">
            لا توجد مشاريع مجمَّدة حالياً
          </div>
        ) : (
          freezes.map((f) => (
            <div key={f.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">{projectName(f.project_id)}</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">{f.freeze_reason}</div>
                <div className="text-[10px] text-neutral-500 mt-1 font-mono flex gap-3">
                  <span>بداية: {f.freeze_start_date}</span>
                  {f.freeze_end_date && <span>نهاية: {f.freeze_end_date}</span>}
                </div>
              </div>
              <button
                onClick={() => handleUnfreeze(f.project_id)}
                disabled={busy === f.project_id}
                className="bg-green-500/15 border border-green-500/30 hover:bg-green-500/25 text-green-400 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <Unlock className="w-3 h-3" strokeWidth={2.5} />
                إلغاء التجميد
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
