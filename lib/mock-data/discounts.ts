/**
 * Discounts program — exclusive discounts for subscribers + claimed coupons.
 * Used by /discounts/* pages + /admin?tab=discounts_admin.
 */

export type DiscountCategory = "restaurants" | "clothing" | "electronics" | "services" | "travel" | "groceries"
export type CouponStatus = "active" | "used" | "expired"
export type RequiredLevel = "basic" | "advanced" | "pro"

export interface Discount {
  id: string
  brand_name: string
  brand_logo_emoji: string  // emoji as logo placeholder
  category: DiscountCategory
  discount_percent: number
  description: string
  conditions: string[]
  required_level: RequiredLevel
  branches: string[]
  starts_at: string
  ends_at: string
  is_active: boolean
  used_count: number
  max_uses: number
  cover_color: "red" | "blue" | "purple" | "orange" | "green" | "yellow"
}

export interface UserCoupon {
  id: string
  user_id: string
  discount_id: string
  brand_name: string
  brand_logo_emoji: string
  discount_percent: number
  code: string
  barcode: string  // 12-digit numeric string
  status: CouponStatus
  claimed_at: string
  used_at?: string
  expires_at: string
}

// ──────────────────────────────────────────────────────────────────────────
// Discounts (15)
// ──────────────────────────────────────────────────────────────────────────
export const MOCK_DISCOUNTS: Discount[] = [
  { id: "dc-1",  brand_name: "مطاعم بغداد",         brand_logo_emoji: "🍽️", category: "restaurants",  discount_percent: 25, description: "خصم على جميع الوجبات الرئيسية",                                conditions: ["لا يشمل المشروبات",      "حدّ أدنى 30,000 د.ع",       "غير قابل للجمع مع عروض أخرى"],   required_level: "basic",    branches: ["الكرّادة",  "المنصور",  "الجادرية"],                  starts_at: "2026-04-01", ends_at: "2026-06-30", is_active: true,  used_count: 234,  max_uses: 1000, cover_color: "red"    },
  { id: "dc-2",  brand_name: "أزياء الأناقة",        brand_logo_emoji: "👔", category: "clothing",     discount_percent: 30, description: "خصم على الملابس الرجالية والنسائية",                          conditions: ["خلال الموسم الحالي فقط", "لا يشمل التخفيضات السابقة"],                                required_level: "advanced", branches: ["مول الزيتون",  "مول المنصور"],                              starts_at: "2026-03-15", ends_at: "2026-05-15", is_active: true,  used_count: 156,  max_uses: 500,  cover_color: "purple" },
  { id: "dc-3",  brand_name: "إلكترونيات تك",         brand_logo_emoji: "💻", category: "electronics",  discount_percent: 15, description: "خصم على اللابتوبات والأجهزة المحمولة",                       conditions: ["موديلات محدّدة",        "ضمان لمدة سنة"],                                                                            required_level: "advanced", branches: ["شارع فلسطين",   "الكرّادة"],                                  starts_at: "2026-04-10", ends_at: "2026-05-10", is_active: true,  used_count: 89,   max_uses: 200,  cover_color: "blue"   },
  { id: "dc-4",  brand_name: "بيتزا اكسبرس",         brand_logo_emoji: "🍕", category: "restaurants",  discount_percent: 20, description: "خصم على البيتزا والمشروبات الغازية",                              conditions: ["كلّ يوم باستثناء الجمعة"],                                                                                                      required_level: "basic",    branches: ["6 فروع في بغداد"],                                                          starts_at: "2026-04-15", ends_at: "2026-12-31", is_active: true,  used_count: 412,  max_uses: 2000, cover_color: "red"    },
  { id: "dc-5",  brand_name: "السفر السهل",         brand_logo_emoji: "✈️", category: "travel",       discount_percent: 12, description: "خصم على تذاكر السفر داخل العراق",                                  conditions: ["الحجز قبل 7 أيام",         "لا يشمل العطل"],                                                                                  required_level: "advanced", branches: ["مكاتب بغداد", "البصرة"],                                                                                              starts_at: "2026-04-01", ends_at: "2026-09-30", is_active: true,  used_count: 67,   max_uses: 300,  cover_color: "blue"   },
  { id: "dc-6",  brand_name: "كافيه السمراء",       brand_logo_emoji: "☕", category: "restaurants",  discount_percent: 35, description: "خصم على المشروبات والحلويات",                                          conditions: ["السبت إلى الأربعاء فقط"],                                                                                                                            required_level: "basic",    branches: ["الجادرية",     "الكرّادة"],                                                                                                          starts_at: "2026-03-01", ends_at: "2026-08-31", is_active: true,  used_count: 178,  max_uses: 600,  cover_color: "orange" },
  { id: "dc-7",  brand_name: "موبايل بلس",           brand_logo_emoji: "📱", category: "electronics",  discount_percent: 10, description: "خصم على Samsung و iPhone",                                                conditions: ["موديلات الإصدار الأخير"],                                                                                                                              required_level: "pro",      branches: ["شارع فلسطين"],                                                                                                                                                                                          starts_at: "2026-04-20", ends_at: "2026-05-20", is_active: true,  used_count: 23,   max_uses: 100,  cover_color: "blue"   },
  { id: "dc-8",  brand_name: "صيدلية الشفاء",        brand_logo_emoji: "💊", category: "services",     discount_percent: 18, description: "خصم على الأدوية ومستحضرات التجميل",                                          conditions: ["لا يشمل الأدوية المخفّضة سابقاً"],                                                                                                                                                          required_level: "basic",    branches: ["12 فرع في بغداد"],                                                                                                                                                                          starts_at: "2026-01-01", ends_at: "2026-12-31", is_active: true,  used_count: 567,  max_uses: 3000, cover_color: "green"  },
  { id: "dc-9",  brand_name: "متجر الأناقة الفاخر", brand_logo_emoji: "👜", category: "clothing",     discount_percent: 40, description: "خصم على المنتجات الصيفية الجديدة",                                              conditions: ["نهاية الموسم"],                                                                                                                                                                                                                                                                                                  required_level: "pro",      branches: ["مول المنصور"],                                                                                                                                                                                                                                                                                                          starts_at: "2026-04-25", ends_at: "2026-06-25", is_active: true,  used_count: 31,   max_uses: 150,  cover_color: "purple" },
  { id: "dc-10", brand_name: "بقالة العائلة",          brand_logo_emoji: "🛒", category: "groceries",    discount_percent: 8,  description: "خصم على المشتريات الأساسية",                                                                  conditions: ["حدّ أدنى 50,000 د.ع"],                                                                                                                                                                                                                                                                                                          required_level: "basic",    branches: ["8 فروع"],                                                                                                                                                                                                                                                                                                                                                                          starts_at: "2026-02-01", ends_at: "2026-12-31", is_active: true,  used_count: 891,  max_uses: 5000, cover_color: "green"  },
  { id: "dc-11", brand_name: "مطاعم العائلة",          brand_logo_emoji: "🍔", category: "restaurants",  discount_percent: 22, description: "خصم على وجبات العائلة",                                                                                conditions: ["للوجبات العائلية فقط",  "تشمل المشروبات"],                                                                                                                                                                                                                                                                                                                                                                                              required_level: "basic",    branches: ["كلّ الفروع"],                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            starts_at: "2026-03-15", ends_at: "2026-09-15", is_active: true,  used_count: 245,  max_uses: 1500, cover_color: "yellow" },
  { id: "dc-12", brand_name: "جيم العافية",          brand_logo_emoji: "💪", category: "services",     discount_percent: 28, description: "خصم على اشتراكات الجيم السنوية",                                                                                conditions: ["اشتراك سنوي فقط"],                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  required_level: "advanced", branches: ["الكرّادة",  "المنصور"],                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            starts_at: "2026-04-01", ends_at: "2026-07-31", is_active: true,  used_count: 78,   max_uses: 200,  cover_color: "orange" },
  { id: "dc-13", brand_name: "كافيه الكتاب",           brand_logo_emoji: "📚", category: "restaurants",  discount_percent: 15, description: "خصم على الكتب والمشروبات",                                                                                                                            conditions: [],                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              required_level: "basic",    branches: ["الجادرية"],                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            starts_at: "2026-03-01", ends_at: "2027-03-01", is_active: true,  used_count: 134,  max_uses: 800,  cover_color: "yellow" },
  { id: "dc-14", brand_name: "خط الفخامة",            brand_logo_emoji: "💎", category: "clothing",     discount_percent: 50, description: "تنزيلات الموسم النهائية",                                                                                                                                                                                                            conditions: ["كميّات محدودة"],                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              required_level: "pro",      branches: ["مول الزيتون"],                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            starts_at: "2026-04-30", ends_at: "2026-05-15", is_active: true,  used_count: 12,   max_uses: 50,   cover_color: "purple" },
  { id: "dc-15", brand_name: "سياحة العراق",          brand_logo_emoji: "🏔️", category: "travel",       discount_percent: 20, description: "خصم على رحلات اكتشاف العراق الداخلية",                                                                                                                                                                                                conditions: ["مجموعات 4 أشخاص فأكثر"],                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            required_level: "advanced", branches: ["مكتب بغداد"],                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            starts_at: "2026-05-01", ends_at: "2026-10-31", is_active: true,  used_count: 45,   max_uses: 250,  cover_color: "blue"   },
]

