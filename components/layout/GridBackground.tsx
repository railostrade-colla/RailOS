import { cn } from "@/lib/utils/cn"

interface GridBackgroundProps {
  /** عرض الدوائر المتدرجة في المنتصف */
  showCircles?: boolean
  /** عرض corner markers في الزوايا */
  showCornerMarkers?: boolean
  /** className إضافية للـ container */
  className?: string
  /** opacity للـ Grid (0-100) */
  gridOpacity?: number
}

/**
 * GridBackground - الخلفية الأساسية لكل صفحات Railos
 *
 * تحتوي على:
 * - Grid pattern (خطوط 80×80 + نقاط عند التقاطعات)
 * - Concentric circles + Radial glow (اختياري)
 * - Corner markers L-shaped (اختياري)
 *
 * الاستخدام:
 * ```tsx
 * <GridBackground />                              // الكل افتراضي
 * <GridBackground showCircles={false} />          // بدون دوائر
 * <GridBackground showCornerMarkers={false} />    // بدون corner markers
 * ```
 */
/**
 * GridBackground — الخلفية المزخرفة (Grid + Circles + Corner markers).
 *
 * تُستخدم فقط في:
 *   - صفحات Splash (SplashSlider)
 *   - صفحات Auth (login / register / forgot-password) عبر AuthLayout
 *
 * كل الصفحات الأخرى تستخدم خلفية سوداء صلبة (#000000) بدون مزخرفات.
 */
export function GridBackground({
  showCircles = true,
  showCornerMarkers = true,
  className,
  gridOpacity = 100,
}: GridBackgroundProps) {
  return (
    <>
      {/* Grid Background - خطوط + نقاط */}
      <svg
        className={cn(
          "absolute inset-0 w-full h-full pointer-events-none z-0",
          className
        )}
        style={{ opacity: gridOpacity / 100, zIndex: 0 }}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="grid-lines-pattern"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 80 0 L 0 0 0 80"
              fill="none"
              stroke="#1a1a1a"
              strokeWidth="0.5"
            />
          </pattern>
          <pattern
            id="grid-dots-pattern"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="0" cy="0" r="1" fill="#333" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-lines-pattern)" />
        <rect width="100%" height="100%" fill="url(#grid-dots-pattern)" />
      </svg>

      {/* Concentric circles + Radial glow */}
      {showCircles && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        >
          <svg width="500" height="500" viewBox="0 0 500 500">
            <defs>
              <radialGradient id="grid-glow" cx="50%" cy="50%">
                <stop offset="0%" stopColor="#1a1a1a" stopOpacity="0.8" />
                <stop offset="70%" stopColor="#0a0a0a" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#000" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="250" cy="250" r="240" fill="url(#grid-glow)" />
            <circle
              cx="250"
              cy="250"
              r="220"
              fill="none"
              stroke="#1a1a1a"
              strokeWidth="0.5"
            />
            <circle
              cx="250"
              cy="250"
              r="170"
              fill="none"
              stroke="#222"
              strokeWidth="0.5"
            />
            <circle
              cx="250"
              cy="250"
              r="120"
              fill="none"
              stroke="#2a2a2a"
              strokeWidth="0.5"
            />
            <circle
              cx="250"
              cy="250"
              r="75"
              fill="none"
              stroke="#333"
              strokeWidth="0.5"
            />
          </svg>
        </div>
      )}

      {/* Corner markers L-shaped */}
      {showCornerMarkers && (
        <>
          <svg
            className="absolute top-8 left-8 w-6 h-6 opacity-50 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1"
            aria-hidden="true"
          >
            <path d="M 0 8 L 0 0 L 8 0" />
          </svg>
          <svg
            className="absolute top-8 right-8 w-6 h-6 opacity-50 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1"
            aria-hidden="true"
          >
            <path d="M 16 0 L 24 0 L 24 8" />
          </svg>
          <svg
            className="absolute bottom-8 left-8 w-6 h-6 opacity-50 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1"
            aria-hidden="true"
          >
            <path d="M 0 16 L 0 24 L 8 24" />
          </svg>
          <svg
            className="absolute bottom-8 right-8 w-6 h-6 opacity-50 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1"
            aria-hidden="true"
          >
            <path d="M 24 16 L 24 24 L 16 24" />
          </svg>
        </>
      )}
    </>
  )
}
