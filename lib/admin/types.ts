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
  // Phase 13.2 — consolidated social-programs hub
  | "social_programs"
  // Phase 14.07c — sidebar entry for the App-Router page
  // /admin/market-settings (Phase 14.06 dynamic registry). Has an
  // href on its AdminNavItem so the sidebar router pushes the full
  // path instead of resolving a tab via app/admin/page.tsx.
  | "market_settings_registry"
  // Phase 14.08f — App-Router page /admin/engine-monitor showing
  // layer progress + recent cron runs + manual trigger.
  | "engine_monitor"

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
  /** Phase 14.07c — optional full-path override. When set, the sidebar
   *  navigates with router.push(href) instead of the legacy
   *  ?tab=<key> query-param routing. Used for App-Router pages that
   *  live outside the tab-router (e.g. /admin/market-settings). */
  href?: string
}

// ─── Phase 13.2 — reorganized into 4 logical sections ─────────────
// • نظرة عامة                — landing + everything that needs a quick decision
// • العمليات والمالية         — projects, shares, fees, market engine
// • الحوكمة والمستخدمون       — users, council, ambassadors, social programs
// • المحتوى والنظام            — content, system settings
//
// Phase 13.2 collapsed the former "البرامج الاجتماعية" section
// (4 standalone entries) into a single hub under "الحوكمة" so the
// sidebar fits in one screen without scrolling.
//
// Anything pending an admin action that already lives as a sub-tab
// inside a hub (KYC, fee_units_requests, payment_proofs, disputes,
// council_proposals, market_state, …) is still reachable via direct
// URL — but the daily workflow runs through these 5 sections.
export const ADMIN_NAV: AdminNavItem[] = [
  // ─── 1. نظرة عامة (the at-a-glance landing) ───────────────────
  // Phase 13.3 — "مركز الطلبات" was REMOVED from the sidebar. Every
  // bucket it surfaced (shares / fees / deals / disputes / volume /
  // inbox) is already presented inside a dedicated hub or on the
  // dashboard, so the sidebar entry was pure duplication. The panel
  // file remains registered in app/admin/page.tsx so legacy URLs
  // (?tab=requests_hub) keep resolving for anyone who has them
  // bookmarked.
  { key: "dashboard",    label: "لوحة التحكم",    icon: "◈",  section: "نظرة عامة", requiredPermission: "view_dashboard" },
  { key: "monitor",      label: "مراقبة السوق",   icon: "📡", section: "نظرة عامة", requiredPermission: "manage_market" },
  // Phase 14.07c — new App-Router page at /admin/market-settings.
  // The `href` field tells the sidebar to push a full path instead
  // of the legacy ?tab=<key> routing.
  { key: "market_settings_registry", label: "إعدادات السوق", icon: "⚙️", section: "نظرة عامة",
    requiredPermission: "manage_market", href: "/admin/market-settings" },
  // Phase 14.08f — engine monitor (3-layer progress + cron history).
  { key: "engine_monitor", label: "مراقبة المحرّك", icon: "📊", section: "نظرة عامة",
    requiredPermission: "manage_market", href: "/admin/engine-monitor" },
  { key: "log",          label: "سجل القرارات",   icon: "📋", section: "نظرة عامة", requiredPermission: "view_audit" },

  // ─── 2. العمليات والمالية ─────────────────────────────────────
  { key: "projects",        label: "المشاريع",         icon: "▣",  section: "العمليات والمالية", requiredPermission: "manage_projects" },
  { key: "market",          label: "السوق والمزادات",   icon: "◉",  section: "العمليات والمالية", requiredPermission: "manage_market" },
  { key: "shares",          label: "الحصص والتداول",    icon: "◎",  section: "العمليات والمالية", requiredPermission: "manage_orders" },
  { key: "fees",            label: "الرسوم",            icon: "💰", section: "العمليات والمالية", requiredPermission: "manage_fees" },
  { key: "contracts_admin", label: "العقود",            icon: "🤝", section: "العمليات والمالية", requiredPermission: "manage_orders" },

  // ─── 3. الحوكمة والمستخدمون ───────────────────────────────────
  { key: "users",            label: "المستخدمون",  icon: "⊙",  section: "الحوكمة والمستخدمون", requiredPermission: "manage_users" },
  { key: "council_admin",    label: "المجلس",      icon: "🏛️", section: "الحوكمة والمستخدمون", requiredPermission: "manage_users" },
  { key: "ambassadors_admin",label: "السفراء",     icon: "🌟", section: "الحوكمة والمستخدمون", requiredPermission: "manage_users" },

  // ─── 4. البرامج الاجتماعية ──────────────────────────────────
  // Phase 13.2 — collapsed 4 entries (healthcare / orphans / discounts /
  // gifts) into a single hub. Each former panel is now a tab inside it.
  // Direct deep-links (?tab=healthcare_admin etc.) still resolve.
  { key: "social_programs",  label: "البرامج الاجتماعية", icon: "🤝", section: "الحوكمة والمستخدمون", requiredPermission: "manage_content" },

  // ─── 5. المحتوى والنظام ─────────────────────────────────────
  { key: "content_mgmt", label: "المحتوى", icon: "📝", section: "المحتوى والنظام", requiredPermission: "manage_content" },
  { key: "system",       label: "النظام",  icon: "⚙",  section: "المحتوى والنظام", requiredPermission: "manage_admins" },

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
