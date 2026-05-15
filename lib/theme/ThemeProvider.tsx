"use client"

/**
 * ThemeProvider — Phase 14.13 M2.
 *
 * Owns the app's light/dark/system theme. Strategy:
 *   • The actual color flip is 100% CSS: globals.css defines a
 *     `[data-theme="light"]` block + Hybrid overrides. This provider
 *     only toggles the `data-theme` attribute on <html>.
 *   • Persistence: localStorage (instant, zero-DB, no-FOUC source of
 *     truth) + Supabase `user_preferences.theme` as the cross-device
 *     sync layer (Phase 14.13 Part B). On mount we hydrate from
 *     localStorage immediately, then reconcile against the DB row for
 *     the signed-in user (DB wins so a change on device A shows on
 *     device B). `setTheme` writes localStorage instantly and
 *     upserts the DB row best-effort (optimistic, non-blocking).
 *   • "system" follows prefers-color-scheme live via matchMedia.
 *   • No FOUC: a tiny inline script in app/layout.tsx sets the
 *     attribute before first paint; this provider just keeps React
 *     state in sync and reacts to user changes.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createClient } from "@/lib/supabase/client"

export type ThemeChoice = "dark" | "light" | "system"
export type ResolvedTheme = "dark" | "light"

const STORAGE_KEY = "railos:theme"

function isThemeChoice(v: unknown): v is ThemeChoice {
  return v === "dark" || v === "light" || v === "system"
}

/**
 * Read the signed-in user's saved theme from Supabase. Returns null
 * when logged-out, no row yet, or any error — caller keeps the
 * localStorage value. Best-effort, never throws.
 */
async function fetchThemeFromDb(): Promise<ThemeChoice | null> {
  try {
    const sb = createClient()
    const { data: auth } = await sb.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) return null
    const { data, error } = await sb
      .from("user_preferences")
      .select("theme")
      .eq("user_id", uid)
      .maybeSingle()
    if (error || !data) return null
    return isThemeChoice(data.theme) ? data.theme : null
  } catch {
    return null
  }
}

/**
 * Optimistically persist the chosen theme to Supabase. Upserts only
 * user_id + theme (locale keeps its column default / existing value).
 * Fire-and-forget — failures are swallowed (localStorage already has
 * the value, so the UX is unaffected offline / logged-out).
 */
async function persistThemeToDb(t: ThemeChoice): Promise<void> {
  try {
    const sb = createClient()
    const { data: auth } = await sb.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) return
    await sb
      .from("user_preferences")
      .upsert({ user_id: uid, theme: t }, { onConflict: "user_id" })
  } catch {
    /* best-effort — ignore */
  }
}

interface ThemeCtx {
  /** What the user picked (may be "system"). */
  theme: ThemeChoice
  /** What is actually applied right now ("dark" | "light"). */
  resolved: ResolvedTheme
  setTheme: (t: ThemeChoice) => void
}

const Ctx = createContext<ThemeCtx | null>(null)

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function resolve(choice: ThemeChoice): ResolvedTheme {
  if (choice === "system") return systemPrefersDark() ? "dark" : "light"
  return choice
}

function apply(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return
  const html = document.documentElement
  if (resolved === "light") html.setAttribute("data-theme", "light")
  else html.removeAttribute("data-theme") // dark = default, no attr
  // Enable the 200ms transition only AFTER the first apply so the
  // initial paint doesn't animate.
  html.classList.add("theme-ready")
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("dark")
  const [resolved, setResolved] = useState<ResolvedTheme>("dark")

  // Hydrate from localStorage on mount (the no-FOUC script in
  // layout.tsx already applied the attribute; this just syncs state),
  // then reconcile against the DB row so a change made on another
  // device propagates here. The user's own change wins over a slow
  // DB response (tracked via userChangedRef).
  const userChangedRef = useRef(false)
  useEffect(() => {
    let initial: ThemeChoice = "dark"
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeChoice | null
      if (isThemeChoice(stored)) initial = stored
    } catch {
      /* localStorage blocked — fall back to dark */
    }
    const r = resolve(initial)
    setThemeState(initial)
    setResolved(r)
    apply(r)

    // Cross-device sync: pull the saved preference for the signed-in
    // user. DB wins unless the user already toggled during this load.
    let cancelled = false
    void fetchThemeFromDb().then((dbTheme) => {
      if (cancelled || userChangedRef.current || !dbTheme) return
      if (dbTheme === initial) return
      const rr = resolve(dbTheme)
      setThemeState(dbTheme)
      setResolved(rr)
      apply(rr)
      try {
        localStorage.setItem(STORAGE_KEY, dbTheme)
      } catch {
        /* ignore */
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // When choice is "system", react to OS theme changes live.
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      const r: ResolvedTheme = mq.matches ? "dark" : "light"
      setResolved(r)
      apply(r)
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [theme])

  const setTheme = useCallback((t: ThemeChoice) => {
    userChangedRef.current = true
    const r = resolve(t)
    setThemeState(t)
    setResolved(r)
    apply(r)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* ignore */
    }
    // Cross-device sync (Phase 14.13 Part B) — optimistic, non-blocking.
    void persistThemeToDb(t)
  }, [])

  return (
    <Ctx.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </Ctx.Provider>
  )
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx)
  if (!c) {
    // Safe fallback so a stray consumer outside the provider doesn't
    // crash — it just can't switch themes.
    return {
      theme: "dark",
      resolved: "dark",
      setTheme: () => undefined,
    }
  }
  return c
}
