"use client"

import { useSearchParams } from "next/navigation"
import { type AdminTab } from "@/lib/admin/types"
import { DashboardPanel } from "@/components/admin/panels/Dashboard"
// Phase 14.08.2 — MonitorPanel deleted. Its job is now done by the
// App-Router page /admin/engine-monitor (Phase 14.08f). Legacy
// ?tab=monitor URLs fall through to the unknown-tab placeholder.
import { AlertsPanel } from "@/components/admin/panels/Alerts"
import { LogPanel } from "@/components/admin/panels/Log"
import { ProjectsPanel } from "@/components/admin/panels/Projects"
import { MarketPanel } from "@/components/admin/panels/Market"
import { SharesPanel } from "@/components/admin/panels/Shares"
import { FeesPanel } from "@/components/admin/panels/Fees"
import { UsersPanel } from "@/components/admin/panels/Users"
import { ContentPanel } from "@/components/admin/panels/Content"
import { SystemPanel } from "@/components/admin/panels/System"
// Phase 14.07b — MarketSettings + FeeConfig mocks deleted. MarketState
// stays (it's real Phase 10.37) and is still deep-linkable via
// ?tab=market_state for legacy bookmarks.
import { MarketStatePanel } from "@/components/admin/panels/MarketState"
import { FeeUnitsAdminPanel } from "@/components/admin/panels/FeeUnitsAdmin"
import { DealFeesAdminPanel } from "@/components/admin/panels/DealFeesAdmin"
// Phase Admin-A
import { KycPanel } from "@/components/admin/panels/KycPanel"
import { DisputesPanel } from "@/components/admin/panels/DisputesPanel"
import { FeeUnitsRequestsPanel } from "@/components/admin/panels/FeeUnitsRequestsPanel"
import { PaymentProofsPanel } from "@/components/admin/panels/PaymentProofsPanel"
import { CouncilAdminPanel } from "@/components/admin/panels/CouncilAdminPanel"
import { AuctionsAdminPanel } from "@/components/admin/panels/AuctionsAdminPanel"
// Phase Admin-B
import { AmbassadorsAdminPanel } from "@/components/admin/panels/AmbassadorsAdminPanel"
import { ContractsAdminPanel } from "@/components/admin/panels/ContractsAdminPanel"
import { NotificationsBroadcasterPanel } from "@/components/admin/panels/NotificationsBroadcasterPanel"
import { AuditLogPanel } from "@/components/admin/panels/AuditLogPanel"
import { SupportInboxPanel } from "@/components/admin/panels/SupportInboxPanel"
// Phase Social
import { HealthcareAdminPanel } from "@/components/admin/panels/HealthcareAdminPanel"
import { OrphansAdminPanel } from "@/components/admin/panels/OrphansAdminPanel"
import { DiscountsAdminPanel } from "@/components/admin/panels/DiscountsAdminPanel"
// Phase 13.2 — consolidated social-programs hub
import { SocialProgramsPanel } from "@/components/admin/panels/SocialPrograms"
// Phase Admin-Plus
import { CreateProjectPanel } from "@/components/admin/panels/CreateProjectPanel"
import { CreateCompanyPanel } from "@/components/admin/panels/CreateCompanyPanel"
import { ProjectWalletsPanel } from "@/components/admin/panels/ProjectWalletsPanel"
import { LegalPagesEditorPanel } from "@/components/admin/panels/LegalPagesEditorPanel"
import { AdminUsersPanel } from "@/components/admin/panels/AdminUsersPanel"
// Phase 14.07b — Phase Health MarketHealthPanel was mock-only
// (analyzeAllProjects against mock-data) and got deleted. A real
// DB-backed replacement will land in a later phase.
// Phase Levels
import { LevelSettingsPanel } from "@/components/admin/panels/LevelSettingsPanel"
import { UserStatsPanel } from "@/components/admin/panels/UserStatsPanel"
// Phase Invoices
import { InvoicesAdminPanel } from "@/components/admin/panels/InvoicesAdminPanel"
// Phase 9.4 — admin requests hub
import { AdminRequestsHubPanel } from "@/components/admin/panels/AdminRequestsHubPanel"
// Phase 11.01 — Phase 9.5 (ShareModificationPanel) removed entirely.
// Adding shares now happens via Project Wallets → "إضافة حصص للطرح".
// Phase 9.6 — user gifts
import { GiftsAdminPanel } from "@/components/admin/panels/GiftsAdminPanel"

