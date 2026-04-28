/**
 * Audit log — every administrative action, read-only.
 * Used by /admin?tab=audit_log.
 */

export type AdminRole = "founder" | "ceo" | "admin" | "moderator"

export type AuditEntityType =
  | "user"
  | "project"
  | "deal"
  | "contract"
  | "kyc"
  | "council"
  | "auction"
  | "fee_request"
  | "dispute"
  | "ambassador"
  | "system"

export type AuditAction =
  // approvals
  | "approve_kyc"
  | "approve_project"
  | "approve_fee_request"
  | "approve_ambassador"
  | "approve_council_proposal"
  // rejections
  | "reject_kyc"
  | "reject_project"
  | "reject_fee_request"
  | "reject_ambassador"
  | "reject_council_proposal"
  // destructive
  | "freeze_project"
  | "suspend_user"
  | "suspend_ambassador"
  | "ban_user"
  | "remove_council_member"
  | "force_end_contract"
  | "cancel_auction"
  // dispute resolutions
  | "resolve_dispute_buyer"
  | "resolve_dispute_seller"
  | "resolve_dispute_split"
  // financial
  | "topup_fee_units"
  | "refund_auction_fee"
  | "modify_fee_amount"
  // system
  | "update_market_settings"
  | "update_fee_config"
  | "broadcast_notification"
  | "override_council_recommendation"

export interface AuditLogEntry {
  id: string
  admin_id: string
  admin_name: string
  admin_role: AdminRole
  action: AuditAction
  entity_type: AuditEntityType
  entity_id: string
  entity_name: string
  metadata: Record<string, unknown>
  ip_address?: string
  reason?: string
  created_at: string
}

