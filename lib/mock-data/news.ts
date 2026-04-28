/**
 * Platform news feed — used by /dashboard and /news pages.
 * In production, this comes from a CMS or admin-controlled table.
 */

export type NewsType = "announcement" | "update" | "tip" | "feature"

export interface PlatformNews {
  id: string
  type: NewsType
  icon: string
  title: string
  excerpt: string
  date: string
  is_new?: boolean
}

export const PLATFORM_NEWS: PlatformNews[] = [
  {
    id: "n1",
    type: "feature",
    icon: "🎉",
    title: "إطلاق ميزة العقود الجماعية",
    excerpt: "اشترك مع آخرين لزيادة حدودك الشهرية بنسبة 25% — تجربة استثمارية أقوى مع شركاء موثوقين.",
    date: "منذ يومين",
    is_new: true,
  },
  {
    id: "n2",
    type: "announcement",
    icon: "📢",
    title: "5 شركات جديدة انضمّت للمنصة",
    excerpt: "اكتشف فرصاً استثمارية متنوّعة في عدة قطاعات — زراعة، عقارات، صناعة، وأكثر.",
    date: "منذ 4 أيام",
    is_new: true,
  },
  {
    id: "n3",
    type: "tip",
    icon: "💡",
    title: "نصيحة: نوّع محفظتك",
    excerpt: "التنويع في 3 قطاعات أو أكثر يقلّل المخاطر ويزيد فرص العائد المستقر على المدى الطويل.",
    date: "منذ أسبوع",
  },
  {
    id: "n4",
    type: "update",
    icon: "🔄",
    title: "تحديث: تحسينات على الواجهة",
    excerpt: "تجربة استخدام أسرع وأسهل في كل الصفحات — لوحة قيادة جديدة وتنقّل أفضل.",
    date: "منذ أسبوعين",
  },
  {
    id: "n5",
    type: "feature",
    icon: "💎",
    title: "Quick Sell Premium متاح الآن",
    excerpt: "بيع حصصك فورياً بخصم 15% على العمولة. اشتراك شهري مرن وإلغاء في أي وقت.",
    date: "منذ أسبوعين",
    is_new: true,
  },
  {
    id: "n6",
    type: "tip",
    icon: "📚",
    title: "دليل المبتدئين في الاستثمار",
    excerpt: "تعلّم الأساسيات: كيف تختار مشروعاً، وكيف تقرأ الأرقام، وكيف تتجنّب الأخطاء الشائعة.",
    date: "منذ 3 أسابيع",
  },
  {
    id: "n7",
    type: "announcement",
    icon: "🏆",
    title: "برنامج السفير: ادعو واربح",
    excerpt: "ادعُ أصدقاءك للمنصة واكسب حصصاً مجانية في مشاريع مختارة. كل صديق = ربح.",
    date: "منذ شهر",
  },
  {
    id: "n8",
    type: "update",
    icon: "🔒",
    title: "تحسينات أمنية مهمة",
    excerpt: "أضفنا طبقة حماية إضافية للجلسات وتشفير محسّن للبيانات الحساسة.",
    date: "منذ شهر",
  },
  {
    id: "n9",
    type: "feature",
    icon: "📊",
    title: "لوحة تحليلات استثماراتك",
    excerpt: "صفحة جديدة تعرض أداء محفظتك بتفصيل — مخططات، توزيع قطاعات، توقّعات.",
    date: "منذ شهر",
    is_new: true,
  },
  {
    id: "n10",
    type: "tip",
    icon: "🎯",
    title: "متى تشتري؟ متى تبيع؟",
    excerpt: "قواعد ذهبية لتوقيت قراراتك الاستثمارية — الصبر والمعلومة هما السلاح الأقوى.",
    date: "منذ شهرين",
  },
  {
    id: "n11",
    type: "announcement",
    icon: "🌍",
    title: "توسّع جغرافي: 6 محافظات جديدة",
    excerpt: "خدمات رايلوس متاحة الآن في كل محافظات العراق — استثمر من أي مكان.",
    date: "منذ شهرين",
  },
  {
    id: "n12",
    type: "update",
    icon: "⚡",
    title: "تحسين أداء التطبيق بنسبة 40%",
    excerpt: "تحديث شامل للبنية التحتية يجعل التطبيق أسرع وأكثر استجابة على كل الأجهزة.",
    date: "منذ 3 أشهر",
  },
]

export function getRecentNews(limit: number = 4): PlatformNews[] {
  return PLATFORM_NEWS.slice(0, limit)
}

/** Filter by news type. */
export function getNewsByType(type: NewsType): PlatformNews[] {
  return PLATFORM_NEWS.filter((n) => n.type === type)
}

/** Search across title + excerpt. */
export function searchNews(query: string): PlatformNews[] {
  if (!query.trim()) return PLATFORM_NEWS
  const q = query.toLowerCase().trim()
  return PLATFORM_NEWS.filter(
    (n) => n.title.toLowerCase().includes(q) || n.excerpt.toLowerCase().includes(q),
  )
}

/** Get the most recent "featured" item — first new item or just first. */
export function getFeaturedNews(): PlatformNews {
  return PLATFORM_NEWS.find((n) => n.is_new) ?? PLATFORM_NEWS[0]
}
