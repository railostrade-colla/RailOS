export type AdminTab =
  | "dashboard" | "monitor" | "alerts" | "log"
  | "projects"
  | "market"
  | "shares"
  | "fees"
  | "users"
  | "content_mgmt"
  | "system"
  // sub-tabs
  | "news" | "ads_manage" | "system_offers"
  | "trades" | "listings" | "wallets" | "auctions" | "direct_buy"
  | "fee_units_requests" | "contracts" | "disputes" | "messages"
  | "support_inbox" | "market_settings" | "settings" | "admins"
  | "site_pages" | "system_messages_panel" | "bids_mgmt"
  | "transactions_log" | "ratings_mgmt" | "friends_mgmt"
  | "contract_holdings_mgmt" | "market_state_mgmt" | "fee_config_mgmt"
  | "market_settings_advanced" | "market_state" | "fee_config_advanced"
  | "fee_units_admin" | "deal_fees_admin"
  // Phase Admin-A (operations + governance + market panels)
  | "kyc"
  | "payment_proofs"
  | "council_admin"
  | "auctions_admin"
  // Phase Admin-B (governance + operations + communications)
  | "ambassadors_admin"
  | "contracts_admin"
  | "broadcaster"
  | "audit_log"
  // Phase Social (social programs)
  | "healthcare_admin"
  | "orphans_admin"
  | "discounts_admin"
  // Phase Admin-Plus
  | "create_project"
  | "create_company"
  | "project_wallets"
  | "legal_editor"
  | "admin_users"
  // Phase Health
  | "market_health"
  // Phase Levels
  | "level_settings"
  | "user_stats"
  // Phase Invoices
  | "invoices_admin"
  // Phase 9.4 — admin requests hub (locking + 5-tab inbox)
  | "requests_hub"
  // Phase 9.5 (share_modification) was removed in Phase 11.01.
  // Phase 9.6 — user gifts (admin grants, user redeems)
  | "gifts_admin"

/** Capability vocabulary kept in sync with lib/data/admin-permissions.ts. */
export type AdminPermission =
  | "manage_users"
  | "manage_projects"
  | "manage_companies"
  | "manage_orders"
  | "manage_kyc"
  | "manage_market"
  | "manage_payments"
  | "manage_fees"
  | "manage_content"
  | "manage_admins"
  | "view_audit"
  | "view_dashboard"

export interface AdminNavItem {
  key: AdminTab
  label: string
  icon: string
  section: string
  /** Phase 11.00 — capability needed to see this nav entry. super_admin
   *  bypasses (sees everything). undefined = always visible to any admin. */
  requiredPermission?: AdminPermission
}

export const ADMIN_NAV: AdminNavItem[] = [
  // رئيسي — overview/dashboard surfaces
  { key: "dashboard",    label: "لوحة التحكم",   icon: "◈",  section: "رئيسي", requiredPermission: "view_dashboard" },
  { key: "requests_hub", label: "مركز الطلبات",  icon: "🎯", section: "رئيسي", requiredPermission: "manage_orders" },
  { key: "monitor",      label: "مراقبة السوق",   icon: "📡", section: "رئيسي", requiredPermission: "manage_market" },
  // Phase 10.76 — "التنبيهات" sidebar link removed per founder request.
  // The page itself (Alerts.tsx + tab=alerts route) stays for deep-links
  // and topbar/dashboard CTAs that still need a target, but no sidebar
  // entry. Replaced by the unified "مركز الطلبات" above.
  { key: "log",          label: "سجل القرارات",   icon: "📋", section: "رئيسي", requiredPermission: "view_audit" },

  // العمليات — only the entry-points that DON'T live as a tab inside another hub
  { key: "contracts_admin",  label: "العقود",     icon: "🤝", section: "العمليات", requiredPermission: "manage_orders" },
  { key: "gifts_admin",      label: "الهدايا",    icon: "🎁", section: "العمليات", requiredPermission: "manage_content" },

  // المشاريع — projects has its own dedicated page (also embedded in Market hub)
  { key: "projects",         label: "المشاريع",   icon: "▣", section: "المشاريع", requiredPermission: "manage_projects" },

  // الهَبات — single-entry hubs
  { key: "market",           label: "السوق والمزادات", icon: "◉",  section: "السوق", requiredPermission: "manage_market" },
  { key: "shares",           label: "الحصص والتداول",  icon: "◎",  section: "الحصص", requiredPermission: "manage_orders" },
  { key: "fees",             label: "الرسوم",          icon: "💰", section: "الرسوم", requiredPermission: "manage_fees" },
  { key: "users",            label: "المستخدمون",       icon: "⊙",  section: "المستخدمون", requiredPermission: "manage_users" },

  // الحوكمة — items that don't live inside another hub
  { key: "council_admin",     label: "المجلس",   icon: "🏛️", section: "الحوكمة", requiredPermission: "manage_users" },
  { key: "ambassadors_admin", label: "السفراء",  icon: "🌟", section: "الحوكمة", requiredPermission: "manage_users" },

  // البرامج الاجتماعية — Phase 10.79 (Task 15): added discounts_admin
  { key: "healthcare_admin", label: "الرعاية الصحية",  icon: "🏥", section: "البرامج الاجتماعية", requiredPermission: "manage_content" },
  { key: "orphans_admin",    label: "رعاية الأيتام",   icon: "👶", section: "البرامج الاجتماعية", requiredPermission: "manage_content" },
  { key: "discounts_admin",  label: "الخصومات",        icon: "🏷️", section: "البرامج الاجتماعية", requiredPermission: "manage_content" },

  // المحتوى — single entry, all sub-tabs are inside
  { key: "content_mgmt",     label: "المحتوى",   icon: "📝", section: "المحتوى", requiredPermission: "manage_content" },

  // النظام — single entry, all sub-tabs are inside (admin mgmt requires super_admin)
  { key: "system",           label: "النظام",    icon: "⚙",  section: "النظام", requiredPermission: "manage_admins" },

  // ملاحظة بعد إعادة الترتيب (Phase 10.36):
  //  جميع البنود التالية باتت تبويبات داخل لوحات الـ hub، فأُزيلت من السلايدبار
  //  (لكنها لا تزال متاحة عبر الـ URL المباشر `?tab=…` للـ deep-links):
  //   • kyc / disputes / fee_units_requests / payment_proofs
  //   • share_modification / project_wallets
  //   • user_stats / admin_users / level_settings / support_inbox
  //   • audit_log / broadcaster / market_health / market_state
  //   • market_settings_advanced / fee_config_advanced / fee_units_admin
  //   • deal_fees_admin / invoices_admin / legal_editor / discounts_admin
  //   • auctions_admin / create_project / create_company
]

export const ADMIN_SECTIONS = Array.from(new Set(ADMIN_NAV.map((n) => n.section)))
