import Image from "next/image"

/**
 * Phase 14.13 Mega-overhaul Stage 1 — the single unified brand mark.
 *
 * Architecture that kills the "shadow around رايلوس/RAILOS" bug:
 *   • `.logo-box`  → the ONLY part that carries depth (var(--shadow-md))
 *                    and stays dark (always-dark) so the white PNG reads.
 *   • `.logo-text` → flat text, explicitly shadow-free (the global
 *                    `.logo-text, .logo-text *` reset zeroes any
 *                    inherited box/text-shadow).
 *
 * Tokens are this project's real ones (text-white auto-flips to dark
 * in Light Mode via the existing [data-theme="light"] overrides) — NOT
 * shadcn `text-foreground` which doesn't exist here.
 */
type LogoSize = "sm" | "md" | "lg" | "xl" | "2xl"
type LogoVariant = "icon" | "horizontal" | "vertical"

// Per founder spec: every logo frame is a PURE SQUARE (no rounding,
// no background) in both themes, app-wide.
// Logo mark enlarged ~30% per founder request (box + icon scaled;
// text sizes unchanged). Pure square, no frame/background.
const SIZES: Record<LogoSize, { box: number; icon: number; gap: number; title: number; subtitle: number }> = {
  sm:   { box: 42,  icon: 26, gap: 8,  title: 13, subtitle: 9 },
  md:   { box: 52,  icon: 31, gap: 12, title: 15, subtitle: 11 },
  lg:   { box: 73,  icon: 42, gap: 14, title: 18, subtitle: 12 },
  xl:   { box: 94,  icon: 55, gap: 16, title: 20, subtitle: 13 },
  "2xl":{ box: 125, icon: 73, gap: 20, title: 24, subtitle: 14 },
}

export function Logo({
  size = "md",
  variant = "horizontal",
  showText = true,
}: {
  size?: LogoSize
  variant?: LogoVariant
  showText?: boolean
}) {
  const d = SIZES[size]

  return (
    <div
      className={`logo-wrapper flex items-center ${variant === "vertical" ? "flex-col" : ""}`}
      style={{ gap: d.gap }}
    >
      {/* Logo box — fully transparent (no bg / border / shadow) in
          both themes, per founder spec. Just a sized, centered frame. */}
      <div
        className="logo-box flex items-center justify-center shrink-0 overflow-hidden"
        style={{ width: d.box, height: d.box, borderRadius: 0 }}
      >
        {/* Dual mark: logo.png in Dark, logo1.png in Light. Both
            render at the FULL box size so the visible mark is equal
            in both themes regardless of each PNG's internal padding. */}
        <Image
          src="/logo.png"
          alt="RailOS"
          width={d.box}
          height={d.box}
          className="logo-img-dark object-contain w-full h-full"
          priority
        />
        <Image
          src="/logo1.png"
          alt="RailOS"
          width={d.box}
          height={d.box}
          className="logo-img-light object-contain w-full h-full"
          priority
        />
      </div>

      {/* Brand text — never shadowed. */}
      {showText && variant !== "icon" && (
        <div className={`logo-text leading-none ${variant === "vertical" ? "text-center mt-1" : "text-right"}`}>
          <p className="font-bold text-white no-shadow" style={{ fontSize: d.title }}>
            رايلوس
          </p>
          <p
            className="text-neutral-500 font-mono uppercase tracking-wider no-shadow mt-0.5"
            style={{ fontSize: d.subtitle }}
          >
            RAILOS
          </p>
        </div>
      )}
    </div>
  )
}
