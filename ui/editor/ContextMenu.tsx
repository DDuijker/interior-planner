"use client";

import { useLayoutEffect, useEffect, useRef, useState } from "react";
import type { Point } from "@/core/model/types";
import { useI18n } from "@/i18n/I18nProvider";

export interface MenuEntry {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

/** WAI-ARIA menu: arrows move, Enter activates, Escape or a click outside closes. */
export function ContextMenu({
  at,
  entries,
  onClose,
}: {
  at: Point;
  entries: MenuEntry[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const [pos, setPos] = useState(at);

  // Keep the menu inside its container.
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const maxX = parent.clientWidth - el.offsetWidth - 4;
    const maxY = parent.clientHeight - el.offsetHeight - 4;
    // Measuring needs the rendered menu, so this runs after layout.
    setPos({ x: Math.max(4, Math.min(at.x, maxX)), y: Math.max(4, Math.min(at.y, maxY)) });
  }, [at]);

  useEffect(() => {
    opener.current = document.activeElement;
    ref.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not(:disabled)")?.focus();
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  function onKeyDown(e: React.KeyboardEvent) {
    const items = [
      ...(ref.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? []),
    ];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={t("editor.contextMenu")}
      className="context-menu"
      style={{ left: pos.x, top: pos.y }}
      onKeyDown={onKeyDown}
    >
      {entries.map((entry) => (
        <button
          key={entry.label}
          type="button"
          role="menuitem"
          tabIndex={-1}
          disabled={entry.disabled}
          className="context-menu-item"
          onClick={() => {
            entry.onSelect();
            onClose();
          }}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
