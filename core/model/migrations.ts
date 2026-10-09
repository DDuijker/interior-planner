import { SCHEMA_VERSION } from "./version";

/**
 * Migrations upgrade stored data one schema version at a time.
 * `migrations[n]` turns a version-n document into a version-(n+1) document.
 * Migrations must be pure: never mutate the input.
 *
 * Version 0 is any document without a `schemaVersion` field (the earliest
 * prototype exports). Add a new entry here every time SCHEMA_VERSION goes up.
 */
export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // 0 -> 1: stamp unversioned documents and fill the fields that version 1 requires.
  0: (doc) => {
    const now = new Date(0).toISOString();
    return {
      ...doc,
      schemaVersion: 1,
      createdAt: typeof doc.createdAt === "string" ? doc.createdAt : now,
      updatedAt: typeof doc.updatedAt === "string" ? doc.updatedAt : now,
    };
  },
};

export class MigrationError extends Error {
  override name = "MigrationError";
}

export function readSchemaVersion(doc: unknown): number {
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    throw new MigrationError("Project data must be an object");
  }
  const v = (doc as Record<string, unknown>).schemaVersion;
  if (v === undefined) return 0;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
    throw new MigrationError(`Invalid schemaVersion: ${String(v)}`);
  }
  return v;
}

/**
 * Bring a stored document up to `target` (the current schema version by
 * default). Returns a new object; the input is left untouched.
 */
export function migrate(
  doc: unknown,
  target: number = SCHEMA_VERSION,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): Record<string, unknown> {
  let version = readSchemaVersion(doc);
  if (version > target) {
    throw new MigrationError(
      `Project was saved by a newer version of the app (schema ${version}, supported ${target})`,
    );
  }
  let current = doc as Record<string, unknown>;
  while (version < target) {
    const step = migrations[version];
    if (!step) throw new MigrationError(`No migration from schema ${version} to ${version + 1}`);
    current = step(current);
    const next = readSchemaVersion(current);
    if (next !== version + 1) {
      throw new MigrationError(`Migration from ${version} produced schema ${next}`);
    }
    version = next;
  }
  return current;
}
