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

export interface AdminNavItem {
  key: AdminTab
  label: string
  icon: string
  section: string
}

export const ADMIN_NAV: AdminNavItem[] = [
  { key: "dashboard",    label: "لوحة التحكم",   icon: "◈",  section: "رئيسي" },
  { key: "monitor",      label: "مراقبة السوق",   icon: "📡", section: "رئيسي" },
  { key: "alerts",       label: "التنبيهات",      icon: "🚨", section: "رئيسي" },
  { key: "log",          label: "سجل القرارات",   icon: "📋", section: "رئيسي" },

  // العمليات (operations) — Phase Admin-A P0 + Phase Admin-B
  { key: "kyc",                 label: "التحقق (KYC)",      icon: "🛡️", section: "العمليات" },
  { key: "disputes",            label: "النزاعات",          icon: "⚖️", section: "العمليات" },
  { key: "fee_units_requests",  label: "طلبات الرسوم",      icon: "💎", section: "العمليات" },
  { key: "payment_proofs",      label: "إثباتات الدفع",     icon: "🧾", section: "العمليات" },
  { key: "contracts_admin",     label: "العقود",            icon: "🤝", section: "العمليات" },

  { key: "projects",     label: "المشاريع",       icon: "▣",  section: "المشاريع" },

  // السوق
  { key: "market",         label: "السوق والمزادات", icon: "◉",  section: "السوق" },
  { key: "auctions_admin", label: "إدارة المزادات",  icon: "🔨", section: "السوق" },

  { key: "shares",       label: "الحصص والتداول",  icon: "◎",  section: "الحصص" },
  { key: "fees",         label: "الرسوم",          icon: "💰", section: "الرسوم" },
  { key: "users",        label: "المستخدمون",      icon: "⊙",  section: "المستخدمون" },

  // الحوكمة (governance) — Phase Admin-A + Phase Admin-B
  { key: "council_admin",      label: "المجلس",         icon: "🏛️", section: "الحوكمة" },
  { key: "ambassadors_admin",  label: "السفراء",        icon: "🌟", section: "الحوكمة" },
  { key: "audit_log",          label: "سجل التدقيق",    icon: "📜", section: "الحوكمة" },

  // التواصل (communications) — Phase Admin-B
  { key: "broadcaster",     label: "إذاعة الإشعارات", icon: "📢", section: "التواصل" },
  { key: "support_inbox",   label: "صندوق الدعم",     icon: "💬", section: "التواصل" },

  // البرامج الاجتماعية (social_programs) — Phase Social
  { key: "healthcare_admin", label: "الرعاية الصحية",  icon: "🏥", section: "البرامج الاجتماعية" },
  { key: "orphans_admin",    label: "رعاية الأيتام",   icon: "👶", section: "البرامج الاجتماعية" },
  { key: "discounts_admin",  label: "الخصومات",         icon: "🎁", section: "البرامج الاجتماعية" },

  // محافظ المشاريع — Phase Admin-Plus (operations)
  { key: "project_wallets",  label: "محافظ المشاريع",   icon: "🏦", section: "العمليات" },

  // المحرّر القانوني — Phase Admin-Plus (content)
  { key: "legal_editor",     label: "محرّر قانوني",     icon: "📜", section: "المحتوى" },

  // ملاحظة:
  //  - create_project + create_company → دُمجا داخل صفحة "المشاريع" (Projects panel)
  //  - admin_users → دُمج داخل صفحة "النظام > الأدمنز" (System panel)
  //  لا يزالان متاحَين عبر URL مباشر (?tab=create_project / ?tab=admin_users)

  { key: "content_mgmt", label: "المحتوى",         icon: "📝", section: "المحتوى" },
  { key: "system",       label: "النظام",          icon: "⚙",  section: "النظام" },
]

export const ADMIN_SECTIONS = Array.from(new Set(ADMIN_NAV.map((n) => n.section)))
