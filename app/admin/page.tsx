"use client"

import { useSearchParams } from "next/navigation"
import { type AdminTab } from "@/lib/admin/types"
import { DashboardPanel } from "@/components/admin/panels/Dashboard"
import { MonitorPanel } from "@/components/admin/panels/Monitor"
import { AlertsPanel } from "@/components/admin/panels/Alerts"
import { LogPanel } from "@/components/admin/panels/Log"
import { ProjectsPanel } from "@/components/admin/panels/Projects"
import { MarketPanel } from "@/components/admin/panels/Market"
import { SharesPanel } from "@/components/admin/panels/Shares"
import { FeesPanel } from "@/components/admin/panels/Fees"
import { UsersPanel } from "@/components/admin/panels/Users"
import { ContentPanel } from "@/components/admin/panels/Content"
import { SystemPanel } from "@/components/admin/panels/System"
import { MarketSettingsAdvancedPanel } from "@/components/admin/panels/MarketSettings"
import { MarketStatePanel } from "@/components/admin/panels/MarketState"
import { FeeConfigAdvancedPanel } from "@/components/admin/panels/FeeConfig"
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
// Phase Admin-Plus
import { CreateProjectPanel } from "@/components/admin/panels/CreateProjectPanel"
import { CreateCompanyPanel } from "@/components/admin/panels/CreateCompanyPanel"
import { ProjectWalletsPanel } from "@/components/admin/panels/ProjectWalletsPanel"
import { LegalPagesEditorPanel } from "@/components/admin/panels/LegalPagesEditorPanel"
import { AdminUsersPanel } from "@/components/admin/panels/AdminUsersPanel"
// Phase Health
import { MarketHealthPanel } from "@/components/admin/panels/MarketHealthPanel"
// Phase Levels
import { LevelSettingsPanel } from "@/components/admin/panels/LevelSettingsPanel"
import { UserStatsPanel } from "@/components/admin/panels/UserStatsPanel"
// Phase Invoices
import { InvoicesAdminPanel } from "@/components/admin/panels/InvoicesAdminPanel"
// Phase 9.4 — admin requests hub
import { AdminRequestsHubPanel } from "@/components/admin/panels/AdminRequestsHubPanel"

export default function AdminPage() {
  const searchParams = useSearchParams()
  const tab = (searchParams?.get("tab") || "dashboard") as AdminTab

  const panels: Record<string, React.ReactNode> = {
    dashboard: <DashboardPanel />,
    monitor: <MonitorPanel />,
    alerts: <AlertsPanel />,
    log: <LogPanel />,
    projects: <ProjectsPanel />,
    market: <MarketPanel />,
    shares: <SharesPanel />,
    fees: <FeesPanel />,
    users: <UsersPanel />,
    content_mgmt: <ContentPanel />,
    system: <SystemPanel />,
    market_settings_advanced: <MarketSettingsAdvancedPanel />,
    market_state: <MarketStatePanel />,
    fee_config_advanced: <FeeConfigAdvancedPanel />,
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
    // Phase Admin-Plus
    create_project: <CreateProjectPanel />,
    create_company: <CreateCompanyPanel />,
    project_wallets: <ProjectWalletsPanel />,
    legal_editor: <LegalPagesEditorPanel />,
    admin_users: <AdminUsersPanel />,
    // Phase Health
    market_health: <MarketHealthPanel />,
    // Phase Levels
    level_settings: <LevelSettingsPanel />,
    user_stats: <UserStatsPanel />,
    // Phase Invoices
    invoices_admin: <InvoicesAdminPanel />,
    // Phase 9.4 — admin requests hub
    requests_hub: <AdminRequestsHubPanel />,
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
