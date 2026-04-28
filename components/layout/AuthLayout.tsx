import { ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import { GridBackground } from "./GridBackground"

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
  badge?: string
}

/**
 * AuthLayout - تصميم مقسّم (Split) لصفحات المصادقة.
 * Desktop: يسار = branding + KPIs، يمين = النموذج.
 * Mobile: عمود واحد (الـ branding مخفي، logo صغير أعلى النموذج).
 */
export function AuthLayout({
  children,
  title,
  subtitle,
  badge,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side (Desktop only): Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-black p-12 flex-col justify-between">
        <GridBackground />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/icon.png"
              alt="Railos"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <span className="text-xl font-medium text-white">RaiLOS</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-md">
          <div className="text-xs text-neutral-500 tracking-wider mb-3 font-mono">
            RAILOS PLATFORM
          </div>
          <h2 className="text-3xl font-medium tracking-tight mb-4 leading-tight">
            <span className="bg-gradient-to-b from-white to-neutral-500 bg-clip-text text-transparent">
              منصة استثمار ذكية للفرص الواقعية
            </span>
          </h2>
          <p className="text-sm text-neutral-400 leading-relaxed">
            تداول الحصص في مشاريع حقيقية، اربح من الإحالات، وتابع استثماراتك لحظة بلحظة
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-2">
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-lg p-2.5">
            <div className="text-base font-bold text-white font-mono">47+</div>
            <div className="text-[9px] text-neutral-500">مشروع نشط</div>
          </div>
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-lg p-2.5">
            <div className="text-base font-bold text-green-400 font-mono">
              18.4%
            </div>
            <div className="text-[9px] text-neutral-500">متوسط العائد</div>
          </div>
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-lg p-2.5">
            <div className="text-base font-bold text-white font-mono">12k+</div>
            <div className="text-[9px] text-neutral-500">مستثمر</div>
          </div>
        </div>
      </div>

      {/* Right side: Form */}
      <div className="flex-1 flex flex-col bg-black relative overflow-hidden lg:bg-[#050505]">
        <div className="lg:hidden absolute inset-0">
          <GridBackground />
        </div>

        {/* Mobile header (logo only) */}
        <div className="lg:hidden relative z-10 p-6 flex items-center justify-center">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/icon.png"
              alt="Railos"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="text-lg font-medium text-white">RaiLOS</span>
          </Link>
        </div>

        {/* Form content */}
        <div className="flex-1 flex items-center justify-center px-6 lg:px-12 py-8 relative z-10">
          <div className="w-full max-w-md">
            {badge && (
              <div className="inline-flex items-center gap-2 bg-neutral-950/80 backdrop-blur-sm border border-neutral-800 px-3 py-1.5 rounded-full mb-6">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-[10px] text-neutral-400 tracking-wider">
                  {badge}
                </span>
              </div>
            )}

            <h1 className="text-2xl lg:text-3xl font-medium tracking-tight mb-2">
              <span className="bg-gradient-to-b from-white to-neutral-500 bg-clip-text text-transparent">
                {title}
              </span>
            </h1>
            {subtitle && (
              <p className="text-sm text-neutral-400 mb-8">{subtitle}</p>
            )}

            {children}
          </div>
        </div>

        <div className="relative z-10 p-6 text-center">
          <div className="text-[10px] text-neutral-600 font-mono tracking-wider">
            RAILOS v2.0 · حماية بأحدث المعايير
          </div>
        </div>
      </div>
    </div>
  )
}
