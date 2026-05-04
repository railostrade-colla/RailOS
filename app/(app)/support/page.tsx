"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Search,
  ChevronDown,
  ChevronLeft,
  HelpCircle,
  MessageCircle,
  Send,
  Phone,
  Clock,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader, Tabs, Badge, EmptyState, Modal } from "@/components/ui"
import { showSuccess, showInfo, showError } from "@/lib/utils/toast"
import {
  FAQS,
  FAQ_CATEGORIES,
  searchFAQs,
  type FAQ,
  type SupportTicket,
} from "@/lib/mock-data"
import {
  getMyTickets,
  createSupportTicket,
  type DBSupportTicket,
} from "@/lib/data/support"
import { cn } from "@/lib/utils/cn"

type CategoryTab = "all" | (typeof FAQ_CATEGORIES)[number]

// Status → Badge color
const STATUS_META: Record<SupportTicket["status"], { label: string; color: "green" | "yellow" | "neutral" }> = {
  open:     { label: "مفتوح",   color: "yellow" },
  answered: { label: "تم الرد", color: "green" },
  closed:   { label: "مغلق",    color: "neutral" },
}

const PRIORITY_META: Record<SupportTicket["priority"], { label: string; color: "green" | "yellow" | "red" }> = {
  low:    { label: "منخفض",  color: "green" },
  medium: { label: "متوسط",  color: "yellow" },
  high:   { label: "عاجل",   color: "red" },
}

// Map DB ticket → page's SupportTicket shape (last_update is mock-only).
function dbToTicket(t: DBSupportTicket): SupportTicket {
  // DB status enum: new | in_progress | replied | closed
  // Page status enum: open | answered | closed
  const status: SupportTicket["status"] =
    t.status === "closed" ? "closed"
    : t.status === "replied" ? "answered"
    : "open"
  return {
    id: t.id,
    subject: t.subject,
    status,
    priority: t.priority,
    created_at: t.created_at?.split("T")[0] ?? "",
    last_update: t.last_message_at?.split("T")[0] ?? "",
  }
}