export const MOCK_AUDIT_LOG: AuditLogEntry[] = [
  // اليوم 2026-04-25
  { id: "al-1",  admin_id: "a1", admin_name: "Admin@Main", admin_role: "founder",   action: "approve_kyc",                 entity_type: "kyc",          entity_id: "kyc-5",   entity_name: "ليلى ناصر",            metadata: { document_type: "residency", review_time_minutes: 45 }, ip_address: "10.0.0.1",   created_at: "2026-04-25 14:30" },
  { id: "al-2",  admin_id: "a2", admin_name: "Admin@1",    admin_role: "admin",     action: "approve_fee_request",         entity_type: "fee_request",  entity_id: "fur-2",   entity_name: "علي حسن (100,000)",    metadata: { units_added: 100, payment_method: "bank_transfer" }, ip_address: "10.0.0.2",   created_at: "2026-04-25 14:00" },
  { id: "al-3",  admin_id: "a1", admin_name: "Admin@Main", admin_role: "founder",   action: "approve_council_proposal",    entity_type: "council",      entity_id: "cp-2",    entity_name: "إطلاق دفعة حصص برج بغداد", metadata: { votes_approve: 4, votes_object: 1, recommendation: "approve" }, ip_address: "10.0.0.1", created_at: "2026-04-25 13:50" },
  { id: "al-4",  admin_id: "a2", admin_name: "Admin@1",    admin_role: "admin",     action: "resolve_dispute_buyer",       entity_type: "dispute",      entity_id: "DSP-005", entity_name: "نزاع مزرعة الواحة",     metadata: { refund_amount: 4750000, reason_code: "no_delivery" }, ip_address: "10.0.0.2",   reason: "البائع فشل في التحويل خلال المدة القانونية", created_at: "2026-04-25 13:30" },
  { id: "al-5",  admin_id: "a3", admin_name: "Admin@2",    admin_role: "moderator", action: "reject_kyc",                  entity_type: "kyc",          entity_id: "kyc-7",   entity_name: "حسن العبيدي",          metadata: { document_type: "passport" }, ip_address: "10.0.0.3", reason: "جواز السفر منتهي الصلاحية", created_at: "2026-04-25 12:50" },
  { id: "al-6",  admin_id: "a1", admin_name: "Admin@Main", admin_role: "founder",   action: "broadcast_notification",      entity_type: "system",       entity_id: "notif-bc-1", entity_name: "إعلان: ميزة العقود الجماعية", metadata: { audience: "kyc_verified", recipients: 685, channels: ["in_app", "push"] }, ip_address: "10.0.0.1", created_at: "2026-04-25 12:00" },
  { id: "al-7",  admin_id: "a2", admin_name: "Admin@1",    admin_role: "admin",     action: "topup_fee_units",             entity_type: "user",         entity_id: "u3",      entity_name: "محمد أحمد",            metadata: { units_added: 50000, source: "bonus" }, ip_address: "10.0.0.2",   created_at: "2026-04-25 11:30" },
  { id: "al-8",  admin_id: "a1", admin_name: "Admin@Main", admin_role: "founder",   action: "approve_ambassador",          entity_type: "ambassador",   entity_id: "amb-1",   entity_name: "علي حسن",              metadata: { level: "pro" }, ip_address: "10.0.0.1",   created_at: "2026-04-25 10:00" },
  { id: "al-9",  admin_id: "a2", admin_name: "Admin@1",    admin_role: "admin",     action: "modify_fee_amount",           entity_type: "fee_request",  entity_id: "fur-x",   entity_name: "طلب فرعي مُعدَّل",      metadata: { requested: 100, approved: 80, delta: -20 }, ip_address: "10.0.0.2",   reason: "خطأ في حساب المستخدم", created_at: "2026-04-25 09:30" },

  // أمس 2026-04-24
  { id: "al-10", admin_id: "a1", admin_name: "Admin@Main", admin_role: "founder",   action: "override_council_recommendation", entity_type: "council",  entity_id: "cp-old", entity_name: "اقتراح سياسة قديم",     metadata: { recommendation: "object", final: "approved", impact: "policy_change" }, ip_address: "10.0.0.1", reason: "ضرورة تشغيلية تتجاوز التوصية الاستشارية", created_at: "2026-04-24 18:00" },
  { id: "al-11", admin_id: "a2", admin_name: "Admin@1",    admin_role: "admin",     action: "freeze_project",              entity_type: "project",      entity_id: "4",       entity_name: "صفا الذهبي",           metadata: { previous_phase: "active", new_phase: "frozen" }, ip_address: "10.0.0.2", reason: "تحت مراجعة لجنة التطوير", created_at: "2026-04-24 16:00" },
  { id: "al-12", admin_id: "a3", admin_name: "Admin@2",    admin_role: "moderator", action: "approve_kyc",                 entity_type: "kyc",          entity_id: "kyc-6",   entity_name: "ضيف الله سعيد",        metadata: { document_type: "national_id" }, ip_address: "10.0.0.3", created_at: "2026-04-24 15:30" },
  { id: "al-13", admin_id: "a2", admin_name: "Admin@1",    admin_role: "admin",     action: "resolve_dispute_split",       entity_type: "dispute",      entity_id: "DSP-006", entity_name: "نزاع برج بغداد",       metadata: { each_party_amount: 2450000 }, ip_address: "10.0.0.2", reason: "خطأ مشترك بين الطرفين", created_at: "2026-04-24 14:00" },
  { id: "al-14", admin_id: "a1", admin_name: "Admin@Main", admin_role: "founder",   action: "update_fee_config",           entity_type: "system",       entity_id: "fee-cfg", entity_name: "إعدادات الرسوم",       metadata: { changed_field: "auction_fee_percent", old: 1.5, new: 2.0 }, ip_address: "10.0.0.1", created_at: "2026-04-24 11:00" },
  { id: "al-15", admin_id: "a2", admin_name: "Admin@1",    admin_role: "admin",     action: "approve_project",             entity_type: "project",      entity_id: "p-new-1", entity_name: "مشروع تقنية بغداد",   metadata: { sector: "تقنية", review_days: 4 }, ip_address: "10.0.0.2",  created_at: "2026-04-24 10:00" },

  // قبل أمس 2026-04-23
  { id: "al-16", admin_id: "a3", admin_name: "Admin@2",    admin_role: "moderator", action: "ban_user",                    entity_type: "user",         entity_id: "u9",      entity_name: "حساب احتيالي",         metadata: { reason_code: "fraud_pattern" }, ip_address: "10.0.0.3", reason: "نشاط احتيالي مكتشف + 3 شكاوى", created_at: "2026-04-23 18:00" },
  { id: "al-17", admin_id: "a1", admin_name: "Admin@Main", admin_role: "founder",   action: "remove_council_member",       entity_type: "council",      entity_id: "cm-old",  entity_name: "عضو سابق",            metadata: { reason_code: "term_expired" }, ip_address: "10.0.0.1", reason: "انتهت دورة العضوية", created_at: "2026-04-23 14:30" },
  { id: "al-18", admin_id: "a2", admin_name: "Admin@1",    admin_role: "admin",     action: "approve_fee_request",         entity_type: "fee_request",  entity_id: "fur-7",   entity_name: "ياسمين كريم (30,000)", metadata: { units_added: 30 }, ip_address: "10.0.0.2",     created_at: "2026-04-23 12:00" },
  { id: "al-19", admin_id: "a1", admin_name: "Admin@Main", admin_role: "founder",   action: "force_end_contract",          entity_type: "contract",     entity_id: "ct-old1", entity_name: "عقد منتهٍ قسرياً",     metadata: { fee_amount: 5000, members_affected: 4 }, ip_address: "10.0.0.1", reason: "خرق شروط العقد من قبل المنشئ", created_at: "2026-04-23 10:00" },
  { id: "al-20", admin_id: "a2", admin_name: "Admin@1",    admin_role: "admin",     action: "refund_auction_fee",          entity_type: "auction",      entity_id: "auc-old1",entity_name: "مزاد ملغى سابق",      metadata: { refund_amount: 25000, participants: 5 }, ip_address: "10.0.0.2", created_at: "2026-04-23 09:30" },

  // 2026-04-22
  { id: "al-21", admin_id: "a3", admin_name: "Admin@2",    admin_role: "moderator", action: "reject_ambassador",           entity_type: "ambassador",   entity_id: "amb-7",   entity_name: "حساب احتيالي",         metadata: {}, ip_address: "10.0.0.3", reason: "بيانات مزيّفة", created_at: "2026-04-22 15:00" },
  { id: "al-22", admin_id: "a1", admin_name: "Admin@Main", admin_role: "founder",   action: "update_market_settings",      entity_type: "system",       entity_id: "mkt-set", entity_name: "إعدادات السوق",        metadata: { changed_field: "max_daily_trades", old: 30, new: 50 }, ip_address: "10.0.0.1", created_at: "2026-04-22 13:00" },
  { id: "al-23", admin_id: "a2", admin_name: "Admin@1",    admin_role: "admin",     action: "suspend_ambassador",          entity_type: "ambassador",   entity_id: "amb-9",   entity_name: "زيد الحلبوسي",         metadata: { active_referrals_paused: 12 }, ip_address: "10.0.0.2", reason: "شكاوى من إحالات مزيّفة", created_at: "2026-04-22 11:00" },

  // 2026-04-21
  { id: "al-24", admin_id: "a2", admin_name: "Admin@1",    admin_role: "admin",     action: "approve_kyc",                 entity_type: "kyc",          entity_id: "kyc-9",   entity_name: "مصطفى الكاظمي",       metadata: { document_type: "national_id" }, ip_address: "10.0.0.2", created_at: "2026-04-21 16:00" },
  { id: "al-25", admin_id: "a1", admin_name: "Admin@Main", admin_role: "founder",   action: "approve_council_proposal",    entity_type: "council",      entity_id: "cp-3",    entity_name: "تحقيق في شكوى",         metadata: {}, ip_address: "10.0.0.1", created_at: "2026-04-21 14:00" },
  { id: "al-26", admin_id: "a2", admin_name: "Admin@1",    admin_role: "admin",     action: "topup_fee_units",             entity_type: "user",         entity_id: "u5",      entity_name: "نور الدين",            metadata: { units_added: 200000, source: "verified_payment" }, ip_address: "10.0.0.2", created_at: "2026-04-21 11:30" },
  { id: "al-27", admin_id: "a3", admin_name: "Admin@2",    admin_role: "moderator", action: "reject_kyc",                  entity_type: "kyc",          entity_id: "kyc-old", entity_name: "كريم سابق",            metadata: { document_type: "national_id" }, ip_address: "10.0.0.3", reason: "صورة Selfie غير واضحة", created_at: "2026-04-21 10:00" },

  // 2026-04-20
  { id: "al-28", admin_id: "a2", admin_name: "Admin@1",    admin_role: "admin",     action: "cancel_auction",              entity_type: "auction",      entity_id: "auc-old2",entity_name: "مزاد ملغى",            metadata: { participants_notified: 4 }, ip_address: "10.0.0.2", reason: "خطأ في إعدادات السعر الابتدائي", created_at: "2026-04-20 14:00" },
  { id: "al-29", admin_id: "a1", admin_name: "Admin@Main", admin_role: "founder",   action: "approve_ambassador",          entity_type: "ambassador",   entity_id: "amb-2",   entity_name: "نور الدين",            metadata: { level: "pro" }, ip_address: "10.0.0.1",   created_at: "2026-04-20 11:00" },
  { id: "al-30", admin_id: "a2", admin_name: "Admin@1",    admin_role: "admin",     action: "approve_fee_request",         entity_type: "fee_request",  entity_id: "fur-5",   entity_name: "نور (200,000)",        metadata: { units_added: 200 }, ip_address: "10.0.0.2",   created_at: "2026-04-20 09:00" },
]

