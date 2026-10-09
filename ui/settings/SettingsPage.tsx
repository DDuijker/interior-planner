"use client";

import Link from "next/link";
import { useState } from "react";
import { PRICES, typicalFloorplanCost } from "@/core/ai/floorplan";
import { UNITS } from "@/core/model/types";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/ui/components/Button";
import { useToast } from "@/ui/components/Toast";
import { Preferences } from "@/ui/Preferences";
import { MODELS, useSettings, type Quality } from "./settings";

const QUALITIES: Quality[] = ["auto", "low", "medium", "high"];

/** All app settings (E11-64). Everything is stored in this browser only. */
export function SettingsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const { settings, update, reset } = useSettings();

  return (
    <main className="page settings-page" id="main">
      <header className="projects-head">
        <h1 className="display">{t("settings.title")}</h1>
        <Link className="btn btn-ghost" href="/">
          {t("nav.projects")}
        </Link>
      </header>

      <section className="card stack" aria-labelledby="s-general">
        <h2 id="s-general" className="panel-title">
          {t("settings.general")}
        </h2>
        <Preferences />
        <div className="row">
          <label className="field">
            <span className="field-label">{t("settings.unit")}</span>
            <select
              className="input"
              value={settings.unit}
              onChange={(e) => update({ unit: e.target.value as (typeof UNITS)[number] })}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`unit.${u}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t("settings.quality")}</span>
            <select
              className="input"
              value={settings.quality}
              onChange={(e) => update({ quality: e.target.value as Quality })}
            >
              {QUALITIES.map((q) => (
                <option key={q} value={q}>
                  {t(`settings.quality.${q}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted small">{t("settings.unitHint")}</p>
      </section>

      <ClaudeSection />

      <section className="card stack" aria-labelledby="s-save">
        <h2 id="s-save" className="panel-title">
          {t("settings.saving")}
        </h2>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.autosave}
            onChange={(e) => update({ autosave: e.target.checked })}
          />
          {t("settings.autosave")}
        </label>
        <label className="field">
          <span className="field-label">{t("settings.backupEvery")}</span>
          <select
            className="input"
            value={settings.backupEvery}
            onChange={(e) => update({ backupEvery: Number(e.target.value) })}
          >
            {[0, 25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? t("settings.never") : t("settings.changes", { count: n })}
              </option>
            ))}
          </select>
        </label>
        <p className="muted small">{t("settings.localOnly")}</p>
      </section>

      <section className="card stack" aria-labelledby="s-errors">
        <h2 id="s-errors" className="panel-title">
          {t("settings.errors")}
        </h2>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.errorReports}
            onChange={(e) => update({ errorReports: e.target.checked })}
          />
          {t("settings.errorReports")}
        </label>
        <p className="muted small">{t("settings.errorReportsHint")}</p>
      </section>

      <section className="card stack" aria-labelledby="s-reset">
        <h2 id="s-reset" className="panel-title">
          {t("settings.resetTitle")}
        </h2>
        <div className="row">
          <Button
            onClick={() => {
              reset();
              toast(t("settings.resetDone"), "success");
            }}
          >
            {t("settings.reset")}
          </Button>
          <Button variant="ghost" onClick={() => update({ tourDone: false })}>
            {t("settings.tourAgain")}
          </Button>
        </div>
        <p className="muted small">{t("settings.resetHint")}</p>
      </section>
    </main>
  );
}

function ClaudeSection() {
  const { t } = useI18n();
  const toast = useToast();
  const { settings, update } = useSettings();
  const [draft, setDraft] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const key = draft ?? settings.apiKey;
  const cost = typicalFloorplanCost(settings.model);

  async function test() {
    setTesting(true);
    // Loaded on demand: the SDK is only needed by people who use Claude.
    const { testKey } = await import("@/ui/ai/claude");
    const result = await testKey(key.trim(), settings.model);
    setTesting(false);
    if (result === true) toast(t("settings.keyOk"), "success");
    else toast(t(`ai.error.${result.kind === "aborted" ? "other" : result.kind}`), "warning");
  }

  return (
    <section className="card stack" aria-labelledby="claude-title" id="claude">
      <h2 id="claude-title" className="panel-title">
        {t("settings.claude")}
      </h2>
      <p className="small">{t("settings.claudeIntro")}</p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          update({ apiKey: key.trim() });
          setDraft(null);
          toast(t(key.trim() ? "settings.keySaved" : "settings.keyRemoved"), "success");
        }}
      >
        <label className="field">
          <span className="field-label">{t("settings.apiKey")}</span>
          <input
            className="input mono"
            type={show ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-ant-…"
            value={key}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <div className="row">
          <Button type="submit" variant="primary">
            {t("common.save")}
          </Button>
          <Button onClick={() => setShow((s) => !s)} aria-pressed={show}>
            {show ? t("settings.hideKey") : t("settings.showKey")}
          </Button>
          <Button disabled={!key.trim() || testing} onClick={() => void test()}>
            {testing ? t("settings.testing") : t("settings.testKey")}
          </Button>
          {settings.apiKey && (
            <Button
              variant="ghost"
              onClick={() => {
                update({ apiKey: "" });
                setDraft(null);
                toast(t("settings.keyRemoved"), "success");
              }}
            >
              {t("settings.removeKey")}
            </Button>
          )}
        </div>
      </form>
      <label className="field">
        <span className="field-label">{t("settings.model")}</span>
        <select
          className="input"
          value={settings.model}
          onChange={(e) => update({ model: e.target.value })}
        >
          {MODELS.map((m) => (
            <option key={m} value={m}>
              {t(`settings.model.${m}`)} ({m}, ${PRICES[m]?.input}/${PRICES[m]?.output})
            </option>
          ))}
        </select>
      </label>
      {cost !== undefined && (
        <p className="muted small">{t("settings.costHint", { cost: cost.toFixed(2) })}</p>
      )}
      <details>
        <summary>{t("settings.howKey")}</summary>
        <ol className="small">
          <li>
            {t("settings.howKey1")}{" "}
            <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer noopener">
              console.anthropic.com
            </a>
          </li>
          <li>{t("settings.howKey2")}</li>
          <li>{t("settings.howKey3")}</li>
        </ol>
      </details>
      <div className="notice small">
        <p>{t("settings.privacy1")}</p>
        <p>{t("settings.privacy2")}</p>
        <p>{t("settings.privacy3")}</p>
      </div>
    </section>
  );
}
