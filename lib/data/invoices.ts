/**
 * Invoices System — نظام الفواتير الرسمي.
 *
 * كل فاتورة تُعتبر **عقد رسمي** لامتلاك الحصص في رايلوس.
 * تُنشأ تلقائياً بعد إتمام أي عملية ناجحة:
 *   - شراء/بيع من /exchange
 *   - البيع السريع
 *   - الشراء المباشر من السوق
 *   - فوز المزاد
 *   - تحويل/استلام الحصص
 *
 * في Mock mode: تُحفظ في الذاكرة + localStorage (persist عبر sessions).
 * في Production: تُحفظ في جدول `invoices` في Supabase.
 */

export type InvoiceType =
  | "exchange_buy"
  | "exchange_sell"
  | "quick_sell_buy"
  | "quick_sell_sell"
  | "direct_buy"
  | "auction_win"
  | "transfer_send"
  | "transfer_receive"

export interface InvoiceParty {
  id: string
  name: string
  email?: string
  phone?: string
}

export interface Invoice {
  /** الرقم الفريد، مثل: INV-2026-04-30-A8F2 */
  id: string
  /** الأرقام المتسلسلة فقط (للعرض في القوائم). */
  number: string

  type: InvoiceType
  status: "issued" | "voided"

  // الأطراف
  from: InvoiceParty   // البائع/المُرسِل
  to: InvoiceParty     // المشتري/المُستلِم

  // المشروع والحصص
  project_id: string
  project_name: string
  project_symbol?: string
  shares_amount: number
  price_per_share: number
  subtotal: number       // shares_amount * price_per_share

  // الرسوم (وحدات الرسوم)
  platform_fee_units: number  // الرسوم بوحدات الرسوم

  // الإجمالي النهائي بالد.ع (للطرف الذي يدفع)
  total_amount: number

  // الربط بالعملية الأصلية
  source_id?: string  // deal_id, auction_id, transfer_id, etc.

  // الختم الرقمي (hash للتحقّق)
  digital_signature: string

  // التواريخ
  issued_at: string  // ISO
  completed_at: string

  // ملاحظات اختيارية
  notes?: string
}

// ──────────────────────────────────────────────────────────────────────────
// Type metadata
// ──────────────────────────────────────────────────────────────────────────

export const INVOICE_TYPE_META: Record<
  InvoiceType,
  { label: string; icon: string; color: "green" | "red" | "blue" | "purple" | "orange" | "yellow" }
> = {
  exchange_buy:      { label: "شراء من سوق التبادل",  icon: "🛒", color: "green"  },
  exchange_sell:     { label: "بيع في سوق التبادل",   icon: "💰", color: "red"    },
  quick_sell_buy:    { label: "شراء (بيع سريع)",       icon: "⚡", color: "orange" },
  quick_sell_sell:   { label: "بيع (بيع سريع)",        icon: "⚡", color: "yellow" },
  direct_buy:        { label: "شراء مباشر من النظام",  icon: "🏗️", color: "blue"   },
  auction_win:       { label: "فوز بمزاد",             icon: "🏆", color: "purple" },
  transfer_send:     { label: "تحويل حصص (مُرسَل)",     icon: "📤", color: "orange" },
  transfer_receive:  { label: "تحويل حصص (مُستلَم)",    icon: "📥", color: "green"  },
}

// ──────────────────────────────────────────────────────────────────────────
// Number generation
// ──────────────────────────────────────────────────────────────────────────

let _seq = 0

/**
 * يُولِّد رقم فاتورة فريد:
 *   INV-{YYYY-MM-DD}-{4-char base36}
 *   مثال: INV-2026-04-30-A8F2
 */
export function generateInvoiceNumber(): string {
  _seq = (_seq + 1) % 0xfff
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)  // YYYY-MM-DD
  const rand = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, "0")
  return `INV-${dateStr}-${rand}`
}

/**
 * يُولِّد توقيع رقمي (hash) للفاتورة:
 *   - مبني على: id + total + parties + completed_at
 *   - في Production: يستخدم HMAC-SHA256 server-side
 */
export function generateDigitalSignature(invoice: Omit<Invoice, "digital_signature">): string {
  const payload = `${invoice.id}|${invoice.from.id}->${invoice.to.id}|${invoice.shares_amount}|${invoice.total_amount}|${invoice.completed_at}`
  // Simple deterministic hash (mock — في Production: HMAC-SHA256)
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    hash = (hash << 5) - hash + payload.charCodeAt(i)
    hash |= 0
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, "0")
  return `RX${hex.slice(0, 4)}-${hex.slice(4, 8)}-${Date.now().toString(36).slice(-4).toUpperCase()}`
}

// ──────────────────────────────────────────────────────────────────────────
// Storage (in-memory + localStorage persist)
// ──────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "railos_invoices"

const _store: Invoice[] = []
let _hydrated = false

