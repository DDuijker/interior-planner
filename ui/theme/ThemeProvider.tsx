"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { readPref, writePref } from "@/ui/prefs";

export type ThemeChoice = "system" | "light" | "dark";

const ThemeContext = createContext<{
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
} | null>(null);

function apply(theme: ThemeChoice) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");

  useEffect(() => {
    const saved = readPref("theme");
    if (saved === "light" || saved === "dark") {
      // Preference lives in localStorage, only readable after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeState(saved);
      apply(saved);
    }
  }, []);

  const setTheme = useCallback((next: ThemeChoice) => {
    setThemeState(next);
    writePref("theme", next);
    apply(next);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}
