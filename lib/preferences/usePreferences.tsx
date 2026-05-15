"use client"

/**
 * Phase 14.13 PART A — PreferencesProvider.
 *
 * Owns 3 appearance prefs the Settings UI exposes:
 *   • fontSize  : small | medium | large
 *   • density   : compact | comfortable
 *   • animations: on/off
 *
 * Strategy mirrors ThemeProvider: the actual effect is 100% CSS via
 * data attributes on <html> ([data-font-size] / [data-density] /
 * [data-animations]); this provider only persists to localStorage and
 * keeps the attributes in sync. A tiny inline bootstrap in layout.tsx
 * applies them before first paint (no FOUC). DB sync is intentionally
 * out of scope here (localStorage is the source of truth; a DB column
 * lands with the gated migration).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

export type FontSize = "small" | "medium" | "large"
export type Density = "compact" | "comfortable"

const STORAGE_KEY = "railos:prefs"

interface PrefsCtx {
  fontSize: FontSize
  density: Density
  animations: boolean
  setFontSize: (v: FontSize) => void
  setDensity: (v: Density) => void
  setAnimations: (v: boolean) => void
}

const Ctx = createContext<PrefsCtx | null>(null)

function applyAttrs(fontSize: FontSize, density: Density, animations: boolean) {
  if (typeof document === "undefined") return
  const html = document.documentElement
  html.setAttribute("data-font-size", fontSize)
  html.setAttribute("data-density", density)
  html.setAttribute("data-animations", animations ? "on" : "off")
}

interface Persisted {
  fontSize?: FontSize
  density?: Density
  animations?: boolean
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>("medium")
  const [density, setDensityState] = useState<Density>("comfortable")
  const [animations, setAnimationsState] = useState<boolean>(true)

  // Hydrate from localStorage (the no-FOUC inline script already
  // applied the attributes; this just syncs React state).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const p = JSON.parse(raw) as Persisted
        const fs: FontSize =
          p.fontSize === "small" || p.fontSize === "large" ? p.fontSize : "medium"
        const d: Density = p.density === "compact" ? "compact" : "comfortable"
        const a = p.animations !== false
        setFontSizeState(fs)
        setDensityState(d)
        setAnimationsState(a)
        applyAttrs(fs, d, a)
      } else {
        applyAttrs("medium", "comfortable", true)
      }
    } catch {
      applyAttrs("medium", "comfortable", true)
    }
  }, [])

  const persist = useCallback(
    (fs: FontSize, d: Density, a: boolean) => {
      applyAttrs(fs, d, a)
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ fontSize: fs, density: d, animations: a }),
        )
      } catch {
        /* ignore */
      }
    },
    [],
  )

  const setFontSize = useCallback(
    (v: FontSize) => {
      setFontSizeState(v)
      persist(v, density, animations)
    },
    [density, animations, persist],
  )
  const setDensity = useCallback(
    (v: Density) => {
      setDensityState(v)
      persist(fontSize, v, animations)
    },
    [fontSize, animations, persist],
  )
  const setAnimations = useCallback(
    (v: boolean) => {
      setAnimationsState(v)
      persist(fontSize, density, v)
    },
    [fontSize, density, persist],
  )

  return (
    <Ctx.Provider
      value={{ fontSize, density, animations, setFontSize, setDensity, setAnimations }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function usePreferences(): PrefsCtx {
  const c = useContext(Ctx)
  if (!c) {
    // Safe fallback so a stray consumer can't crash the tree.
    return {
      fontSize: "medium",
      density: "comfortable",
      animations: true,
      setFontSize: () => undefined,
      setDensity: () => undefined,
      setAnimations: () => undefined,
    }
  }
  return c
}