// ──────────────────────────────────────────────────────────────────────────
// User Coupons (7)
// ──────────────────────────────────────────────────────────────────────────
function genCode(brand: string): string {
  const prefix = brand.replace(/\s/g, "").slice(0, 4).toUpperCase()
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `${prefix}-${suffix}`
}

function genBarcode(): string {
  let s = ""
  for (let i = 0; i < 12; i++) s += Math.floor(Math.random() * 10).toString()
  return s
}

export const MOCK_USER_COUPONS: UserCoupon[] = [
  { id: "uc-1", user_id: "abc123def456", discount_id: "dc-1",  brand_name: "مطاعم بغداد",         brand_logo_emoji: "🍽️", discount_percent: 25, code: "RAILBAGH-A7K9X", barcode: "847291305612", status: "active",  claimed_at: "2026-04-25 10:30", expires_at: "2026-06-30" },
  { id: "uc-2", user_id: "abc123def456", discount_id: "dc-4",  brand_name: "بيتزا اكسبرس",         brand_logo_emoji: "🍕", discount_percent: 20, code: "RAILPIZZ-M2N8K", barcode: "120495683472", status: "active",  claimed_at: "2026-04-23 14:00", expires_at: "2026-12-31" },
  { id: "uc-3", user_id: "abc123def456", discount_id: "dc-6",  brand_name: "كافيه السمراء",       brand_logo_emoji: "☕", discount_percent: 35, code: "RAILSAMR-X4P1Z", barcode: "956712348021", status: "used",    claimed_at: "2026-04-15 12:00", used_at: "2026-04-18 19:00", expires_at: "2026-08-31" },
  { id: "uc-4", user_id: "abc123def456", discount_id: "dc-8",  brand_name: "صيدلية الشفاء",        brand_logo_emoji: "💊", discount_percent: 18, code: "RAILSHIF-K9L3M", barcode: "473218956401", status: "active",  claimed_at: "2026-04-20 11:45", expires_at: "2026-12-31" },
  { id: "uc-5", user_id: "abc123def456", discount_id: "dc-10", brand_name: "بقالة العائلة",         brand_logo_emoji: "🛒", discount_percent: 8,  code: "RAILGROC-T1V7B", barcode: "682104597321", status: "used",    claimed_at: "2026-04-10 09:00", used_at: "2026-04-12 16:30", expires_at: "2026-12-31" },
  { id: "uc-6", user_id: "abc123def456", discount_id: "dc-3",  brand_name: "إلكترونيات تك",         brand_logo_emoji: "💻", discount_percent: 15, code: "RAILTECH-W2Q5R", barcode: "319847256180", status: "expired", claimed_at: "2026-03-20 14:15", expires_at: "2026-04-15" },
  { id: "uc-7", user_id: "abc123def456", discount_id: "dc-13", brand_name: "كافيه الكتاب",          brand_logo_emoji: "📚", discount_percent: 15, code: "RAILBOOK-J4F6N", barcode: "750392184625", status: "active",  claimed_at: "2026-04-26 09:00", expires_at: "2027-03-01" },
]

