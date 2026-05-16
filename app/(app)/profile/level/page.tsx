"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { TrendingUp, AlertTriangle, Flag, Star } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, Badge } from "@/components/ui"
import {
  MOCK_USER_STATS,
  getLevelSetting,
  getNextLevel,
  getRequirementChecklist,
  type UserStats,
  type LevelHistoryEntry,
} from "@/lib/mock-data/levels"
import {
  getMyUserStats,
  getMyLevelHistory,
  CHANGE_TYPE_META,
} from "@/lib/data/levels"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

// level id → i18n key (lib only exposes display_name_ar; we localize
// the small fixed enum here without touching the levels lib).
const LEVEL_KEY: Record<string, string> = {
  basic: "lvlBasic",
  advanced: "lvlAdvanced",
  pro: "lvlPro",
  elite: "lvlElite",
}
// CHANGE_TYPE_META.label → i18n key (icon/color stay lib-canonical).
const CHANGE_TYPE_KEY: Record<string, string> = {
  auto_upgrade: "ctAutoUpgrade",
  auto_downgrade: "ctAutoDowngrade",
  admin_override: "ctAdminOverride",
  admin_revert: "ctAdminRevert",
}
// getRequirementChecklist returns a fixed-order array; map by index.
const REQ_META: ReadonlyArray<{ labelKey: string; unitKey: string }> = [
  { labelKey: "reqVolume",          unitKey: "unitIqd" },
  { labelKey: "reqTrades",          unitKey: "unitDeal" },
  { labelKey: "reqSuccessRate",     unitKey: "unitPct" },
  { labelKey: "reqDaysActive",      unitKey: "unitDay" },
  { labelKey: "reqDisputesLost",    unitKey: "unitDispute" },
  { labelKey: "reqReportsReceived", unitKey: "unitReport" },
  { labelKey: "reqRating",          unitKey: "unitOf5" },
]

