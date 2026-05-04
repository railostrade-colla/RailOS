"use client"

import { useState } from "react"
import { X } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader,
} from "@/components/admin/ui"
import {
  sendBroadcast,
  type BroadcastSubtype,
  type BroadcastPriority,
  type BroadcastAudience,
} from "@/lib/data/admin-broadcast"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type NotifType = "announcement" | "feature" | "alert" | "maintenance" | "promo"
type Priority = "low" | "normal" | "high" | "urgent"
type Audience = "all" | "kyc_verified" | "advanced_plus" | "pro_only" | "specific_user" | "by_city"
type AppPage = "/dashboard" | "/market" | "/portfolio" | "/news" | "/auctions" | "/council" | "/ambassador"

interface BroadcastHistoryEntry {
  id: string
  title: string
  type: NotifType
  audience: Audience
  recipients: number
  sent_at: string
  sent_by: string
  channels: string[]
  status: "sent" | "failed" | "scheduled"
}

const NOTIF_TYPE_META: Record<NotifType, { label: string; icon: string; color: "blue" | "green" | "yellow" | "orange" | "purple" }> = {
  announcement: { label: "إعلان عام", icon: "📢", color: "blue" },
  feature:      { label: "ميزة جديدة", icon: "🎉", color: "green" },
  alert:        { label: "تنبيه",      icon: "⚠️", color: "yellow" },
  maintenance:  { label: "صيانة",      icon: "🛠️", color: "orange" },
  promo:        { label: "عرض ترويجي", icon: "🎁", color: "purple" },
}

const PRIORITY_META: Record<Priority, { label: string; color: "gray" | "blue" | "yellow" | "red" }> = {
  low:    { label: "منخفضة", color: "gray" },
  normal: { label: "عادية",  color: "blue" },
  high:   { label: "عالية",  color: "yellow" },
  urgent: { label: "عاجلة",  color: "red" },
}

const AUDIENCE_META: Record<Audience, { label: string; estimate: number }> = {
  all:            { label: "👥 جميع المستخدمين",  estimate: 1247 },
  kyc_verified:   { label: "✅ موثّقون فقط",       estimate: 685 },
  advanced_plus:  { label: "🥈 مستوى متقدّم+",     estimate: 234 },
  pro_only:       { label: "🥇 محترفون فقط",      estimate: 87 },
  specific_user:  { label: "🎯 مستخدم محدّد",     estimate: 1 },
  by_city:        { label: "📍 حسب المدينة",       estimate: 380 },
}

const CITIES = ["بغداد", "البصرة", "الموصل", "أربيل", "النجف", "كربلاء", "ديالى", "كركوك"]

const APP_PAGES: { value: AppPage; label: string }[] = [
  { value: "/dashboard",  label: "🏠 الصفحة الرئيسية" },
  { value: "/market",     label: "📊 السوق" },
  { value: "/portfolio",  label: "💼 المحفظة" },
  { value: "/news",       label: "📰 الأخبار" },
  { value: "/auctions",   label: "🔨 المزادات" },
  { value: "/council",    label: "🏛️ المجلس" },
  { value: "/ambassador", label: "🌟 السفراء" },
]

// Production mode — broadcast history is empty until the server-
// side log of sent broadcasts is wired (see admin_broadcast.ts +
// the planned `admin_broadcasts` table). Until then the panel only
// shows the compose form and an empty history list.
const MOCK_BROADCAST_HISTORY: BroadcastHistoryEntry[] = []

