import { NextResponse } from "next/server"
import { DevelopmentIndex } from "@/lib/market"
import { createClient } from "@/lib/supabase/server"

/** POST /api/market/measure-development */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { projectId, measurements, committeeRating } = body ?? {}

    if (!projectId || !measurements || typeof committeeRating !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const supabase = await createClient()
    const index = new DevelopmentIndex(supabase)
    const result = await index.recordMeasurement(projectId, measurements, committeeRating)

    return NextResponse.json({
      developmentScore: result.development_score,
      interventionStatus: result.intervention_status,
    })
  } catch {
    return NextResponse.json({ error: "حدث خطأ في تسجيل القياس" }, { status: 500 })
  }
}
