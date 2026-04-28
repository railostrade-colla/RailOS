import { NextResponse } from "next/server"
import { MarketEngine } from "@/lib/market"
import { createClient } from "@/lib/supabase/server"

/** POST /api/market/process-deal */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { dealId, projectId, buyerId, sellerId } = body ?? {}

    if (!dealId || !projectId || !buyerId || !sellerId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const supabase = await createClient()
    const engine = new MarketEngine(supabase)
    const result = await engine.processNewDeal(dealId, projectId, buyerId, sellerId)

    return NextResponse.json({
      shouldIncrease: result.shouldIncrease,
      newPrice: result.newPrice,
      oldPrice: result.oldPrice,
      changePct: result.changePct,
      phase: result.phase,
    })
  } catch {
    return NextResponse.json({ error: "حدث خطأ في معالجة الصفقة" }, { status: 500 })
  }
}
