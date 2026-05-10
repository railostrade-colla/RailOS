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
  /** Phase 13.8 — denormalised project logo URL for the printed copy. */
  project_logo_url?: string
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

// v2 key — bumped from "railos_invoices" because the v1 key was
// pre-seeded with 5 mock invoices ("مزرعة الواحة", "برج بغداد", etc.)
// that would persist in users' browsers across refreshes. Bumping the
// key orphans the old cache so admins land on a clean slate.
const STORAGE_KEY = "railos_invoices_v2"
const LEGACY_STORAGE_KEY = "railos_invoices"

const _store: Invoice[] = []
let _hydrated = false

/** One-time cleanup of the v1 cache so the seeded mock invoices vanish. */
function purgeLegacyCache() {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch { /* silent */ }
}

function hydrate() {
  if (_hydrated || typeof window === "undefined") return
  purgeLegacyCache()
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

/**
 * Phase 13.7 — DB row shape (flat columns) → nested Invoice shape.
 * The DB stores from/to as separate columns (from_user_id, from_name,
 * to_user_id, to_name, …) so they're queryable + indexable. The
 * Invoice TS interface keeps them as nested party objects for UI
 * convenience. This mapper bridges the two.
 */
interface InvoiceRow {
  id: string
  number: string
  type: InvoiceType
  status: "issued" | "voided"
  from_user_id: string | null
  from_name: string
  from_email: string | null
  from_phone: string | null
  to_user_id: string | null
  to_name: string
  to_email: string | null
  to_phone: string | null
  project_id: string | null
  project_name: string
  project_symbol: string | null
  project_logo_url: string | null
  shares_amount: number | string
  price_per_share: number | string
  subtotal: number | string
  platform_fee_units: number | string | null
  total_amount: number | string
  source_id: string | null
  digital_signature: string
  issued_at: string
  completed_at: string
  notes: string | null
}

function rowToInvoice(r: InvoiceRow): Invoice {
  const num = (v: number | string | null | undefined): number =>
    v == null ? 0 : (typeof v === "string" ? Number(v) : v) || 0
  return {
    id: r.id,
    number: r.number,
    type: r.type,
    status: r.status,
    from: {
      id: r.from_user_id ?? "",
      name: r.from_name,
      email: r.from_email ?? undefined,
      phone: r.from_phone ?? undefined,
    },
    to: {
      id: r.to_user_id ?? "",
      name: r.to_name,
      email: r.to_email ?? undefined,
      phone: r.to_phone ?? undefined,
    },
    project_id: r.project_id ?? "",
    project_name: r.project_name,
    project_symbol: r.project_symbol ?? undefined,
    project_logo_url: r.project_logo_url ?? undefined,
    shares_amount: num(r.shares_amount),
    price_per_share: num(r.price_per_share),
    subtotal: num(r.subtotal),
    platform_fee_units: num(r.platform_fee_units),
    total_amount: num(r.total_amount),
    source_id: r.source_id ?? undefined,
    digital_signature: r.digital_signature,
    issued_at: r.issued_at,
    completed_at: r.completed_at,
    notes: r.notes ?? undefined,
  }
}

/**
 * Async DB-backed list. Reads the real `invoices` table (Phase 13.7
 * schema). Falls back to the local store only when the DB read fails
 * AND the local store has rows (legacy compatibility). When the DB
 * succeeds — even if it returns 0 rows — that's the truth, so the
 * admin panel correctly shows an empty state instead of pre-seeded
 * mocks.
 */
export async function getAllInvoicesAsync(limit = 500): Promise<Invoice[]> {
  hydrate()
  try {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("completed_at", { ascending: false })
      .limit(limit)
    if (!error && Array.isArray(data)) {
      // DB read succeeded — authoritative, even if empty.
      return (data as InvoiceRow[]).map(rowToInvoice)
    }
  } catch {
    // Fall through to local store on hard failure (network / SDK).
  }
  return [..._store]
}

/**
 * Phase 13.8 — async by-id fetcher that hits the real DB. The
 * synchronous getInvoiceById() above only ever knew about the local
 * store; for invoices that are issued by the deal-completion trigger
 * the page would always 404. Falls back to the local store for
 * compat with any legacy callers.
 */
export async function getInvoiceByIdAsync(id: string): Promise<Invoice | undefined> {
  hydrate()
  try {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .or(`id.eq.${id},number.eq.${id}`)
      .maybeSingle()
    if (!error && data) {
      return rowToInvoice(data as InvoiceRow)
    }
  } catch {
    // fall through to local
  }
  return _store.find((i) => i.id === id || i.number === id)
}

/**
 * Phase 13.8 — fetch invoices linked to a specific deal id. Returns
 * BOTH the buyer-side (exchange_buy) and seller-side (exchange_sell)
 * invoices so the post-deal modal can show the one that belongs to
 * the calling user.
 */
export async function getInvoicesByDealIdAsync(dealId: string): Promise<Invoice[]> {
  try {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("source_id", dealId)
      .order("type", { ascending: true })
    if (!error && Array.isArray(data)) {
      return (data as InvoiceRow[]).map(rowToInvoice)
    }
  } catch { /* ignore */ }
  return []
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
// Seed mock invoices — DISABLED in production mode.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Production mode: seeding mock invoices is disabled. The function is
 * still exported so existing callers compile, but it's now a no-op.
 *
 * The first call (from any page) also triggers the v1→v2 cache purge
 * via hydrate(), which clears the legacy "railos_invoices" key that
 * may still hold the 5 seeded mocks (مزرعة الواحة، برج بغداد، …) in
 * the user's browser.
 */
export function seedMockInvoices() {
  hydrate()
  // Intentionally no-op. Real invoices land in the store via
  // createInvoice() (called from /wallet/send + /deals/[id]) or from
  // the future server-side invoice generator.
}
