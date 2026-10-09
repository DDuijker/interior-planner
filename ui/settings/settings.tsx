"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Unit } from "@/core/model/types";

/**
 * App-wide preferences, stored in this browser only. The Claude API key is
 * one of them: it never leaves the browser except in requests to Anthropic.
 */
export type Quality = "auto" | "low" | "medium" | "high";

export interface AppSettings {
  unit: Unit;
  quality: Quality;
  apiKey: string;
  model: string;
  autosave: boolean;
  /** Remind to download a backup after this many changes (0 = never). */
  backupEvery: number;
  /** Offer to prepare an error report. Nothing is ever sent automatically. */
  errorReports: boolean;
  tourDone: boolean;
}

export const DEFAULT_MODEL = "claude-opus-5-5";
export const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"] as const;

export const DEFAULT_SETTINGS: AppSettings = {
  unit: "cm",
  quality: "auto",
  apiKey: "",
  model: DEFAULT_MODEL,
  autosave: true,
  backupEvery: 50,
  errorReports: false,
  tourDone: false,
};

const KEY = "maison.settings";

export function readSettings(): AppSettings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(s: AppSettings) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode: settings last for this session only.
  }
}

interface SettingsValue {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
  /** False until localStorage has been read (static export renders defaults first). */
  loaded: boolean;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // localStorage is only readable after mount in a static export.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(readSettings());
    setLoaded(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setSettings(readSettings());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      writeSettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    // Keep the API key: resetting preferences should not log you out.
    setSettings((s) => {
      const next = { ...DEFAULT_SETTINGS, apiKey: s.apiKey, tourDone: s.tourDone };
      writeSettings(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ settings, update, reset, loaded }),
    [settings, update, reset, loaded],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const v = useContext(SettingsContext);
  if (!v) throw new Error("useSettings must be used inside <SettingsProvider>");
  return v;
}
