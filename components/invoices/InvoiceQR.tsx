/**
 * InvoiceQR — QR-style block للفاتورة (deterministic).
 *
 * Mock mode: ينشئ نمط 21×21 شبيه بـ QR من hash النص.
 * Production: يُستبدَل بمكتبة `qrcode` لتوليد QR حقيقي قابل للقراءة.
 */

import { cn } from "@/lib/utils/cn"

interface Props {
  /** النص المُرمَّز (عادةً URL للفاتورة + التوقيع). */
  value: string
  /** الحجم بالبكسل (افتراضي 120). */
  size?: number
  className?: string
}

/** يولّد bitmap 21×21 deterministic من النص. */
function generatePattern(value: string): boolean[][] {
  const size = 21
  const grid: boolean[][] = []
  // simple deterministic hash
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  const seed = Math.abs(hash) || 1

  for (let y = 0; y < size; y++) {
    const row: boolean[] = []
    for (let x = 0; x < size; x++) {
      // Position markers (3 corners)
      const inMarker =
        (x < 7 && y < 7) ||
        (x >= size - 7 && y < 7) ||
        (x < 7 && y >= size - 7)
      if (inMarker) {
        const isFinder =
          (x === 0 || x === 6 || y === 0 || y === 6 ||
           (x >= 2 && x <= 4 && y >= 2 && y <= 4)) &&
          !((x === 1 || x === 5) && (y >= 1 && y <= 5)) &&
          !((y === 1 || y === 5) && (x >= 1 && x <= 5))
        // recompute markers cleanly
        const lx = x < 7 ? x : x - (size - 7)
        const ly = y < 7 ? y : y - (size - 7)
        const onMarkerEdge = lx === 0 || lx === 6 || ly === 0 || ly === 6
        const onMarkerCenter = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4
        row.push(onMarkerEdge || onMarkerCenter)
        continue
      }
      // Data area — pseudo-random based on (x,y,seed)
      const v = ((x * 73856093) ^ (y * 19349663) ^ seed) >>> 0
      row.push((v & 1) === 1)
    }
    grid.push(row)
  }
  return grid
}

export function InvoiceQR({ value, size = 120, className }: Props) {
  const grid = generatePattern(value)
  const cellSize = size / grid.length

  return (
    <div
      className={cn("bg-white p-2 rounded-lg inline-block", className)}
      style={{ width: size + 16, height: size + 16 }}
      role="img"
      aria-label={`QR code for ${value}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width={size} height={size} fill="white" />
        {grid.map((row, y) =>
          row.map(
            (filled, x) =>
              filled && (
                <rect
                  key={`${x}-${y}`}
                  x={x * cellSize}
                  y={y * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill="black"
                />
              )
          )
        )}
      </svg>
    </div>
  )
}
