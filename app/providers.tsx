"use client";

import { I18nProvider } from "@/i18n/I18nProvider";
import { ToastProvider } from "@/ui/components/Toast";
import { ThemeProvider } from "@/ui/theme/ThemeProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>{children}</ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
