"use client"

import { Moon, Sun, Laptop } from "lucide-react"
import { useTranslations } from "next-intl"
import { AppLayout } from "@/components/layout/AppLayout"
import {
  SettingsSectionHeader,
  SettingsOptionCard,
  SettingsButtonGroup,
  SettingsToggle,
} from "@/components/settings"
import { useTheme } from "@/lib/theme/ThemeProvider"
import {
  usePreferences,
  type FontSize,
  type Density,
} from "@/lib/preferences/usePreferences"

/**
 * Phase 14.13 Unified UI Part 2 — Appearance sub-page. The theme
 * control is the REAL ThemeProvider bridge (relocated verbatim from
 * the old tabbed settings page — `auto` ↔ `system` mapping kept).
 * Font size + density + animations remain local UI state (same as
 * before; not yet persisted — unchanged behaviour).
 */
export default function AppearanceSettingsPage() {
  const { theme: themeChoice, setTheme: setThemeChoice } = useTheme()
  const {
    fontSize, setFontSize,
    density, setDensity,
    animations, setAnimations,
  } = usePreferences()
  const t = useTranslations("settings")

  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
          <SettingsSectionHeader
            title={t("appearanceTitle")}
            subtitle={t("appearanceSubtitle")}
            backHref="/settings"
          />

          <div className="flex flex-col gap-3">
            <SettingsOptionCard title={t("modeTitle")} description={t("modeDesc")}>
              <SettingsButtonGroup
                value={themeChoice}
                onChange={(id) =>
                  setThemeChoice(id as "dark" | "light" | "system")
                }
                options={[
                  { id: "dark", label: t("modeDark"), icon: Moon },
                  { id: "light", label: t("modeLight"), icon: Sun },
                  { id: "system", label: t("modeAuto"), icon: Laptop },
                ]}
              />
            </SettingsOptionCard>

            <SettingsOptionCard
              title={t("fontTitle")}
              description={t("fontDesc")}
            >
              <SettingsButtonGroup
                value={fontSize}
                onChange={(id) => setFontSize(id as FontSize)}
                options={[
                  { id: "small", label: t("fontSmall") },
                  { id: "medium", label: t("fontMedium") },
                  { id: "large", label: t("fontLarge") },
                ]}
              />
            </SettingsOptionCard>

            <SettingsOptionCard
              title={t("densityTitle")}
              description={t("densityDesc")}
            >
              <SettingsButtonGroup
                value={density}
                onChange={(id) => setDensity(id as Density)}
                options={[
                  { id: "compact", label: t("densityCompact") },
                  { id: "comfortable", label: t("densityComfortable") },
                ]}
              />
            </SettingsOptionCard>

            <SettingsOptionCard
              title={t("motionTitle")}
              description={t("motionDesc")}
            >
              <SettingsToggle
                label={t("motionToggle")}
                checked={animations}
                onChange={setAnimations}
              />
            </SettingsOptionCard>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
