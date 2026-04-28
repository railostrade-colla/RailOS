/**
 * /following — user's followed projects + companies.
 */

import type { CompanyCardData, ProjectCardData } from "@/components/cards"
import { ALL_PROJECTS } from "./projects"
import { ALL_COMPANIES } from "./companies"

export interface FollowedItem {
  id: string
  user_id: string
  type: "project" | "company"
  item_id: string
  followed_at: string
}

export const FOLLOWED_ITEMS: FollowedItem[] = [
  { id: "f1", user_id: "me", type: "project", item_id: "1", followed_at: "2026-04-10" },
  { id: "f2", user_id: "me", type: "project", item_id: "2", followed_at: "2026-04-15" },
  { id: "f3", user_id: "me", type: "project", item_id: "5", followed_at: "2026-04-20" },
  { id: "f4", user_id: "me", type: "company",  item_id: "c1", followed_at: "2026-04-12" },
  { id: "f5", user_id: "me", type: "company",  item_id: "c2", followed_at: "2026-04-18" },
]

export function getFollowedProjects(userId: string = "me"): ProjectCardData[] {
  const ids = FOLLOWED_ITEMS
    .filter((f) => f.user_id === userId && f.type === "project")
    .map((f) => f.item_id)
  return ALL_PROJECTS.filter((p) => ids.includes(p.id))
}

export function getFollowedCompanies(userId: string = "me"): CompanyCardData[] {
  const ids = FOLLOWED_ITEMS
    .filter((f) => f.user_id === userId && f.type === "company")
    .map((f) => f.item_id)
  return ALL_COMPANIES.filter((c) => ids.includes(c.id))
}

export function getFollowingStats(userId: string = "me") {
  const projects = getFollowedProjects(userId).length
  const companies = getFollowedCompanies(userId).length
  return { total: projects + companies, projects, companies }
}

export function unfollowItem(
  _userId: string,
  _type: "project" | "company",
  _itemId: string,
): { success: boolean } {
  return { success: true }
}
