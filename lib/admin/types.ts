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
  // Phase 9.5 — share modification with two-factor authorization
  | "share_modification"
  // Phase 9.6 — user gifts (admin grants, user redeems)
  | "gifts_admin"

export interface AdminNavItem {
  key: AdminTab
  label: string
  icon: string
  section: string
}

export const ADMIN_NAV: AdminNavItem[] = [
  // رئيسي — overview/dashboard surfaces
  { key: "dashboard",    label: "لوحة التحكم",   icon: "◈",  section: "رئيسي" },
  { key: "requests_hub", label: "مركز الطلبات",  icon: "🎯", section: "رئيسي" },
  { key: "monitor",      label: "مراقبة السوق",   icon: "📡", section: "رئيسي" },
  { key: "alerts",       label: "التنبيهات",      icon: "🚨", section: "رئيسي" },
  { key: "log",          label: "سجل القرارات",   icon: "📋", section: "رئيسي" },

  // العمليات — only the entry-points that DON'T live as a tab inside another hub
  { key: "contracts_admin",  label: "العقود",     icon: "🤝", section: "العمليات" },
  { key: "gifts_admin",      label: "الهدايا",    icon: "🎁", section: "العمليات" },

  // المشاريع — projects has its own dedicated page (also embedded in Market hub)
  { key: "projects",         label: "المشاريع",   icon: "▣", section: "المشاريع" },

  // الهَبات — single-entry hubs
  { key: "market",           label: "السوق والمزادات", icon: "◉",  section: "السوق" },
  { key: "shares",           label: "الحصص والتداول",  icon: "◎",  section: "الحصص" },
  { key: "fees",             label: "الرسوم",          icon: "💰", section: "الرسوم" },
  { key: "users",            label: "المستخدمون",       icon: "⊙",  section: "المستخدمون" },

  // الحوكمة — items that don't live inside another hub
  { key: "council_admin",     label: "المجلس",   icon: "🏛️", section: "الحوكمة" },
  { key: "ambassadors_admin", label: "السفراء",  icon: "🌟", section: "الحوكمة" },

  // البرامج الاجتماعية
  { key: "healthcare_admin", label: "الرعاية الصحية",  icon: "🏥", section: "البرامج الاجتماعية" },
  { key: "orphans_admin",    label: "رعاية الأيتام",   icon: "👶", section: "البرامج الاجتماعية" },

  // المحتوى — single entry, all sub-tabs are inside
  { key: "content_mgmt",     label: "المحتوى",   icon: "📝", section: "المحتوى" },

  // النظام — single entry, all sub-tabs are inside
  { key: "system",           label: "النظام",    icon: "⚙",  section: "النظام" },

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
