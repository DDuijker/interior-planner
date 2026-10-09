"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/translate";
import { Button, IconButton } from "@/ui/components/Button";
import { useSettings } from "@/ui/settings/settings";

const STEPS = ["load", "draw", "views", "save"] as const;

/**
 * Short tour on the first project (E11). Not modal: it sits in a corner and
 * never blocks the editor. Can be shown again from Settings.
 */
export function Onboarding() {
  const { t } = useI18n();
  const { settings, update, loaded } = useSettings();
  const [step, setStep] = useState(0);
  if (!loaded || settings.tourDone) return null;
  const id = STEPS[step]!;
  const done = () => update({ tourDone: true });
  return (
    <aside className="tour" role="dialog" aria-modal="false" aria-labelledby="tour-title">
      <div className="row tour-head">
        <h2 id="tour-title" className="panel-title">
          {t(`tour.${id}.title` as MessageKey)}
        </h2>
        <IconButton icon="close" label={t("tour.skip")} onClick={done} />
      </div>
      <p className="small">{t(`tour.${id}.body` as MessageKey)}</p>
      <div className="row tour-foot">
        <span className="muted small">{t("tour.step", { n: step + 1, total: STEPS.length })}</span>
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
            {t("tour.back")}
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
            {t("tour.next")}
          </Button>
        ) : (
          <Button variant="primary" onClick={done}>
            {t("tour.done")}
          </Button>
        )}
      </div>
    </aside>
  );
}

/** Tip on an empty floor: how to get a plan in. */
export function EmptyPlanTip({ onImport, onDraw }: { onImport: () => void; onDraw: () => void }) {
  const { t } = useI18n();
  return (
    <div className="empty-plan">
      <div className="empty-plan-card stack">
        <h2 className="display">{t("empty.title")}</h2>
        <p className="small">{t("empty.body")}</p>
        <div className="row">
          <Button variant="primary" icon="upload" onClick={onImport}>
            {t("empty.import")}
          </Button>
          <Button icon="room" onClick={onDraw}>
            {t("empty.draw")}
          </Button>
        </div>
      </div>
    </div>
  );
}
