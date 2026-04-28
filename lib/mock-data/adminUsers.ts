/**
 * Admin users — staff accounts with role-based permissions.
 * Used by /admin?tab=admin_users.
 */

export type AdminRoleId = "founder" | "ceo" | "admin" | "moderator"
export type AdminUserStatus = "active" | "suspended" | "deleted"

export type AdminPermission =
  | "kyc_review"
  | "disputes_resolve"
  | "market_control"
  | "users_manage"
  | "content_manage"
  | "financial_actions"
  | "council_manage"
  | "ambassadors_manage"
  | "social_programs"

export interface AdminUserRecord {
  id: string
  full_name: string
  email: string
  phone?: string
  role: AdminRoleId
  permissions: AdminPermission[]
  status: AdminUserStatus
  notes?: string
  last_login_at?: string
  created_at: string
  created_by?: string
}

export const ADMIN_ROLE_LABELS: Record<AdminRoleId, { label: string; color: "purple" | "blue" | "green" | "gray"; icon: string }> = {
  founder:   { label: "مؤسّس",        color: "purple", icon: "👑" },
  ceo:       { label: "رئيس تنفيذي", color: "blue",   icon: "💼" },
  admin:     { label: "مدير",          color: "green",  icon: "⚙️" },
  moderator: { label: "مشرف",         color: "gray",   icon: "🛡️" },
}

export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, { label: string; icon: string }> = {
  kyc_review:        { label: "مراجعة KYC",            icon: "🛡️" },
  disputes_resolve:  { label: "حلّ النزاعات",         icon: "⚖️" },
  market_control:    { label: "التحكّم بالسوق",       icon: "📊" },
  users_manage:      { label: "إدارة المستخدمين",      icon: "👥" },
  content_manage:    { label: "إدارة المحتوى",         icon: "📝" },
  financial_actions: { label: "إجراءات مالية",          icon: "💰" },
  council_manage:    { label: "إدارة المجلس",          icon: "🏛️" },
  ambassadors_manage:{ label: "إدارة السفراء",         icon: "🌟" },
  social_programs:   { label: "البرامج الاجتماعية",  icon: "❤️" },
}

export const ADMIN_STATUS_LABELS: Record<AdminUserStatus, { label: string; color: "green" | "yellow" | "red" }> = {
  active:    { label: "نشط",       color: "green"  },
  suspended: { label: "مُوقَف",    color: "yellow" },
  deleted:   { label: "محذوف",     color: "red"    },
}

const ALL_PERMS: AdminPermission[] = [
  "kyc_review", "disputes_resolve", "market_control", "users_manage",
  "content_manage", "financial_actions", "council_manage", "ambassadors_manage", "social_programs",
]

export const MOCK_ADMIN_USERS: AdminUserRecord[] = [
  {
    id: "a1",
    full_name: "أحمد المؤسس",
    email: "founder@railos.iq",
    phone: "+964 770 1000001",
    role: "founder",
    permissions: ALL_PERMS,
    status: "active",
    last_login_at: "2026-04-25 14:30",
    created_at: "2024-01-01",
  },
  {
    id: "a2",
    full_name: "خالد الإداري",
    email: "ceo@railos.iq",
    phone: "+964 770 1000002",
    role: "ceo",
    permissions: ALL_PERMS,
    status: "active",
    last_login_at: "2026-04-25 13:15",
    created_at: "2024-03-01",
    created_by: "a1",
  },
  {
    id: "a3",
    full_name: "Admin@1",
    email: "admin1@railos.iq",
    phone: "+964 770 1000003",
    role: "admin",
    permissions: ["kyc_review", "disputes_resolve", "users_manage", "ambassadors_manage", "financial_actions"],
    status: "active",
    last_login_at: "2026-04-25 11:00",
    created_at: "2024-06-15",
    created_by: "a1",
  },
  {
    id: "a4",
    full_name: "Admin@2",
    email: "admin2@railos.iq",
    phone: "+964 770 1000004",
    role: "moderator",
    permissions: ["kyc_review", "content_manage"],
    status: "active",
    last_login_at: "2026-04-25 09:30",
    created_at: "2025-01-10",
    created_by: "a2",
  },
  {
    id: "a5",
    full_name: "زينب الموظّفة",
    email: "zainab@railos.iq",
    phone: "+964 770 1000005",
    role: "admin",
    permissions: ["social_programs", "content_manage", "ambassadors_manage"],
    status: "active",
    last_login_at: "2026-04-24 16:00",
    created_at: "2025-08-20",
    created_by: "a2",
    notes: "مسؤولة البرامج الاجتماعية والسفراء.",
  },
  {
    id: "a6",
    full_name: "محمد المشرف",
    email: "mohamed.mod@railos.iq",
    role: "moderator",
    permissions: ["kyc_review"],
    status: "active",
    last_login_at: "2026-04-25 08:00",
    created_at: "2026-01-15",
    created_by: "a3",
  },
  {
    id: "a7",
    full_name: "Old Admin",
    email: "old.admin@railos.iq",
    role: "moderator",
    permissions: ["content_manage"],
    status: "suspended",
    last_login_at: "2026-02-10",
    created_at: "2025-04-01",
    created_by: "a1",
    notes: "مُوقَف بعد تقصير في المهام لمدّة شهر.",
  },
  {
    id: "a8",
    full_name: "حساب محذوف",
    email: "deleted@railos.iq",
    role: "moderator",
    permissions: [],
    status: "deleted",
    created_at: "2025-09-01",
    created_by: "a1",
  },
]

export function getAdminUsersStats() {
  const all = MOCK_ADMIN_USERS
  return {
    total:     all.filter((a) => a.status !== "deleted").length,
    founders:  all.filter((a) => a.role === "founder" && a.status === "active").length,
    admins:    all.filter((a) => a.role === "admin" && a.status === "active").length,
    moderators:all.filter((a) => a.role === "moderator" && a.status === "active").length,
    suspended: all.filter((a) => a.status === "suspended").length,
  }
}

export function createAdminUser(_data: Partial<AdminUserRecord>) {
  return { success: true, id: `a-${Date.now()}` }
}

export function updateAdminPermissions(_id: string, _perms: AdminPermission[]) {
  return { success: true }
}
