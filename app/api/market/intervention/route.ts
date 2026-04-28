import { NextResponse } from "next/server"
import { StabilityFund } from "@/lib/market"
import { createClient } from "@/lib/supabase/server"

/** POST /api/market/intervention */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { projectId, type, sharesCount, pricePerShare } = body ?? {}

    if (!projectId || !type || !sharesCount || !pricePerShare) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    if (type !== "buy" && type !== "sell") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 })
    }

    const supabase = await createClient()
    const fund = new StabilityFund(supabase)

    if (type === "buy") {
      await fund.executeBuyIntervention(projectId, sharesCount, pricePerShare)
    } else {
      await fund.executeSellRelease(projectId, sharesCount, pricePerShare)
    }

    return NextResponse.json({
      success: true,
      transactionId: "tx-" + Date.now(),
    })
  } catch {
    return NextResponse.json({ error: "حدث خطأ في تنفيذ التدخل" }, { status: 500 })
  }
}