// ──────────────────────────────────────────────────────────────────────────
// Labels
// ──────────────────────────────────────────────────────────────────────────
export const CATEGORY_LABELS: Record<DiscountCategory, { label: string; icon: string }> = {
  restaurants: { label: "مطاعم وكافيهات", icon: "🍽️" },
  clothing:    { label: "ملابس وأزياء",    icon: "👔" },
  electronics: { label: "إلكترونيات",        icon: "💻" },
  services:    { label: "خدمات",                icon: "🛠️" },
  travel:      { label: "سفر وسياحة",        icon: "✈️" },
  groceries:   { label: "بقالة",                icon: "🛒" },
}

export const COUPON_STATUS_LABELS: Record<CouponStatus, { label: string; color: "green" | "neutral" | "red" }> = {
  active:  { label: "نشطة",      color: "green"   },
  used:    { label: "مُستخدَمة", color: "neutral" },
  expired: { label: "منتهية",   color: "red"     },
}

export const LEVEL_LABELS: Record<RequiredLevel, { label: string; icon: string }> = {
  basic:    { label: "مبتدئ",  icon: "🌱" },
  advanced: { label: "متقدّم", icon: "⭐" },
  pro:      { label: "محترف",  icon: "👑" },
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
export function getActiveDiscounts(): Discount[] {
  return MOCK_DISCOUNTS.filter((d) => d.is_active)
}

export function getDiscountById(id: string): Discount | undefined {
  return MOCK_DISCOUNTS.find((d) => d.id === id)
}

export function getMyCoupons(userId: string = "abc123def456"): UserCoupon[] {
  return MOCK_USER_COUPONS
    .filter((c) => c.user_id === userId)
    .sort((a, b) => (a.claimed_at < b.claimed_at ? 1 : -1))
}

export function claimCoupon(_userId: string, discount: Discount): UserCoupon {
  const now = new Date().toISOString().replace("T", " ").slice(0, 16)
  return {
    id: `uc-${Date.now()}`,
    user_id: "abc123def456",
    discount_id: discount.id,
    brand_name: discount.brand_name,
    brand_logo_emoji: discount.brand_logo_emoji,
    discount_percent: discount.discount_percent,
    code: genCode(discount.brand_name),
    barcode: genBarcode(),
    status: "active",
    claimed_at: now,
    expires_at: discount.ends_at,
  }
}

export function getDiscountsStats() {
  return {
    total_brands: MOCK_DISCOUNTS.length,
    active_discounts: MOCK_DISCOUNTS.filter((d) => d.is_active).length,
    total_used: MOCK_DISCOUNTS.reduce((s, d) => s + d.used_count, 0),
    total_users_with_coupons: new Set(MOCK_USER_COUPONS.map((c) => c.user_id)).size,
  }
}
