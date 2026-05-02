import { redirect } from "next/navigation"

/**
 * Legacy redirect — the old standalone quick-sell route was replaced
 * by the subscription-gated marketplace at /quick-sale.
 *
 * Kept here so old bookmarks/external links don't 404.
 */
export default function QuickSellLegacyPage() {
  redirect("/quick-sale")
}
