"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ChevronRight, Search, X, Plus, AlertTriangle } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { ContractLimitCard } from "@/components/contracts/ContractLimitCard"
import { LEVEL_LABELS, LEVEL_ICONS, type InvestorLevel } from "@/lib/utils/contractLimits"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"
// Phase 11.27 — IntegerInput prevents wheel/arrow-key/spinner from
// silently mutating IQD investment inputs. The share-percentage input
// stays as type="number" because it's intentionally fractional.
import { IntegerInput } from "@/components/ui/IntegerInput"

const fmtIQD = (n: number) => n.toLocaleString("en-US")

import { FEE_BALANCE_CONTRACTS as mockFeeBalance } from "@/lib/mock-data"
import { createContract as createContractDB } from "@/lib/data/contracts"
import { hasUnusedGift, redeemFreeContractGift } from "@/lib/data/gifts"
import { getMyFriends, type DBFriend } from "@/lib/data/friendships"
import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/data/profile"
import { createClient } from "@/lib/supabase/client"
import { Gift, Handshake, Hash } from "lucide-react"

// رسوم العقد - 2% من قيمة الاستثمار
const CONTRACT_FEE_PERCENT = 2

interface Partner {
  user: { id: string; name: string; reputation_score: number; is_verified: boolean; level: InvestorLevel }
  role: "creator" | "partner"
  share_percentage: number
}

