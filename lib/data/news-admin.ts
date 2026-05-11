"use client"

/**
 * news-admin — Phase 13.63.
 *
 * Admin-only CRUD wrappers for the news system + image upload to
 * the `news-images` bucket. Consumed by NewsAdminPanel inside the
 * Admin → Content → الأخبار tab.
 */

import { createClient } from "@/lib/supabase/client"

export interface CreateNewsInput {
  title: string
  content: string
  summary?: string
  news_type?: "announcement" | "market_update" | "project_news" | "platform_update" | "educational"
  cover_image_url?: string
  related_project_id?: string
  is_pinned?: boolean
  publish?: boolean
}

export interface UpdateNewsInput {
  news_id: string
  title?: string
  content?: string
  summary?: string
  news_type?: CreateNewsInput["news_type"]
  cover_image_url?: string
  related_project_id?: string
  is_pinned?: boolean
  is_published?: boolean
}

export interface NewsRpcResult {
  success: boolean
  news_id?: string
  slug?: string
  error?: string
}

const NEWS_IMAGES_BUCKET = "news-images"
const ALLOWED_IMG = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"])
const MAX_IMG_BYTES = 5 * 1024 * 1024 // 5MB

export async function uploadNewsImage(file: File): Promise<{ url: string } | { error: string }> {
  if (file.size > MAX_IMG_BYTES) {
    return { error: "حجم الصورة أكبر من 5MB" }
  }
  if (!ALLOWED_IMG.has(file.type)) {
    return { error: "نوع غير مسموح (PNG/JPEG/WEBP فقط)" }
  }
  try {
    const supabase = createClient()
    const ext = file.type === "image/png" ? "png"
              : file.type === "image/webp" ? "webp"
              : "jpg"
    const fileName = `${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage
      .from(NEWS_IMAGES_BUCKET)
      .upload(fileName, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      })
    if (error) return { error: error.message }
    const { data } = supabase.storage.from(NEWS_IMAGES_BUCKET).getPublicUrl(fileName)
    return { url: data.publicUrl }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "upload_failed" }
  }
}

export async function adminCreateNews(input: CreateNewsInput): Promise<NewsRpcResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_create_news", {
      p_title: input.title,
      p_content: input.content,
      p_summary: input.summary ?? null,
      p_news_type: input.news_type ?? "announcement",
      p_cover_image_url: input.cover_image_url ?? null,
      p_related_project_id: input.related_project_id ?? null,
      p_is_pinned: input.is_pinned ?? false,
      p_publish: input.publish ?? true,
    })
    if (error) return { success: false, error: error.message }
    type Row = { success?: boolean; news_id?: string; slug?: string; error?: string }
    const r = (data ?? {}) as Row
    if (!r.success) return { success: false, error: r.error ?? "unknown" }
    return { success: true, news_id: r.news_id, slug: r.slug }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "unknown" }
  }
}

export async function adminUpdateNews(input: UpdateNewsInput): Promise<NewsRpcResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_update_news", {
      p_news_id: input.news_id,
      p_title: input.title ?? null,
      p_content: input.content ?? null,
      p_summary: input.summary ?? null,
      p_news_type: input.news_type ?? null,
      p_cover_image_url: input.cover_image_url ?? null,
      p_related_project_id: input.related_project_id ?? null,
      p_is_pinned: input.is_pinned ?? null,
      p_is_published: input.is_published ?? null,
    })
    if (error) return { success: false, error: error.message }
    type Row = { success?: boolean; error?: string }
    const r = (data ?? {}) as Row
    if (!r.success) return { success: false, error: r.error ?? "unknown" }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "unknown" }
  }
}

export async function adminDeleteNews(newsId: string): Promise<NewsRpcResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_delete_news", {
      p_news_id: newsId,
    })
    if (error) return { success: false, error: error.message }
    type Row = { success?: boolean; error?: string }
    const r = (data ?? {}) as Row
    if (!r.success) return { success: false, error: r.error ?? "unknown" }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "unknown" }
  }
}
