"use client"

import { cn } from "@/lib/utils/cn"

export type SkeletonVariant = "text" | "circular" | "rectangular"
export type SkeletonAvatarSize = "sm" | "md" | "lg"

export interface SkeletonProps {
  variant?: SkeletonVariant
  width?: string | number
  height?: string | number
  className?: string
}

const VARIANT_RADIUS: Record<SkeletonVariant, string> = {
  text: "rounded",
  circular: "rounded-full",
  rectangular: "rounded-lg",
}

/**
 * Skeleton — animated placeholder during data loading.
 *
 * @example
 *   <Skeleton width="60%" height={16} />
 *   <Skeleton variant="circular" width={40} height={40} />
 */
export function Skeleton({
  variant = "text",
  width,
  height,
  className,
}: SkeletonProps) {
  return (
    <div
      className={cn("bg-white/[0.05] animate-pulse", VARIANT_RADIUS[variant], className)}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    />
  )
}

/** Card-shaped skeleton (matches the standard Card primitive). */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5", className)}>
      <Skeleton width="40%" height={14} className="mb-3" />
      <Skeleton width="80%" height={28} className="mb-2" />
      <Skeleton width="60%" height={12} />
    </div>
  )
}

/** Multi-line text placeholder. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          width={i === lines - 1 ? "70%" : "100%"}
        />
      ))}
    </div>
  )
}

/** StatCard placeholder. */
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white/[0.04] border border-white/[0.06] rounded-lg p-3", className)}>
      <Skeleton width="60%" height={10} className="mb-2" />
      <Skeleton width="80%" height={18} />
    </div>
  )
}

const AVATAR_SIZE: Record<SkeletonAvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
}

/** Avatar circle placeholder. */
export function SkeletonAvatar({
  size = "md",
  className,
}: {
  size?: SkeletonAvatarSize
  className?: string
}) {
  const px = AVATAR_SIZE[size]
  return <Skeleton variant="circular" width={px} height={px} className={className} />
}
