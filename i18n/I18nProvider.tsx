"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readPref, writePref } from "@/ui/prefs";
import {
  detectLocale,
  LOCALES,
  translate,
  type Locale,
  type MessageKey,
  type Params,
} from "./translate";

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Params) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initial ?? "nl");

  useEffect(() => {
    if (initial) return;
    const saved = readPref("locale");
    const next = (LOCALES as readonly string[]).includes(saved ?? "")
      ? (saved as Locale)
      : detectLocale(navigator.languages ?? [navigator.language]);
    // Locale is only known on the client (static export), so sync it after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(next);
  }, [initial]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writePref("locale", next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale, t: (key, params) => translate(locale, key, params) }),
    [locale, setLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}
