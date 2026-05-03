"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, MessageCircle, UserPlus, UserMinus, X, Check } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess, showError } from "@/lib/utils/toast"
import { mockUsers, mockChats } from "@/lib/mock-data"
import { getCommunityUsers, type CommunityUserRow } from "@/lib/data/community"
import {
  getFriendIdSet,
  getOutgoingPendingSet,
  getMyFriendRequests,
  sendFriendRequest,
  respondToFriendRequest,
  cancelFriendRequest,
  unfriend,
  type DBFriendRequest,
} from "@/lib/data/friendships"
import { cn } from "@/lib/utils/cn"

type CommunityTab = "all" | "friends" | "requests" | "partners" | "chats"

const levelColor = (l: string) => l === "pro" ? "#fbbf5a" : l === "advanced" ? "#4ade9e" : "rgba(255,255,255,0.35)"
const levelLabel = (l: string) => l === "pro" ? "محترف" : l === "advanced" ? "متقدم" : "أساسي"

export default function CommunityPage() {
  const router = useRouter()
  const [tab, setTab] = useState<CommunityTab>("all")
  const [search, setSearch] = useState("")
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set())
  const [pendingOutgoing, setPendingOutgoing] = useState<Set<string>>(new Set())
  const [requests, setRequests] = useState<{ incoming: DBFriendRequest[]; outgoing: DBFriendRequest[] }>({
    incoming: [],
    outgoing: [],
  })
  const [selectedUser, setSelectedUser] = useState<CommunityUserRow | null>(null)

  // Real users from DB with mock fallback so the layout never blanks.
  const [users, setUsers] = useState<CommunityUserRow[]>(mockUsers)

  // Pull users + friend graph in parallel.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      getCommunityUsers(50),
      getFriendIdSet(),
      getOutgoingPendingSet(),
      getMyFriendRequests(),
    ]).then(([rows, fIds, outIds, reqs]) => {
      if (cancelled) return
      if (rows.length > 0) setUsers(rows)
      setFriendIds(fIds)
      setPendingOutgoing(outIds)
      setRequests(reqs)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const refreshGraph = async () => {
    const [fIds, outIds, reqs] = await Promise.all([
      getFriendIdSet(),
      getOutgoingPendingSet(),
      getMyFriendRequests(),
    ])
    setFriendIds(fIds)
    setPendingOutgoing(outIds)
    setRequests(reqs)
  }

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
        unauthenticated: "سجّل دخولك أولاً",
        cannot_befriend_self: "لا يمكن إضافة نفسك",
        already_friends: "أنتما أصدقاء بالفعل",
        request_pending: "هناك طلب قيد الانتظار",
        missing_table: "الجداول غير منشورة بعد",
        rls: "صلاحياتك لا تسمح بذلك",
      }
      showError(map[result.reason ?? ""] ?? "فشل إرسال الطلب")
      return
    }
    showSuccess("تم إرسال طلب الصداقة")
    refreshGraph()
  }

  const removeFriend = async (id: string) => {
    const result = await unfriend(id)
    if (!result.success) {
      showError("فشلت إزالة الصديق")
      return
    }
    setFriendIds((prev) => {
      const s = new Set(prev)
      s.delete(id)
      return s
    })
    showSuccess("تمت إزالة الصديق")
  }

  const handleAcceptRequest = async (requestId: string) => {
    const result = await respondToFriendRequest(requestId, true)
    if (!result.success) {
      showError("فشل قبول الطلب")
      return
    }
    showSuccess("تمت إضافة الصديق")
    refreshGraph()
  }

  const handleDeclineRequest = async (requestId: string) => {
    const result = await respondToFriendRequest(requestId, false)
    if (!result.success) {
      showError("فشل رفض الطلب")
      return
    }
    refreshGraph()
  }

  const handleCancelRequest = async (requestId: string) => {
    const result = await cancelFriendRequest(requestId)
    if (!result.success) {
      showError("فشل إلغاء الطلب")
      return
    }
    refreshGraph()
  }

  const filteredUsers = users.filter((u) =>
    !search || u.name.toLowerCase().includes(search.toLowerCase())
  )

  const friends = users.filter((u) => friendIds.has(u.id))
  const partners = users.filter((u) => u.level === "pro" || u.level === "advanced")

  const tabs: { key: CommunityTab; label: string; badge?: number }[] = [
    { key: "all", label: "المجتمع" },
    { key: "friends", label: "الأصدقاء" },
    { key: "requests", label: "الطلبات", badge: requests.incoming.length },
    { key: "partners", label: "الشركاء" },
    { key: "chats", label: "الدردشة" },
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
              {levelLabel(u.level)}
            </span>
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">
            {u.total_trades} صفقة • {u.success_rate}% نجاح • ثقة: {u.trust_score}
          </div>
        </div>
        {showActions && (
          <div className="flex gap-1.5">
            {friendIds.has(u.id) ? (
              <>
                <button
                  onClick={() => router.push(`/exchange?with=${u.id}&name=${encodeURIComponent(u.name)}`)}
                  className="bg-blue-400/[0.12] border border-blue-400/[0.25] text-blue-400 rounded-lg px-2.5 py-1.5 text-[10px] flex items-center gap-1"
                >
                  <MessageCircle className="w-3 h-3" strokeWidth={2} />
                  دردشة
                </button>
                <button
                  onClick={() => removeFriend(u.id)}
                  className="bg-red-400/[0.1] border border-red-400/[0.18] text-red-400 rounded-lg px-2.5 py-1.5 text-[10px]"
                >
                  إزالة
                </button>
              </>
            ) : pendingOutgoing.has(u.id) ? (
              <button
                disabled
                className="bg-yellow-400/[0.08] border border-yellow-400/[0.2] text-yellow-400 rounded-lg px-2.5 py-1.5 text-[10px] cursor-not-allowed"
              >
                طلب مرسل
              </button>
            ) : (
              <button
                onClick={() => addFriend(u.id)}
                className="bg-white/[0.08] border border-white/[0.12] text-white rounded-lg px-2.5 py-1.5 text-[10px]"
              >
                + إضافة
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
            title="المجتمع"
            subtitle="مستثمرون · أصدقاء · شركاء · دردشات"
            showBack={false}
          />

          {/* Tabs */}
          <div className="flex gap-1 bg-white/[0.05] border border-white/[0.08] rounded-xl p-1 mb-4">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1",
                  tab === t.key
                    ? "bg-white/[0.08] text-white font-bold border border-white/[0.1]"
                    : "text-neutral-500 hover:text-white"
                )}
              >
                <span>{t.label}</span>
                {t.badge !== undefined && t.badge > 0 && (
                  <span className="bg-red-400 text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {t.badge}
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
                placeholder="ابحث عن مستثمر..."
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
              />
            </div>
          )}

          {/* All Tab */}
          {tab === "all" && (
            filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-sm text-neutral-500">لا توجد نتائج</div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((u) => <UserCard key={u.id} u={u} />)}
              </div>
            )
          )}

          {/* Friends Tab */}
          {tab === "friends" && (
            friends.length === 0 ? (
              <div className="text-center py-12">
                <UserPlus className="w-12 h-12 text-neutral-600 mx-auto mb-3" strokeWidth={1.5} />
                <div className="text-sm font-bold text-white mb-1">لا يوجد أصدقاء بعد</div>
                <div className="text-xs text-neutral-500">أضف أصدقاء من المجتمع لتسهيل الصفقات</div>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((u) => <UserCard key={u.id} u={u} />)}
              </div>
            )
          )}

          {/* Requests Tab */}
          {tab === "requests" && (
            <div className="space-y-4">
              {/* Incoming */}
              <div>
                <div className="text-xs text-neutral-400 font-bold mb-2 px-1">
                  واردة ({requests.incoming.length})
                </div>
                {requests.incoming.length === 0 ? (
                  <div className="text-center py-6 text-xs text-neutral-500">لا توجد طلبات واردة</div>
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
                            قبول
                          </button>
                          <button
                            onClick={() => handleDeclineRequest(r.id)}
                            className="bg-red-400/[0.1] border border-red-400/[0.18] text-red-400 rounded-lg px-2.5 py-1.5 text-[10px]"
                          >
                            رفض
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
                  صادرة ({requests.outgoing.length})
                </div>
                {requests.outgoing.length === 0 ? (
                  <div className="text-center py-6 text-xs text-neutral-500">لا توجد طلبات صادرة</div>
                ) : (
                  <div className="space-y-2">
                    {requests.outgoing.map((r) => (
                      <div key={r.id} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3.5 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-base font-bold text-white flex-shrink-0">
                          {r.other_user_avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white">{r.other_user_name}</div>
                          <div className="text-[10px] text-yellow-400 mt-0.5">قيد الانتظار</div>
                        </div>
                        <button
                          onClick={() => handleCancelRequest(r.id)}
                          className="bg-white/[0.05] border border-white/[0.1] text-neutral-400 rounded-lg px-2.5 py-1.5 text-[10px]"
                        >
                          إلغاء
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
            partners.length === 0 ? (
              <div className="text-center py-12 text-sm text-neutral-500">لا يوجد شركاء بعد</div>
            ) : (
              <div className="space-y-2">
                {partners.map((u) => <UserCard key={u.id} u={u} />)}
              </div>
            )
          )}

          {/* Chats Tab */}
          {tab === "chats" && (
            mockChats.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 text-neutral-600 mx-auto mb-3" strokeWidth={1.5} />
                <div className="text-sm font-bold text-white mb-1">لا توجد دردشات</div>
                <div className="text-xs text-neutral-500">ابدأ دردشة مع صديق</div>
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
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-t-3xl lg:rounded-2xl p-6 w-full max-w-md">
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
                    {levelLabel(selectedUser.level)}
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
                { label: "الصفقات", value: selectedUser.total_trades },
                { label: "النجاح", value: `${selectedUser.success_rate}%` },
                { label: "الثقة", value: selectedUser.trust_score },
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
                  دردشة
                </button>
                <button
                  onClick={() => {
                    removeFriend(selectedUser.id)
                    setSelectedUser(null)
                  }}
                  className="flex-1 py-3 rounded-xl bg-red-400/[0.12] border border-red-400/[0.22] text-red-400 text-sm font-bold flex items-center justify-center gap-2"
                >
                  <UserMinus className="w-4 h-4" />
                  إزالة
                </button>
              </div>
            ) : pendingOutgoing.has(selectedUser.id) ? (
              <button
                disabled
                className="w-full py-3 rounded-xl bg-yellow-400/[0.08] border border-yellow-400/[0.2] text-yellow-400 text-sm font-bold cursor-not-allowed"
              >
                طلب الصداقة مرسل
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
                إضافة صديق
              </button>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  )
}
