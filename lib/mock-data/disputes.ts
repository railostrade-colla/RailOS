/**
 * Disputes — buyer/seller conflicts requiring admin resolution.
 * Used by /admin?tab=disputes.
 */

export type DisputeReason =
  | "payment_issue"
  | "delivery"
  | "fraud_suspicion"
  | "communication"
  | "other"

export type DisputeStatus = "open" | "in_review" | "resolved" | "closed"
export type DisputePriority = "low" | "medium" | "high"
export type DisputeResolution = "buyer_favor" | "seller_favor" | "split" | "escalated"

export interface DisputeMessage {
  id: string
  sender: "buyer" | "seller" | "system"
  sender_name: string
  text: string
  created_at: string
}

export interface Dispute {
  id: string
  deal_id: string
  buyer_id: string
  buyer_name: string
  seller_id: string
  seller_name: string
  project_name: string
  reason: DisputeReason
  description: string
  evidence_urls: string[]
  status: DisputeStatus
  priority: DisputePriority
  resolution?: DisputeResolution
  resolution_notes?: string
  opened_at: string
  resolved_at?: string
  amount: number
  shares: number
  messages: DisputeMessage[]
}

const placeholder = (text: string) =>
  `https://placehold.co/400x300/0a0a0a/ffffff?text=${encodeURIComponent(text)}`

