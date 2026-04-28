"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils/cn"

interface Ad {
  id: string | number
  title?: string
  subtitle?: string
  description?: string
  icon?: string
  action_label?: string
  link_url?: string
  link_type?: "internal" | "external"
  /** Display variant — controls slider height. */
  type?: "text" | "image" | "promo"
}

const TYPE_HEIGHT: Record<NonNullable<Ad["type"]>, string> = {
  text:  "h-32",
  image: "h-40 lg:h-48",
  promo: "h-48 lg:h-56",
}

interface AdsSliderProps {
  ads: Ad[]
  onAdClick?: (ad: Ad) => void
  autoPlayInterval?: number
}

export function AdsSlider({ ads, onAdClick, autoPlayInterval = 4000 }: AdsSliderProps) {
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const touchStartX = useRef(0)
  const isDragging = useRef(false)

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (ads.length <= 1) return
    timerRef.current = setInterval(() => setCurrent((p) => (p + 1) % ads.length), autoPlayInterval)
  }

  useEffect(() => {
    resetTimer()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ads.length])

  const goTo = (idx: number) => {
    setCurrent((idx + ads.length) % ads.length)
    resetTimer()
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    isDragging.current = false
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (Math.abs(e.touches[0].clientX - touchStartX.current) > 10) isDragging.current = true
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging.current) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx > 40) goTo(current - 1)
    else if (dx < -40) goTo(current + 1)
    isDragging.current = false
  }

  if (!ads.length) return null

  return (
    <div className="relative">
      <div
        className="overflow-hidden rounded-2xl border border-white/[0.08]"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex w-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(${current * 100}%)`, willChange: "transform" }}
        >
          {ads.map((ad, i) => (
            <div
              key={ad.id || i}
              onClick={() => !isDragging.current && onAdClick?.(ad)}
              className={cn(
                "min-w-full flex-shrink-0 relative cursor-pointer select-none p-5 flex flex-col justify-between transition-all",
                TYPE_HEIGHT[ad.type ?? "text"],
                ad.type === "promo"
                  ? "bg-gradient-to-br from-purple-400/[0.08] via-blue-400/[0.04] to-transparent"
                  : "bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent",
              )}
            >
              <div>
                <div className="text-[11px] text-white/45 mb-1">{ad.icon || "🎯"} إعلان</div>
                {ad.subtitle && <div className="text-[10px] text-white/55 mb-2">{ad.subtitle}</div>}
                {ad.title && <div className="text-base lg:text-lg font-bold text-white mb-1">{ad.title}</div>}
                {ad.description && <div className="text-[12px] text-white/70 leading-relaxed">{ad.description}</div>}
              </div>
              {ad.action_label && (
                <div className="self-start">
                  <button
                    onClick={(e) => { e.stopPropagation(); onAdClick?.(ad) }}
                    className="bg-white/95 text-black rounded-lg px-3 py-1.5 text-[11px] font-bold"
                  >
                    {ad.action_label}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {ads.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {ads.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                idx === current ? "w-6 bg-white" : "w-1.5 bg-white/30 hover:bg-white/50"
              )}
              aria-label={`الإعلان ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
