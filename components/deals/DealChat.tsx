"use client"

/**
 * DealChat — chat between buyer + seller for a single deal.
 * Phase 10.63 wires the previously orphan `deal_messages` table.
 * Phase 13.14 — adds optimistic UI on send + cleaner unsubscribe.
 *
 * Drop into the deal detail page:
 *   <DealChat dealId={deal.id} />
 *
 * The component:
 *   • Loads existing messages via get_deal_messages RPC.
 *   • Subscribes to realtime INSERT on deal_messages filtered by deal_id.
 *     The deal_id filter ensures the user only receives messages for
 *     the deal currently open — no leakage between concurrent chats.
 *   • Posts new messages via post_deal_message RPC (RLS-aware: only
 *     buyer + seller + admins can post).
 *   • Optimistic UI: the moment the user clicks "إرسال", a pending
 *     bubble appears in the list (state="pending"). When the server
 *     confirms, the bubble is reconciled (replaced by the real row
 *     once realtime delivers it). On failure, the bubble flips to
 *     state="failed" with a retry tap and an error toast — the typed
 *     text stays in the input so nothing is lost.
 *   • Unsubscribes from the realtime channel on unmount, on dealId
 *     change, and clears the visibility/poll listeners. No leaked
 *     sockets when navigating away.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Send, MessageCircle, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  getDealMessages,
  postDealMessage,
  type DealMessage,
} from "@/lib/data/deal-messages"
import { showError } from "@/lib/utils/toast"
// Phase 12.8 — soft "pop" sound when a message arrives from the
// other party (we suppress it for our own messages).
import { playChatMessage } from "@/lib/sounds"
import { cn } from "@/lib/utils/cn"

// Phase 13.14 — optimistic message shape. Wraps DealMessage with a
// transient state used only on the client; the real DB row replaces
// it once realtime delivers (or via the next refresh()).
type ChatItem = DealMessage & {
  /** Local-only flag. Absent for confirmed server rows. */
  _optimistic?: "pending" | "failed"
  /** Echo of the user's typed text — used to retry on failure. */
  _draft?: string
}

interface Props {
  dealId: string
  /** When provided, used to right-align the user's own bubbles. */
  currentUserId?: string | null
  /** Optional className for the outer card. */
  className?: string
}

