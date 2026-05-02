"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, MessageCircle, UserPlus, UserMinus, X } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess } from "@/lib/utils/toast"
import { mockUsers, mockChats } from "@/lib/mock-data"
import { cn } from "@/lib/utils/cn"

type CommunityTab = "all" | "friends" | "partners" | "chats"

const levelColor = (l: string) => l === "pro" ? "#fbbf5a" : l === "advanced" ? "#4ade9e" : "rgba(255,255,255,0.35)"
const levelLabel = (l: string) => l === "pro" ? "محترف" : l === "advanced" ? "متقدم" : "أساسي"

export default function CommunityPage() {
  const router = useRouter()
  const [tab, setTab] = useState<CommunityTab>("all")
  const [search, setSearch] = useState("")
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set(["1", "2", "5"]))
  const [selectedUser, setSelectedUser] = useState<typeof mockUsers[0] | null>(null)

  const addFriend = (id: string) => {
    setFriendIds((prev) => new Set([...prev, id]))
    showSuccess("تمت إضافة الصديق")
  }

  const removeFriend = (id: string) => {
    setFriendIds((prev) => {
      const s = new Set(prev)
      s.delete(id)
      return s
    })
    showSuccess("تمت إزالة الصديق")
  }

  const filteredUsers = mockUsers.filter((u) =>
    !search || u.name.toLowerCase().includes(search.toLowerCase())
  )

  const friends = mockUsers.filter((u) => friendIds.has(u.id))
  const partners = mockUsers.filter((u) => u.level === "pro" || u.level === "advanced")

  const tabs: { key: CommunityTab; label: string }[] = [
    { key: "all", label: "المجتمع" },
    { key: "friends", label: "الأصدقاء" },
    { key: "partners", label: "الشركاء" },
    { key: "chats", label: "الدردشة" },
  ]

  const UserCard = ({ u, showActions = true }: { u: typeof mockUsers[0]; showActions?: boolean }) => (
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
                  "flex-1 py-2 rounded-lg text-[11px] transition-colors",
                  tab === t.key
                    ? "bg-white/[0.08] text-white font-bold border border-white/[0.1]"
                    : "text-neutral-500 hover:text-white"
                )}
              >
                {t.label}
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
