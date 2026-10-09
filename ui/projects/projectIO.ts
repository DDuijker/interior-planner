import { buildProjectFile, readProjectFile } from "@/core/export/projectFile";
import { buildDrawing, drawingToSvg } from "@/core/export/drawing";
import { loadProject } from "@/core/model/load";
import { newId } from "@/core/model/ids";
import { getActiveVersion, getFloor } from "@/core/model/actions";
import type { Project } from "@/core/model/types";
import { cutWalls } from "@/core/openings/openings";
import { parsePlanCode, type ParseResult } from "@/core/plancode/plancode";
import { projectFromPlans } from "@/core/samples/houses";
import { generateWalls } from "@/core/walls/generate";
import { blobToDataUrl, dataUrlToBlob } from "@/ui/download";
import { ROOM_TINTS } from "@/ui/editor/roomColors";
import { getPhoto, getProjectRecord, putPhoto, saveProject } from "@/ui/storage/db";

/** Small SVG of the active floor for the project overview. */
export function makeThumbnail(project: Project): string {
  try {
    const floor = getFloor(project);
    const v = getActiveVersion(project);
    const walls = generateWalls(v.rooms, v.extraWalls, { height: floor.height });
    const d = buildDrawing(v, walls, cutWalls(walls, v.openings), {
      unit: project.settings.unit,
      px: 4,
      labels: false,
      tints: ROOM_TINTS,
      custom: project.customItems,
    });
    return drawingToSvg(d, { padding: 30 });
  } catch {
    return "";
  }
}

export async function persistProject(project: Project): Promise<void> {
  await saveProject(project, makeThumbnail(project));
}

/** Load a stored project, migrating if needed. */
export async function openProject(
  id: string,
): Promise<{ ok: true; project: Project } | { ok: false; reason: "missing" | "corrupt" }> {
  const record = await getProjectRecord(id);
  if (!record) return { ok: false, reason: "missing" };
  const result = loadProject(record.data);
  return result.ok ? { ok: true, project: result.project } : { ok: false, reason: "corrupt" };
}

/** Project file text, with the photos the project keeps. */
export async function exportProject(project: Project): Promise<string> {
  const photos: Record<string, string> = {};
  const keep = new Set(project.photos.map((p) => p.id));
  for (const floor of project.floors) {
    for (const v of [floor.current, ...floor.designs])
      if (v.background?.keep) keep.add(v.background.photoId);
  }
  for (const id of keep) {
    const blob = await getPhoto(id);
    if (blob) photos[id] = await blobToDataUrl(blob);
  }
  return buildProjectFile(project, photos);
}

export type ImportResult =
  | { kind: "project"; project: Project; photos: Record<string, string> }
  | { kind: "plancode"; result: Extract<ParseResult, { ok: true }> }
  | { kind: "error"; messages: string[] };

/** Decide whether a text is a project file or plan-code, and read it. */
export function readImport(text: string): ImportResult {
  let looksLikeProject = false;
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    looksLikeProject =
      !!raw &&
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      ("format" in raw || "schemaVersion" in raw || "floors" in raw);
  } catch {
    looksLikeProject = false;
  }
  if (looksLikeProject) {
    const r = readProjectFile(text);
    if (r.ok) return { kind: "project", project: r.project, photos: r.photos };
    return {
      kind: "error",
      messages: r.issues.slice(0, 8).map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)),
    };
  }
  const plan = parsePlanCode(text);
  if (plan.ok) return { kind: "plancode", result: plan };
  return {
    kind: "error",
    messages: plan.errors
      .slice(0, 8)
      .map((e) => `${e.line}:${e.col} ${e.path ? `${e.path}: ` : ""}${e.message}`),
  };
}

/** Store an imported project. `asCopy` gives it a new id so nothing is overwritten. */
export async function saveImported(
  project: Project,
  photos: Record<string, string>,
  asCopy: boolean,
): Promise<Project> {
  const stored: Project = asCopy ? { ...project, id: newId("proj"), name: project.name } : project;
  for (const [id, url] of Object.entries(photos)) await putPhoto(id, await dataUrlToBlob(url));
  await persistProject({ ...stored, updatedAt: new Date().toISOString() });
  return stored;
}

export function projectFromPlanCode(
  name: string,
  result: Extract<ParseResult, { ok: true }>,
): Project {
  return projectFromPlans(name, result.plans);
}
