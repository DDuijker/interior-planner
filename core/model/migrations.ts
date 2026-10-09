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

type Doc = Record<string, unknown>;
const asDoc = (v: unknown): Doc => (typeof v === "object" && v !== null ? (v as Doc) : {});
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const TRIM_V2 = {
  skirting: { style: "flat", height: 7, color: "#FBF9F4" },
  cornice: "none",
  rosette: false,
  frameColor: "#FBF9F4",
};

/** v1 called straight planks "wood". */
function floorFinishV2(f: unknown): unknown {
  const finish = asDoc(f);
  return finish.kind === "wood" ? { ...finish, kind: "planks" } : f;
}

function versionV2(v: unknown): Doc {
  const ver = asDoc(v);
  const style = asDoc(ver.style);
  return {
    ...ver,
    style: { ...style, floor: floorFinishV2(style.floor), trim: style.trim ?? TRIM_V2 },
    rooms: asArray(ver.rooms).map((r) => {
      const room = asDoc(r);
      const rs = room.style ? asDoc(room.style) : undefined;
      if (!rs || !rs.floor) return room;
      return { ...room, style: { ...rs, floor: floorFinishV2(rs.floor) } };
    }),
    demolitions: ver.demolitions ?? [],
    wallFlags: ver.wallFlags ?? {},
    moodboard: ver.moodboard ?? [],
  };
}

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
  // 1 -> 2: style trim, floor patterns, renovation, photos, looks, custom items.
  1: (doc) => {
    const settings = asDoc(doc.settings);
    return {
      ...doc,
      schemaVersion: 2,
      settings: { northAngle: 0, eyeHeight: 160, showLife: true, ...settings },
      floors: asArray(doc.floors).map((f) => {
        const floor = asDoc(f);
        return {
          ...floor,
          current: versionV2(floor.current),
          designs: asArray(floor.designs).map(versionV2),
        };
      }),
      photos: doc.photos ?? [],
      looks: doc.looks ?? [],
      customItems: doc.customItems ?? [],
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
