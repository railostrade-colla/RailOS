"use client"

import { EntityFormPanel } from "./EntityFormPanel"

/**
 * Standalone Create Project page (URL: /admin?tab=create_project).
 * The unified form lives in EntityFormPanel — also used inline by Projects.tsx.
 */
export function CreateProjectPanel() {
  return <EntityFormPanel mode="create" entityType="project" />
}
