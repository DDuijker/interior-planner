// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createProject } from "@/core/model/defaults";
import {
  deletePhoto,
  deleteProjectRecord,
  getPhoto,
  getProjectRecord,
  listBackups,
  listProjects,
  putPhoto,
  renameProjectRecord,
  resetDbForTests,
  saveProject,
} from "./db";

beforeEach(async () => {
  await resetDbForTests();
  await new Promise<void>((resolve) => {
    const r = indexedDB.deleteDatabase("maison");
    r.onsuccess = () => resolve();
    r.onerror = () => resolve();
  });
});

describe("project storage", () => {
  it("saves, lists newest first, renames and deletes", async () => {
    const a = { ...createProject("A"), updatedAt: "2026-01-01T00:00:00.000Z" };
    const b = { ...createProject("B"), updatedAt: "2026-02-01T00:00:00.000Z" };
    await saveProject(a, "<svg/>");
    await saveProject(b);
    expect((await listProjects()).map((p) => p.name)).toEqual(["B", "A"]);
    expect((await listProjects())[1]!.thumbnail).toBe("<svg/>");
    await renameProjectRecord(a.id, "Anders");
    const rec = await getProjectRecord(a.id);
    expect(rec?.name).toBe("Anders");
    expect((rec?.data as { name: string }).name).toBe("Anders");
    await deleteProjectRecord(a.id);
    expect((await listProjects()).map((p) => p.name)).toEqual(["B"]);
    expect(await listBackups(a.id)).toEqual([]);
  });

  it("keeps the last five backups, newest first", async () => {
    const p = createProject("P");
    for (let i = 0; i < 8; i++) await saveProject({ ...p, name: `v${i}` });
    const backups = await listBackups(p.id);
    expect(backups).toHaveLength(5);
    expect((backups[0]!.data as { name: string }).name).toBe("v7");
  });

  it("stores photo blobs", async () => {
    await putPhoto("ph1", new Blob(["abc"], { type: "image/webp" }));
    const blob = await getPhoto("ph1");
    // Stored as bytes (WebKit cannot keep a Blob in IndexedDB), so content and type survive.
    expect(blob?.type).toBe("image/webp");
    expect(await blob?.text()).toBe("abc");
    await deletePhoto("ph1");
    expect(await getPhoto("ph1")).toBeUndefined();
  });
});