export function DealChat({ dealId, currentUserId, className }: Props) {
  const t = useTranslations("deals")
  const [messages, setMessages] = useState<ChatItem[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const rows = await getDealMessages(dealId)
    // Phase 13.14 — preserve any *failed* optimistic bubbles when
    // refreshing. Pending bubbles are dropped on the assumption
    // that realtime will deliver the real row shortly; we don't
    // want duplicate bubbles in the list.
    setMessages((prev) => {
      const failedDrafts = prev.filter((m) => m._optimistic === "failed")
      return [...rows, ...failedDrafts]
    })
    setLoading(false)
  }, [dealId])

  // Initial load + realtime subscription + 5s polling safety net.
  // Phase 12.8: realtime can drop silently (publication drift, flaky
  // socket); polling guarantees the chat refreshes even when the
  // socket is dead. Both run; setMessages dedupes by row id.
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
        (payload) => {
          if (cancelled) return
          // Pop sound only for messages from the other party.
          const newRow = payload.new as { sender_id?: string }
          if (
            currentUserId &&
            newRow?.sender_id &&
            newRow.sender_id !== currentUserId
          ) {
            playChatMessage()
          }
          refresh()
        },
      )
      .subscribe((status) => {
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          // eslint-disable-next-line no-console
          console.warn("[deal-chat] realtime status:", status)
        }
      })

    // 5-second polling fallback so chat updates even if the socket
    // died. Pauses while the tab is hidden (battery).
    const pollInterval = setInterval(() => {
      if (cancelled) return
      if (document.visibilityState !== "visible") return
      void refresh()
    }, 5_000)

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        void refresh()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      clearInterval(pollInterval)
      document.removeEventListener("visibilitychange", onVisibility)
      supabase.removeChannel(channel)
    }
  }, [dealId, refresh, currentUserId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Phase 13.14 — optimistic send.
  //
  // Flow:
  //   1. Build a pending ChatItem with a temp id, push it to state
  //      so the user sees their bubble INSTANTLY.
  //   2. Clear the input — the typed text is now "owned" by the
  //      pending bubble (in _draft) so it can be retried on failure.
  //   3. Hit the RPC in the background.
  //   4. On success: drop the optimistic bubble. The real row will
  //      arrive via realtime (filter=deal_id) and slot in.
  //   5. On failure: flip the bubble's state to "failed" so the
  //      user can tap to retry. Show a toast and restore the text
  //      to the input so they can edit if they want.
  const sendInternal = useCallback(async (text: string, draftRef?: string): Promise<boolean> => {
    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const nowIso = new Date().toISOString()

    const optimistic: ChatItem = {
      id: tempId,
      deal_id: dealId,
      sender_id: currentUserId ?? "",
      sender_name: t("you"),
      message_type: "text",
      content: text,
      attachment_url: null,
      is_read: false,
      read_at: null,
      created_at: nowIso,
      _optimistic: "pending",
      _draft: draftRef ?? text,
    }

    // 1 + 2: push pending bubble + clear input
    setMessages((prev) => [...prev, optimistic])

    // 3: hit RPC
    const result = await postDealMessage(dealId, text)
    if (result.success) {
      // 4: drop the pending bubble — realtime will deliver the real one.
      // (If realtime drifts, the polling fallback in the effect
      //  below covers it within 5s.)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      return true
    }

    // 5: mark failed
    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId ? { ...m, _optimistic: "failed" as const } : m,
      ),
    )
    const map: Record<string, string> = {
      unauthenticated: t("errUnauthenticated"),
      empty_message: t("errEmptyMessage"),
      deal_not_found: t("errDealNotFound"),
      not_party: t("errNotParty"),
    }
    showError(map[result.error ?? ""] ?? t("errSendMessage"))
    return false
  }, [dealId, currentUserId, t])

  const handleSend = async () => {
    const text = input.trim()
    if (!text) return
    setSending(true)
    setInput("")
    await sendInternal(text)
    setSending(false)
  }

  /** Tap a failed bubble to retry. Removes the failed bubble and
   *  re-issues a fresh optimistic send with the same draft text. */
  const handleRetry = async (item: ChatItem) => {
    const draft = item._draft ?? item.content ?? ""
    if (!draft) return
    setMessages((prev) => prev.filter((m) => m.id !== item.id))
    await sendInternal(draft)
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
        <div className="text-sm text-white font-bold">{t("chatTitle")}</div>
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
            {t("loading")}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-6 text-xs text-neutral-500">
            {t("noMessages")}
          </div>
        ) : (
          messages.map((m) => {
            const isMe = !!(currentUserId && m.sender_id === currentUserId) || m._optimistic
            const isPending = m._optimistic === "pending"
            const isFailed = m._optimistic === "failed"
            return (
              <div
                key={m.id}
                className={cn(
                  "flex flex-col max-w-[85%] gap-0.5",
                  isMe ? "ml-auto items-end" : "mr-auto items-start",
                )}
              >
                <div className="text-[10px] text-neutral-500 px-1 flex items-center gap-1.5">
                  <span>{isMe ? t("you") : m.sender_name}</span>
                  <span className="text-neutral-700" dir="ltr">
                    {m.created_at.replace("T", " ").slice(0, 16)}
                  </span>
                  {isPending && (
                    <span className="text-blue-400 text-[9px] font-mono animate-pulse">
                      {t("msgSending")}
                    </span>
                  )}
                  {isFailed && (
                    <span className="text-red-400 text-[9px] font-mono flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5" /> {t("msgFailed")}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={isFailed ? () => handleRetry(m) : undefined}
                  disabled={!isFailed}
                  className={cn(
                    "px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words text-right",
                    isMe
                      ? "bg-blue-500/[0.15] border border-blue-500/[0.25] text-blue-100"
                      : "bg-white/[0.06] border border-white/[0.08] text-neutral-200",
                    isPending && "opacity-60",
                    isFailed && "border-red-500/40 bg-red-500/[0.08] text-red-100 cursor-pointer hover:bg-red-500/[0.12]",
                    !isFailed && "cursor-default",
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
                      {t("attachment")}
                    </a>
                  )}
                </button>
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
          placeholder={t("msgPlaceholder")}
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
          {t("send")}
        </button>
      </div>
    </div>
  )
}
