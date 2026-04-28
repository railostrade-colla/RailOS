import { ReactNode } from "react"

interface IllustrationProps {
  className?: string
}

/**
 * SVG illustrations - أبيض فقط، stroke 1.5px، مفرغة
 * viewBox معياري: 0 0 200 200
 */

// Slide 1: مباني 3D للاستثمار
export function InvestmentIllustration({ className }: IllustrationProps): ReactNode {
  return (
    <svg viewBox="0 0 200 200" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* المبنى الرئيسي */}
      <rect x="60" y="60" width="80" height="100" fill="none" />
      <line x1="60" y1="60" x2="80" y2="40" />
      <line x1="140" y1="60" x2="160" y2="40" />
      <line x1="80" y1="40" x2="160" y2="40" />
      <line x1="160" y1="40" x2="160" y2="140" />
      <line x1="140" y1="160" x2="160" y2="140" />
      {/* النوافذ */}
      <rect x="70" y="75" width="14" height="14" />
      <rect x="93" y="75" width="14" height="14" />
      <rect x="116" y="75" width="14" height="14" />
      <rect x="70" y="100" width="14" height="14" />
      <rect x="93" y="100" width="14" height="14" />
      <rect x="116" y="100" width="14" height="14" />
      <rect x="70" y="125" width="14" height="14" />
      <rect x="93" y="125" width="14" height="14" fill="white" />
      <rect x="116" y="125" width="14" height="14" />
      {/* الباب */}
      <rect x="92" y="143" width="16" height="17" />
      {/* عناصر زخرفية */}
      <circle cx="40" cy="80" r="6" />
      <text x="40" y="84" textAnchor="middle" fill="white" stroke="none" fontSize="8" fontWeight="700">$</text>
      <circle cx="170" cy="100" r="5" />
      <text x="170" y="103" textAnchor="middle" fill="white" stroke="none" fontSize="7" fontWeight="700">$</text>
      <circle cx="35" cy="130" r="4" />
      {/* نجوم */}
      <path d="M 175 60 L 177 65 L 182 65 L 178 68 L 180 73 L 175 70 L 170 73 L 172 68 L 168 65 L 173 65 Z" />
      <path d="M 30 50 L 31 53 L 34 53 L 32 55 L 33 58 L 30 56 L 27 58 L 28 55 L 26 53 L 29 53 Z" />
    </svg>
  )
}

// Slide 2: Candlestick chart للتداول الحي
export function TradingIllustration({ className }: IllustrationProps): ReactNode {
  return (
    <svg viewBox="0 0 200 200" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* محور Y */}
      <line x1="30" y1="40" x2="30" y2="160" />
      <line x1="30" y1="160" x2="180" y2="160" />
      {/* الشموع - candlesticks */}
      {/* شمعة 1 - صاعدة */}
      <line x1="50" y1="100" x2="50" y2="140" />
      <rect x="44" y="110" width="12" height="20" />
      {/* شمعة 2 - هابطة */}
      <line x1="75" y1="80" x2="75" y2="130" />
      <rect x="69" y="95" width="12" height="18" fill="white" fillOpacity="0.4" />
      {/* شمعة 3 - صاعدة */}
      <line x1="100" y1="60" x2="100" y2="120" />
      <rect x="94" y="75" width="12" height="25" />
      {/* شمعة 4 - صاعدة */}
      <line x1="125" y1="55" x2="125" y2="105" />
      <rect x="119" y="65" width="12" height="30" />
      {/* شمعة 5 - هابطة */}
      <line x1="150" y1="50" x2="150" y2="95" />
      <rect x="144" y="60" width="12" height="22" fill="white" fillOpacity="0.4" />
      {/* خط الترند */}
      <path d="M 50 115 Q 100 80 150 60" strokeDasharray="3 3" />
      {/* أرقام */}
      <text x="22" y="50" fill="white" stroke="none" fontSize="7" fontFamily="monospace">$$$</text>
      <text x="22" y="105" fill="white" stroke="none" fontSize="7" fontFamily="monospace">$$</text>
      <text x="22" y="160" fill="white" stroke="none" fontSize="7" fontFamily="monospace">$</text>
      {/* مؤشر LIVE */}
      <circle cx="170" cy="55" r="3" fill="white" />
      <circle cx="170" cy="55" r="6" />
    </svg>
  )
}

