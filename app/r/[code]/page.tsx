/**
 * /r/[code] — short referral redirect for ambassadors.
 *
 * The ambassador dashboard generates URLs like `/r/AMB-368b753d` via
 * `lib/data/ambassador.ts → buildReferralUrl`. This route resolves
 * the code and forwards the visitor to `/register?ref=CODE` (or to
 * `/dashboard` if they're already signed in — the
 * `link_referral_by_code` RPC fires from the register page or auth
 * callback when present).
 *
 * Server component — runs on the server, returns a 307 redirect
 * with no client JS needed.
 */

import { redirect } from "next/navigation"

interface Props {
  params: Promise<{ code: string }>
}

export default async function ReferralRedirectPage({ params }: Props) {
  const { code } = await params
  const safeCode = (code ?? "").replace(/[^a-zA-Z0-9_-]/g, "")
  if (!safeCode) {
    redirect("/register")
  }
  redirect(`/register?ref=${encodeURIComponent(safeCode)}`)
}

// Disable any caching so the redirect always reflects the current
// auth state of the visitor.
export const dynamic = "force-dynamic"
