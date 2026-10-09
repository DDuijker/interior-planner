import { loadProject } from "../model/load";
import type { ValidationIssue } from "../model/schema";
import type { Project } from "../model/types";

/** A downloadable project: the project plus its photos as data URLs. */
export const PROJECT_FILE_FORMAT = "maison-project";

export interface ProjectFile {
  format: typeof PROJECT_FILE_FORMAT;
  fileVersion: 1;
  exportedAt: string;
  project: Project;
  /** Photo id -> data URL. Only photos the user chose to keep. */
  photos: Record<string, string>;
}

export function buildProjectFile(
  project: Project,
  photos: Record<string, string> = {},
  now = new Date(),
): string {
  const file: ProjectFile = {
    format: PROJECT_FILE_FORMAT,
    fileVersion: 1,
    exportedAt: now.toISOString(),
    project,
    photos,
  };
  return JSON.stringify(file);
}

export type ProjectFileResult =
  | { ok: true; project: Project; photos: Record<string, string>; migratedFrom: number }
  | { ok: false; issues: ValidationIssue[] };

/** Read a project file (or a bare project JSON), migrate and validate it. */
export function readProjectFile(text: string): ProjectFileResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      issues: [{ path: "", message: `Not valid JSON: ${(err as Error).message}` }],
    };
  }
  const isFile =
    typeof raw === "object" &&
    raw !== null &&
    (raw as { format?: unknown }).format === PROJECT_FILE_FORMAT;
  const projectRaw = isFile ? (raw as { project: unknown }).project : raw;
  const photosRaw = isFile ? (raw as { photos?: unknown }).photos : undefined;
  const photos: Record<string, string> = {};
  if (photosRaw && typeof photosRaw === "object") {
    for (const [id, url] of Object.entries(photosRaw)) {
      if (typeof url === "string" && url.startsWith("data:image/")) photos[id] = url;
    }
  }
  const result = loadProject(projectRaw);
  if (!result.ok) return result;
  return { ok: true, project: result.project, photos, migratedFrom: result.migratedFrom };
}

/** Safe file name from a project name. */
export function fileNameFor(name: string, ext: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `${base || "project"}.${ext}`;
}
