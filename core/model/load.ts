import { migrate, MigrationError } from "./migrations";
import { validateProject, type ValidationIssue } from "./schema";
import type { Project } from "./types";

export type LoadResult =
  { ok: true; project: Project; migratedFrom: number } | { ok: false; issues: ValidationIssue[] };

/** Migrate stored data to the current schema and validate it. */
export function loadProject(raw: unknown): LoadResult {
  let doc: Record<string, unknown>;
  let from: number;
  try {
    from =
      typeof raw === "object" && raw !== null && "schemaVersion" in raw
        ? Number(raw.schemaVersion)
        : 0;
    doc = migrate(raw);
  } catch (err) {
    if (err instanceof MigrationError)
      return { ok: false, issues: [{ path: "", message: err.message }] };
    throw err;
  }
  const result = validateProject(doc);
  if (!result.ok) return result;
  return { ok: true, project: result.project, migratedFrom: from };
}
