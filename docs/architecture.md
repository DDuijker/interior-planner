# Architecture

Maison is a static Next.js app (App Router, `output: "export"`) hosted on
GitHub Pages. There is no backend. Everything the user makes stays in their
browser (IndexedDB), and moves between browsers only as a project file.

## Layers

```
app/        Routes: /, /project, /editor (demo), /settings, /help
ui/         React: design system, workspace, 2D editor, style, photos, AI
three/      3D view with three.js, loaded only when the 3D tab opens
catalog/    Generic parametric furniture, shared by 2D and 3D
core/       Pure TypeScript, no React/three/DOM, fully unit tested
i18n/       Dutch and English messages
```

`core` is the heart and the place where bugs would hurt most. ESLint forbids
React and three.js imports there and coverage must stay at or above 85%.

## Data model

`Project > Floor > Version`. A floor has a **current situation** and zero or
more **designs**; a new design is a copy of the current situation. A version
holds rooms, openings, fixtures, items, style, wall overrides, demolitions,
a background image and its moodboard. Photos are project-level metadata; the
images live in IndexedDB under the same id.

- Types: `core/model/types.ts`, schema: `core/model/schema.ts` (zod, kept in
  sync with the types by a compile-time check).
- Stored projects carry `schemaVersion`; `core/model/migrations.ts` upgrades
  older ones step by step.
- All updates go through immer, so unchanged branches are shared. Undo/redo
  (`core/history`) stores whole snapshots cheaply and groups a drag into one
  step with transactions.

## Walls from rooms

Rooms are rectangles or polygons. `core/walls` rasterises them on a 5 cm grid,
marks interior walls between two rooms, exterior walls on the edge and low
edges around loggias, merges cells into rectangles and splits them where the
room on either side changes. Wall ids are geometric, so per-wall finishes
(overrides per wall and side) survive regeneration. Openings cut the walls in
`core/openings`.

## Rendering

- **2D** is SVG (`ui/editor/PlanCanvas.tsx`): layers for rooms, walls,
  openings, fixtures, items (drawn from catalogue parts seen from above),
  labels, dimensions and photo markers.
- **3D** (`three/`) builds meshes from the same model and the same catalogue
  parts. Materials and geometry are cached and reused; quality adapts to the
  frame rate. Plan (x, y) maps to world (X, Z), height to Y.

## Claude

The AI features call the Anthropic API straight from the browser with the
user's own key (`ui/ai/claude.ts`, official SDK, streaming, cancel). Prompts
and answer parsing are pure and tested in `core/ai`:

- `floorplan.ts`: photo or PDF to plan-code, with a repair round and a review
  step (scale from one known length, the original under the plan).
- `interior.ts`: photos of the current interior to a tickable proposal of
  finishes, windows, doors and fixed elements.
- `moodboard.ts`: moodboard to a style applied to a new design.

Every answer is validated with a schema. Nothing is applied without the user,
and no photo is sent without a tick per photo. Without a key the app works
fully through plan-code and drawing.

## Performance

three.js, the Anthropic SDK, the style view and the photo view are loaded on
demand. `npm run budget` fails CI when the first-load JavaScript of a page
grows past its budget or when three.js or the SDK end up in it.
