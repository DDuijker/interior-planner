"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadProject } from "@/core/model/load";
import type { Project } from "@/core/model/types";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/ui/components/Button";
import { listBackups, type BackupRecord } from "@/ui/storage/db";
import { openProject, persistProject } from "@/ui/projects/projectIO";
import { Workspace } from "./Workspace";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; project: Project }
  | { kind: "missing" }
  | { kind: "corrupt"; id: string; backups: BackupRecord[] };

/** Opens /project/?id=... from IndexedDB, with recovery from backups (E10-58). */
export function ProjectLoader() {
  const { t, locale } = useI18n();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      // Reading the URL is only possible on the client.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ kind: "missing" });
      return;
    }
    void openProject(id)
      .then(async (r) => {
        if (r.ok) setState({ kind: "ok", project: r.project });
        else if (r.reason === "missing") setState({ kind: "missing" });
        else setState({ kind: "corrupt", id, backups: await listBackups(id) });
      })
      .catch(() => setState({ kind: "missing" }));
  }, []);

  if (state.kind === "loading") {
    return (
      <p className="page muted" role="status">
        {t("common.loading")}
      </p>
    );
  }
  if (state.kind === "ok") return <Workspace initial={state.project} persist={persistProject} />;

  const fmt = new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <main className="page" id="main">
      <h1 className="display">
        {state.kind === "missing" ? t("loader.missing") : t("loader.corrupt")}
      </h1>
      {state.kind === "corrupt" && (
        <>
          <p>{t("loader.corruptBody")}</p>
          <ul className="stack">
            {state.backups.map((b) => {
              const ok = loadProject(b.data);
              return (
                <li key={b.key} className="row">
                  <span>{fmt.format(new Date(b.savedAt))}</span>
                  <Button
                    disabled={!ok.ok}
                    onClick={async () => {
                      if (!ok.ok) return;
                      await persistProject(ok.project);
                      setState({ kind: "ok", project: ok.project });
                    }}
                  >
                    {ok.ok ? t("loader.restore") : t("loader.unusable")}
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <Link href="/" className="btn btn-primary">
        {t("loader.toProjects")}
      </Link>
    </main>
  );
}
