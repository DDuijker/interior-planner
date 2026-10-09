import { describe, expect, it } from "vitest";
import { getActiveVersion, groupItems, moveItems, removeItems } from "@/core/model/actions";
import { sampleApartment } from "@/core/samples/apartment";
import { editorReducer, initialEditorState } from "./state";

const base = () => initialEditorState(sampleApartment());

describe("editorReducer", () => {
  it("records edits and undoes them", () => {
    let s = editorReducer(base(), { type: "apply", update: (p) => moveItems(p, ["sofa"], 10, 0) });
    expect(getActiveVersion(s.history.present).items.find((i) => i.id === "sofa")!.x).toBe(58);
    s = editorReducer(s, { type: "undo" });
    expect(getActiveVersion(s.history.present).items.find((i) => i.id === "sofa")!.x).toBe(48);
    s = editorReducer(s, { type: "redo" });
    expect(getActiveVersion(s.history.present).items.find((i) => i.id === "sofa")!.x).toBe(58);
  });

  it("returns the same state for no-op edits", () => {
    const s = base();
    expect(editorReducer(s, { type: "apply", update: (p) => p })).toBe(s);
  });

  it("makes a drag one undo step", () => {
    let s = editorReducer(base(), { type: "begin" });
    for (let i = 0; i < 20; i++)
      s = editorReducer(s, { type: "apply", update: (p) => moveItems(p, ["sofa"], 1, 0) });
    s = editorReducer(s, { type: "commit" });
    expect(s.history.past).toHaveLength(1);
    s = editorReducer(s, { type: "undo" });
    expect(getActiveVersion(s.history.present).items.find((i) => i.id === "sofa")!.x).toBe(48);
  });

  it("cancels a drag", () => {
    let s = editorReducer(base(), { type: "begin" });
    s = editorReducer(s, { type: "apply", update: (p) => moveItems(p, ["sofa"], 50, 0) });
    s = editorReducer(s, { type: "cancel" });
    expect(getActiveVersion(s.history.present).items.find((i) => i.id === "sofa")!.x).toBe(48);
    expect(s.history.past).toHaveLength(0);
  });

  it("selects whole groups and toggles with shift", () => {
    let s = editorReducer(base(), {
      type: "apply",
      update: (p) => groupItems(p, ["bed", "nightstand-l", "nightstand-r"]).project,
    });
    s = editorReducer(s, { type: "select", ids: ["bed"] });
    expect(s.selection.sort()).toEqual(["bed", "nightstand-l", "nightstand-r"]);
    s = editorReducer(s, { type: "select", ids: ["sofa"], additive: true });
    expect(s.selection).toContain("sofa");
    s = editorReducer(s, { type: "select", ids: ["sofa"], additive: true });
    expect(s.selection).not.toContain("sofa");
  });

  it("drops deleted items from the selection, also after undo", () => {
    let s = editorReducer(base(), { type: "select", ids: ["sofa", "bed"] });
    s = editorReducer(s, { type: "apply", update: (p) => removeItems(p, ["sofa"]) });
    expect(s.selection).toEqual(["bed"]);
    s = editorReducer(s, { type: "select", ids: ["sofa"] });
    expect(s.selection).toEqual([]);
  });

  it("switches tools and toggles view options", () => {
    let s = editorReducer(base(), { type: "tool", tool: "measure" });
    expect(s.tool).toBe("measure");
    s = editorReducer(s, { type: "toggle", key: "showGrid" });
    expect(s.showGrid).toBe(false);
    s = editorReducer(s, { type: "camera", camera: { x: 1, y: 2, scale: 3 } });
    expect(s.camera).toEqual({ x: 1, y: 2, scale: 3 });
  });
});
