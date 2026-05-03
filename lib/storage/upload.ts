"use client"

/**
 * Supabase Storage helpers (client-side).
 *
 * Buckets (defined in `supabase/migrations/20260503_storage_buckets.sql`):
 *   • kyc-documents      — private, owner-only
 *   • payment-proofs     — private, owner-only
 *   • user-avatars       — public read, owner write
 *   • project-galleries  — public read, admin-only write (server-side)
 *
 * Path convention: every object is uploaded under
 *   `<auth.uid()>/<filename>`
 * RLS on `storage.objects` enforces that — clients can ONLY read/write
 * inside their own folder.
 *
 * All helpers return a discriminated `UploadResult` and never throw.
 */

import { createClient } from "@/lib/supabase/client"

export type StorageBucket =
  | "kyc-documents"
  | "payment-proofs"
  | "user-avatars"
  | "project-galleries"

export interface UploadResult {
  success: boolean
  /** Storage object path (e.g. `<user>/selfie-1234.jpg`) — relative to bucket. */
  path?: string
  /** Public URL — only set when uploading to a public bucket. */
  publicUrl?: string
  /** Arabic-friendly error message on failure. */
  error?: string
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

function validateImage(file: File): string | null {
  if (!file) return "لم يتم اختيار ملف"
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "نوع الملف غير مدعوم — يُقبل JPG / PNG / WEBP فقط"
  }
  if (file.size <= 0) return "الملف فارغ"
  if (file.size > MAX_SIZE_BYTES) {
    return "حجم الملف يتجاوز 10 ميغابايت"
  }
  return null
}

/** Pick a sensible extension from the MIME type (used in stored filenames). */
function getExtension(file: File): string {
  if (file.type === "image/jpeg") return "jpg"
  if (file.type === "image/png") return "png"
  if (file.type === "image/webp") return "webp"
  return "bin"
}

/**
 * Upload a file to a bucket under the current user's folder.
 * Internal — prefer the named helpers below.
 */
async function uploadToBucket(
  bucket: StorageBucket,
  fileName: string,
  file: File,
  isPublic: boolean,
): Promise<UploadResult> {
  const validation = validateImage(file)
  if (validation) return { success: false, error: validation }

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "غير مسجَّل دخول" }

    const path = `${user.id}/${fileName}`
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
        cacheControl: "3600",
      })

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[storage] upload error:", error.message)
      return { success: false, error: "تعذّر رفع الملف — حاول مرّة أخرى" }
    }

    if (isPublic) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      return { success: true, path, publicUrl: data.publicUrl }
    }

    return { success: true, path }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[storage] upload threw:", err)
    return {
      success: false,
      error: err instanceof Error ? err.message : "خطأ غير متوقّع",
    }
  }
}

// ───────────────────────────────────────────────────────────────────
// Specific helpers — call these from pages.
// ───────────────────────────────────────────────────────────────────

/** Upload a KYC selfie. Bucket: kyc-documents (private). */
export async function uploadKycSelfie(file: File): Promise<UploadResult> {
  const ext = getExtension(file)
  return uploadToBucket(
    "kyc-documents",
    `selfie-${Date.now()}.${ext}`,
    file,
    false,
  )
}

/** Upload one side of a KYC ID document. Bucket: kyc-documents (private). */
export async function uploadKycDocument(
  file: File,
  side: "front" | "back",
): Promise<UploadResult> {
  const ext = getExtension(file)
  return uploadToBucket(
    "kyc-documents",
    `document-${side}-${Date.now()}.${ext}`,
    file,
    false,
  )
}

/** Upload a fee-units recharge payment proof. Bucket: payment-proofs (private). */
export async function uploadPaymentProof(file: File): Promise<UploadResult> {
  const ext = getExtension(file)
  return uploadToBucket(
    "payment-proofs",
    `proof-${Date.now()}.${ext}`,
    file,
    false,
  )
}

/**
 * Upload (or replace) the user's avatar. Bucket: user-avatars (public read).
 * Filename is fixed (`avatar.<ext>`) so it overwrites the previous one.
 */
export async function uploadUserAvatar(file: File): Promise<UploadResult> {
  const ext = getExtension(file)
  return uploadToBucket("user-avatars", `avatar.${ext}`, file, true)
}

// ───────────────────────────────────────────────────────────────────
// Read helpers
// ───────────────────────────────────────────────────────────────────

/**
 * Generate a time-limited signed URL for a private object so it can be
 * displayed (e.g. an admin reviewing a KYC submission).
 * Returns null on failure.
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  ttlSeconds = 3600,
): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, ttlSeconds)
    if (error || !data) return null
    return data.signedUrl
  } catch {
    return null
  }
}

/**
 * Public URL for an object in a public bucket.
 * Returns null if the bucket isn't actually public (no fetch — just a URL string).
 */
export function getPublicUrl(bucket: StorageBucket, path: string): string | null {
  try {
    const supabase = createClient()
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl ?? null
  } catch {
    return null
  }
}

/** Delete an object the current user owns. Returns true on success. */
export async function deleteObject(
  bucket: StorageBucket,
  path: string,
): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase.storage.from(bucket).remove([path])
    return !error
  } catch {
    return false
  }
}