export default function CreateContractPage() {
  const router = useRouter()
  const t = useTranslations("contracts")
  const tc = useTranslations("common")

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [investment, setInvestment] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // Phase 13.53 — real signed-in user is the creator. Loaded on
  // mount (see useEffect below); until then `currentUser` is null
  // and the partners array stays empty so we don't seed a placeholder
  // "Ahmed Mohamed" row from the legacy mock.
  const [currentUser, setCurrentUser] = useState<CurrentUserProfile | null>(null)
  const [partners, setPartners] = useState<Partner[]>([])
  const [distMode, setDistMode] = useState<"equal" | "manual">("equal")
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showFeeBlock, setShowFeeBlock] = useState(false)

  // Phase 13.53 — replace the legacy mockUsersDB search with two
  // real picker modes:
  //   • "partners" — pick from friends marked is_partner=TRUE (live
  //                  from /community → الأصدقاء → ترقية إلى شريك)
  //   • "id"      — paste a user UUID directly (for off-list partners)
  const [pickerMode, setPickerMode] = useState<"partners" | "id">("partners")
  const [myPartners, setMyPartners] = useState<DBFriend[]>([])
  const [idInput, setIdInput] = useState("")
  const [idLookupLoading, setIdLookupLoading] = useState(false)

  // Phase 9.6 — gift state
  const [hasGift, setHasGift] = useState(false)
  const [useGift, setUseGift] = useState(false)

  // Initial loads + realtime on friendships so a new partner promoted
  // in another tab appears here without refresh.
  useEffect(() => {
    let cancelled = false

    hasUnusedGift("free_contract").then((has) => {
      if (!cancelled) setHasGift(has)
    })

    // Phase 13.53 — seed the partners array with the REAL signed-in
    // user as the contract creator. Maps the profile's raw level
    // (basic|advanced|pro|elite) onto the contract UI's 3-tier
    // enum (`elite` collapses to `pro`).
    getCurrentUserProfile().then((p) => {
      if (cancelled || !p) return
      setCurrentUser(p)
      const safeLevel: InvestorLevel =
        p.level === "advanced" ? "advanced" :
        p.level === "pro" || p.level === "elite" ? "pro" :
        "basic"
      const displayName =
        p.full_name?.trim() || p.username?.trim() || p.email?.split("@")[0] || "—"
      setPartners([
        {
          user: {
            id: p.id,
            name: displayName,
            reputation_score: p.trust_score,
            is_verified: p.is_verified,
            level: safeLevel,
          },
          role: "creator",
          share_percentage: 100,
        },
      ])
    })

    const loadPartners = () => {
      getMyFriends().then((all) => {
        if (cancelled) return
        setMyPartners(all.filter((f) => f.is_partner))
      })
    }
    loadPartners()

    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleReload = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { if (!cancelled) loadPartners() }, 200)
    }
    const channel = supabase
      .channel("contracts-create:partners")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => scheduleReload(),
      )
      .subscribe()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel).catch(() => {})
    }
  }, [])

  // Search the partners list by name/username when in "partners" mode.
  const searchResults = pickerMode === "partners" && searchQuery.length > 0
    ? myPartners
        .filter((p) =>
          p.user_name.toLowerCase().includes(searchQuery.toLowerCase())
          && !partners.some((existing) => existing.user.id === p.user_id),
        )
        .slice(0, 8)
    : []

  // إعادة توزيع متساوية
  const redistributeEqual = (list: Partner[]) => {
    if (list.length === 0) return list
    const equalShare = parseFloat((100 / list.length).toFixed(2))
    return list.map((p) => ({ ...p, share_percentage: equalShare }))
  }

  // Phase 13.53 — generic add. Accepts the minimal user shape used by
  // the Partner type. Both the partners-list picker and the user-ID
  // lookup converge here.
  const addPartner = (user: Partner["user"]) => {
    if (partners.some((p) => p.user.id === user.id)) {
      showError(t("alreadyAdded"))
      return
    }
    const newList = [...partners, { user, role: "partner" as const, share_percentage: 0 }]
    if (distMode === "equal") {
      setPartners(redistributeEqual(newList))
    } else {
      setPartners(newList)
    }
    setSearchQuery("")
    setIdInput("")
  }

  const addPartnerFromFriend = (f: DBFriend) => {
    addPartner({
      id: f.user_id,
      name: f.user_name,
      reputation_score: f.trust_score,
      is_verified: f.is_verified,
      level: f.level as Partner["user"]["level"],
    })
  }

  const addPartnerById = async () => {
    const id = idInput.trim()
    // UUID v4 pattern (loose — accepts any v1-v5).
    const uuidPat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidPat.test(id)) {
      showError(t("invalidUuid"))
      return
    }
    if (partners.some((p) => p.user.id === id)) {
      showError(t("alreadyAdded"))
      return
    }
    setIdLookupLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("profiles_public")
        .select("id, full_name, username, level, kyc_status")
        .eq("id", id)
        .maybeSingle()
      if (error || !data) {
        showError(t("userNotFoundById"))
        return
      }
      type Row = {
        id: string
        full_name: string | null
        username: string | null
        level: string | null
        kyc_status: string | null
      }
      const r = data as Row
      const name = r.full_name?.trim() || r.username?.trim() || id.slice(0, 8)
      const safeLevel: Partner["user"]["level"] =
        r.level === "advanced" ? "advanced" :
        r.level === "pro" || r.level === "elite" ? "pro" :
        "basic"
      addPartner({
        id: r.id,
        name,
        reputation_score: 0,
        is_verified: r.kyc_status === "approved",
        level: safeLevel,
      })
      showSuccess(t("partnerAdded"))
    } catch {
      showError(t("searchFailed"))
    } finally {
      setIdLookupLoading(false)
    }
  }

  const removePartner = (id: string) => {
    const newList = partners.filter((p) => p.user.id !== id)
    if (distMode === "equal") {
      setPartners(redistributeEqual(newList))
    } else {
      setPartners(newList)
    }
  }

  const updateShare = (id: string, value: string) => {
    const num = parseFloat(value) || 0
    setPartners((prev) =>
      prev.map((p) => (p.user.id === id ? { ...p, share_percentage: num } : p))
    )
  }

  const totalShares = partners.reduce((s, p) => s + (p.share_percentage || 0), 0)
  const sharesValid = Math.abs(totalShares - 100) < 0.1

  const investmentNum = parseFloat(investment) || 0
  const feeAmount = Math.ceil((investmentNum * CONTRACT_FEE_PERCENT) / 100)
  const hasEnoughFees = mockFeeBalance >= feeAmount

  const createContract = async () => {
    if (!title.trim()) return showError(t("enterTitle"))
    if (!description.trim()) return showError(t("enterDesc"))
    if (investmentNum < 1) return showError(t("enterValidInvestment"))
    if (partners.length < 2) return showError(t("minOnePartner"))
    if (!sharesValid) return showError(t("sharesMust100"))
    if (!agreed) return showError(t("mustAgree"))
    // Skip the fee gate when the user is redeeming a free_contract gift —
    // the end-fee will be waived server-side when the gift is consumed.
    if (!useGift && !hasEnoughFees) {
      setShowFeeBlock(true)
      return
    }

    setLoading(true)
    const result = await createContractDB({
      title: title.trim(),
      description: description.trim(),
      total_investment: investmentNum,
      members: partners.map((p) => ({
        user_id: p.user.id,
        share_percent: p.share_percentage,
      })),
    })

    if (result.success) {
      // Best-effort gift redemption — the contract is already created
      // even if this fails (we fall back to the normal end-fee).
      if (useGift && result.contract_id) {
        const redeem = await redeemFreeContractGift(result.contract_id)
        if (!redeem.success) {
          // Soft warn but don't block — contract is created.
          showError(
            redeem.reason === "no_gift_available"
              ? t("giftNotFoundCreated")
              : t("giftFailedCreated"),
          )
        } else {
          showSuccess(t("createdFreeWithGift"))
        }
      }
      setLoading(false)
      if (!useGift) {
        showSuccess(t("createdInvitesSent"))
      }
      router.push("/contracts")
      return
    }
    setLoading(false)
    if (result.reason === "share_percent_not_100") {
      showError(result.error || t("sharesMust100"))
    } else if (result.reason === "missing_table") {
      showError(t("featureUnavailable"))
    } else if (result.reason === "unauthenticated") {
      showError(t("loginToContinue"))
    } else {
      showError(result.error || t("createFailed"))
    }
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            title={t("createTitle")}
            subtitle={t("createSubtitle")}
            backHref="/contracts"
          />

          {/* معلومات تلقائية — Phase 13.53: real creator from auth */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-500">{t("contractCreator")}</span>
              {currentUser ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold">
                    {currentUser.full_name?.trim()
                      || currentUser.username?.trim()
                      || currentUser.email?.split("@")[0]
                      || "—"}
                  </span>
                  {currentUser.is_verified && (
                    <span className="bg-green-400/10 border border-green-400/20 text-green-400 px-1 py-0.5 rounded text-[9px] font-bold">
                      {t("verified")}
                    </span>
                  )}
                  <span className="bg-white/[0.08] border border-white/[0.12] text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <span>{currentUser.level_icon}</span>
                    <span className="text-neutral-200">{currentUser.level_label}</span>
                  </span>
                </div>
              ) : (
                <span className="text-neutral-500 text-[11px] animate-pulse">{t("loadingDots")}</span>
              )}
            </div>
            <div className="h-px bg-white/[0.05] my-2.5" />
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-500">{t("date")}</span>
              <span className="text-white">{new Date().toLocaleDateString("en-US")}</span>
            </div>
            <div className="h-px bg-white/[0.05] my-2.5" />
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-500">{t("feeUnitsBalance")}</span>
              <span className={cn("font-bold font-mono", hasEnoughFees ? "text-green-400" : "text-red-400")}>
                {mockFeeBalance.toLocaleString("en-US")} {t("unitWord")}
              </span>
            </div>
          </div>

          {/* Phase 9.6 — Free contract gift banner */}
          {hasGift && (
            <div className="bg-gradient-to-l from-purple-500/[0.12] to-pink-500/[0.08] border border-purple-500/30 rounded-2xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/[0.2] border border-purple-500/[0.3] flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-purple-300" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white mb-0.5">
                    {t("giftAvailable")}
                  </div>
                  <div className="text-[11px] text-neutral-300 leading-relaxed mb-3">
                    {t("giftDesc")}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useGift}
                      onChange={(e) => setUseGift(e.target.checked)}
                      className="w-4 h-4 rounded bg-white/[0.05] border border-purple-400/[0.3]"
                    />
                    <span className={cn(
                      "text-xs font-bold",
                      useGift ? "text-purple-300" : "text-neutral-400",
                    )}>
                      {t("useGiftForContract")}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* اسم العقد */}
          <div className="mb-4">
            <label className="text-xs text-neutral-400 mb-2 block font-bold">{t("titleLabel")}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
            />
          </div>

          {/* وصف العقد */}
          <div className="mb-4">
            <label className="text-xs text-neutral-400 mb-2 block font-bold">{t("descLabel")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descPlaceholder")}
              rows={3}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
            />
          </div>

          {/* قيمة الاستثمار */}
          <div className="mb-4">
            <label className="text-xs text-neutral-400 mb-2 block font-bold">{t("investmentLabel")}</label>
            <IntegerInput
              value={investment}
              onValueChange={setInvestment}
              placeholder={t("investmentPlaceholder")}
              dir="ltr"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 font-mono"
            />
            {investmentNum > 0 && (
              <div className="mt-2 flex items-start gap-1.5 text-[11px] text-neutral-400">
                <span>💳</span>
                <span>
                  {t("platformFeeLabel")} <span className="text-blue-400 font-bold">{feeAmount.toLocaleString("en-US")}</span> {t("feeUnitWord")}
                  {!hasEnoughFees && (
                    <span className="text-red-400 mr-2">{t("insufficientBalance")}</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* إضافة شركاء — Phase 13.53: مُد modes (partners list OR ID) */}
          <div className="mb-4">
            <label className="text-xs text-neutral-400 mb-2 block font-bold">{t("addPartners")}</label>

            {/* Mode toggle */}
            <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1 mb-2 max-w-md">
              <button
                onClick={() => setPickerMode("partners")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-colors",
                  pickerMode === "partners"
                    ? "bg-white/[0.1] text-white"
                    : "text-neutral-400 hover:text-white",
                )}
              >
                <Handshake className="w-3 h-3" strokeWidth={2} />
                {t("fromMyPartners", { n: myPartners.length })}
              </button>
              <button
                onClick={() => setPickerMode("id")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-colors",
                  pickerMode === "id"
                    ? "bg-white/[0.1] text-white"
                    : "text-neutral-400 hover:text-white",
                )}
              >
                <Hash className="w-3 h-3" strokeWidth={2} />
                {t("enterUuid")}
              </button>
            </div>

            {pickerMode === "partners" ? (
              myPartners.length === 0 ? (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                  <Handshake className="w-7 h-7 text-neutral-600 mx-auto mb-1.5" strokeWidth={1.5} />
                  <div className="text-xs text-neutral-400 leading-relaxed">
                    {t("noPartnersYetPre")}{" "}
                    <button
                      type="button"
                      onClick={() => router.push("/community")}
                      className="text-blue-400 underline-offset-2 hover:underline"
                    >
                      {t("communityFriends")}
                    </button>{" "}
                    {t("noPartnersYetPost")}
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("searchPartnersPlaceholder")}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
                  />

                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#1c1c1c] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden">
                      {searchResults.map((f) => (
                        <button
                          key={f.user_id}
                          onClick={() => addPartnerFromFriend(f)}
                          className="w-full p-3 hover:bg-white/[0.06] transition-colors flex items-center gap-3 border-b border-white/[0.04] last:border-0 text-right"
                        >
                          <div className="w-9 h-9 rounded-full bg-white/[0.09] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                            {f.avatar_initial}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-white truncate">{f.user_name}</span>
                              {f.is_verified && (
                                <span className="bg-green-400/10 border border-green-400/20 text-green-400 px-1 py-0.5 rounded text-[9px] font-bold flex-shrink-0">
                                  ✓
                                </span>
                              )}
                              <span className="bg-[#4ADE80]/[0.12] border border-[#4ADE80]/[0.25] text-[#4ADE80] px-1 py-0.5 rounded text-[9px] font-bold flex-shrink-0">
                                {t("partnerTag")}
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-500 mt-0.5">
                              {t("trustLabel")} <span className="font-mono text-yellow-400">{f.trust_score}</span> · {t("dealsCount", { n: f.total_trades })}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-white flex-shrink-0" strokeWidth={2} />
                        </button>
                      ))}
                    </div>
                  )}

                  {searchQuery && searchResults.length === 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#1c1c1c] border border-white/[0.1] rounded-xl p-4 text-center text-xs text-neutral-500">
                      {t("noPartnerMatch")}
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={idInput}
                  onChange={(e) => setIdInput(e.target.value)}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  dir="ltr"
                  className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-white/20 font-mono"
                />
                <button
                  onClick={addPartnerById}
                  disabled={idLookupLoading || !idInput.trim()}
                  className="bg-white text-black px-4 py-3 rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-200 transition-colors"
                >
                  {idLookupLoading ? "..." : t("addBtn")}
                </button>
              </div>
            )}
          </div>

          {/* قائمة الشركاء */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <label className="text-xs text-neutral-400 font-bold">
                {t("partnersTitle")} <span className="text-neutral-500">({partners.length})</span>
              </label>
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    setDistMode("equal")
                    setPartners(redistributeEqual(partners))
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] transition-colors font-bold",
                    distMode === "equal"
                      ? "bg-white text-black"
                      : "bg-white/[0.05] border border-white/[0.08] text-neutral-400 hover:text-white"
                  )}
                >
                  {t("equal")}
                </button>
                <button
                  onClick={() => setDistMode("manual")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] transition-colors font-bold",
                    distMode === "manual"
                      ? "bg-white text-black"
                      : "bg-white/[0.05] border border-white/[0.08] text-neutral-400 hover:text-white"
                  )}
                >
                  {t("manual")}
                </button>
              </div>
            </div>

            {/* شريط التقدم */}
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden mb-2">
              <div
                className={cn("h-full rounded-full transition-all duration-300", sharesValid ? "bg-green-400" : "bg-red-400")}
                style={{ width: Math.min(totalShares, 100) + "%" }}
              />
            </div>
            {!sharesValid && (
              <div className="text-[11px] text-red-400 mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                {t("sharesSumWarn", { pct: totalShares.toFixed(1) })}
              </div>
            )}

            <div className="space-y-2">
              {partners.map((p) => (
                <div
                  key={p.user.id}
                  className={cn(
                    "rounded-xl p-3 flex items-center gap-3 border",
                    p.role === "creator"
                      ? "bg-yellow-400/[0.05] border-yellow-400/[0.2]"
                      : "bg-white/[0.05] border-white/[0.08]"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-white/[0.09] flex items-center justify-center text-base font-bold text-white flex-shrink-0">
                    {p.user.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">{p.user.name}</span>
                      {p.user.is_verified && (
                        <span className="bg-green-400/10 border border-green-400/20 text-green-400 px-1 py-0.5 rounded text-[9px] font-bold">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      {p.role === "creator" ? t("creatorRole") : t("partnerRole")}
                    </div>
                  </div>

                  {distMode === "manual" ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <input
                        type="number"
                        value={p.share_percentage}
                        onChange={(e) => updateShare(p.user.id, e.target.value)}
                        min="0"
                        max="100"
                        step="0.1"
                        dir="ltr"
                        className="w-16 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-white/20 text-center font-mono"
                      />
                      <span className="text-xs text-neutral-400">%</span>
                    </div>
                  ) : (
                    <span className="text-base font-bold text-white font-mono flex-shrink-0">
                      {p.share_percentage.toFixed(1)}%
                    </span>
                  )}

                  {p.role !== "creator" && (
                    <button
                      onClick={() => removePartner(p.user.id)}
                      className="bg-red-500/[0.1] border border-red-500/[0.2] text-red-400 rounded-lg px-2 py-1.5 text-[10px] font-bold hover:bg-red-500/[0.15] transition-colors flex-shrink-0"
                    >
                      {t("remove")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* الحد الشهري الجماعي */}
          {partners.length > 0 && (
            <div className="mb-5">
              <ContractLimitCard members={partners.map((p) => ({ name: p.user.name, level: p.user.level }))} />
            </div>
          )}

          {/* بنود الاتفاق */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4 mb-5">
            <div className="text-xs text-neutral-400 leading-relaxed mb-4">
              <div className="font-bold text-white mb-2">{t("agreementTerms")}</div>
              <ul className="space-y-1.5">
                <li className="flex gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>{t("term1")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>{t("term2")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>{t("term3")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>{t("term4")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>{t("term5")}</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => setAgreed(!agreed)}
              className="flex items-start gap-3 w-full text-right"
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
                  agreed
                    ? "bg-white border-white"
                    : "border-white/[0.25] bg-transparent"
                )}
              >
                {agreed && <span className="text-black text-xs font-bold">✓</span>}
              </div>
              <span className="text-xs text-neutral-400 leading-relaxed">
                {t("agreeText")}
              </span>
            </button>
          </div>

          {/* زر الإنشاء */}
          <button
            onClick={createContract}
            disabled={loading || !agreed || !sharesValid}
            className={cn(
              "w-full py-3.5 rounded-xl text-sm font-bold transition-colors",
              agreed && sharesValid && !loading
                ? "bg-neutral-100 text-black hover:bg-neutral-200"
                : "bg-white/[0.2] text-neutral-500 cursor-not-allowed"
            )}
          >
            {loading ? t("creating") : t("createAndInvite")}
          </button>

        </div>
      </div>

      {/* Fee Insufficient Modal */}
      {showFeeBlock && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-red-500/[0.3] rounded-2xl p-6 w-full max-w-sm">
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-500/[0.1] border-2 border-red-500/[0.3] flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-8 h-8 text-red-400" strokeWidth={1.5} />
              </div>
              <div className="text-base font-bold text-white mb-1">{t("feeInsufficientTitle")}</div>
              <div className="text-xs text-neutral-400 leading-relaxed">
                {t("feeInsufficientDesc")}
              </div>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5 mb-5">
              <div className="flex justify-between items-center py-1.5">
                <span className="text-xs text-neutral-500">{t("required")}</span>
                <span className="text-sm font-bold text-red-400 font-mono">{feeAmount.toLocaleString("en-US")} {t("unitWord")}</span>
              </div>
              <div className="h-px bg-white/[0.05] my-1" />
              <div className="flex justify-between items-center py-1.5">
                <span className="text-xs text-neutral-500">{t("currentBalance")}</span>
                <span className="text-sm font-bold text-white font-mono">{mockFeeBalance.toLocaleString("en-US")} {t("unitWord")}</span>
              </div>
              <div className="h-px bg-white/[0.05] my-1" />
              <div className="flex justify-between items-center py-1.5">
                <span className="text-xs text-neutral-500">{t("shortfall")}</span>
                <span className="text-sm font-bold text-yellow-400 font-mono">
                  {(feeAmount - mockFeeBalance).toLocaleString("en-US")} {t("unitWord")}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowFeeBlock(false)}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                {tc("buttons.close")}
              </button>
              <button
                onClick={() => router.push("/portfolio?tab=fee_units")}
                className="flex-1 py-3 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200"
              >
                {t("topUpUnits")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
