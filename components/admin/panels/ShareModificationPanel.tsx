"use client"

/**
 * ShareModificationPanel (Phase 9.5)
 *
 * Two-step authorization flow for changing total project shares.
 *
 * UI shape depends on the caller's role:
 *   • Super Admin sees:
 *       - "توليد رمز" (generate code form)
 *       - "رموز نشطة" (codes I generated)
 *       - "طلبات معلّقة" (approve/reject)
 *   • Admin (non-super) sees:
 *       - "تقديم طلب" (submit form using a code)
 *   • Both see:
 *       - "طلباتي" (my submitted requests + their statuses)
 *
 * The "طلبات الحصص" tab in the requests_hub (Phase 9.4) populates
 * automatically from the same share_modification_requests table.
 */

import { useEffect, useState, useCallback } from "react"
import {
  KeyRound, ShieldCheck, CheckCircle2, XCircle, Plus, Minus, X, Copy, Clock,
} from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  generateShareCode,
  submitShareModification,
  approveShareModification,
  rejectShareModification,
  getProjectsForSelect,
  getMyGeneratedCodes,
  getPendingShareRequests,
  getMyShareRequests,
  type ProjectOption,
  type ShareCodeRow,
  type ShareRequestRow,
} from "@/lib/data/share-modifications"
import { getMyAdminRole, type AdminRoleInfo } from "@/lib/data/admin-requests"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return ""
  return iso.replace("T", " ").slice(0, 16)
}

type SuperAdminTab = "generate" | "pending" | "codes" | "mine"
type RegularAdminTab = "submit" | "mine"