export const ACTION_LABELS: Record<AuditAction, { label: string; color: "green" | "red" | "yellow" | "blue" | "purple" | "orange" | "gray" }> = {
  approve_kyc:                       { label: "✓ موافقة KYC",           color: "green" },
  approve_project:                   { label: "✓ موافقة مشروع",         color: "green" },
  approve_fee_request:               { label: "✓ موافقة طلب رسوم",      color: "green" },
  approve_ambassador:                { label: "✓ تفعيل سفير",            color: "green" },
  approve_council_proposal:          { label: "✓ تنفيذ قرار مجلس",      color: "green" },

  reject_kyc:                        { label: "✗ رفض KYC",              color: "red" },
  reject_project:                    { label: "✗ رفض مشروع",            color: "red" },
  reject_fee_request:                { label: "✗ رفض طلب رسوم",         color: "red" },
  reject_ambassador:                 { label: "✗ رفض سفير",              color: "red" },
  reject_council_proposal:           { label: "✗ رفض قرار مجلس",        color: "red" },

  freeze_project:                    { label: "❄ تجميد مشروع",          color: "yellow" },
  suspend_user:                      { label: "⏸ إيقاف مستخدم",         color: "yellow" },
  suspend_ambassador:                { label: "⏸ إيقاف سفير",            color: "yellow" },
  ban_user:                          { label: "🚫 حظر مستخدم",          color: "red" },
  remove_council_member:             { label: "🚫 إقالة عضو مجلس",      color: "red" },
  force_end_contract:                { label: "⛔ إنهاء قسري لعقد",     color: "red" },
  cancel_auction:                    { label: "⛔ إلغاء مزاد",          color: "red" },

  resolve_dispute_buyer:             { label: "⚖ حسم لصالح المشتري",    color: "purple" },
  resolve_dispute_seller:            { label: "⚖ حسم لصالح البائع",     color: "purple" },
  resolve_dispute_split:             { label: "⚖ حسم مُقسَّم",           color: "purple" },

  topup_fee_units:                   { label: "💳 شحن وحدات",            color: "blue" },
  refund_auction_fee:                { label: "💰 استرداد مزاد",         color: "blue" },
  modify_fee_amount:                 { label: "✏ تعديل مبلغ",            color: "yellow" },

  update_market_settings:            { label: "⚙ تعديل إعدادات السوق", color: "gray" },
  update_fee_config:                 { label: "⚙ تعديل الرسوم",          color: "gray" },
  broadcast_notification:            { label: "📢 إذاعة إشعار",         color: "blue" },
  override_council_recommendation:   { label: "⚠ تجاوز توصية المجلس",   color: "orange" },
}

