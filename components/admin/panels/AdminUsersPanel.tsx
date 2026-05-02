"use client"

import { useState } from "react"
import { Search, X, Plus, Lock } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  MOCK_ADMIN_USERS,
  ADMIN_ROLE_LABELS,
  ADMIN_PERMISSION_LABELS,
  ADMIN_STATUS_LABELS,
  getAdminUsersStats,
  isSuperAdmin,
  countActiveSuperAdmins,
  MOCK_CURRENT_ADMIN,
  type AdminUserRecord,
  type AdminPermission,
  type AdminRoleId,
  type AdminUserStatus,
} from "@/lib/mock-data/adminUsers"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type RowAction = null | "view" | "edit_perms" | "suspend" | "reactivate" | "delete"

export function AdminUsersPanel() {
  // ─── 🔒 Access guard: super_admin (founder) only ───
  if (!isSuperAdmin(MOCK_CURRENT_ADMIN)) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-red-400/[0.05] border border-red-400/[0.25] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-400/[0.1] border border-red-400/[0.3] flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-400" strokeWidth={1.5} />
          </div>
          <div className="text-lg font-bold text-white mb-2">🚫 غير مصرَّح</div>
          <div className="text-xs text-neutral-400 leading-relaxed max-w-sm mx-auto">
            فقط <span className="text-purple-400 font-bold">المسؤول الأعلى (Super Admin)</span> يستطيع
            إدارة الأدمنز الآخرين، إنشاءهم، تعديل صلاحياتهم، أو حذفهم.
          </div>
          <div className="mt-4 inline-block bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[11px] text-neutral-500">
            دورك الحالي: <span className="text-white font-bold">{ADMIN_ROLE_LABELS[MOCK_CURRENT_ADMIN.role].label}</span>
          </div>
        </div>
      </div>
    )
  }

  const [filter, setFilter] = useState<AdminUserStatus>("active")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<AdminUserRecord | null>(null)
  const [action, setAction] = useState<RowAction>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newRole, setNewRole] = useState<AdminRoleId>("moderator")
  const [newPerms, setNewPerms] = useState<AdminPermission[]>([])
  const [newNotes, setNewNotes] = useState("")
  const [editPerms, setEditPerms] = useState<AdminPermission[]>([])

  const stats = getAdminUsersStats()

  const filtered = MOCK_ADMIN_USERS
    .filter((a) => a.status === filter)
    .filter((a) => !search || a.full_name.includes(search) || a.email.toLowerCase().includes(search.toLowerCase()))

  const togglePerm = (list: AdminPermission[], setList: (l: AdminPermission[]) => void, p: AdminPermission) => {
    if (list.includes(p)) setList(list.filter((x) => x !== p))
    else setList([...list, p])
  }

  const handleCreate = () => {
    if (!newName.trim() || !newEmail.trim()) return showError("الاسم والبريد إجباريان")
    showSuccess(`✅ تم إنشاء حساب ${newName} كـ ${ADMIN_ROLE_LABELS[newRole].label} + إرسال invite للبريد`)
    setShowCreate(false)
    setNewName(""); setNewEmail(""); setNewPhone(""); setNewRole("moderator"); setNewPerms([]); setNewNotes("")
  }

  const handleAction = () => {
    if (!selected || !action) return

    // 🛡️ منع المسؤول من حذف/إيقاف نفسه
    if ((action === "suspend" || action === "delete") && selected.id === MOCK_CURRENT_ADMIN.id) {
      return showError("لا يمكنك إيقاف أو حذف نفسك")
    }

    // 🛡️ منع حذف آخر super_admin (founder)
    if ((action === "suspend" || action === "delete") && selected.role === "founder") {
      const remainingSuperAdmins = countActiveSuperAdmins()
      if (remainingSuperAdmins <= 1) {
        return showError("يجب وجود مسؤول أعلى (Super Admin) واحد على الأقل في النظام")
      }
    }

    if (action === "edit_perms") {
      showSuccess(`✅ تم تحديث صلاحيات ${selected.full_name}`)
    }
    if (action === "suspend") {
      showSuccess(`⏸ تم إيقاف ${selected.full_name}`)
    }
    if (action === "reactivate") showSuccess(`▶️ تم إعادة تفعيل ${selected.full_name}`)
    if (action === "delete") {
      showSuccess(`🗑️ تم حذف ${selected.full_name}`)
    }
    setAction(null)
    setSelected(null)
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <div className="flex justify-between items-start mb-4 gap-3">
        <div>
          <div className="text-lg font-bold text-white">🛡️ إدارة الإداريين</div>
          <div className="text-xs text-neutral-500 mt-0.5">إنشاء + إدارة + صلاحيات حسابات الفريق الإداري</div>
        </div>
        <ActionBtn label="+ إضافة أدمن جديد" color="green" onClick={() => setShowCreate(true)} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="الإجمالي"   val={stats.total}      color="#fff" />
        <KPI label="مؤسّسون"   val={stats.founders}   color="#a855f7" />
        <KPI label="مدراء"      val={stats.admins}     color="#4ADE80" />
        <KPI label="مشرفون"    val={stats.moderators} color="#a3a3a3" />
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث (اسم/بريد)..."
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      <InnerTabBar
        tabs={[
          { key: "active",    label: "نشطون",  count: MOCK_ADMIN_USERS.filter((a) => a.status === "active").length },
          { key: "suspended", label: "موقوفون", count: stats.suspended },
          { key: "deleted",   label: "محذوفون", count: MOCK_ADMIN_USERS.filter((a) => a.status === "deleted").length },
        ]}
        active={filter}
        onSelect={(k) => setFilter(k as AdminUserStatus)}
      />

      {filtered.length === 0 ? (
        <AdminEmpty title="لا يوجد إداريون" />
      ) : (
        <Table>
          <THead>
            <TH>الإداري</TH>
            <TH>الدور</TH>
            <TH>الصلاحيات</TH>
            <TH>آخر دخول</TH>
            <TH>الحالة</TH>
            <TH>إجراءات</TH>
          </THead>
          <TBody>
            {filtered.map((a) => {
              const role = ADMIN_ROLE_LABELS[a.role]
              const status = ADMIN_STATUS_LABELS[a.status]
              const isFounder = a.role === "founder"
              return (
                <TR key={a.id}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-sm">
                        {role.icon}
                      </div>
                      <div>
                        <div className="text-xs text-white font-bold">{a.full_name}</div>
                        <div className="text-[10px] text-neutral-500" dir="ltr">{a.email}</div>
                      </div>
                    </div>
                  </TD>
                  <TD><Badge label={role.label} color={role.color} /></TD>
                  <TD>
                    <span className="text-[11px] text-neutral-300 font-mono">
                      {a.permissions.length} <span className="text-neutral-500">/ {Object.keys(ADMIN_PERMISSION_LABELS).length}</span>
                    </span>
                  </TD>
                  <TD><span className="text-[11px] text-neutral-500">{a.last_login_at || "—"}</span></TD>
                  <TD><Badge label={status.label} color={status.color} /></TD>
                  <TD>
                    <div className="flex gap-1.5">
                      <ActionBtn label="عرض" color="gray" sm onClick={() => { setSelected(a); setAction("view") }} />
                      {!isFounder && a.status === "active" && (
                        <>
                          <ActionBtn label="صلاحيات" color="blue" sm onClick={() => { setSelected(a); setAction("edit_perms"); setEditPerms(a.permissions) }} />
                          <ActionBtn label="إيقاف" color="yellow" sm onClick={() => { setSelected(a); setAction("suspend") }} />
                        </>
                      )}
                      {!isFounder && a.status === "suspended" && (
                        <>
                          <ActionBtn label="تفعيل" color="green" sm onClick={() => { setSelected(a); setAction("reactivate") }} />
                          <ActionBtn label="حذف" color="red" sm onClick={() => { setSelected(a); setAction("delete") }} />
                        </>
                      )}
                      {isFounder && <span className="text-[10px] text-purple-400 font-bold">🔒 محمي</span>}
                    </div>
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">+ إضافة أدمن جديد</div>
              <button onClick={() => setShowCreate(false)} className="text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">الاسم الكامل *</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مثلاً: محمد العامري" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">البريد الإلكتروني *</label>
                <input type="email" dir="ltr" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="admin@railos.iq" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">الهاتف</label>
                <input type="tel" dir="ltr" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+964770..." className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">الدور</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as AdminRoleId)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20">
                  {(Object.entries(ADMIN_ROLE_LABELS) as [AdminRoleId, typeof ADMIN_ROLE_LABELS[AdminRoleId]][])
                    .filter(([r]) => r !== "founder")
                    .map(([r, m]) => <option key={r} value={r}>{m.icon} {m.label}</option>)}
                </select>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs text-neutral-400 mb-2 block">الصلاحيات (Checkboxes)</label>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {(Object.entries(ADMIN_PERMISSION_LABELS) as [AdminPermission, typeof ADMIN_PERMISSION_LABELS[AdminPermission]][]).map(([p, m]) => (
                  <label key={p} className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 cursor-pointer hover:bg-white/[0.06]">
                    <input type="checkbox" checked={newPerms.includes(p)} onChange={() => togglePerm(newPerms, setNewPerms, p)} className="w-4 h-4" />
                    <span className="text-[11px] text-neutral-300 flex items-center gap-1">
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-neutral-400 mb-1.5 block">ملاحظات</label>
              <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} placeholder="اختياري..." className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20 resize-none" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
              <button onClick={handleCreate} className="flex-1 py-3 rounded-xl bg-green-500/[0.15] border border-green-500/[0.3] text-green-400 text-sm font-bold hover:bg-green-500/[0.2] flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                إنشاء + إرسال invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View / action modal */}
      {selected && action && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">
                {action === "view"        && `${ADMIN_ROLE_LABELS[selected.role].icon} ${selected.full_name}`}
                {action === "edit_perms"  && "✏️ تعديل الصلاحيات"}
                {action === "suspend"     && "⏸ إيقاف الحساب"}
                {action === "reactivate"  && "▶️ إعادة تفعيل"}
                {action === "delete"      && "🗑️ حذف الأدمن"}
              </div>
              <button onClick={() => { setAction(null); setSelected(null) }} className="text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {action === "view" && (
              <>
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-3 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-neutral-500">البريد</span><span className="text-white" dir="ltr">{selected.email}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500">الهاتف</span><span className="text-white" dir="ltr">{selected.phone || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500">الدور</span><Badge label={ADMIN_ROLE_LABELS[selected.role].label} color={ADMIN_ROLE_LABELS[selected.role].color} /></div>
                  <div className="flex justify-between"><span className="text-neutral-500">آخر دخول</span><span className="text-white">{selected.last_login_at || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500">تاريخ الإنشاء</span><span className="text-white">{selected.created_at}</span></div>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-3">
                  <div className="text-[11px] font-bold text-neutral-400 mb-2">الصلاحيات</div>
                  <div className="flex flex-wrap gap-1">
                    {selected.permissions.length === 0 ? (
                      <span className="text-[11px] text-neutral-500">— لا صلاحيات —</span>
                    ) : (
                      selected.permissions.map((p) => (
                        <span key={p} className="bg-white/[0.05] border border-white/[0.08] rounded-md px-2 py-0.5 text-[10px] text-neutral-300">
                          {ADMIN_PERMISSION_LABELS[p].icon} {ADMIN_PERMISSION_LABELS[p].label}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                {selected.notes && (
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-3">
                    <div className="text-[11px] font-bold text-neutral-400 mb-1">ملاحظات</div>
                    <div className="text-xs text-neutral-300">{selected.notes}</div>
                  </div>
                )}
              </>
            )}

            {action === "edit_perms" && (
              <>
                <div className="text-xs text-neutral-300 mb-3">{selected.full_name}</div>
                <div className="grid grid-cols-1 gap-2 mb-3">
                  {(Object.entries(ADMIN_PERMISSION_LABELS) as [AdminPermission, typeof ADMIN_PERMISSION_LABELS[AdminPermission]][]).map(([p, m]) => (
                    <label key={p} className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 cursor-pointer hover:bg-white/[0.06]">
                      <input type="checkbox" checked={editPerms.includes(p)} onChange={() => togglePerm(editPerms, setEditPerms, p)} className="w-4 h-4" />
                      <span className="text-[11px] text-neutral-300 flex items-center gap-1">
                        <span>{m.icon}</span>
                        <span>{m.label}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}

            {(action === "suspend" || action === "reactivate" || action === "delete") && (
              <div className={cn(
                "rounded-xl p-3 mb-3 text-xs border",
                action === "suspend"    && "bg-yellow-400/[0.05] border-yellow-400/[0.2] text-yellow-400",
                action === "reactivate" && "bg-green-400/[0.05] border-green-400/[0.2] text-green-400",
                action === "delete"     && "bg-red-400/[0.05] border-red-400/[0.2] text-red-400",
              )}>
                {action === "suspend"    && `سيتم إيقاف ${selected.full_name} مؤقّتاً. لا يستطيع الدخول حتى إعادة التفعيل.`}
                {action === "reactivate" && `سيتم إعادة تفعيل ${selected.full_name} بنفس الصلاحيات السابقة.`}
                {action === "delete"     && `⚠️ سيتم حذف ${selected.full_name} نهائياً. هذا إجراء لا رجعة فيه.`}
              </div>
            )}

            <div className="flex gap-2">
              {action === "view" ? (
                <button onClick={() => { setAction(null); setSelected(null) }} className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إغلاق</button>
              ) : (
                <>
                  <button onClick={() => { setAction(null); setSelected(null) }} className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
                  <button onClick={handleAction} className={cn(
                    "flex-1 py-3 rounded-xl text-sm font-bold border",
                    action === "edit_perms"  && "bg-blue-500/[0.15] border-blue-500/[0.3] text-blue-400",
                    action === "suspend"     && "bg-yellow-500/[0.15] border-yellow-500/[0.3] text-yellow-400",
                    action === "reactivate"  && "bg-green-500/[0.15] border-green-500/[0.3] text-green-400",
                    action === "delete"      && "bg-red-500/[0.15] border-red-500/[0.3] text-red-400",
                  )}>تأكيد</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
