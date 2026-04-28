/**
 * /auctions — active auctions with countdowns.
 * /auctions/[id] — full details + bid history.
 *
 * NOTE: `ends_at` values are computed at module load time (offsets from "now").
 */

import type { Auction } from "./types"

// ──────────────────────────────────────────────────────────────────────────
// Detailed auction view (used by /auctions/[id])
// ──────────────────────────────────────────────────────────────────────────
export type AuctionStatus = "upcoming" | "active" | "ended"
export type AuctionType = "english" | "dutch"

export interface AuctionDetails {
  id: string
  project_id: string
  project_name: string
  company_name: string
  starting_price: number
  current_highest_bid: number
  bid_count: number
  shares_offered: number
  min_increment: number
  starts_at: string
  ends_at: string
  status: AuctionStatus
  type: AuctionType
}

export interface AuctionBid {
  id: string
  auction_id: string
  bidder_id: string
  bidder_name: string
  amount: number
  shares: number
  is_current_user?: boolean
  created_at: string
}

export const AUCTION_DETAILS: AuctionDetails[] = [
  {
    id: "1",
    project_id: "1",
    project_name: "مزرعة الواحة",
    company_name: "شركة الحقول الذهبية",
    starting_price: 80000,
    current_highest_bid: 92000,
    bid_count: 12,
    shares_offered: 50,
    min_increment: 1000,
    starts_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
    status: "active",
    type: "english",
  },
  {
    id: "2",
    project_id: "2",
    project_name: "برج بغداد",
    company_name: "عمار للإنشاءات",
    starting_price: 200000,
    current_highest_bid: 235000,
    bid_count: 8,
    shares_offered: 25,
    min_increment: 5000,
    starts_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    status: "active",
    type: "english",
  },
  {
    id: "3",
    project_id: "3",
    project_name: "مجمع الكرخ",
    company_name: "عمار للإنشاءات",
    starting_price: 140000,
    current_highest_bid: 162000,
    bid_count: 24,
    shares_offered: 100,
    min_increment: 2000,
    starts_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
    status: "active",
    type: "english",
  },
]

export const AUCTION_BIDS: AuctionBid[] = [
  // Auction 1 — مزرعة الواحة
  { id: "b1",  auction_id: "1", bidder_id: "u1",  bidder_name: "علي حسن",       amount: 92000, shares: 50, created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
  { id: "b2",  auction_id: "1", bidder_id: "me",  bidder_name: "أنت",          amount: 91000, shares: 50, is_current_user: true, created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
  { id: "b3",  auction_id: "1", bidder_id: "u3",  bidder_name: "سارة محمود",    amount: 90000, shares: 50, created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString() },
  { id: "b4",  auction_id: "1", bidder_id: "u2",  bidder_name: "محمد أحمد",     amount: 88500, shares: 50, created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString() },
  { id: "b5",  auction_id: "1", bidder_id: "u4",  bidder_name: "زين العبيدي",   amount: 87000, shares: 50, created_at: new Date(Date.now() - 18 * 60 * 1000).toISOString() },
  { id: "b6",  auction_id: "1", bidder_id: "u5",  bidder_name: "نور الدين",     amount: 85500, shares: 50, created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString() },
  { id: "b7",  auction_id: "1", bidder_id: "u1",  bidder_name: "علي حسن",       amount: 84000, shares: 50, created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString() },
  { id: "b8",  auction_id: "1", bidder_id: "u3",  bidder_name: "سارة محمود",    amount: 82500, shares: 50, created_at: new Date(Date.now() - 50 * 60 * 1000).toISOString() },
  { id: "b9",  auction_id: "1", bidder_id: "u2",  bidder_name: "محمد أحمد",     amount: 81000, shares: 50, created_at: new Date(Date.now() - 70 * 60 * 1000).toISOString() },
  { id: "b10", auction_id: "1", bidder_id: "u6",  bidder_name: "ياسمين كريم",   amount: 80500, shares: 50, created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString() },

  // Auction 2 — برج بغداد
  { id: "b11", auction_id: "2", bidder_id: "u4",  bidder_name: "زين العبيدي",   amount: 235000, shares: 25, created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  { id: "b12", auction_id: "2", bidder_id: "u1",  bidder_name: "علي حسن",       amount: 230000, shares: 25, created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
  { id: "b13", auction_id: "2", bidder_id: "me",  bidder_name: "أنت",          amount: 225000, shares: 25, is_current_user: true, created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString() },

  // Auction 3 — مجمع الكرخ
  { id: "b14", auction_id: "3", bidder_id: "u5",  bidder_name: "نور الدين",     amount: 162000, shares: 100, created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString() },
  { id: "b15", auction_id: "3", bidder_id: "u3",  bidder_name: "سارة محمود",    amount: 160000, shares: 100, created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString() },
]

export function getAuctionById(id: string): AuctionDetails | undefined {
  return AUCTION_DETAILS.find((a) => a.id === id)
}

export function getAuctionBids(auctionId: string, limit?: number): AuctionBid[] {
  const sorted = AUCTION_BIDS
    .filter((b) => b.auction_id === auctionId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  return limit ? sorted.slice(0, limit) : sorted
}

export function getCurrentHighestBid(auctionId: string): AuctionBid | undefined {
  return getAuctionBids(auctionId)[0]
}

export const mockAuctions: Auction[] = [
  {
    id: "1",
    title: "مزاد على حصص مزرعة الواحة",
    project: { name: "مزرعة الواحة" },
    shares: 50,
    opening_price: 80000,
    current_price: 92000,
    ends_at: new Date(Date.now() + 35 * 60 * 1000).toISOString(),     // 35 min — urgent
    bids_count: 12,
  },
  {
    id: "2",
    title: "مزاد على حصص برج بغداد",
    project: { name: "برج بغداد" },
    shares: 25,
    opening_price: 200000,
    current_price: 235000,
    ends_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours
    bids_count: 8,
  },
  {
    id: "3",
    title: "مزاد VIP على حصص الكرخ",
    project: { name: "مجمع الكرخ" },
    shares: 100,
    opening_price: 140000,
    current_price: 162000,
    ends_at: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),// 22 hours
    bids_count: 24,
  },
]
