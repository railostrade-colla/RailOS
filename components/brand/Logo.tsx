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

// `radius` is an explicit, modest corner (~20% of the box) so the
// frame always reads as a SOFT SQUARE — never a circle. A fixed
// rounded-xl (12px) on the 32px size looked almost circular; this
// scales the corner with the box instead.
const SIZES: Record<LogoSize, { box: number; icon: number; gap: number; title: number; subtitle: number; radius: number }> = {
  sm:   { box: 32, icon: 20, gap: 8,  title: 13, subtitle: 9,  radius: 7 },
  md:   { box: 40, icon: 24, gap: 12, title: 15, subtitle: 11, radius: 9 },
  lg:   { box: 56, icon: 32, gap: 14, title: 18, subtitle: 12, radius: 12 },
  xl:   { box: 72, icon: 42, gap: 16, title: 20, subtitle: 13, radius: 16 },
  "2xl":{ box: 96, icon: 56, gap: 20, title: 24, subtitle: 14, radius: 20 },
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
      {/* Logo box — always dark, the only element with a shadow. */}
      <div
        className="logo-box always-dark flex items-center justify-center shrink-0 overflow-hidden border border-white/[0.1]"
        style={{ width: d.box, height: d.box, borderRadius: d.radius, backgroundColor: "#000", boxShadow: "var(--shadow-md)" }}
      >
        {/* Dual mark: icon.png in Dark, logo1.png in Light. Toggled
            by CSS (no-FOUC, no client hook) — see globals.css. */}
        <Image
          src="/icon.png"
          alt="RailOS"
          width={d.icon}
          height={d.icon}
          className="logo-img-dark object-contain"
          priority
        />
        <Image
          src="/logo1.png"
          alt="RailOS"
          width={d.icon}
          height={d.icon}
          className="logo-img-light object-contain"
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
