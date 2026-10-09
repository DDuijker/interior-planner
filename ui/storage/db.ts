import type { Id, Project } from "@/core/model/types";

/**
 * Local storage in IndexedDB. Nothing leaves the browser.
 *
 * - projects: one record per project with the data and a small thumbnail
 * - photos:   image blobs (E13), keyed by photo id
 * - backups:  the last few good versions of each project, for recovery
 */

const DB_NAME = "maison";
const DB_VERSION = 1;
const MAX_BACKUPS = 5;

export interface ProjectRecord {
  id: Id;
  name: string;
  updatedAt: string;
  /** SVG markup of the plan, for the overview. */
  thumbnail?: string;
  /** Stored as-is; run loadProject() on it before use. */
  data: unknown;
}

export type ProjectMeta = Omit<ProjectRecord, "data">;

export interface BackupRecord {
  key?: number;
  projectId: Id;
  savedAt: string;
  data: unknown;
}

export interface PhotoRecord {
  id: Id;
  blob: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains("projects"))
        db.createObjectStore("projects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("photos"))
        db.createObjectStore("photos", { keyPath: "id" });
      if (!db.objectStoreNames.contains("backups")) {
        const backups = db.createObjectStore("backups", { keyPath: "key", autoIncrement: true });
        backups.createIndex("projectId", "projectId");
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  return dbPromise;
}

/** For tests: forget the open connection. */
export async function resetDbForTests() {
  const db = await dbPromise?.catch(() => null);
  db?.close();
  dbPromise = null;
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const db = await openDb();
  const all = await req(
    db.transaction("projects").objectStore("projects").getAll() as IDBRequest<ProjectRecord[]>,
  );
  return all
    .map(({ data: _data, ...meta }) => meta)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProjectRecord(id: Id): Promise<ProjectRecord | undefined> {
  const db = await openDb();
  return req(
    db.transaction("projects").objectStore("projects").get(id) as IDBRequest<
      ProjectRecord | undefined
    >,
  );
}

/** Save a project and keep it as a backup (only valid projects are saved). */
export async function saveProject(project: Project, thumbnail?: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(["projects", "backups"], "readwrite");
  const record: ProjectRecord = {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    data: project,
    ...(thumbnail ? { thumbnail } : {}),
  };
  tx.objectStore("projects").put(record);
  const backups = tx.objectStore("backups");
  backups.add({
    projectId: project.id,
    savedAt: project.updatedAt,
    data: project,
  } satisfies BackupRecord);
  const keys = await req(backups.index("projectId").getAllKeys(project.id));
  const excess = keys.length - MAX_BACKUPS;
  for (let i = 0; i < excess; i++) backups.delete(keys[i]!);
  await done(tx);
}

export async function renameProjectRecord(id: Id, name: string): Promise<void> {
  const record = await getProjectRecord(id);
  if (!record) return;
  const db = await openDb();
  const data =
    typeof record.data === "object" && record.data
      ? { ...(record.data as object), name }
      : record.data;
  const tx = db.transaction("projects", "readwrite");
  tx.objectStore("projects").put({ ...record, name, data });
  await done(tx);
}

export async function deleteProjectRecord(id: Id): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(["projects", "backups"], "readwrite");
  tx.objectStore("projects").delete(id);
  const backups = tx.objectStore("backups");
  const keys = await req(backups.index("projectId").getAllKeys(id));
  for (const k of keys) backups.delete(k);
  await done(tx);
}

/** Newest first. */
export async function listBackups(projectId: Id): Promise<BackupRecord[]> {
  const db = await openDb();
  const all = await req(
    db
      .transaction("backups")
      .objectStore("backups")
      .index("projectId")
      .getAll(projectId) as IDBRequest<BackupRecord[]>,
  );
  return all.sort((a, b) => (b.key ?? 0) - (a.key ?? 0));
}

export async function putPhoto(id: Id, blob: Blob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("photos", "readwrite");
  tx.objectStore("photos").put({ id, blob } satisfies PhotoRecord);
  await done(tx);
}

export async function getPhoto(id: Id): Promise<Blob | undefined> {
  const db = await openDb();
  const r = await req(
    db.transaction("photos").objectStore("photos").get(id) as IDBRequest<PhotoRecord | undefined>,
  );
  return r?.blob;
}

export async function deletePhoto(id: Id): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("photos", "readwrite");
  tx.objectStore("photos").delete(id);
  await done(tx);
}

/** Ask the browser not to evict our data when space runs low. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
