"use client"

/**
 * ThemeProvider — Phase 14.13 M2.
 *
 * Owns the app's light/dark/system theme. Strategy:
 *   • The actual color flip is 100% CSS: globals.css defines a
 *     `[data-theme="light"]` block + Hybrid overrides. This provider
 *     only toggles the `data-theme` attribute on <html>.
 *   • Persistence: localStorage (instant, zero-DB). DB persistence
 *     (user_preferences.theme) lands in a follow-up once the
 *     migration is approved — `hydrateFromDb` is the seam for it.
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
  useState,
  type ReactNode,
} from "react"

export type ThemeChoice = "dark" | "light" | "system"
export type ResolvedTheme = "dark" | "light"

const STORAGE_KEY = "railos:theme"

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
  // layout.tsx already applied the attribute; this just syncs state).
  useEffect(() => {
    let initial: ThemeChoice = "dark"
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeChoice | null
      if (stored === "dark" || stored === "light" || stored === "system") {
        initial = stored
      }
    } catch {
      /* localStorage blocked — fall back to dark */
    }
    const r = resolve(initial)
    setThemeState(initial)
    setResolved(r)
    apply(r)
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
    const r = resolve(t)
    setThemeState(t)
    setResolved(r)
    apply(r)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* ignore */
    }
    // DB persistence seam (Phase 14.13 M2 follow-up, post-migration):
    //   void persistThemeToDb(t)
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
