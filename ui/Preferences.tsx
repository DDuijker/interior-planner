"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { LOCALES, type Locale } from "@/i18n/translate";
import { useTheme, type ThemeChoice } from "./theme/ThemeProvider";

/** Language and theme selects. Full settings screen is E11-64. */
export function Preferences() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  return (
    <div className="row prefs">
      <label className="field">
        <span className="field-label">{t("settings.language")}</span>
        <select
          className="input"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {l === "nl" ? "Nederlands" : "English"}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">{t("settings.theme")}</span>
        <select
          className="input"
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemeChoice)}
        >
          {(["system", "light", "dark"] as const).map((v) => (
            <option key={v} value={v}>
              {t(`settings.theme.${v}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
