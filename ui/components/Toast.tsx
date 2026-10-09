"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { IconButton } from "./Button";

type Tone = "info" | "success" | "warning";
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);

/** Polite live region for short notices. Toasts close themselves after 5 s. */
export function ToastProvider({
  children,
  duration = 5000,
}: {
  children: React.ReactNode;
  duration?: number;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const { t } = useI18n();

  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((x) => x.id !== id)),
    [],
  );
  const show = useCallback(
    (message: string, tone: Tone = "info") => {
      const id = next.current++;
      setToasts((all) => [...all, { id, message, tone }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
    },
    [dismiss, duration],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <span>{toast.message}</span>
            <IconButton icon="close" label={t("common.close")} onClick={() => dismiss(toast.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}
