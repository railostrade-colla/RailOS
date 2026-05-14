/**
 * Design tokens for the admin surface (Phase 14.08.2 Step 5 Round 1).
 *
 * Single source of truth for every visual primitive used across
 * /admin/* pages, components/admin/panels, and components/admin/*.
 *
 * Why this file exists:
 *   Before Phase 14.08.2 the admin shipped with three slightly
 *   different visual languages — the older shared `components/admin/
 *   ui.tsx` primitives, the Phase 13.x panels, and the Phase 14.06+
 *   reference pages (/admin/market-settings, /admin/engine-monitor).
 *   This token file collapses all of that to one canonical look.
 *
 * How to use:
 *   Prefer importing the constants below over writing class strings
 *   inline. When the design system needs to evolve, change it here.
 *
 *   ```ts
 *   import { tokens } from "@/lib/admin/design-tokens"
 *
 *   <div className={tokens.card.base + " " + tokens.card.padding}>
 *     <h2 className={tokens.text.h2}>عنوان</h2>
 *     ...
 *   </div>
 *   ```
 *
 *   Or use the small `cls(...)` helper below to compose class
 *   strings safely:
 *
 *   ```ts
 *   <div className={cls(tokens.card.base, tokens.card.padding)}>
 *   ```
 *
 * Mutability:
 *   These are STRINGS, not Tailwind theme overrides. Tailwind sees
 *   the literal class names at build time as long as we always
 *   write them out (no string concatenation that hides classes from
 *   the JIT scanner). The token VALUES below are all whole class
 *   names — safe.
 *
 * Reference pages (look here first for visual examples):
 *   - app/admin/engine-monitor/page.tsx
 *   - app/admin/market-settings/page.tsx
 */

// ─── Tiny helper to join class strings, dropping falsy values ─────
export function cls(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ")
}


// ═══════════════════════════════════════════════════════════════════
// PAGE LAYOUT — the outermost frame used by every admin page
// ═══════════════════════════════════════════════════════════════════
export const page = {
  /** Outer wrapper: horizontal padding scales with breakpoint. */
  wrap: "px-4 md:px-6 lg:px-8 py-6",
  /** Width clamp for centered admin pages. */
  max: "max-w-7xl mx-auto",
  /** Vertical rhythm between top-level sections. */
  sectionGap: "space-y-7",
  /** Inner rhythm inside a single card. */
  innerGap: "space-y-3",
} as const


// ═══════════════════════════════════════════════════════════════════
// CARDS — the box that wraps almost everything
// ═══════════════════════════════════════════════════════════════════
export const card = {
  /** Default card surface: subtle white tint, soft border. */
  base: "bg-white/[0.04] border border-white/[0.08] rounded-2xl",
  /** Default internal padding. */
  padding: "p-4",
  /** Use for hero / standalone sections that need room to breathe. */
  paddingLg: "p-6",
  /** Use on cards that contain a `<table>` so borders stay crisp. */
  overflow: "overflow-hidden",
} as const

/** Small stat tile — same surface as `card.base` but tighter radius
 *  and padding. Use for KPI strips, status counters, mini summaries. */
export const statTile = {
  base: "bg-white/[0.04] border border-white/[0.08] rounded-xl p-3",
} as const


// ═══════════════════════════════════════════════════════════════════
// PAGE HEADER — the icon + title + subtitle row at the top of a page
// ═══════════════════════════════════════════════════════════════════
export const header = {
  /** Outer row, lets the action cluster wrap below the title. */
  row: "flex items-start justify-between gap-3 flex-wrap",
  /** Title + icon cluster on the right. */
  titleGroup: "flex items-center gap-3",
  /** Square chip behind the page icon. Use `iconBoxTone` for color. */
  iconBox: "w-11 h-11 rounded-2xl flex items-center justify-center border",
  /** Page title. */
  title: "text-xl font-bold text-white",
  /** Description directly below the title. */
  subtitle: "text-xs text-neutral-500 mt-0.5 leading-relaxed",
} as const

/** Pre-built gradient + border tints for the page-header icon box.
 *  Pick the tone that best matches the page's primary action. */
export const iconBoxTone = {
  green:  "bg-gradient-to-br from-green-400/20 to-blue-400/20 border-green-400/30",
  blue:   "bg-gradient-to-br from-blue-400/20 to-purple-400/20 border-blue-400/30",
  purple: "bg-gradient-to-br from-purple-400/20 to-pink-400/20 border-purple-400/30",
  yellow: "bg-gradient-to-br from-yellow-400/20 to-orange-400/20 border-yellow-400/30",
  red:    "bg-gradient-to-br from-red-400/20 to-orange-400/20 border-red-400/30",
  neutral:"bg-gradient-to-br from-white/[0.08] to-white/[0.04] border-white/[0.12]",
} as const


