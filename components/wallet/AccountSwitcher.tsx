"use client"

/**
 * AccountSwitcher (Phase 9.3a)
 *
 * Compact dropdown placed in the /portfolio header. Lets the user
 * toggle between their personal account and any of their active
 * partnership contracts. Backed by ActiveAccountContext so the choice
 * propagates to every consumer (balance, holdings, action gating).
 *
 * Visibility: hidden entirely when the user has zero active contracts
 * — there's nothing to switch to, and showing an empty dropdown would
 * be noise.
 */

import { useEffect, useRef, useState } from "react"
import { ChevronDown, User, Users, Check, Eye, ShoppingCart, ArrowLeftRight } from "lucide-react"
import { useActiveAccount } from "@/contexts/ActiveAccountContext"
import type { ContractMemberPermission } from "@/lib/data/contracts"
import { cn } from "@/lib/utils/cn"

const fmtIQD = (n: number) => n.toLocaleString("en-US")

const PERMISSION_LABELS: Record<ContractMemberPermission, { label: string; icon: typeof Eye }> = {
  creator:       { label: "منشئ",         icon: Users },
  buy_and_sell:  { label: "شراء وبيع",   icon: ArrowLeftRight },
  buy_only:      { label: "شراء فقط",    icon: ShoppingCart },
  view_only:     { label: "عرض فقط",     icon: Eye },
}

export function AccountSwitcher() {
  const { active, contracts, loading, setPersonal, setContract } = useActiveAccount()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Click-outside to close
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  if (loading) return null
  if (contracts.length === 0) return null

  const isPersonal = active.kind === "personal"
  const currentLabel = isPersonal
    ? "الحساب الرئيسي"
    : active.contractTitle
  const CurrentIcon = isPersonal ? User : Users

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl px-3 py-2 transition-colors text-right",
          !isPersonal && "border-purple-400/30 bg-purple-400/[0.06]",
        )}
      >
        <CurrentIcon
          className={cn(
            "w-4 h-4 flex-shrink-0",
            isPersonal ? "text-neutral-400" : "text-purple-400",
          )}
          strokeWidth={2}
        />
        <div className="min-w-0">
          <div className="text-xs text-white font-bold truncate max-w-[160px]">
            {currentLabel}
          </div>
          {!isPersonal && (
            <div className="text-[10px] text-neutral-500 font-mono">
              {fmtIQD(active.totalBalance)} د.ع
            </div>
          )}
        </div>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-neutral-500 transition-transform",
            open && "rotate-180",
          )}
          strokeWidth={2.5}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-[#0a0a0a] border border-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden"
          dir="rtl"
        >
          <div className="px-3 py-2 border-b border-white/[0.06]">
            <div className="text-[10px] text-neutral-500 font-bold">
              تبديل الحساب
            </div>
          </div>

          {/* Personal */}
          <button
            onClick={() => {
              setPersonal()
              setOpen(false)
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 hover:bg-white/[0.04] transition-colors text-right",
              isPersonal && "bg-white/[0.05]",
            )}
          >
            <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-neutral-300" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white font-bold">الحساب الرئيسي</div>
              <div className="text-[10px] text-neutral-500">حسابك الشخصي</div>
            </div>
            {isPersonal && (
              <Check className="w-4 h-4 text-green-400 flex-shrink-0" strokeWidth={2.5} />
            )}
          </button>

          <div className="h-px bg-white/[0.06]" />

          {/* Contracts */}
          <div className="max-h-72 overflow-y-auto">
            {contracts.map((c) => {
              const isActive =
                active.kind === "contract" && active.contractId === c.contract_id
              const perm = c.is_creator
                ? ("creator" as const)
                : c.permission
              const PMeta = PERMISSION_LABELS[perm]
              const PIcon = PMeta.icon
              return (
                <button
                  key={c.contract_id}
                  onClick={() => {
                    setContract(c.contract_id)
                    setOpen(false)
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 hover:bg-white/[0.04] transition-colors text-right",
                    isActive && "bg-purple-400/[0.05]",
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-purple-400/[0.1] border border-purple-400/30 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-purple-400" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-bold truncate">
                      {c.contract_title}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {fmtIQD(c.total_balance)} د.ع
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-neutral-400">
                        <PIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
                        {PMeta.label}
                      </span>
                    </div>
                  </div>
                  {isActive && (
                    <Check className="w-4 h-4 text-purple-400 flex-shrink-0" strokeWidth={2.5} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