export default function AdminPage() {
  const searchParams = useSearchParams()
  const tab = (searchParams?.get("tab") || "dashboard") as AdminTab

  const panels: Record<string, React.ReactNode> = {
    dashboard: <DashboardPanel />,
    // Phase 14.08.2 — monitor tab removed (panel deleted). Use the
    // App-Router page at /admin/engine-monitor instead.
    alerts: <AlertsPanel />,
    log: <LogPanel />,
    projects: <ProjectsPanel />,
    market: <MarketPanel />,
    shares: <SharesPanel />,
    fees: <FeesPanel />,
    users: <UsersPanel />,
    content_mgmt: <ContentPanel />,
    system: <SystemPanel />,
    // Phase 14.07b — market_settings_advanced + fee_config_advanced removed
    // (panels were mock-only). Legacy bookmarks now hit the unknown-tab
    // fallback below instead of seeing a fake "save successful" toast.
    market_state: <MarketStatePanel />,
    fee_units_admin: <FeeUnitsAdminPanel />,
    deal_fees_admin: <DealFeesAdminPanel />,
    // Phase Admin-A
    kyc: <KycPanel />,
    disputes: <DisputesPanel />,
    fee_units_requests: <FeeUnitsRequestsPanel />,
    payment_proofs: <PaymentProofsPanel />,
    council_admin: <CouncilAdminPanel />,
    auctions_admin: <AuctionsAdminPanel />,
    // Phase Admin-B
    ambassadors_admin: <AmbassadorsAdminPanel />,
    contracts_admin: <ContractsAdminPanel />,
    broadcaster: <NotificationsBroadcasterPanel />,
    audit_log: <AuditLogPanel />,
    support_inbox: <SupportInboxPanel />,
    // Phase Social
    healthcare_admin: <HealthcareAdminPanel />,
    orphans_admin: <OrphansAdminPanel />,
    discounts_admin: <DiscountsAdminPanel />,
    // Phase 13.2 — consolidated social-programs hub (replaces 4 sidebar entries)
    social_programs: <SocialProgramsPanel />,
    // Phase Admin-Plus
    create_project: <CreateProjectPanel />,
    create_company: <CreateCompanyPanel />,
    project_wallets: <ProjectWalletsPanel />,
    legal_editor: <LegalPagesEditorPanel />,
    admin_users: <AdminUsersPanel />,
    // Phase 14.07b — market_health entry removed (panel was mock-only).
    // Phase Levels
    level_settings: <LevelSettingsPanel />,
    user_stats: <UserStatsPanel />,
    // Phase Invoices
    invoices_admin: <InvoicesAdminPanel />,
    // Phase 9.4 — admin requests hub
    requests_hub: <AdminRequestsHubPanel />,
    // Phase 11.01 — Phase 9.5 (share_modification) entry removed.
    // Phase 9.6 — user gifts
    gifts_admin: <GiftsAdminPanel />,
  }

  if (panels[tab]) return <>{panels[tab]}</>

  return (
    <div className="p-6">
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-8 text-center">
        <div className="text-6xl mb-4">🚧</div>
        <div className="text-2xl font-bold text-white mb-2">قسم: {tab}</div>
        <div className="text-xs text-neutral-500">قسم غير معروف أو قيد التطوير</div>
      </div>
    </div>
  )
}
