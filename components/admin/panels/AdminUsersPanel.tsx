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

import { useEffect, useState, useCallback, useMemo } from "react"
import { Search, Lock, Crown, ShieldCheck, X, UserPlus } from "lucide-react"
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
import {
  adminSetAdminPermissions,
  ALL_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  PERMISSION_LABELS,
  type AdminPermission,
} from "@/lib/data/admin-permissions"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const fmtDate = (iso: string | null | undefined) => iso ? iso.slice(0, 10) : "—"

export function AdminUsersPanel() {
  const [accessChecked, setAccessChecked] = useState(false)
  const [accessAllowed, setAccessAllowed] = useState(false)
  const [myUserId, setMyUserId] = useState<string | null>(null)

  const [users, setUsers] = useState<AdminUserListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Phase 11.00 / 13.44 — Add-Admin modal. Phase 13.44 swapped the
  // user-picker for a self-contained creation form (full_name, phone,
  // email, password) that calls /api/admin/create-admin.
  const [showAddModal, setShowAddModal] = useState(false)
  const [allUsers, setAllUsers] = useState<AdminUserListRow[]>([])
  const [formFullName, setFormFullName] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [permSet, setPermSet] = useState<Set<AdminPermission>>(new Set(DEFAULT_PERMISSIONS))
  const [submitting, setSubmitting] = useState(false)

  // Phase 11.00 — Edit-permissions modal state (for existing admins)
  const [editPermsFor, setEditPermsFor] = useState<AdminUserListRow | null>(null)
  const [editPermSet, setEditPermSet] = useState<Set<AdminPermission>>(new Set())

  const refresh = useCallback(async () => {
    setLoading(true)
    const rows = await getAllUsersForAdmin(500)
    setAllUsers(rows)
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

  // Phase 13.44 — pickerCandidates removed; the Add Admin modal
  // now uses a creation form, not a user picker.

  // Phase 13.40 — derived values memoised so they're stable for
  // child components even though they don't strictly need to be
  // hooks. Keeps the render path predictable.
  const filtered = useMemo(() => {
    return users.filter((u) =>
      !search ||
      u.full_name.includes(search) ||
      (u.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.username ?? "").toLowerCase().includes(search.toLowerCase()),
    )
  }, [users, search])

  const stats = useMemo(() => ({
    total:        users.length,
    super_admins: users.filter((u) => u.is_super_admin).length,
    admins:       users.filter((u) => u.role === "admin").length,
  }), [users])

  // Now safe to early-return — every hook above runs on every render.
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

  // ─── Phase 13.44 — Add Admin via form (creates new auth user) ──
  const resetForm = () => {
    setFormFullName("")
    setFormPhone("")
    setFormEmail("")
    setFormPassword("")
    setShowPassword(false)
    setPermSet(new Set(DEFAULT_PERMISSIONS))
  }
  const openAddModal = () => {
    resetForm()
    setShowAddModal(true)
  }
  const closeAddModal = () => {
    setShowAddModal(false)
    resetForm()
  }
  const togglePerm = (p: AdminPermission) => {
    setPermSet((cur) => {
      const next = new Set(cur)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }
  const submitAddAdmin = async () => {
    const name = formFullName.trim()
    const email = formEmail.trim().toLowerCase()
    const phone = formPhone.trim()
    const password = formPassword

    if (!name || name.length < 2) return showError("الاسم مطلوب (حرفان على الأقل)")
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return showError("البريد الإلكتروني غير صالح")
    }
    if (!password || password.length < 6) {
      return showError("كلمة المرور قصيرة (6 أحرف على الأقل)")
    }
    if (permSet.size === 0) {
      const ok = window.confirm("لم تختر أي صلاحية. هل تريد المتابعة (الأدمن لن يرى أي شيء)؟")
      if (!ok) return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/create-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: name,
          phone,
          email,
          password,
          permissions: Array.from(permSet),
        }),
      })
      const json = await res.json() as { ok: boolean; error?: string; warning?: string; detail?: string }
      if (!res.ok || !json.ok) {
        const map: Record<string, string> = {
          unauthenticated: "سجّل الدخول أوّلاً",
          not_super_admin: "هذا الإجراء يتطلّب Super Admin",
          name_required: "الاسم مطلوب",
          email_invalid: "البريد الإلكتروني غير صالح",
          password_too_short: "كلمة المرور قصيرة (6 أحرف على الأقل)",
          email_already_exists: "هذا البريد مسجَّل بالفعل",
          service_role_missing: "إعدادات الخادم ناقصة — أبلغ المطوّر (SUPABASE_SERVICE_ROLE_KEY)",
          auth_create_failed: "تعذّر إنشاء الحساب — راجع كلمة المرور",
          profile_upsert_failed: "تعذّر حفظ الملف الشخصي",
        }
        const msg = map[json.error ?? ""] ?? json.detail ?? json.error ?? "فشل الإضافة"
        showError(msg)
        return
      }
      const successMsg = json.warning === "permissions_failed"
        ? `✅ تم إنشاء الحساب لكن تعذّر حفظ الصلاحيات — حدّثها يدوياً`
        : `✅ تم إنشاء أدمن جديد: ${name} (${permSet.size} صلاحية)`
      showSuccess(successMsg)
      closeAddModal()
      refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "خطأ في الشبكة")
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Phase 11.00 — Edit permissions flow ──────────────────────
  const openEditPerms = (u: AdminUserListRow) => {
    setEditPermsFor(u)
    // Read existing permissions from the user row if exposed by the
    // shape (admin_permissions column). Falls back to "all" so the
    // admin sees the full preset.
    const cur = (u as AdminUserListRow & { admin_permissions?: unknown }).admin_permissions
    const arr = Array.isArray(cur) ? (cur as AdminPermission[]) : ALL_PERMISSIONS
    setEditPermSet(new Set(arr))
  }
  const closeEditPerms = () => {
    setEditPermsFor(null)
    setEditPermSet(new Set())
  }
  const toggleEditPerm = (p: AdminPermission) => {
    setEditPermSet((cur) => {
      const next = new Set(cur)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }
  const submitEditPerms = async () => {
    if (!editPermsFor) return
    setSubmitting(true)
    const r = await adminSetAdminPermissions(editPermsFor.id, Array.from(editPermSet))
    setSubmitting(false)
    if (!r.success) {
      const map: Record<string, string> = {
        super_admin_only: "هذا الإجراء يتطلب Super Admin",
        not_an_admin: "هذا المستخدم ليس أدمن",
        missing_table: "طبّق Migration 11.00 أولاً",
      }
      return showError(map[r.reason ?? ""] ?? "فشل التحديث")
    }
    showSuccess(`✅ تم تحديث صلاحيات ${editPermsFor.full_name}`)
    closeEditPerms()
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
        <div className="flex gap-2">
          <button
            onClick={openAddModal}
            className="px-3 py-1.5 rounded-lg bg-blue-500/[0.15] border border-blue-500/[0.3] text-blue-400 text-xs font-bold hover:bg-blue-500/[0.2] flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            إضافة أدمن
          </button>
          <ActionBtn label="🔄 تحديث" color="gray" sm onClick={refresh} />
        </div>
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
                    <div className="flex gap-1.5 flex-wrap">
                      {!a.is_super_admin && !isMe && (
                        <ActionBtn
                          label="🛠 الصلاحيات"
                          color="blue"
                          sm
                          onClick={() => openEditPerms(a)}
                        />
                      )}
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
        💡 الأدمن يرى فقط الأقسام التي مُنح صلاحية الوصول إليها. لتعديل صلاحيات
        أدمن موجود، اضغط <span className="font-bold text-white">🛠 الصلاحيات</span> أمام صفّه.
      </div>

      {/* ═══════ Phase 11.00 — Add Admin modal ═══════ */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeAddModal}
        >
          <div
            className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
              <div>
                <div className="text-base font-bold text-white">👑 إضافة أدمن جديد</div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  اختر المستخدم ثم حدّد الصلاحيات التي يستطيع الوصول إليها
                </div>
              </div>
              <button onClick={closeAddModal} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Phase 13.44 — Creation form (replaces user picker) */}
              <div>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">
                  1. الاسم الكامل <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="مثال: محمد علي"
                  autoComplete="off"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 mb-2 block font-bold">
                    البريد الإلكتروني <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="admin@example.com"
                    autoComplete="off"
                    dir="ltr"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-2 block font-bold">
                    رقم الهاتف
                    <span className="text-neutral-500 font-normal"> (اختياري)</span>
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+9647XXXXXXXXX"
                    autoComplete="off"
                    dir="ltr"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">
                  كلمة المرور <span className="text-red-400">*</span>
                  <span className="text-neutral-500 font-normal"> (6 أحرف على الأقل)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    dir="ltr"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pr-3 pl-16 py-2 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-400 hover:text-blue-300 px-2 py-1"
                  >
                    {showPassword ? "إخفاء" : "إظهار"}
                  </button>
                </div>
              </div>

              {/* Permissions checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-neutral-400 font-bold">
                    2. الصلاحيات <span className="text-neutral-500 font-normal">({permSet.size}/{ALL_PERMISSIONS.length})</span>
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setPermSet(new Set(ALL_PERMISSIONS))}
                      className="text-[10px] text-blue-400 hover:text-blue-300"
                    >
                      تحديد الكل
                    </button>
                    <span className="text-neutral-600">·</span>
                    <button
                      onClick={() => setPermSet(new Set())}
                      className="text-[10px] text-neutral-400 hover:text-white"
                    >
                      إلغاء الكل
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {ALL_PERMISSIONS.map((p) => {
                    const meta = PERMISSION_LABELS[p]
                    const isOn = permSet.has(p)
                    return (
                      <button
                        key={p}
                        onClick={() => togglePerm(p)}
                        className={cn(
                          "px-3 py-2 rounded-lg border text-right transition-colors",
                          isOn
                            ? "bg-blue-400/[0.08] border-blue-400/[0.3]"
                            : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-white flex items-center gap-1">
                              <span>{meta.icon}</span>
                              <span>{meta.label}</span>
                            </div>
                            <div className="text-[10px] text-neutral-500 mt-0.5 leading-snug">
                              {meta.hint}
                            </div>
                          </div>
                          <div
                            className={cn(
                              "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                              isOn
                                ? "bg-blue-400 border-blue-400 text-black"
                                : "border-neutral-600",
                            )}
                          >
                            {isOn && <span className="text-[10px] font-bold">✓</span>}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-white/[0.06] sticky bottom-0 bg-[#0a0a0a]/95 backdrop-blur flex gap-2">
              <button
                onClick={closeAddModal}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={submitAddAdmin}
                disabled={
                  submitting ||
                  !formFullName.trim() ||
                  !formEmail.trim() ||
                  formPassword.length < 6
                }
                className="flex-1 py-2.5 rounded-xl bg-blue-500/[0.15] border border-blue-500/[0.3] text-blue-300 text-sm font-bold hover:bg-blue-500/[0.2] disabled:opacity-50"
              >
                {submitting ? "جاري الإنشاء..." : "👑 إنشاء الأدمن"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Phase 11.00 — Edit Permissions modal ═══════ */}
      {editPermsFor && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeEditPerms}
        >
          <div
            className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
              <div>
                <div className="text-base font-bold text-white">🛠 تعديل صلاحيات الأدمن</div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  {editPermsFor.full_name}
                </div>
              </div>
              <button onClick={closeEditPerms} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400 font-bold">
                  الصلاحيات <span className="text-neutral-500 font-normal">({editPermSet.size})</span>
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setEditPermSet(new Set(ALL_PERMISSIONS))}
                    className="text-[10px] text-blue-400 hover:text-blue-300"
                  >
                    تحديد الكل
                  </button>
                  <span className="text-neutral-600">·</span>
                  <button
                    onClick={() => setEditPermSet(new Set())}
                    className="text-[10px] text-neutral-400 hover:text-white"
                  >
                    إلغاء الكل
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {ALL_PERMISSIONS.map((p) => {
                  const meta = PERMISSION_LABELS[p]
                  const isOn = editPermSet.has(p)
                  return (
                    <button
                      key={p}
                      onClick={() => toggleEditPerm(p)}
                      className={cn(
                        "px-3 py-2 rounded-lg border text-right transition-colors",
                        isOn
                          ? "bg-blue-400/[0.08] border-blue-400/[0.3]"
                          : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold text-white flex items-center gap-1">
                            <span>{meta.icon}</span>
                            <span>{meta.label}</span>
                          </div>
                          <div className="text-[10px] text-neutral-500 mt-0.5 leading-snug">
                            {meta.hint}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                            isOn
                              ? "bg-blue-400 border-blue-400 text-black"
                              : "border-neutral-600",
                          )}
                        >
                          {isOn && <span className="text-[10px] font-bold">✓</span>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-white/[0.06] sticky bottom-0 bg-[#0a0a0a]/95 backdrop-blur flex gap-2">
              <button
                onClick={closeEditPerms}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={submitEditPerms}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-green-500/[0.15] border border-green-500/[0.3] text-green-300 text-sm font-bold hover:bg-green-500/[0.2] disabled:opacity-50"
              >
                {submitting ? "جاري الحفظ..." : "💾 حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
