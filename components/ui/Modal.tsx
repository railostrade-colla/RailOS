"use client"

import { useEffect } from "react"
import { X, AlertTriangle, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { ReactNode } from "react"

export type ModalSize = "sm" | "md" | "lg" | "xl"
export type ModalVariant = "default" | "warning" | "danger" | "success"

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  size?: ModalSize
  variant?: ModalVariant
  showCloseButton?: boolean
  closeOnOverlay?: boolean
  footer?: ReactNode
  children: ReactNode
  className?: string
}

const SIZE: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
}

const VARIANT_ICON: Record<ModalVariant, { icon: ReactNode; color: string; bg: string } | null> = {
  default: null,
  warning: {
    icon: <AlertTriangle className="w-5 h-5" strokeWidth={2} />,
    color: "text-yellow-400",
    bg: "bg-yellow-400/[0.1] border-yellow-400/30",
  },
  danger: {
    icon: <AlertTriangle className="w-5 h-5" strokeWidth={2} />,
    color: "text-red-400",
    bg: "bg-red-400/[0.1] border-red-400/30",
  },
  success: {
    icon: <CheckCircle className="w-5 h-5" strokeWidth={2} />,
    color: "text-green-400",
    bg: "bg-green-400/[0.1] border-green-400/30",
  },
}

/**
 * Modal — bottom-sheet on mobile, centered dialog on desktop.
 *
 * Behavior:
 * - ESC key closes (when isOpen)
 * - Click on overlay closes (if closeOnOverlay=true, default)
 * - Body scroll locked while open
 *
 * @example
 *   <Modal isOpen={open} onClose={() => setOpen(false)} title="تأكيد" variant="warning"
 *          footer={<button onClick={...}>تأكيد</button>}>
 *     content
 *   </Modal>
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = "md",
  variant = "default",
  showCloseButton = true,
  closeOnOverlay = true,
  footer,
  children,
  className,
}: ModalProps) {
  // ESC key + body scroll lock
  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleEsc)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", handleEsc)
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const variantCfg = VARIANT_ICON[variant]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={() => closeOnOverlay && onClose()}
    >
      <div
        className={cn(
          "bg-[#0a0a0a] border-t border-white/[0.1] sm:border sm:rounded-2xl rounded-t-3xl w-full max-h-[90vh] overflow-y-auto flex flex-col",
          SIZE[size],
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start gap-3 p-5 pb-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {variantCfg && (
              <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0", variantCfg.bg)}>
                <span className={variantCfg.color}>{variantCfg.icon}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 id="modal-title" className="text-base font-bold text-white">{title}</h3>
              {subtitle && (
                <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">{subtitle}</p>
              )}
            </div>
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              aria-label="إغلاق"
              className="text-neutral-500 hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 px-5 pb-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-white/[0.06] p-4 flex gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
