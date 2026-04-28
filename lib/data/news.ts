import { createClient } from "@/lib/supabase/client"

export interface DBNews {
  id: string
  title: string
  slug?: string
  summary?: string
  content?: string
  cover_image_url?: string
  news_type?: string
  tags?: string[]
  related_project_id?: string
  is_published: boolean
  is_pinned?: boolean
  published_at?: string
  views_count?: number
  reactions_count?: number
  created_at?: string
}

export async function getAllNews(limit = 20): Promise<DBNews[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("news")
      .select("*")
      .eq("is_published", true)
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

export async function getLatestNews(limit = 4): Promise<DBNews[]> {
  return getAllNews(limit)
}

export async function getNewsById(id: string): Promise<DBNews | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("news")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return data
  } catch {
    return null
  }
}

export async function getNewsByType(type: string, limit = 10): Promise<DBNews[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("news")
      .select("*")
      .eq("is_published", true)
      .eq("news_type", type)
      .order("published_at", { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}