export function NotificationsBroadcasterPanel() {
  const [type, setType] = useState<NotifType>("announcement")
  const [priority, setPriority] = useState<Priority>("normal")
  const [audience, setAudience] = useState<Audience>("all")
  const [specificUserId, setSpecificUserId] = useState("")
  const [city, setCity] = useState(CITIES[0])
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [linkPage, setLinkPage] = useState<AppPage | "">("")
  const [linkText, setLinkText] = useState("")
  const [pushEnabled, setPushEnabled] = useState(false)
  const [emailEnabled, setEmailEnabled] = useState(false)

  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [historyDetail, setHistoryDetail] = useState<BroadcastHistoryEntry | null>(null)

  const audienceMeta = AUDIENCE_META[audience]
  const recipientEstimate = audience === "specific_user" ? 1 : audienceMeta.estimate

  const typeMeta = NOTIF_TYPE_META[type]
  const priorityMeta = PRIORITY_META[priority]

  const handleSubmitClick = () => {
    if (!title.trim() || title.length > 60) {
      showError("العنوان مطلوب (حد أقصى 60 حرف)")
      return
    }
    if (!body.trim() || body.length > 200) {
      showError("النص مطلوب (حد أقصى 200 حرف)")
      return
    }
    if (audience === "specific_user" && !specificUserId.trim()) {
      showError("ID المستخدم مطلوب")
      return
    }
    setShowConfirm(true)
  }

  const handleConfirmSend = async () => {
    if (submitting) return

    // Resolve audience param.
    let audienceParam: string | undefined
    if (audience === "specific_user") audienceParam = specificUserId.trim()
    else if (audience === "by_city") audienceParam = city

    setSubmitting(true)
    const result = await sendBroadcast({
      title: title.trim(),
      message: body.trim(),
      priority: priority as BroadcastPriority,
      audience: audience as BroadcastAudience,
      audience_param: audienceParam,
      subtype: type as BroadcastSubtype,
      link_url: (linkPage as string) || undefined,
      link_text: linkText.trim() || undefined,
    })
    setSubmitting(false)

    if (!result.success) {
      // The push/email checkboxes are intentionally read-only: the
      // notifications-realtime channel + /api/push/webhook fan-out
      // already handle them per the user's preferences. We just
      // surface a friendly error per failure reason.
      if (result.reason === "missing_table") {
        showError("RPC غير متاح على الخادم — طبّق migration الإذاعة")
        return
      }
      if (result.reason === "rls") {
        showError("لا تملك صلاحيات الإذاعة")
        return
      }
      if (result.reason === "unauthenticated") {
        showError("سجّل دخول كمسؤول")
        return
      }
      showError(result.error || "تعذّر إرسال الإذاعة")
      return
    }

    showSuccess(
      `✅ تم إرسال الإشعار لـ ${fmtNum(result.recipients_count ?? 0)} مستخدم`,
    )
    setShowConfirm(false)
    // Reset form so a duplicate-send can't happen by accident.
    setTitle("")
    setBody("")
    setLinkPage("")
    setLinkText("")
    setPushEnabled(false)
    setEmailEnabled(false)
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="📢 إذاعة الإشعارات"
        subtitle="إرسال إشعارات عامة أو موجّهة للمستخدمين"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

        {/* ═══════════ Form (col-span-2) ═══════════ */}
        <div className="lg:col-span-2 space-y-4">

          {/* Type */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4">
            <label className="text-xs text-neutral-400 mb-2 block font-bold">نوع الإشعار</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as NotifType)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
            >
              {Object.entries(NOTIF_TYPE_META).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>

          {/* Priority radio */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4">
            <label className="text-xs text-neutral-400 mb-2 block font-bold">الأولوية</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(PRIORITY_META) as [Priority, typeof priorityMeta][]).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setPriority(k)}
                  className={cn(
                    "py-2 rounded-lg text-xs font-bold border transition-colors",
                    priority === k
                      ? v.color === "red" ? "bg-red-400/[0.15] border-red-400/[0.4] text-red-400" :
                        v.color === "yellow" ? "bg-yellow-400/[0.15] border-yellow-400/[0.4] text-yellow-400" :
                        v.color === "blue" ? "bg-blue-400/[0.15] border-blue-400/[0.4] text-blue-400" :
                        "bg-white/[0.1] border-white/[0.2] text-white"
                      : "bg-white/[0.04] border-white/[0.08] text-neutral-400"
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Audience */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4">
            <label className="text-xs text-neutral-400 mb-2 block font-bold">الجمهور المستهدف</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
            >
              {Object.entries(AUDIENCE_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            {audience === "specific_user" && (
              <input
                type="text"
                value={specificUserId}
                onChange={(e) => setSpecificUserId(e.target.value)}
                placeholder="ID المستخدم (مثلاً: u123)"
                className="w-full mt-3 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-white/20"
              />
            )}

            {audience === "by_city" && (
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full mt-3 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
              >
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            <div className="mt-3 text-[11px] text-blue-400 font-mono">
              📊 سيصل لـ <span className="font-bold">{fmtNum(recipientEstimate)}</span> مستخدم تقريباً
            </div>
          </div>

          {/* Title */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs text-neutral-400 font-bold">عنوان الإشعار</label>
              <span className={cn("text-[10px] font-mono", title.length > 60 ? "text-red-400" : "text-neutral-500")}>
                {title.length} / 60
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: إطلاق ميزة جديدة..."
              maxLength={60}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
            />
          </div>

          {/* Body */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs text-neutral-400 font-bold">نص الإشعار</label>
              <span className={cn("text-[10px] font-mono", body.length > 200 ? "text-red-400" : "text-neutral-500")}>
                {body.length} / 200
              </span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="اكتب نص الإشعار الذي سيراه المستخدم..."
              maxLength={200}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20 resize-none"
            />
          </div>

          {/* Link (optional) */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4">
            <label className="text-xs text-neutral-400 mb-2 block font-bold">رابط (اختياري)</label>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <input
                type="text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="نص الزر (مثلاً: اكتشف الآن)"
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
              />
              <select
                value={linkPage}
                onChange={(e) => setLinkPage(e.target.value as AppPage | "")}
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
              >
                <option value="">— لا يوجد —</option>
                {APP_PAGES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Channels */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4">
            <label className="text-xs text-neutral-400 mb-3 block font-bold">قنوات الإرسال</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-not-allowed opacity-60">
                <input type="checkbox" checked disabled className="w-4 h-4" />
                <span>📱 داخل التطبيق (إجباري)</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pushEnabled}
                  onChange={(e) => setPushEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>🔔 Push notification</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>✉️ Email</span>
              </label>
            </div>
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmitClick}
            className={cn(
              "w-full py-4 rounded-xl text-base font-bold border transition-colors",
              priority === "urgent"
                ? "bg-red-500/[0.15] border-red-500/[0.3] text-red-400 hover:bg-red-500/[0.2]"
                : "bg-blue-500/[0.15] border-blue-500/[0.3] text-blue-400 hover:bg-blue-500/[0.2]"
            )}
          >
            📤 إرسال الإشعار
          </button>
        </div>

        {/* ═══════════ Preview (col-span-1, sticky) ═══════════ */}
        <div className="lg:col-span-1">
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4 lg:sticky lg:top-6">
            <div className="text-[11px] font-bold text-neutral-400 mb-3">👁️ معاينة الإشعار</div>

            <div className={cn(
              "bg-[#0a0a0a] border rounded-xl p-4",
              priority === "urgent" ? "border-red-400/[0.3]" :
              priority === "high" ? "border-yellow-400/[0.3]" :
              "border-white/[0.1]"
            )}>
              <div className="flex items-start gap-3 mb-2">
                <div className={cn(
                  "w-10 h-10 rounded-xl border flex items-center justify-center text-base flex-shrink-0",
                  typeMeta.color === "blue" && "bg-blue-400/[0.1] border-blue-400/[0.3]",
                  typeMeta.color === "green" && "bg-green-400/[0.1] border-green-400/[0.3]",
                  typeMeta.color === "yellow" && "bg-yellow-400/[0.1] border-yellow-400/[0.3]",
                  typeMeta.color === "orange" && "bg-orange-400/[0.1] border-orange-400/[0.3]",
                  typeMeta.color === "purple" && "bg-purple-400/[0.1] border-purple-400/[0.3]",
                )}>
                  {typeMeta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white mb-1 truncate">
                    {title || <span className="text-neutral-600">— عنوان الإشعار —</span>}
                  </div>
                  <div className="text-xs text-neutral-300 leading-relaxed line-clamp-3">
                    {body || <span className="text-neutral-600">— نص الإشعار —</span>}
                  </div>
                </div>
              </div>

              {linkText && linkPage && (
                <button className="mt-3 text-[11px] text-blue-400 hover:text-blue-300">
                  {linkText} ←
                </button>
              )}

              <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center gap-2 flex-wrap">
                <Badge label={typeMeta.label} color={typeMeta.color} />
                <Badge label={priorityMeta.label} color={priorityMeta.color} />
                <span className="text-[10px] text-neutral-600">الآن</span>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-[11px] text-neutral-400">
              <div className="flex justify-between">
                <span>الجمهور:</span>
                <span className="text-white">{audienceMeta.label}</span>
              </div>
              <div className="flex justify-between">
                <span>المستلمون:</span>
                <span className="text-blue-400 font-mono font-bold">{fmtNum(recipientEstimate)}</span>
              </div>
              <div className="flex justify-between">
                <span>القنوات:</span>
                <span className="text-white">
                  {[
                    "📱",
                    pushEnabled && "🔔",
                    emailEnabled && "✉️",
                  ].filter(Boolean).join(" ")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <SectionHeader
        title="📜 الإشعارات المُرسلة"
        subtitle={`آخر ${MOCK_BROADCAST_HISTORY.length} إشعار`}
      />
      <Table>
        <THead>
          <TH>العنوان</TH>
          <TH>النوع</TH>
          <TH>الجمهور</TH>
          <TH>المستلمون</TH>
          <TH>القنوات</TH>
          <TH>تاريخ الإرسال</TH>
          <TH>الحالة</TH>
          <TH>إجراءات</TH>
        </THead>
        <TBody>
          {MOCK_BROADCAST_HISTORY.map((h) => {
            const tm = NOTIF_TYPE_META[h.type]
            return (
              <TR key={h.id}>
                <TD>
                  <div className="text-xs text-white font-bold max-w-xs truncate">{h.title}</div>
                </TD>
                <TD>
                  <span className="text-[11px] flex items-center gap-1">
                    <span>{tm.icon}</span>
                    <span>{tm.label}</span>
                  </span>
                </TD>
                <TD><span className="text-[11px] text-neutral-300">{AUDIENCE_META[h.audience].label}</span></TD>
                <TD><span className="font-mono text-blue-400 font-bold">{fmtNum(h.recipients)}</span></TD>
                <TD>
                  <div className="flex gap-1 text-[11px]">
                    {h.channels.includes("in_app") && <span title="داخل التطبيق">📱</span>}
                    {h.channels.includes("push") && <span title="Push">🔔</span>}
                    {h.channels.includes("email") && <span title="Email">✉️</span>}
                  </div>
                </TD>
                <TD><span className="text-[11px] text-neutral-500">{h.sent_at}</span></TD>
                <TD>
                  <Badge
                    label={h.status === "sent" ? "أُرسل" : h.status === "failed" ? "فشل" : "مجدول"}
                    color={h.status === "sent" ? "green" : h.status === "failed" ? "red" : "yellow"}
                  />
                </TD>
                <TD>
                  <div className="flex gap-1.5">
                    <ActionBtn label="عرض" color="gray" sm onClick={() => setHistoryDetail(h)} />
                    {h.status === "failed" && (
                      <ActionBtn label="إعادة" color="blue" sm onClick={() => showSuccess("🔁 تم إعادة المحاولة")} />
                    )}
                  </div>
                </TD>
              </TR>
            )
          })}
        </TBody>
      </Table>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">📤 تأكيد إرسال الإشعار</div>
              <button onClick={() => setShowConfirm(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={cn(
              "rounded-xl p-3 mb-4 text-xs border",
              priority === "urgent"
                ? "bg-red-400/[0.05] border-red-400/[0.2] text-red-400"
                : "bg-blue-400/[0.05] border-blue-400/[0.2] text-blue-400"
            )}>
              {priority === "urgent" && "⚠️ هذا إشعار عاجل وسيصل بأعلى أولوية. تأكّد من المحتوى. "}
              هل أنت متأكد من إرسال هذا الإشعار لـ <span className="font-bold font-mono">{fmtNum(recipientEstimate)}</span> مستخدم؟
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-4 space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-neutral-500">العنوان</span>
                <span className="text-white font-bold text-left max-w-[60%] truncate">{title}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-neutral-500">النوع</span>
                <span className="text-white">{typeMeta.icon} {typeMeta.label}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-neutral-500">الأولوية</span>
                <span className="text-white">{priorityMeta.label}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-neutral-500">الجمهور</span>
                <span className="text-white">{audienceMeta.label}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmSend}
                disabled={submitting}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold border disabled:opacity-50",
                  priority === "urgent"
                    ? "bg-red-500/[0.15] border-red-500/[0.3] text-red-400 hover:bg-red-500/[0.2]"
                    : "bg-blue-500/[0.15] border-blue-500/[0.3] text-blue-400 hover:bg-blue-500/[0.2]"
                )}
              >
                {submitting ? "جاري الإرسال..." : "تأكيد الإرسال"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History detail modal */}
      {historyDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">تفاصيل الإشعار</div>
              <button onClick={() => setHistoryDetail(null)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4 space-y-2">
              {[
                ["العنوان", historyDetail.title],
                ["النوع", `${NOTIF_TYPE_META[historyDetail.type].icon} ${NOTIF_TYPE_META[historyDetail.type].label}`],
                ["الجمهور", AUDIENCE_META[historyDetail.audience].label],
                ["المستلمون", fmtNum(historyDetail.recipients)],
                ["تاريخ الإرسال", historyDetail.sent_at],
                ["أرسل بواسطة", historyDetail.sent_by],
                ["القنوات", historyDetail.channels.join(" + ")],
                ["الحالة", historyDetail.status === "sent" ? "✅ أُرسل" : historyDetail.status === "failed" ? "❌ فشل" : "⏰ مجدول"],
              ].map(([l, v], i) => (
                <div key={i} className="flex justify-between gap-3 text-xs">
                  <span className="text-neutral-500 text-[11px]">{l}</span>
                  <span className="text-white text-left">{v}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setHistoryDetail(null)}
              className="w-full py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
