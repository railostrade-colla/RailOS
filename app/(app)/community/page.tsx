"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Search, MessageCircle, UserPlus, UserMinus, X, Check, Handshake } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess, showError } from "@/lib/utils/toast"
import { createClient } from "@/lib/supabase/client"
// Chats DB schema isn't built yet — empty list until then.
const mockChats: Array<{
  id: string
  other: { name: string }
  time: string
  last_message: string
  unread: number
}> = []
import { getCommunityUsers, type CommunityUserRow } from "@/lib/data/community"
import {
  getMyFriends,
  getOutgoingPendingSet,
  getMyFriendRequests,
  sendFriendRequest,
  respondToFriendRequest,
  cancelFriendRequest,
  unfriend,
  markFriendAsPartner,
  type DBFriend,
  type DBFriendRequest,
} from "@/lib/data/friendships"
import { cn } from "@/lib/utils/cn"

type CommunityTab = "all" | "friends" | "requests" | "partners" | "chats"

const levelColor = (l: string) => l === "pro" ? "#fbbf5a" : l === "advanced" ? "#4ade9e" : "rgba(255,255,255,0.35)"
// level → i18n key (resolved via t() at the call site).
const levelKey = (l: string) => l === "pro" ? "lvlPro" : l === "advanced" ? "lvlAdvanced" : "lvlBasic"

