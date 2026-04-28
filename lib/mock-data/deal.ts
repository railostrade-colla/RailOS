/**
 * /deal-chat/[id] — current deal being negotiated.
 */

import type { DealMock } from "./types"

export const mockDeal: DealMock = {
  id: "deal_123",
  project_name: "مزرعة الواحة",
  shares: 50,
  price_per_share: 95000,
  total: 4_750_000,
  buyer: { id: "me", name: "أنا" },
  seller: { id: "user1", name: "علي حسن" },
  expires_at: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
  status: "pending",
}

export const dealInitialMessages: Array<{
  id: string
  sender: string
  type: string
  content: string
  time: string
}> = [
  { id: "m1", sender: "system", type: "system", content: "🤝 تم فتح غرفة الصفقة. لديكم 15 دقيقة لإتمام الصفقة.", time: "الآن" },
  { id: "m2", sender: "user1", type: "text", content: "مرحبا! تأكيد على شراء 50 حصة بسعر 95,000؟", time: "14:25" },
]