function hydrate() {
  if (_hydrated || typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Invoice[]
      _store.push(...parsed)
    }
  } catch { /* silent */ }
  _hydrated = true
}

function persist() {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_store))
  } catch { /* silent */ }
}

// ──────────────────────────────────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────────────────────────────────

export interface CreateInvoiceInput {
  type: InvoiceType
  from: InvoiceParty
  to: InvoiceParty
  project_id: string
  project_name: string
  project_symbol?: string
  shares_amount: number
  price_per_share: number
  platform_fee_units?: number
  source_id?: string
  notes?: string
}

export function createInvoice(input: CreateInvoiceInput): Invoice {
  hydrate()
  const id = generateInvoiceNumber()
  const number = id.replace("INV-", "").replace(/-/g, "")
  const now = new Date().toISOString()
  const subtotal = input.shares_amount * input.price_per_share

  const baseInvoice: Omit<Invoice, "digital_signature"> = {
    id,
    number,
    type: input.type,
    status: "issued",
    from: input.from,
    to: input.to,
    project_id: input.project_id,
    project_name: input.project_name,
    project_symbol: input.project_symbol,
    shares_amount: input.shares_amount,
    price_per_share: input.price_per_share,
    subtotal,
    platform_fee_units: input.platform_fee_units ?? 0,
    total_amount: subtotal,
    source_id: input.source_id,
    issued_at: now,
    completed_at: now,
    notes: input.notes,
  }

  const invoice: Invoice = {
    ...baseInvoice,
    digital_signature: generateDigitalSignature(baseInvoice),
  }

  _store.unshift(invoice)
  persist()
  return invoice
}

export function getInvoiceById(id: string): Invoice | undefined {
  hydrate()
  return _store.find((i) => i.id === id || i.number === id)
}

export function getAllInvoices(): Invoice[] {
  hydrate()
  return [..._store]
}

export function getInvoicesByUser(userId: string): Invoice[] {
  hydrate()
  return _store.filter((i) => i.from.id === userId || i.to.id === userId)
}

export function getInvoicesBySourceId(sourceId: string): Invoice[] {
  hydrate()
  return _store.filter((i) => i.source_id === sourceId)
}

export function searchInvoices(query: string): Invoice[] {
  hydrate()
  const q = query.trim().toLowerCase()
  if (!q) return [..._store]
  return _store.filter(
    (i) =>
      i.id.toLowerCase().includes(q) ||
      i.number.toLowerCase().includes(q) ||
      i.from.id.toLowerCase().includes(q) ||
      i.to.id.toLowerCase().includes(q) ||
      i.from.name.includes(query) ||
      i.to.name.includes(query) ||
      i.project_name.includes(query)
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Seed mock invoices (5 examples)
// ──────────────────────────────────────────────────────────────────────────

export function seedMockInvoices() {
  hydrate()
  if (_store.length > 0) return  // already seeded

  const types: InvoiceType[] = [
    "exchange_buy",
    "auction_win",
    "transfer_receive",
    "direct_buy",
    "quick_sell_sell",
  ]
  const samples = [
    { proj: "مزرعة الواحة", sym: "WAH", shares: 50, price: 100_000 },
    { proj: "برج بغداد",     sym: "BGD", shares: 4,  price: 250_000 },
    { proj: "نخيل العراق",   sym: "PLM", shares: 10, price: 90_000 },
    { proj: "مجمع الكرخ",    sym: "KRX", shares: 20, price: 175_000 },
    { proj: "صفا الذهبي",    sym: "SAF", shares: 15, price: 120_000 },
  ]

  for (let i = 0; i < types.length; i++) {
    const s = samples[i]
    const t = types[i]
    const ago = (i + 1) * 86_400_000  // i days ago
    const issuedAt = new Date(Date.now() - ago).toISOString()
    const inv: Invoice = (() => {
      const base: Omit<Invoice, "digital_signature"> = {
        id: generateInvoiceNumber(),
        number: "",
        type: t,
        status: "issued",
        from: { id: "u_seed_" + i, name: i % 2 === 0 ? "علي حسن" : "إدارة المنصّة", email: "from@example.com" },
        to: { id: "abc123def456", name: "أحمد محمد", email: "ahmed.m@example.com" },
        project_id: String(i + 1),
        project_name: s.proj,
        project_symbol: s.sym,
        shares_amount: s.shares,
        price_per_share: s.price,
        subtotal: s.shares * s.price,
        platform_fee_units: Math.floor((s.shares * s.price) * 0.025),
        total_amount: s.shares * s.price,
        source_id: `src_${i}`,
        issued_at: issuedAt,
        completed_at: issuedAt,
      }
      base.number = base.id.replace("INV-", "").replace(/-/g, "")
      return { ...base, digital_signature: generateDigitalSignature(base) }
    })()
    _store.push(inv)
  }
  persist()
}
