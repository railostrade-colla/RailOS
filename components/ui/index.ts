/**
 * RailOS UI primitives — single import path.
 *
 * Usage:
 *   import { Card, Tabs, Modal, Badge } from "@/components/ui"
 */

export { Card } from "./Card"
export type { CardProps, CardColor, CardVariant, CardPadding } from "./Card"

export { SectionHeader } from "./SectionHeader"
export type {
  SectionHeaderProps,
  SectionHeaderAction,
  SectionHeaderSize,
} from "./SectionHeader"

export { StatCard } from "./StatCard"
export type {
  StatCardProps,
  StatCardColor,
  StatCardSize,
  TrendDirection,
} from "./StatCard"

export { Modal } from "./Modal"
export type { ModalProps, ModalSize, ModalVariant } from "./Modal"

export {
  Skeleton,
  SkeletonCard,
  SkeletonText,
  SkeletonStat,
  SkeletonAvatar,
} from "./Skeleton"
export type { SkeletonProps, SkeletonVariant, SkeletonAvatarSize } from "./Skeleton"

export { EmptyState } from "./EmptyState"
export type { EmptyStateProps, EmptyStateAction, EmptyStateSize } from "./EmptyState"

export { Badge } from "./Badge"
export type { BadgeProps, BadgeColor, BadgeVariant, BadgeSize } from "./Badge"

export { Tabs } from "./Tabs"
export type { TabsProps, TabItem, TabsVariant, TabsSize } from "./Tabs"
