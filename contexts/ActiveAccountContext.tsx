"use client"

/**
 * ActiveAccountContext (Phase 9.3a)
 *
 * Tracks which "wallet" the user is viewing in /portfolio:
 *   - "personal"        → their own balance + holdings (default)
 *   - "contract:<id>"   → balance + holdings of one of their active
 *                         partnership contracts
 *
 * The active selection is persisted to localStorage under
 * `railos_active_account` so it survives reloads. If the persisted
 * contract no longer appears in getUserContracts() (revoked, ended,
 * etc.) we silently fall back to "personal".
 *
 * The provider also caches the user's contract list (refreshed on
 * mount + when refresh() is called) so the AccountSwitcher dropdown
 * doesn't have to refetch on every render.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  getUserContracts,
  type ContractMemberPermission,
  type UserContractRow,
} from "@/lib/data/contracts"

const STORAGE_KEY = "railos_active_account"

export interface PersonalAccount {
  kind: "personal"
}

export interface ContractAccount {
  kind: "contract"
  contractId: string
  contractTitle: string
  isCreator: boolean
  permission: ContractMemberPermission
  totalBalance: number
}

export type ActiveAccount = PersonalAccount | ContractAccount

interface ActiveAccountContextValue {
  active: ActiveAccount
  contracts: UserContractRow[]
  loading: boolean
  /** Switch to the personal account. */
  setPersonal: () => void
  /** Switch to a specific contract (must be in `contracts`). */
  setContract: (contractId: string) => void
  /** Re-fetch the contracts list (after creating/joining/leaving). */
  refresh: () => Promise<void>
  /** Convenience: can the active context place buys? */
  canBuy: boolean
  /** Convenience: can the active context place sells? */
  canSell: boolean
}

const PERSONAL: PersonalAccount = { kind: "personal" }

const ActiveAccountContext = createContext<ActiveAccountContextValue | null>(null)

function readPersisted(): { kind: "personal" } | { kind: "contract"; contractId: string } {
  if (typeof window === "undefined") return PERSONAL
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return PERSONAL
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as { kind?: unknown }).kind === "contract" &&
      typeof (parsed as { contractId?: unknown }).contractId === "string"
    ) {
      return parsed as { kind: "contract"; contractId: string }
    }
    return PERSONAL
  } catch {
    return PERSONAL
  }
}

function persist(payload: { kind: "personal" } | { kind: "contract"; contractId: string }) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* QuotaExceeded etc. — ignore */
  }
}

function rowToActive(row: UserContractRow): ContractAccount {
  return {
    kind: "contract",
    contractId: row.contract_id,
    contractTitle: row.contract_title,
    isCreator: row.is_creator,
    permission: row.permission,
    totalBalance: row.total_balance,
  }
}

export function ActiveAccountProvider({ children }: { children: ReactNode }) {
  const [contracts, setContracts] = useState<UserContractRow[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<ActiveAccount>(PERSONAL)

  const refresh = useCallback(async () => {
    setLoading(true)
    const rows = await getUserContracts()
    setContracts(rows)

    // Reconcile persisted choice against the live list. If the user
    // had a contract selected but it's no longer in the list (ended,
    // revoked, declined), drop back to personal.
    const persisted = readPersisted()
    if (persisted.kind === "contract") {
      const match = rows.find((r) => r.contract_id === persisted.contractId)
      if (match) {
        setActive(rowToActive(match))
      } else {
        setActive(PERSONAL)
        persist(PERSONAL)
      }
    } else {
      setActive(PERSONAL)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const setPersonal = useCallback(() => {
    setActive(PERSONAL)
    persist(PERSONAL)
  }, [])

  const setContract = useCallback(
    (contractId: string) => {
      const match = contracts.find((r) => r.contract_id === contractId)
      if (!match) return // stale id; ignore
      const next = rowToActive(match)
      setActive(next)
      persist({ kind: "contract", contractId })
    },
    [contracts],
  )

  const canBuy = useMemo(() => {
    if (active.kind === "personal") return true
    if (active.isCreator) return true
    return active.permission === "buy_only" || active.permission === "buy_and_sell"
  }, [active])

  const canSell = useMemo(() => {
    if (active.kind === "personal") return true
    if (active.isCreator) return true
    return active.permission === "buy_and_sell"
  }, [active])

  const value = useMemo<ActiveAccountContextValue>(
    () => ({
      active,
      contracts,
      loading,
      setPersonal,
      setContract,
      refresh,
      canBuy,
      canSell,
    }),
    [active, contracts, loading, setPersonal, setContract, refresh, canBuy, canSell],
  )

  return (
    <ActiveAccountContext.Provider value={value}>
      {children}
    </ActiveAccountContext.Provider>
  )
}

/** Hook for consumers. Throws if used outside the provider. */
export function useActiveAccount(): ActiveAccountContextValue {
  const ctx = useContext(ActiveAccountContext)
  if (!ctx) {
    throw new Error(
      "useActiveAccount must be used inside <ActiveAccountProvider>",
    )
  }
  return ctx
}
