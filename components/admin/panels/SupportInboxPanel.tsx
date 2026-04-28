"use client"

import { useState } from "react"
import { Search, X, Send, Paperclip } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  ADMIN_SUPPORT_TICKETS,
  ADMIN_TICKET_CATEGORY_LABELS,
  ADMIN_TICKET_STATUS_LABELS,
  ADMIN_TICKET_PRIORITY_LABELS,
  REPLY_TEMPLATES,
  ADMIN_LIST,
  getAdminTicketsStats,
  type AdminSupportTicket,
  type AdminTicketStatus,
} from "@/lib/mock-data/support"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

const CURRENT_ADMIN = { id: "a1", name: "Admin@Main", role: "founder" }

export function SupportInboxPanel() {
  const [filter, setFilter] = useState<string>("new")
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [assignedFilter, setAssignedFilter] = useState<string>("all")
  const [selected, setSelected] = useState<AdminSupportTicket | null>(null)
  const [replyText, setReplyText] = useState("")
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closeReason, setCloseReason] = useState("")
  const [showTemplates, setShowTemplates] = useState(false)
  // Local mutable copies for status/assignee changes (mock — in real life would call API)
  const [localStatus, setLocalStatus] = useState<AdminTicketStatus | null>(null)
  const [localAssignee, setLocalAssignee] = useState<string | null>(null)

  const stats = getAdminTicketsStats()

  const tabs = [
    { key: "all", label: "الكل", count: stats.total },
    { key: "new", label: "جديدة", count: stats.new_count },
    { key: "in_progress", label: "قيد المعالجة", count: stats.in_progress },
    { key: "replied", label: "تم الرد", count: stats.replied },
    { key: "closed", label: "مُغلقة", count: stats.closed },
  ]

  const filtered = ADMIN_SUPPORT_TICKETS
    .filter((t) => filter === "all" || t.status === filter)
    .filter((t) => categoryFilter === "all" || t.category === categoryFilter)
    .filter((t) => priorityFilter === "all" || t.priority === priorityFilter)
    .filter((t) => assignedFilter === "all" || t.assigned_to === assignedFilter)
    .filter((t) =>
      !search ||
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.user_name.includes(search) ||
      t.subject.includes(search)
    )

  const openTicket = (t: AdminSupportTicket) => {
    setSelected(t)
    setReplyText("")
    setLocalStatus(t.status)
    setLocalAssignee(t.assigned_to ?? null)
    setShowTemplates(false)
  }

  const closeTicketModal = () => {
    setSelected(null)
    setReplyText("")
    setLocalStatus(null)
    setLocalAssignee(null)
    setShowTemplates(false)
  }

  const handleSendReply = () => {
    if (!replyText.trim()) {
      showError("نص الرد مطلوب")
      return
    }
    showSuccess("📤 تم إرسال الرد + تحديث حالة التذكرة + إشعار المستخدم")
    setReplyText("")
    setLocalStatus("replied")
  }

  const handleSaveDraft = () => {
    if (!replyText.trim()) {
      showError("النص فارغ")
      return
    }
    showSuccess("💾 تم حفظ الرد كمسودّة")
  }

  const handleCloseTicket = () => {
    if (!closeReason.trim()) {
      showError("سبب الإغلاق مطلوب")
      return
    }
    showSuccess("✅ تم إغلاق التذكرة")
    setShowCloseModal(false)
    setCloseReason("")
    closeTicketModal()
  }

  const handleAssignToMe = () => {
    setLocalAssignee(CURRENT_ADMIN.id)
    showSuccess(`📌 أُسنِدت التذكرة إلى ${CURRENT_ADMIN.name}`)
  }

  const handleAssigneeChange = (newAssignee: string) => {
    setLocalAssignee(newAssignee || null)
    if (newAssignee) {
      const adminName = ADMIN_LIST.find((a) => a.id === newAssignee)?.name
      showSuccess(`📌 أُسنِدت إلى ${adminName}`)
    }
  }

  const handleStatusChange = (newStatus: AdminTicketStatus) => {
    setLocalStatus(newStatus)
    showSuccess(`✏️ تم تحديث الحالة إلى: ${ADMIN_TICKET_STATUS_LABELS[newStatus].label}`)
  }

  const insertTemplate = (template: string) => {
    setReplyText(template)
    setShowTemplates(false)
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="💬 صندوق الدعم"
        subtitle="إدارة تذاكر الدعم — رد + تتبّع + تصعيد"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="جديدة" val={stats.new_count} color="#F87171" accent="rgba(248,113,113,0.05)" />
        <KPI label="قيد المعالجة" val={stats.in_progress} color="#FBBF24" />
        <KPI label="تم الرد" val={stats.replied} color="#60A5FA" />
        <KPI label="مُغلقة" val={stats.closed} color="#a3a3a3" />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-3">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث (id/مستخدم/موضوع)..."
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
          />
        </div>
        <select
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
          className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="all">كل المُسنَدين</option>
          {ADMIN_LIST.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-3">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="all">كل الفئات</option>
          {Object.entries(ADMIN_TICKET_CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="all">كل الأولويات</option>
          <option value="high">عاجل</option>
          <option value="medium">متوسط</option>
          <option value="low">منخفض</option>
        </select>
      </div>

      <InnerTabBar tabs={tabs} active={filter} onSelect={setFilter} />

      {filtered.length === 0 ? (
        <AdminEmpty title="لا توجد تذاكر" body="جرّب تعديل الفلترة" />
      ) : (
        <Table>
          <THead>
            <TH>المستخدم</TH>
            <TH>الموضوع</TH>
            <TH>الفئة</TH>
            <TH>الأولوية</TH>
            <TH>الحالة</TH>
            <TH>المُسنَد</TH>
            <TH>آخر تحديث</TH>
            <TH>إجراءات</TH>
          </THead>
          <TBody>
            {filtered.map((t) => {
              const cat = ADMIN_TICKET_CATEGORY_LABELS[t.category]
              const st = ADMIN_TICKET_STATUS_LABELS[t.status]
              const pr = ADMIN_TICKET_PRIORITY_LABELS[t.priority]
              return (
                <TR key={t.id} onClick={() => openTicket(t)}>
                  <TD>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-400/[0.15] border border-blue-400/[0.3] flex items-center justify-center text-[11px] font-bold text-blue-300">
                        {t.user_name[0]}
                      </div>
                      <div>
                        <div className="text-xs text-white">{t.user_name}</div>
                        <div className="text-[10px] text-neutral-500 font-mono">{t.id}</div>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <div className="text-xs text-white max-w-xs truncate">{t.subject}</div>
                  </TD>
                  <TD>
                    <span className="text-[11px] flex items-center gap-1">
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </span>
                  </TD>
                  <TD><Badge label={pr.label} color={pr.color} /></TD>
                  <TD><Badge label={st.label} color={st.color} /></TD>
                  <TD>
                    <span className="text-[11px] text-neutral-400">
                      {t.assigned_to_name || <span className="text-neutral-600">—</span>}
                    </span>
                  </TD>
                  <TD><span className="text-[11px] text-neutral-500">{t.updated_at}</span></TD>
                  <TD>
                    <ActionBtn label="فتح" color="blue" sm onClick={() => openTicket(t)} />
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {/* ═══════════ TICKET MODAL (2-column) ═══════════ */}
      {selected && !showCloseModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col">
            <div className="flex justify-between items-start p-5 border-b border-white/[0.06]">
              <div>
                <div className="text-base font-bold text-white">{selected.subject}</div>
                <div className="text-xs text-neutral-500 mt-1 font-mono">{selected.id}</div>
              </div>
              <button onClick={closeTicketModal} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3">

              {/* ═══ Right column (info) ═══ */}
              <div className="lg:col-span-1 border-l border-white/[0.06] p-5 overflow-y-auto space-y-4">

                {/* User info */}
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-[11px] font-bold text-neutral-400 mb-3">👤 المستخدم</div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-400/[0.15] border border-blue-400/[0.3] flex items-center justify-center text-sm font-bold text-blue-300">
                      {selected.user_name[0]}
                    </div>
                    <div>
                      <div className="text-sm text-white font-bold">{selected.user_name}</div>
                      <div className="text-[10px] text-neutral-500" dir="ltr">{selected.user_email}</div>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">المستوى</span>
                      <span className="text-white">{selected.user_level}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">حالة KYC</span>
                      <Badge
                        label={selected.user_kyc_status === "verified" ? "✓ موثّق" : selected.user_kyc_status === "pending" ? "معلّق" : selected.user_kyc_status === "rejected" ? "مرفوض" : "—"}
                        color={selected.user_kyc_status === "verified" ? "green" : selected.user_kyc_status === "pending" ? "yellow" : selected.user_kyc_status === "rejected" ? "red" : "gray"}
                      />
                    </div>
                  </div>
                </div>

                {/* Ticket details */}
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-[11px] font-bold text-neutral-400 mb-3">📋 تفاصيل التذكرة</div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-[11px] text-neutral-500">الفئة</span>
                      <span className="text-xs text-white">
                        {ADMIN_TICKET_CATEGORY_LABELS[selected.category].icon} {ADMIN_TICKET_CATEGORY_LABELS[selected.category].label}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-[11px] text-neutral-500">الأولوية</span>
                      <Badge
                        label={ADMIN_TICKET_PRIORITY_LABELS[selected.priority].label}
                        color={ADMIN_TICKET_PRIORITY_LABELS[selected.priority].color}
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-neutral-500 mb-1.5">الحالة (قابلة للتغيير)</div>
                      <select
                        value={localStatus ?? selected.status}
                        onChange={(e) => handleStatusChange(e.target.value as AdminTicketStatus)}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white/20"
                      >
                        {Object.entries(ADMIN_TICKET_STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-[11px] text-neutral-500">تاريخ الفتح</span>
                      <span className="text-[11px] text-white font-mono">{selected.created_at}</span>
                    </div>
                    <div>
                      <div className="text-[11px] text-neutral-500 mb-1.5">المُسنَد إلى</div>
                      <div className="flex gap-1.5">
                        <select
                          value={localAssignee ?? ""}
                          onChange={(e) => handleAssigneeChange(e.target.value)}
                          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white/20"
                        >
                          <option value="">— غير مُسنَد —</option>
                          {ADMIN_LIST.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <button
                          onClick={handleAssignToMe}
                          className="px-2 py-2 text-xs rounded-md bg-blue-400/[0.1] border border-blue-400/[0.25] text-blue-400 hover:bg-blue-400/[0.15] whitespace-nowrap"
                          title="أسنِد إلى نفسي"
                        >
                          📌 أنا
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions card */}
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-[11px] font-bold text-neutral-400 mb-3">⚡ إجراءات</div>
                  <div className="space-y-2">
                    {(localStatus ?? selected.status) !== "closed" ? (
                      <ActionBtn label="✅ إغلاق التذكرة" color="green" onClick={() => setShowCloseModal(true)} />
                    ) : (
                      <ActionBtn label="🔁 إعادة فتح" color="blue" onClick={() => handleStatusChange("in_progress")} />
                    )}
                    {selected.priority === "high" && (
                      <ActionBtn label="🚀 تصعيد للمؤسس" color="red" onClick={() => showSuccess("🚀 تم التصعيد")} />
                    )}
                  </div>
                </div>
              </div>

              {/* ═══ Left column (chat thread) ═══ */}
              <div className="lg:col-span-2 flex flex-col h-full overflow-hidden">

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-black/30">
                  {/* Original message */}
                  <div className="flex gap-2 max-w-[85%]">
                    <div className="w-8 h-8 rounded-full bg-blue-400/[0.15] border border-blue-400/[0.3] flex items-center justify-center text-[11px] font-bold text-blue-300 flex-shrink-0">
                      {selected.user_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-white">{selected.user_name}</span>
                        <span className="text-[9px] text-neutral-600">{selected.created_at}</span>
                      </div>
                      <div className="bg-blue-400/[0.06] border border-blue-400/[0.15] rounded-xl rounded-tr-sm p-3 text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap">
                        {selected.body}
                      </div>
                    </div>
                  </div>

                  {/* Replies */}
                  {selected.replies.map((r) => (
                    <div
                      key={r.id}
                      className={cn(
                        "flex gap-2 max-w-[85%]",
                        r.sender_type === "admin" ? "ml-auto flex-row-reverse" : ""
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-bold flex-shrink-0",
                        r.sender_type === "admin"
                          ? "bg-purple-400/[0.15] border-purple-400/[0.3] text-purple-300"
                          : "bg-blue-400/[0.15] border-blue-400/[0.3] text-blue-300"
                      )}>
                        {r.sender_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          "flex items-center gap-2 mb-1",
                          r.sender_type === "admin" && "flex-row-reverse"
                        )}>
                          <span className="text-xs font-bold text-white">{r.sender_name}</span>
                          {r.sender_role && (
                            <span className="text-[9px] text-purple-400">· {r.sender_role}</span>
                          )}
                          <span className="text-[9px] text-neutral-600">{r.created_at}</span>
                        </div>
                        <div className={cn(
                          "rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap",
                          r.sender_type === "admin"
                            ? "bg-purple-400/[0.06] border border-purple-400/[0.15] rounded-tl-sm text-neutral-200"
                            : "bg-blue-400/[0.06] border border-blue-400/[0.15] rounded-tr-sm text-neutral-200"
                        )}>
                          {r.body}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Closed indicator */}
                  {selected.status === "closed" && selected.closed_at && (
                    <div className="text-center my-3">
                      <Badge label={`مُغلقة في ${selected.closed_at}`} color="gray" />
                      {selected.closed_reason && (
                        <div className="text-[11px] text-neutral-500 mt-1.5 max-w-md mx-auto">
                          سبب الإغلاق: {selected.closed_reason}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Reply box */}
                {(localStatus ?? selected.status) !== "closed" && (
                  <div className="border-t border-white/[0.06] p-4 bg-[#0a0a0a]">
                    {/* Toolbar */}
                    <div className="flex items-center gap-2 mb-2 relative">
                      <button
                        onClick={() => showSuccess("📎 placeholder — رفع المرفقات قادم")}
                        className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        إرفاق ملف
                      </button>
                      <button
                        onClick={() => setShowTemplates(!showTemplates)}
                        className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1"
                      >
                        📋 Templates سريعة
                      </button>
                      {showTemplates && (
                        <div className="absolute bottom-full mb-2 right-0 lg:right-auto lg:left-0 bg-[#0a0a0a] border border-white/[0.1] rounded-xl shadow-2xl p-2 w-72 z-10">
                          {REPLY_TEMPLATES.map((tpl, i) => (
                            <button
                              key={i}
                              onClick={() => insertTemplate(tpl.body)}
                              className="block w-full text-right p-2 text-xs text-neutral-300 hover:bg-white/[0.05] rounded-lg transition-colors"
                            >
                              <div className="font-bold text-white mb-0.5">{tpl.label}</div>
                              <div className="text-[10px] text-neutral-500 line-clamp-2">{tpl.body}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                      placeholder="اكتب ردك..."
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20 resize-none mb-3"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveDraft}
                        className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-xs hover:bg-white/[0.08]"
                      >
                        💾 حفظ كمسودة
                      </button>
                      <button
                        onClick={handleSendReply}
                        className="flex-1 py-2.5 rounded-xl bg-blue-500/[0.15] border border-blue-500/[0.3] text-blue-400 text-xs font-bold hover:bg-blue-500/[0.2] flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        إرسال الرد
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close ticket confirm modal */}
      {selected && showCloseModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">✅ إغلاق التذكرة</div>
              <button onClick={() => { setShowCloseModal(false); setCloseReason("") }} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-neutral-400 mb-3">
              التذكرة: <span className="text-white font-bold">{selected.subject}</span>
            </div>

            <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-xl p-3 mb-4 text-xs text-green-400">
              سيتم إغلاق التذكرة. يمكن إعادة فتحها لاحقاً إذا لزم.
            </div>

            <label className="text-xs text-neutral-400 mb-2 block font-bold">سبب الإغلاق (إجباري)</label>
            <textarea
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              rows={3}
              placeholder="مثلاً: تم حل المشكلة + تأكيد المستخدم..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => { setShowCloseModal(false); setCloseReason("") }}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={handleCloseTicket}
                className="flex-1 py-3 rounded-xl bg-green-500/[0.15] border border-green-500/[0.3] text-green-400 text-sm font-bold hover:bg-green-500/[0.2]"
              >
                تأكيد الإغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 text-[10px] text-neutral-600 font-mono">
        {fmtNum(filtered.length)} من {fmtNum(ADMIN_SUPPORT_TICKETS.length)} تذكرة
      </div>
    </div>
  )
}
