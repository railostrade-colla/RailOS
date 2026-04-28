"use client"

import { EntityFormPanel } from "./EntityFormPanel"

/**
 * Standalone Create Company page (URL: /admin?tab=create_company).
 * Companies have tradable shares + auto-created wallet, identical structure
 * to projects. The unified form lives in EntityFormPanel.
 */
export function CreateCompanyPanel() {
  return <EntityFormPanel mode="create" entityType="company" />
}
