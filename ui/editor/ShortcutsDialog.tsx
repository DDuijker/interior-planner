"use client";

import { DEFAULT_KEYMAP, formatCombo, SHORTCUT_ACTIONS } from "@/core/editor/shortcuts";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/translate";
import { Modal } from "@/ui/components/Modal";

const EXTRA: [string, MessageKey][] = [
  ["←↑→↓", "shortcut.nudge"],
  ["Shift+←↑→↓", "shortcut.nudgeFar"],
  ["Space", "shortcut.pan"],
];

export function ShortcutsDialog({
  open,
  onClose,
  isMac,
}: {
  open: boolean;
  onClose: () => void;
  isMac: boolean;
}) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={onClose} title={t("editor.shortcuts")}>
      <ShortcutsTable isMac={isMac} />
    </Modal>
  );
}

/** All shortcuts, also shown on the help page. */
export function ShortcutsTable({ isMac }: { isMac: boolean }) {
  const { t } = useI18n();
  return (
    <table className="shortcuts">
      <tbody>
        {SHORTCUT_ACTIONS.map((action) => (
          <tr key={action}>
            <th scope="row">{t(`shortcut.${action}` as MessageKey)}</th>
            <td>
              {DEFAULT_KEYMAP[action].map((combo) => (
                <kbd key={combo}>{formatCombo(combo, isMac)}</kbd>
              ))}
            </td>
          </tr>
        ))}
        {EXTRA.map(([keys, label]) => (
          <tr key={label}>
            <th scope="row">{t(label)}</th>
            <td>
              <kbd>{keys}</kbd>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