export default function CommunityPage() {
  const router = useRouter()
  const t = useTranslations("community")
  const tc = useTranslations("common")
  const [tab, setTab] = useState<CommunityTab>("all")
  const [search, setSearch] = useState("")
  // Phase 13.53 — track full friend objects (including is_partner) so
  // the Partners tab + the per-card partner toggle don't need extra
  // round-trips.
  const [friends, setFriends] = useState<DBFriend[]>([])
  const [pendingOutgoing, setPendingOutgoing] = useState<Set<string>>(new Set())
  const [requests, setRequests] = useState<{ incoming: DBFriendRequest[]; outgoing: DBFriendRequest[] }>({
    incoming: [],
    outgoing: [],
  })
  const [selectedUser, setSelectedUser] = useState<CommunityUserRow | null>(null)

  // Phase 13.57 — confirmation state when user clicks "تم الإرسال"
  // on a card with a pending outgoing request. Clicking the chip
  // opens this modal; confirming calls cancel_friend_request.
  const [cancelTarget, setCancelTarget] = useState<{
    user: CommunityUserRow
    requestId: string
  } | null>(null)
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  // Real users from DB only (production mode).
  const [users, setUsers] = useState<CommunityUserRow[]>([])

  // Derived sets (memo-light — small list, cheap each render).
  const friendIds = new Set(friends.map((f) => f.user_id))
  const partnerIds = new Set(friends.filter((f) => f.is_partner).map((f) => f.user_id))

  // Phase 13.53 — refresh helper used by initial mount, mutations,
  // AND realtime subscription events. Fetches in parallel; each
  // setState fires independently so a slow query doesn't stall the UI.
  const refreshGraph = useCallback(async () => {
    const [friendsList, outIds, reqs] = await Promise.all([
      getMyFriends(),
      getOutgoingPendingSet(),
      getMyFriendRequests(),
    ])
    setFriends(friendsList)
    setPendingOutgoing(outIds)
    setRequests(reqs)
  }, [])

  // Initial paint + realtime subscription.
  // Phase 13.53 — subscribe to friend_requests + friendships so an
  // incoming request appears WITHOUT a manual refresh, and the
  // accepter / sender both see the new friendship instantly.
  useEffect(() => {
    let cancelled = false

    // Paint the community list immediately.
    getCommunityUsers(500).then((rows) => {
      if (cancelled) return
      setUsers(rows)
    })

    // First friend-graph load.
    refreshGraph()

    // Realtime subscription — debounce refetches to coalesce bursts
    // (multi-step accept = INSERT friendship + UPDATE request).
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (cancelled) return
        refreshGraph()
      }, 200)
    }

    const channel = supabase
      .channel("community:friend-graph")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        () => scheduleRefresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => scheduleRefresh(),
      )
      .subscribe()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel).catch(() => {})
    }
  }, [refreshGraph])

  const addFriend = async (id: string) => {
    // Optimistic
    setPendingOutgoing((prev) => new Set([...prev, id]))
    const result = await sendFriendRequest(id)
    if (!result.success) {
      // Roll back optimistic update
      setPendingOutgoing((prev) => {
        const s = new Set(prev)
        s.delete(id)
        return s
      })
      const map: Record<string, string> = {
        unauthenticated: t("loginFirst"),
        cannot_befriend_self: t("cannotSelf"),
        already_friends: t("alreadyFriends"),
        request_pending: t("requestPending"),
        missing_table: t("tablesNotPub"),
        rls: t("noPermission"),
      }
      showError(map[result.reason ?? ""] ?? t("sendFailed"))
      return
    }
    showSuccess(t("requestSent"))
    refreshGraph()
  }

  const removeFriend = async (id: string) => {
    const result = await unfriend(id)
    if (!result.success) {
      showError(t("removeFailed"))
      return
    }
    // Optimistic — realtime will reconcile within ~200ms.
    setFriends((prev) => prev.filter((f) => f.user_id !== id))
    showSuccess(t("removed"))
  }

  // Phase 13.53 — toggle the is_partner flag on a friendship.
  const togglePartner = async (otherUserId: string, makePartner: boolean) => {
    // Optimistic flip.
    setFriends((prev) =>
      prev.map((f) => (f.user_id === otherUserId ? { ...f, is_partner: makePartner } : f))
    )
    const result = await markFriendAsPartner(otherUserId, makePartner)
    if (!result.success) {
      // Roll back.
      setFriends((prev) =>
        prev.map((f) => (f.user_id === otherUserId ? { ...f, is_partner: !makePartner } : f))
      )
      const map: Record<string, string> = {
        unauthenticated: t("loginFirst"),
        invalid_user: t("invalidUser"),
        not_friends: t("notFriends"),
      }
      showError(map[result.reason ?? ""] ?? t("updateFailed"))
      return
    }
    showSuccess(makePartner ? t("addedPartner") : t("removedPartner"))
  }

  const handleAcceptRequest = async (requestId: string) => {
    const result = await respondToFriendRequest(requestId, true)
    if (!result.success) {
      showError(t("acceptFailed"))
      return
    }
    showSuccess(t("friendAdded"))
    refreshGraph()
  }

  const handleDeclineRequest = async (requestId: string) => {
    const result = await respondToFriendRequest(requestId, false)
    if (!result.success) {
      showError(t("declineFailed"))
      return
    }
    refreshGraph()
  }

  const handleCancelRequest = async (requestId: string) => {
    const result = await cancelFriendRequest(requestId)
    if (!result.success) {
      showError(t("cancelFailed"))
      return
    }
    refreshGraph()
  }

  // Phase 13.57 — open the cancel-confirmation modal when the user
  // clicks the "تم الإرسال" chip on a community card. We look up the
  // matching outgoing request by recipient_id; if it's gone (stale UI
  // race), we just clear the pending set so the card flips back to
  // "+ إضافة".
  const openCancelModal = (u: CommunityUserRow) => {
    const r = requests.outgoing.find((x) => x.recipient_id === u.id)
    if (!r) {
      setPendingOutgoing((prev) => {
        const s = new Set(prev)
        s.delete(u.id)
        return s
      })
      return
    }
    setCancelTarget({ user: u, requestId: r.id })
  }

  const confirmCancelRequest = async () => {
    if (!cancelTarget) return
    setCancelSubmitting(true)
    // Optimistic — clear pending immediately; realtime will reconcile.
    const userId = cancelTarget.user.id
    setPendingOutgoing((prev) => {
      const s = new Set(prev)
      s.delete(userId)
      return s
    })
    const result = await cancelFriendRequest(cancelTarget.requestId)
    setCancelSubmitting(false)
    if (!result.success) {
      // Roll back optimistic update.
      setPendingOutgoing((prev) => new Set([...prev, userId]))
      showError(t("cancelFailed"))
      return
    }
    showSuccess(t("requestCancelled"))
    setCancelTarget(null)
    refreshGraph()
  }

  const filteredUsers = users.filter((u) =>
    !search || u.name.toLowerCase().includes(search.toLowerCase())
  )

  // Phase 13.53 — friends tab shows confirmed friendships from DB.
  // Partners tab is the SUBSET marked is_partner=TRUE (no longer
  // a level-based filter).
  const friendsList = users.filter((u) => friendIds.has(u.id))
  const partnersList = users.filter((u) => partnerIds.has(u.id))

  const tabs: { key: CommunityTab; label: string; badge?: number }[] = [
    { key: "all", label: t("tabAll") },
    { key: "friends", label: t("tabFriends") },
    { key: "requests", label: t("tabRequests"), badge: requests.incoming.length },
    { key: "partners", label: t("tabPartners") },
    { key: "chats", label: t("tabChats") },
  ]

  const UserCard = ({ u, showActions = true }: { u: CommunityUserRow; showActions?: boolean }) => (
    <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3.5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSelectedUser(u)}
          className="w-11 h-11 rounded-full bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-base font-bold text-white flex-shrink-0"
        >
          {u.name.charAt(0)}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedUser(u)}
              className="text-sm font-bold text-white"
            >
              {u.name}
            </button>
            {u.is_verified && (
              <span className="bg-green-400/10 border border-green-400/20 text-green-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                ✓
              </span>
            )}
            <span
              className="px-1.5 py-0.5 rounded text-[9px] border"
              style={{
                color: levelColor(u.level),
                borderColor: `${levelColor(u.level)}30`,
              }}
            >
              {t(levelKey(u.level))}
            </span>
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">
            {t("userStats", { trades: u.total_trades, rate: u.success_rate, trust: u.trust_score })}
          </div>
        </div>
        {showActions && (
          <div className="flex gap-1.5 flex-wrap justify-end">
            {friendIds.has(u.id) ? (
              <>
                {/* Phase 13.53 — partner toggle for friends. Shows
                    a filled ✓ pill if already a partner. */}
                <button
                  onClick={() => togglePartner(u.id, !partnerIds.has(u.id))}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[10px] flex items-center gap-1 border",
                    partnerIds.has(u.id)
                      ? "bg-[#4ADE80]/[0.15] border-[#4ADE80]/[0.35] text-[#4ADE80]"
                      : "bg-white/[0.05] border-white/[0.12] text-neutral-300 hover:bg-white/[0.08]",
                  )}
                  title={partnerIds.has(u.id) ? t("removeFromPartners") : t("promoteToPartner")}
                >
                  <Handshake className="w-3 h-3" strokeWidth={2} />
                  {partnerIds.has(u.id) ? t("partnerYes") : t("partnerNo")}
                </button>
                <button
                  onClick={() => router.push(`/exchange?with=${u.id}&name=${encodeURIComponent(u.name)}`)}
                  className="bg-blue-400/[0.12] border border-blue-400/[0.25] text-blue-400 rounded-lg px-2.5 py-1.5 text-[10px] flex items-center gap-1"
                >
                  <MessageCircle className="w-3 h-3" strokeWidth={2} />
                  {t("chat")}
                </button>
                <button
                  onClick={() => removeFriend(u.id)}
                  className="bg-red-400/[0.1] border border-red-400/[0.18] text-red-400 rounded-lg px-2.5 py-1.5 text-[10px]"
                >
                  {t("remove")}
                </button>
              </>
            ) : pendingOutgoing.has(u.id) ? (
              // Phase 13.57 — clicking flips to the cancel-confirm modal.
              // Chip becomes red on hover to hint at the destructive action.
              <button
                onClick={() => openCancelModal(u)}
                className="group bg-yellow-400/[0.1] border border-yellow-400/[0.3] text-yellow-400 hover:bg-red-400/[0.12] hover:border-red-400/[0.3] hover:text-red-400 rounded-lg px-2.5 py-1.5 text-[10px] flex items-center gap-1 transition-colors"
                title={t("cancelReqTitle")}
              >
                <Check className="w-3 h-3 group-hover:hidden" strokeWidth={2.5} />
                <X className="w-3 h-3 hidden group-hover:inline" strokeWidth={2.5} />
                <span className="group-hover:hidden">{t("sent")}</span>
                <span className="hidden group-hover:inline">{t("cancelReq")}</span>
              </button>
            ) : (
              <button
                onClick={() => addFriend(u.id)}
                className="bg-white/[0.08] border border-white/[0.12] text-white rounded-lg px-2.5 py-1.5 text-[10px]"
              >
                {t("addBtn")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            title={t("title")}
            /* Phase A T4 — registered-users count hidden temporarily.
               Early on the number is small and reads badly; show the
               count-free generic subtitle until we cross ~1000 users.
               TODO: restore the dynamic count when ready:
               subtitle={users.length > 0
                 ? t("subtitle", { n: users.length.toLocaleString("en-US") })
                 : t("subtitleEmpty")} */
            subtitle={t("subtitleEmpty")}
            showBack={false}
          />

          {/* Tabs */}
          <div className="flex gap-1 bg-white/[0.05] border border-white/[0.08] rounded-xl p-1 mb-4">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1",
                  tab === tb.key
                    ? "bg-white/[0.08] text-white font-bold border border-white/[0.1]"
                    : "text-neutral-500 hover:text-white"
                )}
              >
                <span>{tb.label}</span>
                {tb.badge !== undefined && tb.badge > 0 && (
                  <span className="bg-red-400 text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {tb.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search (للـ all فقط) */}
          {tab === "all" && (
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
              />
            </div>
          )}

          {/* All Tab */}
          {tab === "all" && (
            filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-sm text-neutral-500">{t("noResults")}</div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((u) => <UserCard key={u.id} u={u} />)}
              </div>
            )
          )}

          {/* Friends Tab */}
          {tab === "friends" && (
            friendsList.length === 0 ? (
              <div className="text-center py-12">
                <UserPlus className="w-12 h-12 text-neutral-600 mx-auto mb-3" strokeWidth={1.5} />
                <div className="text-sm font-bold text-white mb-1">{t("noFriends")}</div>
                <div className="text-xs text-neutral-500">{t("noFriendsHint")}</div>
              </div>
            ) : (
              <div className="space-y-2">
                {friendsList.map((u) => <UserCard key={u.id} u={u} />)}
              </div>
            )
          )}

          {/* Requests Tab */}
          {tab === "requests" && (
            <div className="space-y-4">
              {/* Incoming */}
              <div>
                <div className="text-xs text-neutral-400 font-bold mb-2 px-1">
                  {t("incoming", { n: requests.incoming.length })}
                </div>
                {requests.incoming.length === 0 ? (
                  <div className="text-center py-6 text-xs text-neutral-500">{t("noIncoming")}</div>
                ) : (
                  <div className="space-y-2">
                    {requests.incoming.map((r) => (
                      <div key={r.id} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3.5 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-base font-bold text-white flex-shrink-0">
                          {r.other_user_avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white">{r.other_user_name}</div>
                          {r.message && <div className="text-[10px] text-neutral-500 truncate mt-0.5">{r.message}</div>}
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleAcceptRequest(r.id)}
                            className="bg-green-400/[0.12] border border-green-400/[0.25] text-green-400 rounded-lg px-2.5 py-1.5 text-[10px] flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" strokeWidth={2.5} />
                            {t("accept")}
                          </button>
                          <button
                            onClick={() => handleDeclineRequest(r.id)}
                            className="bg-red-400/[0.1] border border-red-400/[0.18] text-red-400 rounded-lg px-2.5 py-1.5 text-[10px]"
                          >
                            {t("decline")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outgoing */}
              <div>
                <div className="text-xs text-neutral-400 font-bold mb-2 px-1">
                  {t("outgoing", { n: requests.outgoing.length })}
                </div>
                {requests.outgoing.length === 0 ? (
                  <div className="text-center py-6 text-xs text-neutral-500">{t("noOutgoing")}</div>
                ) : (
                  <div className="space-y-2">
                    {requests.outgoing.map((r) => (
                      <div key={r.id} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3.5 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-base font-bold text-white flex-shrink-0">
                          {r.other_user_avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white">{r.other_user_name}</div>
                          <div className="text-[10px] text-yellow-400 mt-0.5">{t("pending")}</div>
                        </div>
                        <button
                          onClick={() => handleCancelRequest(r.id)}
                          className="bg-white/[0.05] border border-white/[0.1] text-neutral-400 rounded-lg px-2.5 py-1.5 text-[10px]"
                        >
                          {tc("buttons.cancel")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Partners Tab */}
          {tab === "partners" && (
            partnersList.length === 0 ? (
              <div className="text-center py-12">
                <Handshake className="w-12 h-12 text-neutral-600 mx-auto mb-3" strokeWidth={1.5} />
                <div className="text-sm font-bold text-white mb-1">{t("noPartners")}</div>
                <div className="text-xs text-neutral-500">{t("noPartnersHint")}</div>
              </div>
            ) : (
              <div className="space-y-2">
                {partnersList.map((u) => <UserCard key={u.id} u={u} />)}
              </div>
            )
          )}

          {/* Chats Tab */}
          {tab === "chats" && (
            mockChats.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 text-neutral-600 mx-auto mb-3" strokeWidth={1.5} />
                <div className="text-sm font-bold text-white mb-1">{t("noChats")}</div>
                <div className="text-xs text-neutral-500">{t("noChatsHint")}</div>
              </div>
            ) : (
              <div className="space-y-2">
                {mockChats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => router.push(`/chat/${c.id}`)}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl p-3.5 hover:bg-white/[0.07] transition-colors flex items-center gap-3 text-right"
                  >
                    <div className="w-11 h-11 rounded-full bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-base font-bold text-white flex-shrink-0">
                      {c.other.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-white truncate">{c.other.name}</span>
                        <span className="text-[10px] text-neutral-500 flex-shrink-0">{c.time}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-neutral-400 truncate">{c.last_message}</span>
                        {c.unread > 0 && (
                          <span className="bg-blue-400 text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                            {c.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

        </div>
      </div>

      {/* User profile modal */}
      {/* Phase 13.57 — confirm cancel of outgoing friend request */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-red-400/[0.3] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <UserMinus className="w-5 h-5 text-red-400" />
                <div className="text-base font-bold text-white">{t("cancelModalTitle")}</div>
              </div>
              <button
                onClick={() => setCancelTarget(null)}
                disabled={cancelSubmitting}
                className="text-neutral-500 hover:text-white disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-xl p-3 mb-4 text-xs text-red-300 leading-relaxed">
              {t("cancelConfirmPre")}
              <span className="font-bold text-white">{cancelTarget.user.name}</span>{t("cancelConfirmPost")}
              <span className="block mt-1 text-red-300/80 text-[11px]">
                {t("cancelNote")}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={cancelSubmitting}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                {t("undo")}
              </button>
              <button
                onClick={confirmCancelRequest}
                disabled={cancelSubmitting}
                className="flex-1 py-3 rounded-xl bg-red-500/[0.15] border border-red-500/[0.3] text-red-400 text-sm font-bold hover:bg-red-500/[0.2] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelSubmitting ? t("working") : t("yesCancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-white/[0.08] border-2 border-white/[0.1] flex items-center justify-center text-2xl font-bold text-white">
                  {selectedUser.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg font-bold text-white">{selectedUser.name}</span>
                    {selectedUser.is_verified && (
                      <span className="bg-green-400/10 border border-green-400/20 text-green-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        ✓
                      </span>
                    )}
                  </div>
                  <span
                    className="text-xs"
                    style={{ color: levelColor(selectedUser.level) }}
                  >
                    {t(levelKey(selectedUser.level))}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { label: t("sTrades"), value: selectedUser.total_trades },
                { label: t("sSuccess"), value: `${selectedUser.success_rate}%` },
                { label: t("sTrust"), value: selectedUser.trust_score },
              ].map((s, i) => (
                <div key={i} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 text-center">
                  <div className="text-base font-bold text-white">{s.value}</div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            {friendIds.has(selectedUser.id) ? (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    router.push(`/exchange?with=${selectedUser.id}&name=${encodeURIComponent(selectedUser.name)}`)
                    setSelectedUser(null)
                  }}
                  className="flex-1 py-3 rounded-xl bg-blue-400/[0.12] border border-blue-400/[0.25] text-blue-400 text-sm font-bold flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  {t("chat")}
                </button>
                <button
                  onClick={() => {
                    removeFriend(selectedUser.id)
                    setSelectedUser(null)
                  }}
                  className="flex-1 py-3 rounded-xl bg-red-400/[0.12] border border-red-400/[0.22] text-red-400 text-sm font-bold flex items-center justify-center gap-2"
                >
                  <UserMinus className="w-4 h-4" />
                  {t("remove")}
                </button>
              </div>
            ) : pendingOutgoing.has(selectedUser.id) ? (
              // Phase 13.57 — same clickable cancel-request flow as the
              // card chips; closes the profile modal first so both
              // modals don't stack.
              <button
                onClick={() => {
                  const target = selectedUser
                  setSelectedUser(null)
                  openCancelModal(target)
                }}
                className="w-full py-3 rounded-xl bg-yellow-400/[0.1] border border-yellow-400/[0.3] text-yellow-400 hover:bg-red-400/[0.12] hover:border-red-400/[0.3] hover:text-red-400 text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                <UserMinus className="w-4 h-4" />
                {t("reqSentClickCancel")}
              </button>
            ) : (
              <button
                onClick={() => {
                  addFriend(selectedUser.id)
                  setSelectedUser(null)
                }}
                className="w-full py-3 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                {t("addFriendBtn")}
              </button>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  )
}
