"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { fileNameFor } from "@/core/export/projectFile";
import { createProject } from "@/core/model/defaults";
import { newId } from "@/core/model/ids";
import type { Project } from "@/core/model/types";
import { SAMPLES } from "@/core/samples/houses";
import { useI18n } from "@/i18n/I18nProvider";
import { Button, IconButton } from "@/ui/components/Button";
import { Modal } from "@/ui/components/Modal";
import { TextField } from "@/ui/components/TextField";
import { useToast } from "@/ui/components/Toast";
import { downloadText } from "@/ui/download";
import { Preferences } from "@/ui/Preferences";
import { useSettings } from "@/ui/settings/settings";
import {
  deleteProjectRecord,
  listProjects,
  renameProjectRecord,
  requestPersistence,
  type ProjectMeta,
} from "@/ui/storage/db";
import { resetChanges } from "./backupReminder";
import {
  exportProject,
  openProject,
  persistProject,
  projectFromPlanCode,
  readImport,
  saveImported,
} from "./projectIO";

export function projectHref(id: string) {
  return `/project/?id=${encodeURIComponent(id)}`;
}

export function ProjectsPage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const { settings } = useSettings();
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ProjectMeta | null>(null);
  const [conflict, setConflict] = useState<{
    project: Project;
    photos: Record<string, string>;
  } | null>(null);
  const [importErrors, setImportErrors] = useState<string[] | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch {
      setFailed(true);
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    // Loading from IndexedDB happens after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    void navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(false));
  }, [refresh]);

  async function create(project: Project) {
    const withUnit = { ...project, settings: { ...project.settings, unit: settings.unit } };
    await persistProject(withUnit);
    void requestPersistence().then(setPersisted);
    router.push(projectHref(withUnit.id));
  }

  async function duplicate(meta: ProjectMeta) {
    const r = await openProject(meta.id);
    if (!r.ok) return toast(t("projects.corrupt"), "warning");
    const now = new Date().toISOString();
    await persistProject({
      ...r.project,
      id: newId("proj"),
      name: `${meta.name} ${t("projects.copySuffix")}`,
      createdAt: now,
      updatedAt: now,
    });
    await refresh();
  }

  async function download(meta: ProjectMeta) {
    const r = await openProject(meta.id);
    if (!r.ok) return toast(t("projects.corrupt"), "warning");
    downloadText(await exportProject(r.project), fileNameFor(meta.name, "maison.json"));
    resetChanges(meta.id);
  }

  async function onFile(file: File) {
    const text = await file.text();
    const result = readImport(text);
    if (result.kind === "error") return setImportErrors(result.messages);
    if (result.kind === "plancode") {
      const name = file.name.replace(/\.(json|txt)$/i, "") || t("projects.imported");
      if (result.result.warnings.length)
        toast(t("import.warnings", { count: result.result.warnings.length }), "warning");
      return create(projectFromPlanCode(name, result.result));
    }
    const exists = projects?.some((p) => p.id === result.project.id);
    if (exists) return setConflict({ project: result.project, photos: result.photos });
    const saved = await saveImported(result.project, result.photos, false);
    router.push(projectHref(saved.id));
  }

  async function resolveConflict(asCopy: boolean) {
    if (!conflict) return;
    const saved = await saveImported(conflict.project, conflict.photos, asCopy);
    setConflict(null);
    router.push(projectHref(saved.id));
  }

  const dateFmt = new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="page projects" id="main">
      <header className="projects-head">
        <div>
          <h1 className="display" style={{ fontSize: "var(--font-xxl)", margin: 0 }}>
            {t("app.name")}
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            {t("app.tagline")}
          </p>
        </div>
        <nav className="row" aria-label={t("nav.main")}>
          <Link className="btn btn-ghost" href="/help/">
            {t("nav.help")}
          </Link>
          <Link className="btn btn-ghost" href="/settings/">
            {t("nav.settings")}
          </Link>
        </nav>
      </header>

      {persisted === false && (
        <p className="notice" role="note">
          {t("projects.storageNotice")}
        </p>
      )}
      {failed && (
        <p className="notice notice-warn" role="alert">
          {t("projects.noStorage")}
        </p>
      )}

      <section aria-labelledby="new-title" className="panel new-project">
        <h2 id="new-title">{t("projects.new")}</h2>
        <div className="sample-grid">
          <button
            type="button"
            className="sample-card"
            onClick={() => create(createProject(t("projects.untitled")))}
          >
            <strong>{t("projects.empty")}</strong>
            <span className="muted">{t("projects.emptyHint")}</span>
          </button>
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="sample-card"
              data-sample={s.id}
              onClick={() => create({ ...s.create(), name: s.name[locale] })}
            >
              <strong>{s.name[locale]}</strong>
              <span className="muted">{s.description[locale]}</span>
            </button>
          ))}
        </div>
        <div className="row">
          <Button icon="plus" onClick={() => fileRef.current?.click()}>
            {t("projects.import")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.txt,application/json,text/plain"
            className="sr-only"
            aria-label={t("projects.import")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onFile(f);
            }}
          />
          <span className="muted">{t("projects.importHint")}</span>
        </div>
      </section>

      <section aria-labelledby="list-title">
        <h2 id="list-title">{t("projects.mine")}</h2>
        {projects === null ? (
          <p className="muted">{t("common.loading")}</p>
        ) : projects.length === 0 ? (
          <p className="muted">{t("projects.none")}</p>
        ) : (
          <ul className="project-grid">
            {projects.map((p) => (
              <li key={p.id} className="project-card">
                <Link
                  href={projectHref(p.id)}
                  className="project-thumb"
                  aria-label={t("projects.open", { name: p.name })}
                >
                  {p.thumbnail ? (
                    <span className="thumb-svg" dangerouslySetInnerHTML={{ __html: p.thumbnail }} />
                  ) : null}
                </Link>
                <div className="project-meta">
                  {renaming === p.id ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
                        if (name) await renameProjectRecord(p.id, name);
                        setRenaming(null);
                        await refresh();
                      }}
                    >
                      <TextField
                        name="name"
                        label={t("projects.rename")}
                        defaultValue={p.name}
                        autoFocus
                        hideLabel
                      />
                    </form>
                  ) : (
                    <Link href={projectHref(p.id)} className="project-name">
                      {p.name}
                    </Link>
                  )}
                  <span className="muted small">
                    {t("projects.updated", { date: dateFmt.format(new Date(p.updatedAt)) })}
                  </span>
                </div>
                <div className="row project-actions">
                  <IconButton
                    icon="edit"
                    label={t("projects.rename")}
                    onClick={() => setRenaming(p.id)}
                  />
                  <IconButton
                    icon="copy"
                    label={t("projects.duplicate")}
                    onClick={() => duplicate(p)}
                  />
                  <IconButton
                    icon="download"
                    label={t("projects.download")}
                    onClick={() => download(p)}
                  />
                  <IconButton
                    icon="trash"
                    label={t("projects.delete")}
                    onClick={() => setDeleting(p)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-label={t("settings.title")}>
        <Preferences />
      </section>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t("projects.deleteTitle")}
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>{t("common.cancel")}</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (deleting) await deleteProjectRecord(deleting.id);
                setDeleting(null);
                await refresh();
              }}
            >
              {t("projects.delete")}
            </Button>
          </>
        }
      >
        <p>{t("projects.deleteBody", { name: deleting?.name ?? "" })}</p>
      </Modal>

      <Modal
        open={!!conflict}
        onClose={() => setConflict(null)}
        title={t("import.conflictTitle")}
        footer={
          <>
            <Button onClick={() => resolveConflict(true)}>{t("import.asCopy")}</Button>
            <Button variant="danger" onClick={() => resolveConflict(false)}>
              {t("import.overwrite")}
            </Button>
          </>
        }
      >
        <p>{t("import.conflictBody", { name: conflict?.project.name ?? "" })}</p>
      </Modal>

      <Modal open={!!importErrors} onClose={() => setImportErrors(null)} title={t("import.failed")}>
        <ul className="error-list">
          {importErrors?.map((m) => (
            <li key={m}>
              <code>{m}</code>
            </li>
          ))}
        </ul>
      </Modal>
    </main>
  );
}
