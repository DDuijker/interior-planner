"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { FIXTURE_TYPES, ROOM_TYPES } from "@/core/model/types";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/translate";
import { ShortcutsTable } from "@/ui/editor/ShortcutsDialog";

const EXAMPLE = `{
  "version": 1,
  "name": "Begane grond",
  "height": 260,
  "rooms": [
    { "name": "Woonkamer", "type": "living", "rects": [[0, 0, 500, 400]] },
    { "name": "Keuken", "type": "kitchen", "rects": [[500, 0, 300, 400]] }
  ],
  "doors": [{ "x": 500, "y": 150, "w": 83, "dir": "v" }],
  "windows": [{ "x": 100, "y": -15, "w": 200, "dir": "h" }],
  "fixtures": [{ "type": "kitchen", "x": 510, "y": 0, "w": 240, "h": 60 }],
  "items": [{ "name": "Bank 3-zits", "x": 250, "y": 340, "back": "S" }]
}`;

const FIELDS = [
  "name",
  "level",
  "height",
  "rooms",
  "walls",
  "doors",
  "windows",
  "passages",
  "fixtures",
  "items",
] as const;

const TOPICS = ["start", "draw", "furnish", "threeD", "photos", "save"] as const;

const isMacSnapshot = () => /Mac|iPhone|iPad/.test(navigator.platform);

/** Help (E11-65): how things work, shortcuts and the plan-code reference. */
export function HelpPage() {
  const { t } = useI18n();
  const isMac = useSyncExternalStore(
    () => () => {},
    isMacSnapshot,
    () => false,
  );
  return (
    <main className="page help-page" id="main">
      <header className="projects-head">
        <h1 className="display">{t("nav.help")}</h1>
        <Link className="btn btn-ghost" href="/">
          {t("nav.projects")}
        </Link>
      </header>
      <nav aria-label={t("help.contents")} className="card">
        <ul className="row help-toc">
          {TOPICS.map((topic) => (
            <li key={topic}>
              <a href={`#${topic}`}>{t(`help.${topic}.title`)}</a>
            </li>
          ))}
          <li>
            <a href="#shortcuts">{t("editor.shortcuts")}</a>
          </li>
          <li>
            <a href="#plan-code">{t("help.planCode.title")}</a>
          </li>
        </ul>
      </nav>

      {TOPICS.map((topic) => (
        <section key={topic} id={topic} className="card stack">
          <h2 className="panel-title">{t(`help.${topic}.title`)}</h2>
          <p>{t(`help.${topic}.body`)}</p>
        </section>
      ))}

      <section id="shortcuts" className="card stack">
        <h2 className="panel-title">{t("editor.shortcuts")}</h2>
        <ShortcutsTable isMac={isMac} />
      </section>

      <section id="plan-code" className="card stack">
        <h2 className="panel-title">{t("help.planCode.title")}</h2>
        <p>{t("help.planCode.intro")}</p>
        <pre className="code-block">
          <code>{EXAMPLE}</code>
        </pre>
        <table className="help-fields">
          <tbody>
            {FIELDS.map((f) => (
              <tr key={f}>
                <th scope="row">
                  <code>{f}</code>
                </th>
                <td>{t(`help.planCode.${f}` as MessageKey)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          {t("help.planCode.roomTypes")} <code>{ROOM_TYPES.join(", ")}</code>
        </p>
        <p>
          {t("help.planCode.fixtureTypes")} <code>{FIXTURE_TYPES.join(", ")}</code>
        </p>
        <p className="muted">{t("help.planCode.autoWalls")}</p>
      </section>
    </main>
  );
}
