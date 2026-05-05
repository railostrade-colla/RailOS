"use client"

/**
 * DealsAdminPanel — admin overview of every deal (trade) on the
 * platform. Shows count + total volume + share volume, plus a table
 * of recent deals with a "view invoice" button per row.
 *
 * Reads `deals` directly with a two-step manual join for buyer/
 * seller/project names so missing FK constraints don't sink the list.
 */

import { useEffect, useState } from "react"
import { Search, FileText } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  KPI, AdminEmpty,
} from "@/components/admin/ui"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

const fmtNum = (n: number) => n.toLocaleString("en-US")

interface DealRow {
  id: string
  buyer_id: string | null
  seller_id: string | null
  project_id: string | null
  shares_amount: number
  total_amount: number
  status: string
  created_at: string
  buyer_name: string
  seller_name: string
  project_name: string
}

async function fetchDeals(limit: number = 200): Promise<DealRow[]> {
  try {
    const supabase = createClient()
    const { data: rows, error } = await supabase
      .from("deals")
      .select("id, buyer_id, seller_id, project_id, shares_amount, total_amount, status, created_at")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error || !rows) return []

    interface Raw {
      id: string
      buyer_id: string | null
      seller_id: string | null
      project_id: string | null
      shares_amount: number | string | null
      total_amount: number | string | null
      status: string
      created_at: string
    }

    const dealRows = rows as Raw[]
    const userIds = Array.from(
      new Set(
        [
          ...dealRows.map((d) => d.buyer_id),
          ...dealRows.map((d) => d.seller_id),
        ].filter((x): x is string => Boolean(x)),
      ),
    )
    const projectIds = Array.from(
      new Set(dealRows.map((d) => d.project_id).filter((x): x is string => Boolean(x))),
    )

    const userMap = new Map<string, string>()
    if (userIds.length > 0) {
      try {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .in("id", userIds)
        for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null; username: string | null }>) {
          userMap.set(p.id, p.full_name ?? p.username ?? "—")
        }
      } catch { /* ignore */ }
    }

    const projectMap = new Map<string, string>()
    if (projectIds.length > 0) {
      try {
        const { data: projs } = await supabase
          .from("projects")
          .select("id, name")
          .in("id", projectIds)
        for (const p of (projs ?? []) as Array<{ id: string; name: string | null }>) {
          projectMap.set(p.id, p.name ?? "—")
        }
      } catch { /* ignore */ }
    }

    return dealRows.map((d) => ({
      id: d.id,
      buyer_id: d.buyer_id,
      seller_id: d.seller_id,
      project_id: d.project_id,
      shares_amount: Number(d.shares_amount ?? 0),
      total_amount: Number(d.total_amount ?? 0),
      status: d.status,
      created_at: d.created_at,
      buyer_name: d.buyer_id ? userMap.get(d.buyer_id) ?? "—" : "—",
      seller_name: d.seller_id ? userMap.get(d.seller_id) ?? "—" : "—",
      project_name: d.project_id ? projectMap.get(d.project_id) ?? "—" : "—",
    }))
  } catch {
    return []
  }
}

export function DealsAdminPanel() {
  const router = useRouter()
  const [deals, setDeals] = useState<DealRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    let cancelled = false
    fetchDeals(200).then((rows) => {
      if (cancelled) return
      setDeals(rows)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const filtered = deals.filter(
    (d) =>
      !search ||
      d.project_name.includes(search) ||
      d.buyer_name.includes(search) ||
      d.seller_name.includes(search) ||
      d.id.toLowerCase().includes(search.toLowerCase()),
  )

  const completed = deals.filter((d) => d.status === "completed")
  const stats = {
    total: deals.length,
    completed: completed.length,
    total_shares: completed.reduce((s, d) => s + d.shares_amount, 0),
    total_value: completed.reduce((s, d) => s + d.total_amount, 0),
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <div className="text-lg font-bold text-white mb-1">📋 الصفقات</div>
      <div className="text-xs text-neutral-500 mb-5">
        كل الصفقات المُنفَّذة على المنصّة — مع زرّ الفاتورة لكل صفقة
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="إجمالي الصفقات" val={fmtNum(stats.total)} color="#fff" />
        <KPI label="مكتملة" val={fmtNum(stats.completed)} color="#4ADE80" />
        <KPI label="إجمالي الحصص المتداولة" val={fmtNum(stats.total_shares)} color="#C084FC" />
        <KPI label="إجمالي القيمة" val={fmtNum(stats.total_value) + " د.ع"} color="#FBBF24" />
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث (مشروع / مشتري / بائع / id)..."
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      {loading ? (
        <AdminEmpty title="جاري التحميل..." />
      ) : filtered.length === 0 ? (
        <AdminEmpty title="لا توجد صفقات بعد" body="ستظهر هنا أوّل ما يبدأ التداول" />
      ) : (
        <Table>
          <THead>
            <TH>المشروع</TH>
            <TH>المشتري</TH>
            <TH>البائع</TH>
            <TH>الحصص</TH>
            <TH>القيمة</TH>
            <TH>الحالة</TH>
            <TH>التاريخ</TH>
            <TH>الفاتورة</TH>
          </THead>
          <TBody>
            {filtered.map((d) => (
              <TR key={d.id}>
                <TD>{d.project_name}</TD>
                <TD>{d.buyer_name}</TD>
                <TD>{d.seller_name}</TD>
                <TD><span className="font-mono text-xs">{fmtNum(d.shares_amount)}</span></TD>
                <TD><span className="font-mono text-yellow-400 text-xs">{fmtNum(d.total_amount)}</span></TD>
                <TD>
                  <Badge
                    label={
                      d.status === "completed" ? "مكتملة" :
                      d.status === "pending" ? "معلّقة" :
                      d.status === "in_dispute" ? "نزاع" :
                      d.status === "cancelled" ? "ملغاة" :
                      d.status
                    }
                    color={
                      d.status === "completed" ? "green" :
                      d.status === "pending" ? "yellow" :
                      d.status === "in_dispute" ? "red" :
                      "gray"
                    }
                  />
                </TD>
                <TD>
                  <span className="text-[11px] text-neutral-500" dir="ltr">
                    {d.created_at.slice(0, 10)}
                  </span>
                </TD>
                <TD>
                  <ActionBtn
                    label="📄 فاتورة"
                    color="blue"
                    sm
                    onClick={() => router.push(`/deals/${d.id}`)}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <div className="mt-4 flex items-center gap-2 text-[11px] text-neutral-500">
        <FileText className="w-3.5 h-3.5" />
        الضغط على "فاتورة" يفتح صفحة الصفقة الكاملة (نفس الفاتورة التي يراها المستخدم).
      </div>
    </div>
  )
}
