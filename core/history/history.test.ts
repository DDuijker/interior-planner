import { describe, expect, it } from "vitest";
import {
  begin,
  cancel,
  canRedo,
  canUndo,
  commit,
  createHistory,
  push,
  redo,
  reset,
  undo,
} from "./history";

describe("history", () => {
  it("undoes and redoes steps", () => {
    let h = push(push(createHistory(0), 1), 2);
    expect(h.present).toBe(2);
    h = undo(h);
    expect(h.present).toBe(1);
    expect(canRedo(h)).toBe(true);
    h = undo(undo(h));
    expect(h.present).toBe(0);
    expect(canUndo(h)).toBe(false);
    expect(undo(h)).toBe(h);
    h = redo(h);
    expect(h.present).toBe(1);
    h = redo(redo(h));
    expect(h.present).toBe(2);
    expect(redo(h)).toBe(h);
  });

  it("drops the redo branch on a new step", () => {
    let h = undo(push(push(createHistory("a"), "b"), "c"));
    h = push(h, "d");
    expect(h.future).toEqual([]);
    expect(undo(h).present).toBe("b");
  });

  it("ignores steps that change nothing", () => {
    const h = createHistory({ x: 1 });
    expect(push(h, h.present)).toBe(h);
  });

  it("keeps at least 100 steps", () => {
    let h = createHistory(0);
    for (let i = 1; i <= 150; i++) h = push(h, i);
    for (let i = 0; i < 150; i++) h = undo(h);
    expect(h.present).toBe(0);
  });

  it("trims beyond the limit", () => {
    let h = createHistory(0, 3);
    for (let i = 1; i <= 10; i++) h = push(h, i);
    expect(h.past).toEqual([7, 8, 9]);
    h = undo(undo(undo(undo(h))));
    expect(h.present).toBe(7);
    expect(() => createHistory(0, 0)).toThrow(RangeError);
  });

  it("treats a drag as one step", () => {
    let h = push(createHistory(0), 1);
    h = begin(h);
    for (let x = 2; x <= 50; x++) h = push(h, x);
    expect(h.present).toBe(50);
    h = commit(h);
    expect(h.past).toEqual([0, 1]);
    expect(undo(h).present).toBe(1);
  });

  it("does not record an empty transaction", () => {
    const h = commit(begin(push(createHistory(0), 1)));
    expect(h.past).toEqual([0]);
    expect(h.pending).toBeNull();
    expect(commit(h)).toBe(h);
  });

  it("cancels a transaction", () => {
    let h = begin(push(createHistory(0), 1));
    h = push(push(h, 5), 6);
    h = cancel(h);
    expect(h.present).toBe(1);
    expect(h.past).toEqual([0]);
    expect(cancel(h)).toBe(h);
  });

  it("commits an open transaction before undoing", () => {
    let h = begin(push(createHistory(0), 1));
    h = push(h, 9);
    h = undo(h);
    expect(h.present).toBe(1);
    expect(redo(h).present).toBe(9);
  });

  it("ignores nested begins", () => {
    let h = begin(createHistory(0));
    h = push(h, 1);
    h = begin(h);
    expect(h.pending).toBe(0);
  });

  it("resets without history", () => {
    const h = reset(push(createHistory(0, 50), 1), 7);
    expect(h).toEqual({ past: [], present: 7, future: [], pending: null, limit: 50 });
  });
});
