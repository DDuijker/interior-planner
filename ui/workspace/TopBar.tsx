"use client";

import Link from "next/link";
import { useState } from "react";
import {
  addFloor,
  createDesign,
  getFloor,
  moveFloor,
  removeDesign,
  removeFloor,
  renameProject,
  renameVersion,
  setActiveFloor,
  setActiveVersion,
  updateFloor,
} from "@/core/model/actions";
import type { Project } from "@/core/model/types";
import { useI18n } from "@/i18n/I18nProvider";
import { Button, IconButton } from "@/ui/components/Button";
import { Modal } from "@/ui/components/Modal";
import { TextField } from "@/ui/components/TextField";
import { LengthField } from "@/ui/editor/LengthField";
import type { View } from "@/ui/editor/state";
import { Icon, type IconName } from "@/ui/icons";

export type SaveStatus =
  | { kind: "saved"; at: Date }
  | { kind: "saving" }
  | { kind: "dirty" }
  | { kind: "error" }
  | { kind: "local" };

const VIEWS: { id: View; icon: IconName }[] = [
  { id: "plan", icon: "room" },
  { id: "3d", icon: "cube" },
  { id: "style", icon: "palette" },
  { id: "photos", icon: "image" },
];

export function TopBar({
  project,
  apply,
  view,
  onView,
  status,
  onSave,
  onImport,
  onExport,
  onHelp,
}: {
  project: Project;
  apply: (update: (p: Project) => Project) => void;
  view: View;
  onView: (v: View) => void;
  status: SaveStatus;
  onSave?: () => void;
  onImport: () => void;
  onExport: () => void;
  onHelp: () => void;
}) {
  const { t, locale } = useI18n();
  const [floorsOpen, setFloorsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const floor = getFloor(project);
  const versions = [floor.current, ...floor.designs];
  const time = (d: Date) =>
    d.toLocaleTimeString(locale === "nl" ? "nl-NL" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <header className="topbar">
      <Link href="/" className="editor-brand display" aria-label={t("nav.projects")}>
        {t("app.name")}
      </Link>
      <label className="project-title">
        <span className="sr-only">{t("workspace.projectName")}</span>
        <input
          className="input input-title"
          defaultValue={project.name}
          key={project.id}
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name && name !== project.name) apply((p) => renameProject(p, name));
          }}
        />
      </label>

      <nav className="floor-tabs" aria-label={t("floors.title")}>
        {project.floors.map((f) => (
          <button
            key={f.id}
            type="button"
            className="chip"
            aria-pressed={f.id === project.activeFloorId}
            onClick={() => apply((p) => setActiveFloor(p, f.id))}
          >
            {f.name}
          </button>
        ))}
        <IconButton icon="floors" label={t("floors.manage")} onClick={() => setFloorsOpen(true)} />
      </nav>

      <div className="version-picker">
        <label className="inline-select">
          <span className="sr-only">{t("versions.label")}</span>
          <select
            className="input"
            value={floor.activeVersionId}
            onChange={(e) => apply((p) => setActiveVersion(p, floor.id, e.target.value))}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.kind === "current" ? t("versions.current") : v.name}
              </option>
            ))}
          </select>
        </label>
        <IconButton
          icon="more"
          label={t("versions.manage")}
          onClick={() => setVersionsOpen(true)}
        />
      </div>

      <div role="tablist" aria-label={t("workspace.views")} className="view-tabs">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            className="view-tab"
            onClick={() => onView(v.id)}
          >
            <Icon name={v.icon} size={18} />
            {t(`view.${v.id}`)}
          </button>
        ))}
      </div>

      <div className="topbar-end">
        <span className="save-status muted small" role="status">
          {status.kind === "saved"
            ? t("save.savedAt", { time: time(status.at) })
            : status.kind === "saving"
              ? t("save.saving")
              : status.kind === "dirty"
                ? t("save.unsaved")
                : status.kind === "error"
                  ? t("save.error")
                  : t("save.local")}
        </span>
        {onSave && status.kind === "dirty" && (
          <Button variant="primary" onClick={onSave}>
            {t("common.save")}
          </Button>
        )}
        <IconButton icon="upload" label={t("workspace.import")} onClick={onImport} />
        <IconButton icon="download" label={t("workspace.export")} onClick={onExport} />
        <IconButton icon="help" label={t("nav.help")} onClick={onHelp} />
        <Link
          href="/settings/"
          className="btn btn-icon btn-ghost"
          aria-label={t("nav.settings")}
          title={t("nav.settings")}
        >
          <Icon name="settings" />
        </Link>
      </div>

      <FloorsDialog
        open={floorsOpen}
        onClose={() => setFloorsOpen(false)}
        project={project}
        apply={apply}
      />
      <VersionsDialog
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        project={project}
        apply={apply}
      />
    </header>
  );
}

