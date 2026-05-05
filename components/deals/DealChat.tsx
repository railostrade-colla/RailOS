"use client"

/**
 * DealChat — chat between buyer + seller for a single deal.
 * Phase 10.63 wires the previously orphan `deal_messages` table.
 *
 * Drop into the deal detail page:
 *   <DealChat dealId={deal.id} />
 *
 * The component:
 *   • Loads existing messages via get_deal_messages RPC.
 *   • Subscribes to realtime INSERT on deal_messages filtered by deal_id.
 *   • Posts new messages via post_deal_message RPC (RLS-aware: only
 *     buyer + seller + admins can post).
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { Send, MessageCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  getDealMessages,
  postDealMessage,
  type DealMessage,
} from "@/lib/data/deal-messages"
import { showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

interface Props {
  dealId: string
  /** When provided, used to right-align the user's own bubbles. */
  currentUserId?: string | null
  /** Optional className for the outer card. */
  className?: string
}

export function DealChat({ dealId, currentUserId, className }: Props) {
  const [messages, setMessages] = useState<DealMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const rows = await getDealMessages(dealId)
    setMessages(rows)
    setLoading(false)
  }, [dealId])

  // Initial load + realtime subscription
  useEffect(() => {
    if (!dealId) return
    let cancelled = false

    refresh()

    const supabase = createClient()
    const channel = supabase
      .channel(`deal-chat:${dealId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "deal_messages",
          filter: `deal_id=eq.${dealId}`,
        },
        () => {
          if (!cancelled) refresh()
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [dealId, refresh])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text) return
    setSending(true)
    const result = await postDealMessage(dealId, text)
    setSending(false)
    if (!result.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        empty_message: "اكتب رسالة قبل الإرسال",
        deal_not_found: "الصفقة غير موجودة",
        not_party: "لست طرفاً في هذه الصفقة",
      }
      showError(map[result.error ?? ""] ?? "تعذّر إرسال الرسالة")
      return
    }
    setInput("")
    // Realtime will refresh automatically; refresh() also covers the
    // edge case where the channel hasn't fired yet.
    refresh()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={cn(
      "bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden",
      className,
    )}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-blue-400" strokeWidth={1.75} />
        <div className="text-sm text-white font-bold">دردشة الصفقة</div>
        {messages.length > 0 && (
          <span className="text-[10px] text-neutral-500 font-mono">
            ({messages.length})
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="max-h-80 overflow-y-auto px-4 py-3 space-y-2"
      >
        {loading ? (
          <div className="text-center py-6 text-xs text-neutral-500">
            جاري التحميل...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-6 text-xs text-neutral-500">
            لا رسائل بعد — ابدأ بالكتابة لتنسيق التفاصيل
          </div>
        ) : (
          messages.map((m) => {
            const isMe = currentUserId && m.sender_id === currentUserId
            return (
              <div
                key={m.id}
                className={cn(
                  "flex flex-col max-w-[85%] gap-0.5",
                  isMe ? "ml-auto items-end" : "mr-auto items-start",
                )}
              >
                <div className="text-[10px] text-neutral-500 px-1">
                  {isMe ? "أنت" : m.sender_name}
                  <span className="mx-1.5 text-neutral-700" dir="ltr">
                    {m.created_at.replace("T", " ").slice(0, 16)}
                  </span>
                </div>
                <div
                  className={cn(
                    "px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words",
                    isMe
                      ? "bg-blue-500/[0.15] border border-blue-500/[0.25] text-blue-100"
                      : "bg-white/[0.06] border border-white/[0.08] text-neutral-200",
                  )}
                >
                  {m.content || "—"}
                  {m.attachment_url && (
                    <a
                      href={m.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-[10px] text-blue-400 underline mt-1"
                      dir="ltr"
                    >
                      📎 مرفق
                    </a>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Composer */}
      <div className="px-3 py-2 border-t border-white/[0.06] flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="اكتب رسالة..."
          className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className={cn(
            "px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors",
            input.trim() && !sending
              ? "bg-blue-500/[0.15] border border-blue-500/[0.3] text-blue-300 hover:bg-blue-500/[0.2]"
              : "bg-white/[0.04] border border-white/[0.06] text-neutral-600 cursor-not-allowed",
          )}
        >
          <Send className="w-3.5 h-3.5" />
          إرسال
        </button>
      </div>
    </div>
  )
}