export const ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  user: "مستخدم",
  project: "مشروع",
  deal: "صفقة",
  contract: "عقد",
  kyc: "KYC",
  council: "مجلس",
  auction: "مزاد",
  fee_request: "طلب رسوم",
  dispute: "نزاع",
  ambassador: "سفير",
  system: "نظام",
}

export const ROLE_LABELS: Record<AdminRole, { label: string; color: "purple" | "blue" | "green" | "gray" }> = {
  founder: { label: "مؤسس", color: "purple" },
  ceo: { label: "رئيس تنفيذي", color: "blue" },
  admin: { label: "أدمن", color: "green" },
  moderator: { label: "مشرف", color: "gray" },
}

const DESTRUCTIVE_ACTIONS: AuditAction[] = [
  "freeze_project", "suspend_user", "suspend_ambassador", "ban_user",
  "remove_council_member", "force_end_contract", "cancel_auction",
  "override_council_recommendation",
]

export function isDestructive(action: AuditAction): boolean {
  return DESTRUCTIVE_ACTIONS.includes(action)
}

export function getAuditLogStats() {
  const all = MOCK_AUDIT_LOG
  const today = "2026-04-25"
  const weekAgo = new Date(Date.parse(today) - 7 * 86_400_000).toISOString().split("T")[0]
  return {
    today: all.filter((a) => a.created_at.startsWith(today)).length,
    this_week: all.filter((a) => a.created_at >= weekAgo).length,
    destructive: all.filter((a) => isDestructive(a.action)).length,
    total: all.length,
  }
}
