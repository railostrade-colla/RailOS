"use client"

import { useState } from "react"
import { Moon, Sun, Laptop } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import {
  SettingsSectionHeader,
  SettingsOptionCard,
  SettingsButtonGroup,
  SettingsToggle,
} from "@/components/settings"
import { useTheme } from "@/lib/theme/ThemeProvider"

/**
 * Phase 14.13 Unified UI Part 2 — Appearance sub-page. The theme
 * control is the REAL ThemeProvider bridge (relocated verbatim from
 * the old tabbed settings page — `auto` ↔ `system` mapping kept).
 * Font size + density + animations remain local UI state (same as
 * before; not yet persisted — unchanged behaviour).
 */
export default function AppearanceSettingsPage() {
  const { theme: themeChoice, setTheme: setThemeChoice } = useTheme()
  const [fontSize, setFontSize] = useState("medium")
  const [density, setDensity] = useState("comfortable")
  const [animations, setAnimations] = useState(true)

  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
          <SettingsSectionHeader
            title="المظهر والعرض"
            subtitle="تخصيص الواجهة"
            backHref="/settings"
          />

          <div className="flex flex-col gap-3">
            <SettingsOptionCard title="الوضع" description="اختر الوضع المناسب لك">
              <SettingsButtonGroup
                value={themeChoice}
                onChange={(id) =>
                  setThemeChoice(id as "dark" | "light" | "system")
                }
                options={[
                  { id: "dark", label: "داكن", icon: Moon },
                  { id: "light", label: "فاتح", icon: Sun },
                  { id: "system", label: "تلقائي", icon: Laptop },
                ]}
              />
            </SettingsOptionCard>

            <SettingsOptionCard
              title="حجم الخط"
              description="صغير، متوسط، كبير"
            >
              <SettingsButtonGroup
                value={fontSize}
                onChange={setFontSize}
                options={[
                  { id: "small", label: "صغير" },
                  { id: "medium", label: "متوسط" },
                  { id: "large", label: "كبير" },
                ]}
              />
            </SettingsOptionCard>

            <SettingsOptionCard
              title="كثافة العرض"
              description="مدمج أو مريح"
            >
              <SettingsButtonGroup
                value={density}
                onChange={setDensity}
                options={[
                  { id: "compact", label: "مدمج" },
                  { id: "comfortable", label: "مريح" },
                ]}
              />
            </SettingsOptionCard>

            <SettingsOptionCard
              title="الحركات والتأثيرات"
              description="عطّلها لتحسين الأداء على الأجهزة الأبطأ"
            >
              <SettingsToggle
                label="تفعيل الحركات"
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
