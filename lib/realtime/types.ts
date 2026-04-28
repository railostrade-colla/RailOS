export type DealStatus = "pending" | "accepted" | "rejected" | "cancelled" | "in_progress" | "completed" | "expired"

export interface PendingDeal {
  id: string
  buyer_id: string
  seller_id: string
  buyer_name: string
  seller_name: string
  project_id: string
  project_name: string
  shares: number
  price_per_share: number
  total: number
  status: DealStatus
  created_at: string
  expires_at?: string
}

export interface RealtimeNotification {
  id: string
  user_id: string
  type: "deal_request" | "deal_accepted" | "deal_rejected" | "deal_completed" | "message" | "system"
  title: string
  body: string
  link?: string
  read: boolean
  created_at: string
}