function FloorsDialog({
  open,
  onClose,
  project,
  apply,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
  apply: (update: (p: Project) => Project) => void;
}) {
  const { t } = useI18n();
  const sorted = [...project.floors].sort((a, b) => b.level - a.level);
  return (
    <Modal open={open} onClose={onClose} title={t("floors.title")}>
      <ul className="floor-list">
        {sorted.map((f, i) => (
          <li key={f.id} className="floor-row">
            <TextField
              label={t("floors.name")}
              defaultValue={f.name}
              onBlur={(e) =>
                e.target.value.trim() &&
                apply((p) => updateFloor(p, f.id, { name: e.target.value.trim() }))
              }
            />
            <LengthField
              label={t("floors.height")}
              value={f.height}
              unit={project.settings.unit}
              min={150}
              onCommit={(height) => apply((p) => updateFloor(p, f.id, { height }))}
            />
            <div className="row">
              <IconButton
                icon="upload"
                label={t("floors.up", { name: f.name })}
                disabled={i === 0}
                onClick={() => apply((p) => moveFloor(p, f.id, 1))}
              />
              <IconButton
                icon="download"
                label={t("floors.down", { name: f.name })}
                disabled={i === sorted.length - 1}
                onClick={() => apply((p) => moveFloor(p, f.id, -1))}
              />
              <IconButton
                icon="trash"
                label={t("floors.delete", { name: f.name })}
                disabled={project.floors.length < 2}
                onClick={() => apply((p) => removeFloor(p, f.id))}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="row">
        <Button icon="plus" onClick={() => apply((p) => addFloor(p, t("floors.newAbove")))}>
          {t("floors.addAbove")}
        </Button>
        <Button
          icon="plus"
          onClick={() =>
            apply((p) =>
              addFloor(p, t("floors.newBelow"), Math.min(...p.floors.map((f) => f.level)) - 1),
            )
          }
        >
          {t("floors.addBelow")}
        </Button>
      </div>
    </Modal>
  );
}

function VersionsDialog({
  open,
  onClose,
  project,
  apply,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
  apply: (update: (p: Project) => Project) => void;
}) {
  const { t } = useI18n();
  const floor = getFloor(project);
  return (
    <Modal open={open} onClose={onClose} title={t("versions.manage")}>
      <p className="muted">{t("versions.explain")}</p>
      <ul className="floor-list">
        {floor.designs.map((d) => (
          <li key={d.id} className="floor-row">
            <TextField
              label={t("versions.name")}
              defaultValue={d.name}
              onBlur={(e) =>
                e.target.value.trim() &&
                apply((p) => renameVersion(p, floor.id, d.id, e.target.value.trim()))
              }
            />
            <IconButton
              icon="trash"
              label={t("versions.delete", { name: d.name })}
              onClick={() => apply((p) => removeDesign(p, floor.id, d.id))}
            />
          </li>
        ))}
      </ul>
      <Button
        icon="plus"
        variant="primary"
        onClick={() => {
          apply((p) =>
            createDesign(p, floor.id, t("versions.newName", { n: floor.designs.length + 1 })),
          );
          onClose();
        }}
      >
        {t("versions.new")}
      </Button>
    </Modal>
  );
}
