"use client"

/**
 * UsersListPanel — Phase 10.59.
 *
 * Lists every registered (non-admin) user from `profiles`, with
 * search + level/KYC filters and the standard admin actions:
 *   • View user stats (deep-link to `?tab=user_stats&user_id=…`).
 *   • Promote / demote role (super-admin only).
 *   • Toggle freeze flag (placeholder until a freeze RPC ships).
 *
 * Data path: `getAllUsersForAdmin` reads `profiles` directly (no FK
 * joins, no PostgREST inference) so it works under the same RLS as
 * the rest of the admin panels.
 */

import { useEffect, useMemo, useState, useCallback } from "react"
import { Search, Crown } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  KPI, AdminEmpty, InnerTabBar,
} from "@/components/admin/ui"
import {
  getAllUsersForAdmin,
  adminSetUserRole,
  isSuperAdminDB,
  type AdminUserListRow,
} from "@/lib/data/admin-utilities"
import { showSuccess, showError } from "@/lib/utils/toast"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—"
  return iso.slice(0, 10)
}

type LevelTab = "all" | "basic" | "advanced" | "pro" | "elite" | "kyc_pending"

const LEVEL_LABEL: Record<string, { label: string; color: "blue" | "green" | "purple" | "yellow" | "gray" }> = {
  basic:    { label: "أساسي",   color: "gray" },
  advanced: { label: "متقدّم",   color: "blue" },
  pro:      { label: "محترف",   color: "purple" },
  elite:    { label: "نخبة",     color: "yellow" },
}

const ROLE_LABEL: Record<string, { label: string; color: "purple" | "blue" | "green" | "gray" }> = {
  super_admin: { label: "مسؤول أعلى",  color: "purple" },
  admin:       { label: "مدير",         color: "blue"   },
  ambassador:  { label: "سفير",         color: "green"  },
  user:        { label: "مستخدم",       color: "gray"   },
}

const KYC_LABEL: Record<string, { label: string; color: "green" | "yellow" | "red" | "gray" }> = {
  approved:  { label: "موثَّق",     color: "green"  },
  pending:   { label: "قيد المراجعة", color: "yellow" },
  rejected:  { label: "مرفوض",      color: "red"    },
  none:      { label: "—",          color: "gray"   },
}