export default function MyLevelPage() {
  const t = useTranslations("profile")
  // Initial paint uses mock fixture so the layout never flashes empty.
  // Real DB-backed values swap in on mount.
  const [stats, setStats] = useState<UserStats>(MOCK_USER_STATS)
  const [history, setHistory] = useState<LevelHistoryEntry[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([getMyUserStats(), getMyLevelHistory(5)]).then(
      ([dbStats, dbHistory]) => {
        if (cancelled) return
        if (dbStats) setStats(dbStats)
        setHistory(dbHistory)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const levelSetting = getLevelSetting(stats.level)
  const nextLevel = getNextLevel(stats.level)
  const checklist = nextLevel ? getRequirementChecklist(stats, nextLevel.level) : []

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
          <PageHeader
            title={t("levelTitle")}
            subtitle={t("levelSubtitle")}
            backHref="/profile"
          />

          {/* Current level card */}
          <div
            className="rounded-2xl p-5 mb-5 border-2"
            style={{
              backgroundColor: `${levelSetting?.color}10`,
              borderColor: `${levelSetting?.color}50`,
            }}
          >
            <div className="flex items-center gap-4 flex-wrap">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center text-5xl flex-shrink-0"
                style={{
                  backgroundColor: `${levelSetting?.color}20`,
                  border: `2px solid ${levelSetting?.color}50`,
                }}
              >
                {levelSetting?.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-neutral-500 mb-0.5">{t("currentLevel")}</div>
                <div className="text-2xl font-bold mb-1" style={{ color: levelSetting?.color }}>
                  {LEVEL_KEY[stats.level] ? t(LEVEL_KEY[stats.level]) : levelSetting?.display_name_ar}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {stats.level_override && <Badge color="purple">{t("manualOverride")}</Badge>}
                  {stats.level_locked && <Badge color="yellow">{t("locked")}</Badge>}
                  {stats.level_upgraded_at && (
                    <span className="text-[10px] text-neutral-500" dir="ltr">
                      {t("upgradedOn", { date: new Date(stats.level_upgraded_at).toLocaleDateString("en-GB") })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Progress to next level */}
          {nextLevel ? (
            <Card className="mb-5">
              <div className="text-sm font-bold text-white mb-3">
                {t("progressTo")} {nextLevel.icon} {LEVEL_KEY[nextLevel.level] ? t(LEVEL_KEY[nextLevel.level]) : nextLevel.display_name_ar}
              </div>
              <div className="space-y-3">
                {checklist.map((req, i) => {
                  const pct = req.required > 0 ? Math.min(100, (req.current / req.required) * 100) : 100
                  const rm = REQ_META[i]
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={cn(req.met ? "text-green-400" : "text-neutral-300")}>
                          {req.met ? "✓" : "○"} {rm ? t(rm.labelKey) : req.label}
                        </span>
                        <span className="font-mono text-neutral-500">
                          <span className={req.met ? "text-green-400" : "text-white"}>
                            {fmtNum(req.current)}
                          </span>
                          {" / "}
                          <span>{fmtNum(req.required)}</span> {rm ? t(rm.unitKey) : req.unit}
                        </span>
                      </div>
                      {!req.inverse && (
                        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all",
                              req.met ? "bg-green-400" : "bg-blue-400"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          ) : (
            <Card variant="gradient" color="yellow" className="mb-5">
              <div className="text-center py-2">
                <div className="text-3xl mb-2">👑</div>
                <div className="text-base font-bold text-white">{t("topLevel")}</div>
                <div className="text-xs text-neutral-300 mt-1">
                  {t("topLevelDesc")}
                </div>
              </div>
            </Card>
          )}

          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            {/* Trading */}
            <Card>
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.06]">
                <TrendingUp className="w-4 h-4 text-green-400" strokeWidth={2} />
                <div className="text-sm font-bold text-white">{t("tradingStats")}</div>
              </div>
              <div className="space-y-1.5 text-xs">
                <Row label={t("tradeVolume")} value={`${fmtNum(stats.total_trade_volume)} ${t("unitIqd")}`} />
                <Row label={t("totalTrades")} value={fmtNum(stats.total_trades)} />
                <Row label={t("successful")} value={fmtNum(stats.successful_trades)} color="text-green-400" />
                <Row label={t("failed")} value={fmtNum(stats.failed_trades)} color="text-red-400" />
                <Row label={t("cancelled")} value={fmtNum(stats.cancelled_trades)} />
                <Row
                  label={t("successRate")}
                  value={`${stats.success_rate}%`}
                  color={stats.success_rate >= 95 ? "text-green-400" : "text-yellow-400"}
                />
              </div>
            </Card>

            {/* Disputes */}
            <Card>
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.06]">
                <AlertTriangle className="w-4 h-4 text-yellow-400" strokeWidth={2} />
                <div className="text-sm font-bold text-white">{t("disputesTitle")}</div>
              </div>
              <div className="space-y-1.5 text-xs">
                <Row label={t("disputesTotal")} value={fmtNum(stats.disputes_total)} />
                <Row label={t("disputesWon")} value={fmtNum(stats.disputes_won)} color="text-green-400" />
                <Row label={t("disputesLost")} value={fmtNum(stats.disputes_lost)} color="text-red-400" />
                <Row
                  label={t("disputeRate")}
                  value={`${stats.dispute_rate}%`}
                  color={stats.dispute_rate > 5 ? "text-red-400" : "text-yellow-400"}
                />
              </div>
            </Card>

            {/* Reports */}
            <Card>
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.06]">
                <Flag className="w-4 h-4 text-red-400" strokeWidth={2} />
                <div className="text-sm font-bold text-white">{t("reportsTitle")}</div>
              </div>
              <div className="space-y-1.5 text-xs">
                <Row
                  label={t("reportsReceived")}
                  value={fmtNum(stats.reports_received)}
                  color={stats.reports_received > 0 ? "text-red-400" : "text-green-400"}
                />
                <Row label={t("reportsSent")} value={fmtNum(stats.reports_against_others)} />
              </div>
            </Card>

            {/* Rating */}
            <Card>
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.06]">
                <Star className="w-4 h-4 text-purple-400" strokeWidth={2} />
                <div className="text-sm font-bold text-white">{t("ratingTitle")}</div>
              </div>
              <div className="space-y-1.5 text-xs">
                <Row
                  label={t("ratingLabel")}
                  value={`${stats.rating_average} / 5`}
                  color="text-purple-400"
                />
                <Row label={t("ratingCount")} value={fmtNum(stats.rating_count)} />
                <Row label={t("daysActive")} value={fmtNum(stats.days_active)} />
                <Row label={t("accountAge")} value={t("accountAgeDays", { n: stats.account_age_days })} />
              </div>
            </Card>
          </div>

          {/* Level history (last 5) */}
          <Card>
            <div className="text-sm font-bold text-white mb-3 pb-3 border-b border-white/[0.06]">
              {t("levelHistory")}
            </div>
            {history.length === 0 ? (
              <div className="text-xs text-neutral-500 py-4 text-center">{t("noChanges")}</div>
            ) : (
              <div className="space-y-2.5">
                {history.map((h) => {
                  const meta = CHANGE_TYPE_META[h.change_type]
                  return (
                    <div
                      key={h.id}
                      className="flex items-start gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-lg"
                    >
                      <div className="text-2xl flex-shrink-0">{meta.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge color={meta.color}>{CHANGE_TYPE_KEY[h.change_type] ? t(CHANGE_TYPE_KEY[h.change_type]) : meta.label}</Badge>
                          <span className="text-xs text-white font-bold">
                            {h.from_level ? (LEVEL_KEY[h.from_level] ? t(LEVEL_KEY[h.from_level]) : getLevelSetting(h.from_level)?.display_name_ar) : "—"}
                            {" → "}
                            {LEVEL_KEY[h.to_level] ? t(LEVEL_KEY[h.to_level]) : getLevelSetting(h.to_level)?.display_name_ar}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400 leading-relaxed">{h.reason}</div>
                        <div className="text-[10px] text-neutral-600 mt-1" dir="ltr">
                          {new Date(h.created_at).toLocaleDateString("en-GB")}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

function Row({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-neutral-500">{label}</span>
      <span className={cn("font-bold font-mono", color ?? "text-white")}>{value}</span>
    </div>
  )
}
