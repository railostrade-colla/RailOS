"use client"

/**
 * AdminUsersPanel — Phase 10.59 rewrite.
 *
 * Reads the live admin/super-admin roster from `profiles` (no more
 * MOCK_ADMIN_USERS). Super-admin gate stays — only the founder can
 * promote/demote roles. The DB schema doesn't track per-permission
 * checkboxes, so we display the role-level grant only and leave the
 * fine-grained permissions matrix for a future phase.
 *
 * Actions:
 *   • View basic profile info.
 *   • Demote admin → user (super-admin only).
 *   • Promote user → admin (super-admin only — done from the
 *     Users hub list panel; here we keep only the demote flow).
 */

import { useEffect, useState, useCallback } from "react"
import { Search, Lock, Crown, ShieldCheck } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  KPI, AdminEmpty,
} from "@/components/admin/ui"
import {
  getAllUsersForAdmin,
  adminSetUserRole,
  isSuperAdminDB,
  getMyUserId,
  type AdminUserListRow,
} from "@/lib/data/admin-utilities"
import { showSuccess, showError } from "@/lib/utils/toast"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const fmtDate = (iso: string | null | undefined) => iso ? iso.slice(0, 10) : "—"

export function AdminUsersPanel() {
  const [accessChecked, setAccessChecked] = useState(false)
  const [accessAllowed, setAccessAllowed] = useState(false)
  const [myUserId, setMyUserId] = useState<string | null>(null)

  const [users, setUsers] = useState<AdminUserListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    const rows = await getAllUsersForAdmin(500)
    // Only admin + super_admin rows.
    setUsers(rows.filter((u) => u.is_admin))
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([isSuperAdminDB(), getMyUserId()]).then(([isSuper, uid]) => {
      if (cancelled) return
      setAccessAllowed(isSuper)
      setMyUserId(uid)
      setAccessChecked(true)
      if (isSuper) refresh()
    })
    return () => { cancelled = true }
  }, [refresh])

  if (!accessChecked) {
    return (
      <div className="p-6 text-center text-xs text-neutral-500">
        جاري التحقق من الصلاحيات...
      </div>
    )
  }

  if (!accessAllowed) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-red-400/[0.05] border border-red-400/[0.25] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-400/[0.1] border border-red-400/[0.3] flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-400" strokeWidth={1.5} />
          </div>
          <div className="text-lg font-bold text-white mb-2">🚫 غير مصرَّح</div>
          <div className="text-xs text-neutral-400 leading-relaxed max-w-sm mx-auto">
            فقط <span className="text-purple-400 font-bold">المسؤول الأعلى (Super Admin)</span> يستطيع
            استعراض وإدارة قائمة الأدمنز.
          </div>
        </div>
      </div>
    )
  }

  const filtered = users.filter((u) =>
    !search ||
    u.full_name.includes(search) ||
    (u.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (u.username ?? "").toLowerCase().includes(search.toLowerCase()),
  )

  const stats = {
    total:        users.length,
    super_admins: users.filter((u) => u.is_super_admin).length,
    admins:       users.filter((u) => u.role === "admin").length,
  }

  const demote = async (u: AdminUserListRow) => {
    if (u.is_super_admin) {
      const remaining = users.filter((x) => x.is_super_admin).length
      if (remaining <= 1) return showError("يجب وجود مسؤول أعلى واحد على الأقل")
    }
    if (u.id === myUserId) return showError("لا يمكنك حذف صلاحياتك بنفسك")
    const ok = window.confirm(`إزالة صلاحيات الإدارة عن ${u.full_name}؟`)
    if (!ok) return
    const r = await adminSetUserRole(u.id, "user")
    if (!r.success) return showError("فشل التحديث")
    showSuccess(`✅ تم تحويل ${u.full_name} إلى مستخدم عادي`)
    refresh()
  }

  const promoteToSuper = async (u: AdminUserListRow) => {
    const ok = window.confirm(`ترقية ${u.full_name} إلى مسؤول أعلى (super admin)؟`)
    if (!ok) return
    const r = await adminSetUserRole(u.id, "super_admin")
    if (!r.success) return showError("فشل التحديث")
    showSuccess(`👑 ${u.full_name} أصبح مسؤول أعلى`)
    refresh()
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <div className="flex justify-between items-start mb-4 gap-3">
        <div>
          <div className="text-lg font-bold text-white">👑 الإداريون</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            قائمة الأدمنز + المسؤول الأعلى — مقروءة من قاعدة البيانات (profiles.role)
          </div>
        </div>
        <ActionBtn label="🔄 تحديث" color="gray" sm onClick={refresh} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <KPI label="إجمالي" val={fmtNum(stats.total)} color="#fff" />
        <KPI label="مسؤولون أعلى" val={fmtNum(stats.super_admins)} color="#a855f7" />
        <KPI label="مدراء" val={fmtNum(stats.admins)} color="#60A5FA" />
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث (اسم/بريد/username)..."
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      {loading ? (
        <AdminEmpty title="جاري التحميل..." />
      ) : filtered.length === 0 ? (
        <AdminEmpty
          title="لا يوجد أدمنز"
          body={
            users.length === 0
              ? "لا توجد سجلات بدور admin/super_admin في `profiles`. لترقية مستخدم اذهب إلى المستخدمون ▸ قائمة المستخدمين."
              : "لا تطابق نتائج للبحث."
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>الإداري</TH>
            <TH>الدور</TH>
            <TH>username</TH>
            <TH>تسجيل</TH>
            <TH>آخر دخول</TH>
            <TH>إجراءات</TH>
          </THead>
          <TBody>
            {filtered.map((a) => {
              const isMe = a.id === myUserId
              return (
                <TR key={a.id}>
                  <TD>
                    <div>
                      <div className="text-xs text-white font-bold flex items-center gap-1.5">
                        {a.is_super_admin ? <Crown className="w-3.5 h-3.5 text-purple-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />}
                        {a.full_name}
                        {isMe && <span className="text-[10px] text-purple-400 font-bold">(أنت)</span>}
                      </div>
                      <div className="text-[10px] text-neutral-500" dir="ltr">
                        {a.email || a.phone || "—"}
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <Badge
                      label={a.is_super_admin ? "👑 مسؤول أعلى" : "🛡 أدمن"}
                      color={a.is_super_admin ? "purple" : "blue"}
                    />
                  </TD>
                  <TD>
                    <span className="text-[11px] text-neutral-400 font-mono" dir="ltr">
                      @{a.username || "—"}
                    </span>
                  </TD>
                  <TD>
                    <span className="text-[11px] text-neutral-500" dir="ltr">{fmtDate(a.created_at)}</span>
                  </TD>
                  <TD>
                    <span className="text-[11px] text-neutral-500" dir="ltr">{fmtDate(a.last_seen_at)}</span>
                  </TD>
                  <TD>
                    <div className="flex gap-1.5">
                      {!a.is_super_admin && !isMe && (
                        <ActionBtn label="👑 ترقية" color="purple" sm onClick={() => promoteToSuper(a)} />
                      )}
                      {!isMe && (
                        <ActionBtn label="↓ إزالة" color="red" sm onClick={() => demote(a)} />
                      )}
                      {isMe && (
                        <span className="text-[10px] text-purple-400 font-bold">🔒 محمي</span>
                      )}
                    </div>
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      <div className="mt-4 text-[11px] text-neutral-500 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
        💡 لإضافة أدمن جديد، اذهب إلى{" "}
        <a className="font-bold underline" href="/admin?tab=users">المستخدمون ▸ قائمة المستخدمين</a>
        {" "}واضغط <span className="font-bold">"👑 أدمن"</span> أمام المستخدم. الترقية تستدعي{" "}
        <span className="font-mono text-yellow-400">admin_set_user_role</span> RPC.
      </div>
    </div>
  )
}