export function ShareModificationPanel() {
  const [role, setRole] = useState<AdminRoleInfo>({
    is_admin: false,
    is_super_admin: false,
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [myCodes, setMyCodes] = useState<ShareCodeRow[]>([])
  const [pendingReqs, setPendingReqs] = useState<ShareRequestRow[]>([])
  const [myReqs, setMyReqs] = useState<ShareRequestRow[]>([])

  // Sub-tab — start on whichever makes sense for the role
  const [tab, setTab] = useState<SuperAdminTab | RegularAdminTab>("submit")

  // Generate-code form (Super Admin)
  const [genProjectId, setGenProjectId] = useState<string>("")
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)

  // Submit-request form (Admin)
  const [reqProjectId, setReqProjectId] = useState<string>("")
  const [reqType, setReqType] = useState<"increase" | "decrease">("increase")
  const [reqShares, setReqShares] = useState<string>("")
  const [reqCode, setReqCode] = useState<string>("")
  const [reqReason, setReqReason] = useState<string>("")

  // Reject reason modal
  const [rejectFor, setRejectFor] = useState<ShareRequestRow | null>(null)
  const [rejectNote, setRejectNote] = useState("")

  const refresh = useCallback(async () => {
    const [r, p, codes, pending, mine] = await Promise.all([
      getMyAdminRole(),
      getProjectsForSelect(),
      getMyGeneratedCodes(),
      getPendingShareRequests(),
      getMyShareRequests(),
    ])
    setRole(r)
    setProjects(p)
    setMyCodes(codes)
    setPendingReqs(pending)
    setMyReqs(mine)
    // pick a sensible default sub-tab once we know the role
    setTab((current) => {
      if (current !== "submit") return current
      return r.is_super_admin ? "pending" : "submit"
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // ─── Actions ─────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!genProjectId) {
      showError("اختر مشروعاً")
      return
    }
    setSubmitting(true)
    const result = await generateShareCode(genProjectId)
    setSubmitting(false)
    if (!result.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        not_super_admin: "هذه الصلاحية للمدير العام فقط",
        project_not_found: "المشروع غير موجود",
        code_collision_retry: "تصادم نادر — حاول مجدداً",
        missing_table: "الجداول غير منشورة بعد",
      }
      showError(map[result.reason ?? ""] ?? "فشل توليد الرمز")
      return
    }
    setGeneratedCode(result.code ?? null)
    showSuccess(`✅ تم توليد الرمز — صالح 24 ساعة`)
    refresh()
  }

  const handleSubmitRequest = async () => {
    if (!reqProjectId) return showError("اختر مشروعاً")
    const sharesNum = Number(reqShares)
    if (!Number.isFinite(sharesNum) || sharesNum <= 0) {
      return showError("أدخل عدد حصص صحيح موجب")
    }
    if (!/^[0-9]{6}$/.test(reqCode.trim())) {
      return showError("الرمز يجب أن يكون 6 أرقام")
    }
    setSubmitting(true)
    const result = await submitShareModification({
      project_id: reqProjectId,
      type: reqType,
      shares: sharesNum,
      code: reqCode.trim(),
      reason: reqReason.trim() || undefined,
    })
    setSubmitting(false)
    if (!result.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        not_admin: "صلاحياتك لا تسمح",
        invalid_type: "نوع غير صحيح",
        invalid_shares: "أدخل عدد حصص صحيح",
        invalid_code_format: "صيغة الرمز غير صحيحة (6 أرقام)",
        invalid_or_expired_code: "الرمز غير صالح أو منتهي",
        code_project_mismatch: "هذا الرمز ليس لهذا المشروع",
        missing_table: "الجداول غير منشورة بعد",
      }
      showError(map[result.reason ?? ""] ?? "فشل إرسال الطلب")
      return
    }
    showSuccess("✅ تم إرسال الطلب — في انتظار Super Admin")
    setReqProjectId("")
    setReqShares("")
    setReqCode("")
    setReqReason("")
    refresh()
  }

  const handleApprove = async (req: ShareRequestRow) => {
    setSubmitting(true)
    const result = await approveShareModification(req.id)
    setSubmitting(false)
    if (!result.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        not_super_admin: "هذه الصلاحية للمدير العام فقط",
        not_found: "الطلب غير موجود",
        not_pending: "الطلب لم يعد في حالة الانتظار",
        self_approval_blocked: "لا يمكنك الموافقة على طلبك بنفسك",
        reserve_wallet_missing: "محفظة الاحتياطي غير موجودة",
        insufficient_reserve: `الاحتياطي غير كافٍ (متوفّر: ${result.available ?? "—"} / مطلوب: ${result.requested ?? "—"})`,
        missing_table: "الجداول غير منشورة بعد",
      }
      showError(map[result.reason ?? ""] ?? "فشلت الموافقة")
      return
    }
    showSuccess("✅ تم الاعتماد + تطبيق التعديل على الاحتياطي")
    refresh()
  }

  const handleReject = async () => {
    if (!rejectFor) return
    if (!rejectNote.trim()) {
      return showError("سبب الرفض مطلوب")
    }
    setSubmitting(true)
    const result = await rejectShareModification(rejectFor.id, rejectNote.trim())
    setSubmitting(false)
    if (!result.success) {
      showError("فشل الرفض")
      return
    }
    showSuccess("تم رفض الطلب")
    setRejectFor(null)
    setRejectNote("")
    refresh()
  }

  const copyCode = (code: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => showSuccess("📋 نُسخ الرمز"))
    }
  }

  // ─── Render gates ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-neutral-400">جاري التحميل...</div>
      </div>
    )
  }

  if (!role.is_admin) {
    return (
      <div className="p-6">
        <AdminEmpty title="🔒 وصول مقيّد" body="هذه اللوحة للأدمن فقط." />
      </div>
    )
  }

  const tabs = role.is_super_admin
    ? [
        { key: "pending" as const, label: "📋 طلبات معلّقة", count: pendingReqs.length },
        { key: "generate" as const, label: "🔐 توليد رمز" },
        { key: "codes" as const, label: "🔑 رموزي", count: myCodes.filter((c) => c.status === "active").length },
        { key: "mine" as const, label: "📨 طلباتي", count: myReqs.length },
      ]
    : [
        { key: "submit" as const, label: "📨 تقديم طلب" },
        { key: "mine" as const, label: "📋 طلباتي", count: myReqs.length },
      ]

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="🔐 تعديل حصص المشاريع"
        subtitle={
          role.is_super_admin
            ? "Super Admin — يولّد الرموز ويعتمد الطلبات"
            : "Admin — يحتاج رمز تحقق من المدير العام"
        }
        action={<ActionBtn label="تحديث" color="gray" sm onClick={refresh} />}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="معلّق" val={pendingReqs.length} color="#FBBF24" />
        <KPI label="رموز نشطة" val={myCodes.filter((c) => c.status === "active").length} color="#60A5FA" />
        <KPI label="طلباتي" val={myReqs.length} color="#a855f7" />
        <KPI
          label="مُعتمَدة (آخر 50)"
          val={myReqs.filter((r) => r.status === "approved").length}
          color="#4ADE80"
        />
      </div>

      <InnerTabBar
        tabs={tabs}
        active={tab}
        onSelect={(k) => setTab(k as SuperAdminTab | RegularAdminTab)}
      />

      {/* ═══ Generate code (Super Admin) ═══ */}
      {role.is_super_admin && tab === "generate" && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="w-4 h-4 text-purple-400" strokeWidth={2} />
            <div className="text-sm font-bold text-white">توليد رمز تحقق جديد</div>
          </div>
          <div className="text-[11px] text-neutral-500 mb-4 leading-relaxed">
            الرمز عبارة عن <strong className="text-white">6 أرقام</strong>، صالح لـ 24 ساعة، يُستخدم مرّة واحدة فقط، ومرتبط بمشروع واحد.
            سلّمه يدوياً للأدمن المسؤول عن تعديل الحصص.
          </div>

          <label className="text-xs text-neutral-400 mb-1.5 block">المشروع</label>
          <select
            value={genProjectId}
            onChange={(e) => {
              setGenProjectId(e.target.value)
              setGeneratedCode(null)
            }}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 mb-4"
          >
            <option value="">— اختر —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({fmtNum(p.total_shares)} حصة)
              </option>
            ))}
          </select>

          <button
            onClick={handleGenerate}
            disabled={!genProjectId || submitting}
            className="w-full bg-purple-500/[0.15] border border-purple-500/[0.3] text-purple-400 py-3 rounded-xl text-sm font-bold hover:bg-purple-500/[0.2] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" strokeWidth={2.5} />
            {submitting ? "جاري التوليد..." : "توليد رمز"}
          </button>

          {generatedCode && (
            <div className="mt-5 bg-purple-500/[0.08] border border-purple-500/30 rounded-xl p-4 text-center">
              <div className="text-[10px] text-purple-300 mb-2">الرمز المُولَّد</div>
              <div className="text-4xl font-bold text-white font-mono tracking-widest mb-3" dir="ltr">
                {generatedCode}
              </div>
              <button
                onClick={() => copyCode(generatedCode)}
                className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg px-4 py-2 text-xs text-white inline-flex items-center gap-1.5"
              >
                <Copy className="w-3 h-3" strokeWidth={2.5} />
                نسخ
              </button>
              <div className="text-[10px] text-neutral-500 mt-3 flex items-center justify-center gap-1">
                <Clock className="w-2.5 h-2.5" /> صالح لـ 24 ساعة
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Pending requests (Super Admin) ═══ */}
      {role.is_super_admin && tab === "pending" && (
        pendingReqs.length === 0 ? (
          <AdminEmpty title="لا توجد طلبات معلّقة" />
        ) : (
          <Table>
            <THead>
              <TH>المشروع</TH>
              <TH>النوع</TH>
              <TH>الحصص</TH>
              <TH>طلب التعديل</TH>
              <TH>السبب</TH>
              <TH>التاريخ</TH>
              <TH>إجراءات</TH>
            </THead>
            <TBody>
              {pendingReqs.map((r) => (
                <TR key={r.id}>
                  <TD>{r.project_name}</TD>
                  <TD>
                    <Badge
                      label={r.modification_type === "increase" ? "زيادة" : "نقص"}
                      color={r.modification_type === "increase" ? "green" : "red"}
                    />
                  </TD>
                  <TD>
                    <span className={cn(
                      "font-mono font-bold",
                      r.modification_type === "increase" ? "text-green-400" : "text-red-400",
                    )}>
                      {r.modification_type === "increase" ? "+" : "−"}{fmtNum(r.shares_amount)}
                    </span>
                  </TD>
                  <TD>{r.requested_by_name}</TD>
                  <TD>
                    <span className="text-[11px] text-neutral-300 max-w-xs line-clamp-2 inline-block">
                      {r.reason ?? "—"}
                    </span>
                  </TD>
                  <TD><span className="text-[11px] text-neutral-500">{fmtDate(r.created_at)}</span></TD>
                  <TD>
                    <div className="flex gap-1.5">
                      <ActionBtn
                        label="✓ موافقة"
                        color="green"
                        sm
                        onClick={() => handleApprove(r)}
                      />
                      <ActionBtn
                        label="✗ رفض"
                        color="red"
                        sm
                        onClick={() => {
                          setRejectFor(r)
                          setRejectNote("")
                        }}
                      />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )
      )}

      {/* ═══ My generated codes (Super Admin) ═══ */}
      {role.is_super_admin && tab === "codes" && (
        myCodes.length === 0 ? (
          <AdminEmpty title="لم تولّد أي رمز بعد" />
        ) : (
          <Table>
            <THead>
              <TH>الرمز</TH>
              <TH>المشروع</TH>
              <TH>الحالة</TH>
              <TH>صالح حتى</TH>
              <TH>المُستخدِم</TH>
            </THead>
            <TBody>
              {myCodes.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <span className="font-mono text-sm font-bold text-white tracking-widest" dir="ltr">
                      {c.code}
                    </span>
                  </TD>
                  <TD>{c.project_name}</TD>
                  <TD>
                    <Badge
                      label={
                        c.status === "active" ? "نشط"
                        : c.status === "used" ? "مُستخدَم"
                        : "منتهي"
                      }
                      color={
                        c.status === "active" ? "green"
                        : c.status === "used" ? "blue"
                        : "gray"
                      }
                    />
                  </TD>
                  <TD><span className="text-[11px] text-neutral-500">{fmtDate(c.expires_at)}</span></TD>
                  <TD>
                    <span className="text-[11px] text-neutral-400">
                      {c.used_by_name ?? "—"}
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )
      )}

      {/* ═══ Submit request (Admin) ═══ */}
      {!role.is_super_admin && tab === "submit" && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-blue-400" strokeWidth={2} />
            <div className="text-sm font-bold text-white">تقديم طلب تعديل</div>
          </div>
          <div className="text-[11px] text-neutral-500 mb-4 leading-relaxed">
            تحتاج <strong className="text-white">رمز تحقق 6 أرقام</strong> من Super Admin.
            التعديل يطبَّق فقط على <strong className="text-white">محفظة الاحتياطي</strong> —
            الحصص المعروضة للتداول والمملوكة من المستخدمين لا تتأثر.
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">المشروع *</label>
              <select
                value={reqProjectId}
                onChange={(e) => setReqProjectId(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
              >
                <option value="">— اختر —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({fmtNum(p.total_shares)} حصة)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setReqType("increase")}
                className={cn(
                  "py-3 rounded-xl border text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  reqType === "increase"
                    ? "bg-green-500/[0.15] border-green-500/[0.3] text-green-400"
                    : "bg-white/[0.04] border-white/[0.08] text-neutral-400",
                )}
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                زيادة
              </button>
              <button
                onClick={() => setReqType("decrease")}
                className={cn(
                  "py-3 rounded-xl border text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  reqType === "decrease"
                    ? "bg-red-500/[0.15] border-red-500/[0.3] text-red-400"
                    : "bg-white/[0.04] border-white/[0.08] text-neutral-400",
                )}
              >
                <Minus className="w-4 h-4" strokeWidth={2.5} />
                نقص
              </button>
            </div>

            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">عدد الحصص *</label>
              <input
                type="number"
                value={reqShares}
                onChange={(e) => setReqShares(e.target.value)}
                min="1"
                placeholder="مثلاً: 10"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-neutral-600 outline-none focus:border-white/20"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">رمز التحقق (6 أرقام) *</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={reqCode}
                onChange={(e) => setReqCode(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="000000"
                dir="ltr"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-base text-white font-mono tracking-widest text-center placeholder:text-neutral-600 outline-none focus:border-white/20"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">السبب</label>
              <textarea
                value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                rows={3}
                placeholder="وضّح سبب التعديل (اختياري لكن مُستحسَن)..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
              />
            </div>

            <button
              onClick={handleSubmitRequest}
              disabled={submitting}
              className="w-full bg-blue-500/[0.15] border border-blue-500/[0.3] text-blue-400 py-3 rounded-xl text-sm font-bold hover:bg-blue-500/[0.2] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? "جاري الإرسال..." : "إرسال للمراجعة"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ My requests (both roles) ═══ */}
      {tab === "mine" && (
        myReqs.length === 0 ? (
          <AdminEmpty title="لم تقدّم أي طلب بعد" />
        ) : (
          <Table>
            <THead>
              <TH>المشروع</TH>
              <TH>النوع</TH>
              <TH>الحصص</TH>
              <TH>الحالة</TH>
              <TH>القرار</TH>
              <TH>التاريخ</TH>
            </THead>
            <TBody>
              {myReqs.map((r) => {
                const statusLabel =
                  r.status === "approved" ? "مُعتمَد"
                  : r.status === "rejected" ? "مرفوض"
                  : "في الانتظار"
                const statusColor =
                  r.status === "approved" ? "green" as const
                  : r.status === "rejected" ? "red" as const
                  : "yellow" as const
                return (
                  <TR key={r.id}>
                    <TD>{r.project_name}</TD>
                    <TD>
                      <Badge
                        label={r.modification_type === "increase" ? "زيادة" : "نقص"}
                        color={r.modification_type === "increase" ? "green" : "red"}
                      />
                    </TD>
                    <TD>
                      <span className="font-mono font-bold text-white">
                        {fmtNum(r.shares_amount)}
                      </span>
                    </TD>
                    <TD><Badge label={statusLabel} color={statusColor} /></TD>
                    <TD>
                      {r.super_admin_name ? (
                        <div>
                          <div className="text-xs text-white">{r.super_admin_name}</div>
                          <div className="text-[10px] text-neutral-500">{fmtDate(r.super_admin_at)}</div>
                          {r.super_admin_note && (
                            <div className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1 max-w-xs">
                              {r.super_admin_note}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-neutral-500">—</span>
                      )}
                    </TD>
                    <TD><span className="text-[11px] text-neutral-500">{fmtDate(r.created_at)}</span></TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )
      )}

      {/* ═══ Reject modal ═══ */}
      {rejectFor && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" strokeWidth={2} />
                <div className="text-base font-bold text-white">رفض طلب تعديل الحصص</div>
              </div>
              <button onClick={() => setRejectFor(null)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-xl p-3 mb-4 text-xs text-red-400 leading-relaxed">
              المشروع: <strong>{rejectFor.project_name}</strong> — {rejectFor.modification_type === "increase" ? "زيادة" : "نقص"} {fmtNum(rejectFor.shares_amount)} حصة
              <br />
              مُقدِّم الطلب: {rejectFor.requested_by_name}
            </div>
            <label className="text-xs text-neutral-400 mb-1.5 block font-bold">سبب الرفض *</label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="وضّح للأدمن سبب الرفض..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRejectFor(null)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleReject}
                disabled={submitting || !rejectNote.trim()}
                className="flex-1 py-2.5 rounded-xl bg-red-500/[0.15] border border-red-500/[0.3] text-red-400 text-sm font-bold hover:bg-red-500/[0.2] disabled:opacity-50"
              >
                {submitting ? "جاري الرفض..." : "تأكيد الرفض"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="mt-6 bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-xl p-3 flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
        <div className="text-[11px] text-blue-300 leading-relaxed">
          <strong>أمان مزدوج:</strong> كل تعديل يحتاج رمزاً مؤقتاً من Super Admin + موافقة نهائية بعد التقديم.
          التعديل لا يؤثر على الحصص المعروضة في السوق ولا على ممتلكات المستخدمين — فقط على محفظة الاحتياطي.
        </div>
      </div>
    </div>
  )
}