export function UsersListPanel() {
  const [users, setUsers] = useState<AdminUserListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<LevelTab>("all")
  const [search, setSearch] = useState("")
  const [isSuper, setIsSuper] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [rows, sup] = await Promise.all([
      getAllUsersForAdmin(500),
      isSuperAdminDB(),
    ])
    // Hide admin/super_admin accounts here — those are managed in
    // the System ▸ Admins panel.
    setUsers(rows.filter((u) => !u.is_admin))
    setIsSuper(sup)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const stats = useMemo(() => ({
    total:    users.length,
    verified: users.filter((u) => u.kyc_status === "approved").length,
    pending:  users.filter((u) => u.kyc_status === "pending").length,
    new30d:   users.filter((u) => {
      const days = (Date.now() - new Date(u.created_at).getTime()) / 86_400_000
      return days <= 30
    }).length,
  }), [users])

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (tab === "kyc_pending" && u.kyc_status !== "pending") return false
      if (tab !== "all" && tab !== "kyc_pending" && u.level !== tab) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = (
          (u.full_name || "") + " " +
          (u.username || "") + " " +
          (u.phone || "") + " " +
          (u.email || "")
        ).toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [users, tab, search])

  const promote = async (u: AdminUserListRow) => {
    if (!isSuper) return showError("فقط المسؤول الأعلى يستطيع ترقية الأدوار")
    const ok = window.confirm(`ترقية ${u.full_name} إلى أدمن؟`)
    if (!ok) return
    const r = await adminSetUserRole(u.id, "admin")
    if (!r.success) return showError("فشل تحديث الدور")
    showSuccess(`✅ تمت ترقية ${u.full_name} إلى أدمن`)
    refresh()
  }

  const makeAmbassador = async (u: AdminUserListRow) => {
    if (!isSuper) return showError("فقط المسؤول الأعلى يستطيع تعيين السفراء")
    const r = await adminSetUserRole(u.id, "ambassador")
    if (!r.success) return showError("فشل التعيين")
    showSuccess(`🌟 ${u.full_name} أصبح سفيراً`)
    refresh()
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <div className="flex justify-between items-start mb-4 gap-3">
        <div>
          <div className="text-lg font-bold text-white">⊙ المستخدمون المسجَّلون</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            كل مستخدم سجّل في التطبيق — بياناته الفعلية + إجراءات إدارية
          </div>
        </div>
        <ActionBtn label="🔄 تحديث" color="gray" sm onClick={refresh} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="إجمالي" val={fmtNum(stats.total)} color="#fff" />
        <KPI label="موثَّقون" val={fmtNum(stats.verified)} color="#4ADE80" />
        <KPI label="KYC قيد المراجعة" val={fmtNum(stats.pending)} color="#FBBF24" />
        <KPI label="جدد (30 يوم)" val={fmtNum(stats.new30d)} color="#60A5FA" />
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث (اسم / username / هاتف / بريد)..."
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      <InnerTabBar
        tabs={[
          { key: "all", label: "الكل", count: users.length },
          { key: "basic", label: "أساسي", count: users.filter((u) => u.level === "basic").length },
          { key: "advanced", label: "متقدّم", count: users.filter((u) => u.level === "advanced").length },
          { key: "pro", label: "محترف", count: users.filter((u) => u.level === "pro").length },
          { key: "elite", label: "نخبة", count: users.filter((u) => u.level === "elite").length },
          { key: "kyc_pending", label: "KYC معلّق", count: stats.pending },
        ]}
        active={tab}
        onSelect={(k) => setTab(k as LevelTab)}
      />

      {loading ? (
        <AdminEmpty title="جاري التحميل..." />
      ) : filtered.length === 0 ? (
        <AdminEmpty
          title="لا يوجد مستخدمون"
          body={
            users.length === 0
              ? "لا توجد سجلات في `profiles` بعد — أو RLS يحجب القراءة."
              : "لا تطابق نتائج للفلتر/البحث الحالي."
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>الاسم</TH>
            <TH>username</TH>
            <TH>المستوى</TH>
            <TH>KYC</TH>
            <TH>تسجيل</TH>
            <TH>آخر دخول</TH>
            <TH>إجراءات</TH>
          </THead>
          <TBody>
            {filtered.map((u) => {
              const level = LEVEL_LABEL[u.level] ?? LEVEL_LABEL.basic
              const kyc = KYC_LABEL[u.kyc_status] ?? KYC_LABEL.none
              return (
                <TR key={u.id}>
                  <TD>
                    <div>
                      <div className="text-xs text-white font-bold">{u.full_name}</div>
                      <div className="text-[10px] text-neutral-500" dir="ltr">
                        {u.email || u.phone || "—"}
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <span className="text-[11px] text-neutral-400 font-mono" dir="ltr">
                      @{u.username || "—"}
                    </span>
                  </TD>
                  <TD><Badge label={level.label} color={level.color} /></TD>
                  <TD><Badge label={kyc.label} color={kyc.color} /></TD>
                  <TD>
                    <span className="text-[11px] text-neutral-500" dir="ltr">{fmtDate(u.created_at)}</span>
                  </TD>
                  <TD>
                    <span className="text-[11px] text-neutral-500" dir="ltr">{fmtDate(u.last_seen_at)}</span>
                  </TD>
                  <TD>
                    <div className="flex gap-1.5">
                      <ActionBtn
                        label="📊 سجل"
                        color="gray"
                        sm
                        onClick={() => { window.location.href = `/admin?tab=user_stats&user_id=${u.id}` }}
                      />
                      {isSuper && u.role === "user" && (
                        <>
                          <ActionBtn label="🌟 سفير" color="green" sm onClick={() => makeAmbassador(u)} />
                          <ActionBtn label="👑 أدمن" color="purple" sm onClick={() => promote(u)} />
                        </>
                      )}
                      {u.role === "ambassador" && (
                        <Badge label="🌟 سفير حالياً" color="green" />
                      )}
                    </div>
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {!isSuper && (
        <div className="mt-4 text-[11px] text-neutral-500 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
          <Crown className="inline w-3.5 h-3.5 text-purple-400 mr-1" />
          ترقية الأدوار (سفير / أدمن) متاحة للمسؤول الأعلى فقط — اتصل بالمؤسس عند الحاجة.
        </div>
      )}
    </div>
  )
}