// Slide 3: شبكة السفير
export function AmbassadorIllustration({ className }: IllustrationProps): ReactNode {
  return (
    <svg viewBox="0 0 200 200" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* المركز - السفير */}
      <circle cx="100" cy="100" r="18" />
      <circle cx="100" cy="95" r="6" />
      <path d="M 88 113 Q 100 105 112 113" />
      {/* النجمة في الوسط */}
      <path d="M 100 75 L 103 82 L 110 82 L 105 87 L 107 94 L 100 90 L 93 94 L 95 87 L 90 82 L 97 82 Z" fill="white" stroke="none" fillOpacity="0.3" />
      {/* الشبكة - 6 أشخاص حول السفير */}
      {/* أعلى */}
      <circle cx="100" cy="40" r="10" />
      <circle cx="100" cy="37" r="3" />
      <line x1="100" y1="58" x2="100" y2="82" strokeDasharray="2 2" />
      {/* يمين أعلى */}
      <circle cx="155" cy="65" r="10" />
      <circle cx="155" cy="62" r="3" />
      <line x1="146" y1="74" x2="115" y2="92" strokeDasharray="2 2" />
      {/* يمين أسفل */}
      <circle cx="155" cy="135" r="10" />
      <circle cx="155" cy="132" r="3" />
      <line x1="146" y1="126" x2="115" y2="108" strokeDasharray="2 2" />
      {/* أسفل */}
      <circle cx="100" cy="160" r="10" />
      <circle cx="100" cy="157" r="3" />
      <line x1="100" y1="142" x2="100" y2="118" strokeDasharray="2 2" />
      {/* يسار أسفل */}
      <circle cx="45" cy="135" r="10" />
      <circle cx="45" cy="132" r="3" />
      <line x1="54" y1="126" x2="85" y2="108" strokeDasharray="2 2" />
      {/* يسار أعلى */}
      <circle cx="45" cy="65" r="10" />
      <circle cx="45" cy="62" r="3" />
      <line x1="54" y1="74" x2="85" y2="92" strokeDasharray="2 2" />
      {/* علامات + للمكافآت */}
      <text x="155" y="50" textAnchor="middle" fill="white" stroke="none" fontSize="10" fontWeight="700">+</text>
      <text x="155" y="170" textAnchor="middle" fill="white" stroke="none" fontSize="10" fontWeight="700">+</text>
      <text x="45" y="50" textAnchor="middle" fill="white" stroke="none" fontSize="10" fontWeight="700">+</text>
    </svg>
  )
}

// Slide 4: لوحة تحليلية
export function AnalyticsIllustration({ className }: IllustrationProps): ReactNode {
  return (
    <svg viewBox="0 0 200 200" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* الإطار الرئيسي */}
      <rect x="30" y="40" width="140" height="120" rx="6" />
      {/* الهيدر */}
      <line x1="30" y1="60" x2="170" y2="60" />
      <circle cx="40" cy="50" r="2" fill="white" />
      <circle cx="48" cy="50" r="2" fill="white" />
      <circle cx="56" cy="50" r="2" fill="white" />
      {/* محور y */}
      <line x1="45" y1="75" x2="45" y2="145" strokeOpacity="0.4" />
      {/* محور x */}
      <line x1="45" y1="145" x2="160" y2="145" strokeOpacity="0.4" />
      {/* خط الرسم البياني الصاعد */}
      <path d="M 50 130 L 65 125 L 80 115 L 95 100 L 110 95 L 125 75 L 140 70 L 155 65" />
      {/* تظليل تحت الخط */}
      <path d="M 50 130 L 65 125 L 80 115 L 95 100 L 110 95 L 125 75 L 140 70 L 155 65 L 155 145 L 50 145 Z" fill="white" fillOpacity="0.05" stroke="none" />
      {/* النقاط */}
      <circle cx="50" cy="130" r="2" fill="white" />
      <circle cx="80" cy="115" r="2" fill="white" />
      <circle cx="110" cy="95" r="2" fill="white" />
      <circle cx="140" cy="70" r="2" fill="white" />
      <circle cx="155" cy="65" r="3" fill="white" />
      {/* tooltip فوق آخر نقطة */}
      <rect x="135" y="40" width="35" height="14" rx="2" />
      <text x="152" y="50" textAnchor="middle" fill="white" stroke="none" fontSize="7" fontFamily="monospace">+18%</text>
      <line x1="155" y1="54" x2="155" y2="65" />
      {/* أعمدة صغيرة على اليسار */}
      <rect x="48" y="155" width="3" height="3" fill="white" />
      <rect x="55" y="152" width="3" height="6" fill="white" />
      <rect x="62" y="148" width="3" height="10" fill="white" />
      <rect x="69" y="150" width="3" height="8" fill="white" />
      {/* arrows up */}
      <path d="M 162 32 L 165 28 L 168 32" />
      <line x1="165" y1="28" x2="165" y2="35" />
    </svg>
  )
}
