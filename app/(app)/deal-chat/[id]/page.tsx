"use client"

/**
 * /deal-chat/[id] — Phase 14.07.1.
 *
 * The legacy page at this route was 398 lines of pure mock — fake
 * deal, fake messages, hardcoded role="buyer", and "Accept / Pay /
 * Release Shares" buttons that updated nothing but local React
 * state. It silently misled anyone landing here.
 *
 * The real chat now lives inside /deals/[id] (Phase 10.63's
 * <DealChat> component, backed by lib/data/deal-messages.ts and
 * Realtime). Old bookmarks / push notifications that point at
 * /deal-chat/[id] are forwarded transparently.
 */

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"

export default function DealChatRedirect() {
  const router = useRouter()
  const params = useParams()
  const dealId = params?.id as string | undefined

  useEffect(() => {
    if (dealId) {
      router.replace(`/deals/${dealId}`)
    } else {
      router.replace("/deals")
    }
  }, [router, dealId])

  return null
}
