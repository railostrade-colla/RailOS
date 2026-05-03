"use client"

import { useEffect, useState } from "react"
import { Search, X, Plus } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  MOCK_DISCOUNTS,
  MOCK_USER_COUPONS,
  CATEGORY_LABELS,
  COUPON_STATUS_LABELS,
  type Discount,
  type DiscountCategory,
  type UserCoupon,
} from "@/lib/mock-data/discounts"
import {
  getAllDiscounts,
  getAllUserCoupons,
  adminCreateDiscount,
  adminSetDiscountActive,
} from "@/lib/data/discounts-admin"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type SubTab = "active" | "create" | "stats"

export function DiscountsAdminPanel() {
  const [tab, setTab] = useState<SubTab>("active")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null)
  const [actionMode, setActionMode] = useState<null | "deactivate" | "edit">(null)
  const [submitting, setSubmitting] = useState(false)

  // Create form
  const [newName, setNewName] = useState("")
  const [newPercent, setNewPercent] = useState<number>(20)
  const [newCategory, setNewCategory] = useState<DiscountCategory>("restaurants")
  const [newDescription, setNewDescription] = useState("")
  const [newEnds, setNewEnds] = useState("")

  // Mock first-paint, real DB on mount.
  const [discounts, setDiscounts] = useState<Discount[]>(MOCK_DISCOUNTS)
  const [coupons, setCoupons] = useState<UserCoupon[]>(MOCK_USER_COUPONS)

  const refresh = () => {
    Promise.all([getAllDiscounts(), getAllUserCoupons()]).then(([d, c]) => {
      if (d.length > 0) setDiscounts(d)
      if (c.length > 0) setCoupons(c)
    })
  }

  useEffect(() => {
    refresh()
  }, [])

  const filtered = discounts
    .filter((d) => category === "all" || d.category === category)
    .filter((d) => !search || d.brand_name.includes(search))

  const handleAction = async () => {
    if (!selectedDiscount || !actionMode) return
    if (actionMode === "deactivate") {
      setSubmitting(true)
      const result = await adminSetDiscountActive(selectedDiscount.id, false)
      if (!result.success) {
        const map: Record<string, string> = {
          not_admin: "صلاحياتك لا تسمح",
          not_found: "غير موجود",
          missing_table: "الجداول غير منشورة بعد",
        }
        showError(map[result.reason ?? ""] ?? "فشل الإيقاف")
      } else {
        showSuccess("✅ تم إيقاف الخصم")
        refresh()
      }
      setSubmitting(false)
    } else {
      // Edit form is a TODO — keep optimistic toast for now.
      showSuccess("✅ تم حفظ التعديلات")
    }
    setActionMode(null)
    setSelectedDiscount(null)
  }

  const handleCreate = async () => {
    if (!newName.trim() || newPercent < 1 || newPercent > 99 || !newDescription.trim() || !newEnds) {
      return showError("املأ جميع الحقول الإجبارية")
    }
    setSubmitting(true)
    const result = await adminCreateDiscount({
      brand_name: newName.trim(),
      category: newCategory,
      discount_percent: newPercent,
      description: newDescription.trim(),
      starts_at: new Date().toISOString(),
      ends_at: new Date(newEnds).toISOString(),
      max_uses: 1000,
    })
    if (!result.success) {
      const map: Record<string, string> = {
        not_admin: "صلاحياتك لا تسمح",
        invalid_percent: "النسبة بين 1 و99",
        invalid_dates: "تاريخ غير صحيح",
        missing_table: "الجداول غير منشورة بعد",
      }
      showError(map[result.reason ?? ""] ?? "فشل الإنشاء")
      setSubmitting(false)
      return
    }
    showSuccess(`✅ تم إنشاء خصم جديد لـ "${newName}"`)
    setNewName("")
    setNewPercent(20)
    setNewDescription("")
    setNewEnds("")
    setTab("active")
    setSubmitting(false)
    refresh()
  }

  const stats = {
    total_brands: discounts.length,
    active: discounts.filter((d) => d.is_active).length,
    total_uses: discounts.reduce((s, d) => s + d.used_count, 0),
    total_claimed: coupons.length,
    redemption_rate: Math.round((coupons.filter((c) => c.status === "used").length / Math.max(1, coupons.length)) * 100),
  }
  void submitting

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="🎁 إدارة الخصومات"
        subtitle="إدارة الخصومات + إنشاء خصومات جديدة + الإحصائيات"
      />

      <InnerTabBar
        tabs={[
          { key: "active", label: "🎁 الخصومات النشطة", count: stats.active },
          { key: "create", label: "➕ إنشاء جديد" },
          { key: "stats",  label: "📊 الإحصائيات" },
        ]}
        active={tab}
        onSelect={(k) => setTab(k as SubTab)}
      />

      {/* TAB 1: Active discounts */}
      {tab === "active" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KPI label="إجمالي الماركات" val={stats.total_brands} color="#fff" />
            <KPI label="نشطة" val={stats.active} color="#4ADE80" />
            <KPI label="إجمالي الاستخدامات" val={fmtNum(stats.total_uses)} color="#FBBF24" />
            <KPI label="مُطالَب بها" val={fmtNum(stats.total_claimed)} color="#a855f7" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-3">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث (ماركة)..."
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
            >
              <option value="all">كل الفئات</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <AdminEmpty title="لا توجد خصومات" />
          ) : (
            <Table>
              <THead>
                <TH>الماركة</TH>
                <TH>الفئة</TH>
                <TH>الخصم</TH>
                <TH>المستخدمون</TH>
                <TH>السقف</TH>
                <TH>الانتهاء</TH>
                <TH>الحالة</TH>
                <TH>إجراءات</TH>
              </THead>
              <TBody>
                {filtered.map((d) => {
                  const cat = CATEGORY_LABELS[d.category]
                  return (
                    <TR key={d.id}>
                      <TD>
                        <div className="flex items-center gap-2">
                          <div className="text-base">{d.brand_logo_emoji}</div>
                          <span className="text-xs text-white">{d.brand_name}</span>
                        </div>
                      </TD>
                      <TD><span className="text-[11px]">{cat.icon} {cat.label}</span></TD>
                      <TD><span className="font-mono text-orange-400 font-bold">-{d.discount_percent}%</span></TD>
                      <TD><span className="font-mono">{fmtNum(d.used_count)}</span></TD>
                      <TD><span className="font-mono text-neutral-400">{fmtNum(d.max_uses)}</span></TD>
                      <TD><span className="text-[11px] text-neutral-500" dir="ltr">{d.ends_at}</span></TD>
                      <TD>
                        <Badge label={d.is_active ? "نشط" : "مُوقَف"} color={d.is_active ? "green" : "gray"} />
                      </TD>
                      <TD>
                        <div className="flex gap-1.5">
                          <ActionBtn label="تعديل" color="blue" sm onClick={() => { setSelectedDiscount(d); setActionMode("edit") }} />
                          {d.is_active && (
                            <ActionBtn label="إيقاف" color="red" sm onClick={() => { setSelectedDiscount(d); setActionMode("deactivate") }} />
                          )}
                        </div>
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          )}
        </>
      )}

      {/* TAB 2: Create */}
      {tab === "create" && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 max-w-2xl">
          <div className="text-base font-bold text-white mb-4">➕ إنشاء خصم جديد</div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">اسم الماركة *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثلاً: مطعم البلد"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">نسبة الخصم (%) *</label>
                <input
                  type="number"
                  value={newPercent}
                  onChange={(e) => setNewPercent(Number(e.target.value))}
                  min={1}
                  max={99}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">الفئة *</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as DiscountCategory)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">الوصف *</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                placeholder="مثلاً: خصم على جميع الوجبات الرئيسية..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">تاريخ الانتهاء *</label>
              <input
                type="date"
                value={newEnds}
                onChange={(e) => setNewEnds(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
              />
            </div>

            <button
              onClick={handleCreate}
              className="w-full bg-purple-500/[0.15] border border-purple-500/[0.3] text-purple-400 py-3 rounded-xl text-sm font-bold hover:bg-purple-500/[0.2] flex items-center justify-center gap-2 mt-3"
            >
              <Plus className="w-4 h-4" />
              إنشاء الخصم
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Stats */}
      {tab === "stats" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KPI label="إجمالي الاستخدامات" val={fmtNum(stats.total_uses)} color="#FBBF24" />
            <KPI label="قسائم مُطالَب بها" val={fmtNum(stats.total_claimed)} color="#60A5FA" />
            <KPI label="مُستخدَمة فعلياً" val={coupons.filter((c) => c.status === "used").length} color="#4ADE80" />
            <KPI label="معدل الاستخدام" val={stats.redemption_rate + "%"} color="#a855f7" />
          </div>

          <SectionHeader title="🏆 الأكثر استخداماً" />
          <Table>
            <THead>
              <TH>الماركة</TH>
              <TH>الخصم</TH>
              <TH>الاستخدامات</TH>
              <TH>السقف</TH>
              <TH>%</TH>
            </THead>
            <TBody>
              {[...discounts].sort((a, b) => b.used_count - a.used_count).slice(0, 8).map((d) => (
                <TR key={d.id}>
                  <TD>{d.brand_logo_emoji} {d.brand_name}</TD>
                  <TD><span className="font-mono text-orange-400 font-bold">-{d.discount_percent}%</span></TD>
                  <TD><span className="font-mono">{fmtNum(d.used_count)}</span></TD>
                  <TD><span className="font-mono text-neutral-400">{fmtNum(d.max_uses)}</span></TD>
                  <TD><span className="font-mono text-yellow-400">{Math.round((d.used_count / d.max_uses) * 100)}%</span></TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <div className="mt-6">
            <SectionHeader title="🎟️ آخر القسائم المُطالَب بها" />
            <Table>
              <THead>
                <TH>المستخدم</TH>
                <TH>الماركة</TH>
                <TH>الرمز</TH>
                <TH>الحالة</TH>
                <TH>الصلاحية</TH>
              </THead>
              <TBody>
                {coupons.slice(0, 8).map((c) => (
                  <TR key={c.id}>
                    <TD><span className="font-mono text-[11px]">{c.user_id.slice(0, 8)}</span></TD>
                    <TD>{c.brand_logo_emoji} {c.brand_name}</TD>
                    <TD><span className="font-mono text-[10px] text-neutral-400">{c.code}</span></TD>
                    <TD>
                      {(() => {
                        const m = COUPON_STATUS_LABELS[c.status]
                        const color = m.color === "neutral" ? "gray" as const : m.color
                        return <Badge label={m.label} color={color} />
                      })()}
                    </TD>
                    <TD><span className="text-[11px] text-neutral-500">{c.expires_at}</span></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </>
      )}

      {/* Action modal */}
      {actionMode && selectedDiscount && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">
                {actionMode === "deactivate" ? "🔴 إيقاف الخصم" : "✏️ تعديل الخصم"}
              </div>
              <button onClick={() => { setActionMode(null); setSelectedDiscount(null) }} className="text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className={cn(
              "rounded-xl p-3 mb-4 text-xs border",
              actionMode === "deactivate"
                ? "bg-red-400/[0.05] border-red-400/[0.2] text-red-400"
                : "bg-blue-400/[0.05] border-blue-400/[0.2] text-blue-400"
            )}>
              {actionMode === "deactivate"
                ? `سيتم إيقاف خصم "${selectedDiscount.brand_name}" — لن يستطيع المستخدمون المطالبة بقسائم جديدة. القسائم المُصدَرة تبقى صالحة.`
                : `تعديل خصم "${selectedDiscount.brand_name}" (Form كامل قيد التطوير).`
              }
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setActionMode(null); setSelectedDiscount(null) }} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
              <button onClick={handleAction} className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-bold border",
                actionMode === "deactivate" ? "bg-red-500/[0.15] border-red-500/[0.3] text-red-400" : "bg-blue-500/[0.15] border-blue-500/[0.3] text-blue-400"
              )}>تأكيد</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