// ═══════════════════════════════════════════════════════════════════
// BUTTONS — three semantic variants + ghost link style
// ═══════════════════════════════════════════════════════════════════
export const button = {
  /** Primary call-to-action. Saturated green pill. */
  primary:
    "bg-green-500 text-black hover:bg-green-600 font-bold rounded-xl px-3 py-2 text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  /** Default action — sits next to a primary button. */
  secondary:
    "bg-white/[0.04] border border-white/[0.08] text-neutral-400 hover:text-white hover:border-white/20 rounded-xl px-3 py-2 text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50",
  /** Destructive / emergency. Tinted red. */
  danger:
    "bg-red-500/20 text-red-300 border border-red-400/30 hover:bg-red-500/30 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  /** Lightweight link-style action embedded in a row. */
  ghost:
    "text-neutral-400 hover:text-white underline underline-offset-2 text-[10px] transition-colors disabled:opacity-50",
  /** Compact variant — drop a class string AFTER `primary`/`secondary`
   *  to override the default size. */
  sizeCompact: "px-2 py-1 text-[10px]",
} as const


// ═══════════════════════════════════════════════════════════════════
// FORMS — inputs, labels, helper text
// ═══════════════════════════════════════════════════════════════════
export const input = {
  /** Standard text/number input. Same border treatment as cards. */
  base:
    "w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/20 disabled:opacity-50",
  /** Use for monetary or numeric fields. */
  mono: "font-mono",
} as const

export const label = {
  /** Tiny uppercase-ish label above an input. */
  base: "block text-[10px] text-neutral-500 mb-1 font-bold",
} as const


// ═══════════════════════════════════════════════════════════════════
// TABLES — used by listing panels, recent runs, audit logs, etc.
// ═══════════════════════════════════════════════════════════════════
export const table = {
  /** Outer wrapper. Use `card.overflow` for clipped borders. */
  wrap: "bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden overflow-x-auto",
  /** Header row background. Matches the wrapper but a shade lighter
   *  on its bottom border to define the seam. */
  thead: "bg-white/[0.04] border-b border-white/[0.08]",
  /** Header cell typography. */
  th: "text-right px-3 py-2 font-bold text-neutral-500 text-xs whitespace-nowrap",
  /** Divider style between body rows. */
  tbody: "divide-y divide-white/[0.05]",
  /** Hover lift on a body row. */
  rowHover: "hover:bg-white/[0.06] transition-colors",
  /** Body cell typography. */
  td: "px-3 py-2 text-xs text-white",
} as const


// ═══════════════════════════════════════════════════════════════════
// BADGES — small status tags. Engine-monitor / market-settings tone.
// ═══════════════════════════════════════════════════════════════════
export const badge = {
  base: "px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap",
  green:  "bg-green-400/15 border-green-400/30 text-green-300",
  yellow: "bg-yellow-400/15 border-yellow-400/30 text-yellow-300",
  red:    "bg-red-400/15 border-red-400/30 text-red-300",
  blue:   "bg-blue-400/15 border-blue-400/30 text-blue-300",
  purple: "bg-purple-400/15 border-purple-400/30 text-purple-300",
  orange: "bg-orange-400/15 border-orange-400/30 text-orange-300",
  gray:   "bg-white/[0.06] border-white/[0.1] text-neutral-400",
} as const


// ═══════════════════════════════════════════════════════════════════
// TYPOGRAPHY — text scale
// ═══════════════════════════════════════════════════════════════════
export const text = {
  /** Page title — pair with `header.titleGroup`. */
  h1: "text-xl font-bold text-white",
  /** Section heading. */
  h2: "text-sm font-bold text-white",
  /** Sub-section heading. */
  h3: "text-xs font-bold text-white",
  /** Default body. */
  body: "text-xs text-white",
  /** Helper / metadata. */
  cap: "text-[10px] text-neutral-500",
  /** Numeric column or ID display. */
  mono: "font-mono",
  /** Subtle secondary text. */
  muted: "text-neutral-400",
} as const


// ═══════════════════════════════════════════════════════════════════
// EMPTY + LOADING STATES
// ═══════════════════════════════════════════════════════════════════
export const empty = {
  /** Card-style empty placeholder. */
  wrap: "py-12 text-center bg-white/[0.03] border border-white/[0.06] rounded-xl",
  icon: "text-3xl mb-2 opacity-40",
  title: "text-sm font-bold text-white mb-1",
  desc: "text-xs text-neutral-500",
} as const

export const loading = {
  /** Inline placeholder while data resolves. */
  wrap: "py-8 text-center text-xs text-neutral-500",
  /** Spinner class — pair with the `<Loader2>` icon from lucide. */
  spinnerIcon: "w-3.5 h-3.5 animate-spin",
} as const


// ═══════════════════════════════════════════════════════════════════
// AGGREGATE EXPORT — `tokens.card.base`, `tokens.button.primary`, …
// ═══════════════════════════════════════════════════════════════════
export const tokens = {
  page,
  card,
  statTile,
  header,
  iconBoxTone,
  button,
  input,
  label,
  table,
  badge,
  text,
  empty,
  loading,
} as const