export default function SupportPage() {
  const [tab, setTab] = useState<CategoryTab>("all")
  const [search, setSearch] = useState("")
  const [openFAQ, setOpenFAQ] = useState<string | null>(null)
  const [ticketModal, setTicketModal] = useState<SupportTicket | null>(null)
  const [showNewTicket, setShowNewTicket] = useState(false)
  const [newTicketSubject, setNewTicketSubject] = useState("")
  const [newTicketMessage, setNewTicketMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  // Production mode — DB only.
  const [tickets, setTickets] = useState<SupportTicket[]>([])

  useEffect(() => {
    let cancelled = false
    getMyTickets().then((rows) => {
      if (cancelled) return
      // Empty array = either no tickets OR table missing — only swap
      // if we got real rows; otherwise keep the demo placeholders.
      if (rows.length > 0) setTickets(rows.map(dbToTicket))
    })
    return () => { cancelled = true }
  }, [])

  // Filter FAQs by search → category
  const filteredFAQs = useMemo(() => {
    let rows: FAQ[] = search.trim() ? searchFAQs(search) : FAQS
    if (tab !== "all") rows = rows.filter((f) => f.category === tab)
    return rows
  }, [tab, search])

  // Tab counts
  const tabCounts = useMemo(() => {
    const base = search.trim() ? searchFAQs(search) : FAQS
    const counts: Record<string, number> = { all: base.length }
    FAQ_CATEGORIES.forEach((c) => {
      counts[c] = base.filter((f) => f.category === c).length
    })
    return counts
  }, [search])

  const handleSubmitTicket = async () => {
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) {
      showInfo("املأ كل الحقول")
      return
    }
    setSubmitting(true)
    const result = await createSupportTicket({
      subject: newTicketSubject.trim(),
      body: newTicketMessage.trim(),
    })
    if (!result.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        invalid_input: "املأ الموضوع والرسالة",
        missing_table: "الجداول غير منشورة بعد",
        rls: "صلاحياتك لا تسمح بإرسال التذكرة",
      }
      showError(map[result.reason ?? ""] ?? "فشل إرسال الطلب — حاول مجدداً")
      setSubmitting(false)
      return
    }
    showSuccess("تم إرسال طلبك! سنرد خلال 24 ساعة")
    setShowNewTicket(false)
    setNewTicketSubject("")
    setNewTicketMessage("")
    setSubmitting(false)
    // Refresh list
    getMyTickets().then((rows) => {
      if (rows.length > 0) setTickets(rows.map(dbToTicket))
    })
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-4xl mx-auto pb-20">

          <PageHeader
            title="🆘 مركز المساعدة"
            subtitle="كيف يمكننا مساعدتك؟"
            showBack={false}
          />

          {/* ═══ § 1 Hero — Search ═══ */}
          <Card variant="gradient" color="blue" className="mb-7">
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-400/[0.15] border border-blue-400/30 flex items-center justify-center mx-auto mb-3">
                <HelpCircle className="w-7 h-7 text-blue-400" strokeWidth={2} />
              </div>
              <h2 className="text-base font-bold text-white mb-1">ابحث عن إجابة</h2>
              <p className="text-[11px] text-neutral-400">جرّب البحث في أكثر من 18 سؤالاً شائعاً</p>
            </div>

            <div className="relative mb-3">
              <Search className="w-4 h-4 text-neutral-500 absolute right-4 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="اكتب سؤالك..."
                className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition-colors"
              />
            </div>

            {/* Quick links */}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {["كيف أبدأ؟", "حساب الأرباح", "التوثيق", "العمولات"].map((q) => (
                <button
                  key={q}
                  onClick={() => setSearch(q)}
                  className="bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] text-[10px] text-neutral-300 px-2.5 py-1 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </Card>

          {/* ═══ § 2 Quick actions — horizontal row with colored icons ═══ */}
          <div className="grid grid-cols-3 gap-2 mb-7">
            <button
              onClick={() => showInfo("ميزة الدردشة المباشرة قادمة قريباً")}
              className="bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] rounded-xl py-3 px-2 flex flex-col items-center gap-2 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-green-400/[0.1] border border-green-400/30 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-green-400" strokeWidth={2} />
              </div>
              <div className="text-[11px] font-bold text-white">محادثة مباشرة</div>
            </button>
            <button
              onClick={() => setShowNewTicket(true)}
              className="bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] rounded-xl py-3 px-2 flex flex-col items-center gap-2 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-400/[0.1] border border-blue-400/30 flex items-center justify-center">
                <Send className="w-5 h-5 text-blue-400" strokeWidth={2} />
              </div>
              <div className="text-[11px] font-bold text-white">إرسال طلب دعم</div>
            </button>
            <button
              onClick={() => showInfo("للاتصال: 07721726518")}
              className="bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] rounded-xl py-3 px-2 flex flex-col items-center gap-2 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-400/[0.1] border border-purple-400/30 flex items-center justify-center">
                <Phone className="w-5 h-5 text-purple-400" strokeWidth={2} />
              </div>
              <div className="text-[11px] font-bold text-white">اتصل بنا</div>
            </button>
          </div>

          {/* ═══ § 3 FAQ Tabs + List ═══ */}
          <div className="mb-7">
            <SectionHeader
              title="❓ الأسئلة الشائعة"
              subtitle={`${filteredFAQs.length} سؤال متاح`}
            />

            <div className="mb-4 -mx-1 px-1 overflow-x-auto">
              <Tabs
                tabs={[
                  { id: "all", icon: "✨", label: "الكل", count: tabCounts.all },
                  ...FAQ_CATEGORIES.map((c) => ({ id: c, label: c, count: tabCounts[c] })),
                ]}
                activeTab={tab}
                onChange={(id) => setTab(id as CategoryTab)}
                size="sm"
              />
            </div>

            {filteredFAQs.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="لا توجد نتائج"
                description="جرّب كلمة بحث أخرى أو تواصل مع الدعم"
                action={{ label: "إرسال طلب دعم", onClick: () => setShowNewTicket(true) }}
                size="md"
              />
            ) : (
              <div className="space-y-2">
                {filteredFAQs.map((faq) => {
                  const isOpen = openFAQ === faq.id
                  return (
                    <Card key={faq.id} padding="md" className="!p-0 overflow-hidden">
                      <button
                        onClick={() => setOpenFAQ(isOpen ? null : faq.id)}
                        className="w-full p-4 flex items-center justify-between gap-3 text-right hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <Badge color="neutral" variant="soft" size="xs">{faq.category}</Badge>
                          </div>
                          <div className="text-sm font-bold text-white text-right">{faq.question}</div>
                        </div>
                        <ChevronDown className={cn("w-4 h-4 text-neutral-500 transition-transform flex-shrink-0", isOpen && "rotate-180")} strokeWidth={2} />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 -mt-1 border-t border-white/[0.04] pt-3">
                          <p className="text-xs text-neutral-300 leading-relaxed mb-3">{faq.answer}</p>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex gap-2">
                              <button
                                onClick={() => showSuccess("شكراً على ملاحظتك!")}
                                className="flex items-center gap-1 bg-green-400/[0.06] border border-green-400/20 hover:bg-green-400/[0.1] text-green-400 text-[10px] px-2.5 py-1 rounded-full transition-colors"
                              >
                                <ThumbsUp className="w-2.5 h-2.5" strokeWidth={2} />
                                مفيد
                              </button>
                              <button
                                onClick={() => showInfo("سنحاول تحسين هذه الإجابة")}
                                className="flex items-center gap-1 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] text-neutral-400 text-[10px] px-2.5 py-1 rounded-full transition-colors"
                              >
                                <ThumbsDown className="w-2.5 h-2.5" strokeWidth={2} />
                                غير مفيد
                              </button>
                            </div>
                            {faq.helpful_count !== undefined && (
                              <span className="text-[10px] text-neutral-500">
                                ساعد {faq.helpful_count.toLocaleString("en-US")} شخص
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

          {/* ═══ § 4 My Tickets ═══ */}
          {tickets.length > 0 && (
            <div className="mb-7">
              <SectionHeader
                title="🎫 طلباتي السابقة"
                subtitle={`${tickets.length} طلب`}
                action={{ label: "طلب جديد", onClick: () => setShowNewTicket(true) }}
              />
              <div className="space-y-2">
                {tickets.map((t) => {
                  const status = STATUS_META[t.status]
                  const priority = PRIORITY_META[t.priority]
                  return (
                    <Card key={t.id} onClick={() => setTicketModal(t)} className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white mb-1 truncate">{t.subject}</div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge color={status.color} variant="soft" size="xs">{status.label}</Badge>
                          <Badge color={priority.color} variant="soft" size="xs">{priority.label}</Badge>
                          <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {t.last_update}
                          </span>
                        </div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-neutral-500 flex-shrink-0" strokeWidth={2} />
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* New ticket Modal */}
      <Modal
        isOpen={showNewTicket}
        onClose={() => setShowNewTicket(false)}
        title="إرسال طلب دعم جديد"
        subtitle="سنرد خلال 24 ساعة"
        size="md"
        footer={
          <>
            <button
              onClick={() => setShowNewTicket(false)}
              className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-2.5 rounded-xl text-sm hover:bg-white/[0.08] transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleSubmitTicket}
              disabled={submitting}
              className="flex-1 bg-neutral-100 text-black py-2.5 rounded-xl text-sm font-bold hover:bg-neutral-200 disabled:opacity-50 transition-colors"
            >
              {submitting ? "جاري..." : "إرسال"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="text-[11px] text-neutral-400 mb-1.5 font-bold">الموضوع</div>
            <input
              value={newTicketSubject}
              onChange={(e) => setNewTicketSubject(e.target.value)}
              placeholder="مثال: استفسار عن الأرباح"
              className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
            />
          </div>
          <div>
            <div className="text-[11px] text-neutral-400 mb-1.5 font-bold">الرسالة</div>
            <textarea
              value={newTicketMessage}
              onChange={(e) => setNewTicketMessage(e.target.value)}
              placeholder="اكتب تفاصيل طلبك هنا..."
              rows={4}
              className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white outline-none resize-none transition-colors"
            />
          </div>
        </div>
      </Modal>

      {/* Ticket detail Modal */}
      {ticketModal && (
        <Modal
          isOpen={!!ticketModal}
          onClose={() => setTicketModal(null)}
          title={ticketModal.subject}
          subtitle={`أُنشئ في ${ticketModal.created_at}`}
          size="md"
        >
          <div className="flex items-center gap-1.5 mb-4 flex-wrap">
            <Badge color={STATUS_META[ticketModal.status].color} variant="soft">{STATUS_META[ticketModal.status].label}</Badge>
            <Badge color={PRIORITY_META[ticketModal.priority].color} variant="soft">أولوية {PRIORITY_META[ticketModal.priority].label}</Badge>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 mb-3">
            <div className="text-[10px] text-neutral-500 mb-1">آخر تحديث</div>
            <div className="text-xs text-white">{ticketModal.last_update}</div>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            للاطلاع على المحادثة الكاملة وإضافة رد، تواصل مع الدعم عبر WhatsApp.
          </p>
        </Modal>
      )}
    </AppLayout>
  )
}