export const MOCK_DISPUTES: Dispute[] = [
  {
    id: "DSP-001",
    deal_id: "t1247",
    buyer_id: "u1",
    buyer_name: "أحمد محمد",
    seller_id: "u2",
    seller_name: "علي حسن",
    project_name: "مزرعة الواحة",
    reason: "delivery",
    description: "تم دفع المبلغ كاملاً قبل 3 أيام لكن البائع لم يحوّل الحصص حتى الآن، ولا يردّ على رسائلي.",
    evidence_urls: [placeholder("PAYMENT-PROOF"), placeholder("CHAT-LOG-1")],
    status: "open",
    priority: "high",
    opened_at: "2026-04-25 10:30",
    amount: 4750000,
    shares: 50,
    messages: [
      { id: "m1", sender: "buyer", sender_name: "أحمد محمد", text: "حوّلت المبلغ يوم الثلاثاء، أرجو تأكيد الاستلام", created_at: "2026-04-22 14:00" },
      { id: "m2", sender: "seller", sender_name: "علي حسن", text: "تمام، خلال ساعات أحوّل الحصص", created_at: "2026-04-22 14:30" },
      { id: "m3", sender: "buyer", sender_name: "أحمد محمد", text: "مرّ يومان ولم أستلم شيئاً", created_at: "2026-04-24 09:00" },
      { id: "m4", sender: "system", sender_name: "النظام", text: "تم فتح نزاع من قِبل المشتري", created_at: "2026-04-25 10:30" },
    ],
  },
  {
    id: "DSP-002",
    deal_id: "t1198",
    buyer_id: "u3",
    buyer_name: "محمد أحمد",
    seller_id: "u4",
    seller_name: "سارة محمود",
    project_name: "برج بغداد",
    reason: "fraud_suspicion",
    description: "إثبات الدفع المرفق من المشتري يبدو معدّلاً. رقم المرجع لا يتطابق مع كشف حسابي البنكي.",
    evidence_urls: [placeholder("BANK-STATEMENT"), placeholder("FAKE-PROOF"), placeholder("ORIGINAL-RECEIPT")],
    status: "in_review",
    priority: "high",
    opened_at: "2026-04-23 14:00",
    amount: 4900000,
    shares: 20,
    messages: [
      { id: "m1", sender: "seller", sender_name: "سارة محمود", text: "إثبات الدفع المرفوع غير صحيح، رقم العملية مختلف عن البنك", created_at: "2026-04-23 13:50" },
      { id: "m2", sender: "buyer", sender_name: "محمد أحمد", text: "أكدّت أنني دفعت بالفعل", created_at: "2026-04-23 14:10" },
      { id: "m3", sender: "system", sender_name: "النظام", text: "تم تحويل النزاع إلى المراجعة الإدارية", created_at: "2026-04-23 14:30" },
    ],
  },
  {
    id: "DSP-003",
    deal_id: "t1180",
    buyer_id: "u5",
    buyer_name: "زين العبيدي",
    seller_id: "u6",
    seller_name: "نور الدين",
    project_name: "مجمع الكرخ",
    reason: "payment_issue",
    description: "البائع يطالب بمبلغ إضافي خارج الصفقة المُتفق عليها.",
    evidence_urls: [placeholder("CHAT-EXTRA-FEES")],
    status: "in_review",
    priority: "medium",
    opened_at: "2026-04-22 11:15",
    amount: 17000000,
    shares: 100,
    messages: [
      { id: "m1", sender: "buyer", sender_name: "زين العبيدي", text: "الاتفاق كان 170,000 لكل حصة، الآن يطلب رسوم نقل إضافية", created_at: "2026-04-22 10:00" },
      { id: "m2", sender: "seller", sender_name: "نور الدين", text: "هذه رسوم بنكية اعتيادية", created_at: "2026-04-22 10:30" },
    ],
  },
  {
    id: "DSP-004",
    deal_id: "t1150",
    buyer_id: "u7",
    buyer_name: "ياسمين كريم",
    seller_id: "u8",
    seller_name: "كريم علي",
    project_name: "صفا الذهبي",
    reason: "communication",
    description: "البائع لا يردّ منذ 5 أيام رغم أن الدفع تمّ والصفقة معلّقة.",
    evidence_urls: [placeholder("UNREAD-MESSAGES")],
    status: "open",
    priority: "low",
    opened_at: "2026-04-21 09:00",
    amount: 3450000,
    shares: 30,
    messages: [
      { id: "m1", sender: "buyer", sender_name: "ياسمين كريم", text: "هل أنت متاح لإكمال الصفقة؟", created_at: "2026-04-19 12:00" },
      { id: "m2", sender: "buyer", sender_name: "ياسمين كريم", text: "مضى يومان دون رد", created_at: "2026-04-21 09:00" },
    ],
  },
  {
    id: "DSP-005",
    deal_id: "t1100",
    buyer_id: "u1",
    buyer_name: "أحمد محمد",
    seller_id: "u9",
    seller_name: "هدى صبري",
    project_name: "مزرعة الواحة",
    reason: "delivery",
    description: "تأخير 14 يوم في تحويل الحصص.",
    evidence_urls: [],
    status: "resolved",
    priority: "medium",
    resolution: "buyer_favor",
    resolution_notes: "تم استرداد كامل المبلغ للمشتري بعد فشل البائع في التحويل خلال المدة القانونية.",
    opened_at: "2026-04-10 11:00",
    resolved_at: "2026-04-15 16:30",
    amount: 4750000,
    shares: 50,
    messages: [
      { id: "m1", sender: "system", sender_name: "النظام", text: "تم الحل لصالح المشتري", created_at: "2026-04-15 16:30" },
    ],
  },
  {
    id: "DSP-006",
    deal_id: "t1050",
    buyer_id: "u2",
    buyer_name: "علي حسن",
    seller_id: "u3",
    seller_name: "محمد أحمد",
    project_name: "برج بغداد",
    reason: "other",
    description: "خطأ في عدد الحصص — تم تحويل 18 حصة بدلاً من 20.",
    evidence_urls: [placeholder("HOLDINGS-DIFF")],
    status: "closed",
    priority: "low",
    resolution: "split",
    resolution_notes: "البائع حوّل الحصص الناقصة + استرداد رمزي للمشتري عن التأخير.",
    opened_at: "2026-04-05 14:00",
    resolved_at: "2026-04-08 10:00",
    amount: 4900000,
    shares: 20,
    messages: [],
  },
]

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  payment_issue: "مشكلة دفع",
  delivery: "عدم تسليم الحصص",
  fraud_suspicion: "اشتباه احتيال",
  communication: "ضعف تواصل",
  other: "سبب آخر",
}

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, { label: string; color: "red" | "yellow" | "green" | "gray" }> = {
  open: { label: "مفتوح", color: "red" },
  in_review: { label: "قيد المراجعة", color: "yellow" },
  resolved: { label: "مُحلّ", color: "green" },
  closed: { label: "مُغلق", color: "gray" },
}

export const DISPUTE_PRIORITY_LABELS: Record<DisputePriority, { label: string; color: "red" | "yellow" | "gray" }> = {
  high: { label: "عاجل", color: "red" },
  medium: { label: "متوسط", color: "yellow" },
  low: { label: "منخفض", color: "gray" },
}

export function getDisputeStats() {
  const all = MOCK_DISPUTES
  return {
    open: all.filter((d) => d.status === "open").length,
    in_review: all.filter((d) => d.status === "in_review").length,
    resolved: all.filter((d) => d.status === "resolved").length,
    closed: all.filter((d) => d.status === "closed").length,
    total: all.length,
  }
}
