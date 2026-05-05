"use client"

/**
 * faqs — surfaces the orphan `faqs` table via a defensive RPC that
 * handles unknown column shapes gracefully.
 */

import { createClient } from "@/lib/supabase/client"

export interface FaqItem {
  id: string
  question: string
  answer: string
  category: string
  ordering: number
  is_active: boolean
}

export async function getActiveFaqs(): Promise<FaqItem[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_active_faqs")
    if (error || !Array.isArray(data)) return []
    return (data as FaqItem[]).map((f) => ({
      id: String(f.id ?? ""),
      question: f.question ?? "",
      answer: f.answer ?? "",
      category: f.category ?? "",
      ordering: Number(f.ordering ?? 0),
      is_active: Boolean(f.is_active ?? true),
    }))
  } catch {
    return []
  }
}
