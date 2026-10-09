# Maison

Free interior planner in the browser. Load a floor plan, see it in 2D and 3D,
furnish it and try out styles. No backend, no accounts: everything stays in
your browser (IndexedDB) plus a project file you can export.

Backlog: GitHub Issues E01 to E12 (source: `backlog.md`, created with
`create-issues.sh`). Decisions and conventions: `CLAUDE.md`.

## Setup

Requires Node 22 (see `.nvmrc`).

```bash
npm ci
npm run dev        # http://localhost:3000
```

## Scripts

| Script                  | What it does                                           |
| ----------------------- | ------------------------------------------------------ |
| `npm run dev`           | Dev server                                             |
| `npm run build`         | Static export to `out/`                                |
| `npm run preview`       | Serve `out/` locally                                   |
| `npm run lint`          | ESLint (zero warnings allowed)                         |
| `npm run typecheck`     | `tsc --noEmit`, strict                                 |
| `npm run format`        | Prettier write (`format:check` to only check)          |
| `npm test`              | Unit tests (Vitest)                                    |
| `npm run test:coverage` | Unit tests with coverage on `/core` (85% minimum)      |
| `npm run e2e`           | Playwright end-to-end tests (builds and serves `out/`) |

The editor opens a sample apartment at `/editor/`. Add `?stress=150` to load 150
extra chairs for performance checks.

A pre-commit hook (husky + lint-staged) runs ESLint and Prettier on staged files.

## Architecture

```
app/        Next.js routes (App Router, static export). Thin: composes ui/.
core/       Pure TypeScript logic. No React, no three.js, no DOM.
  model/      Types, schema (zod), migrations, immutable actions
  geometry/   Rects, polygons, oriented boxes, distances
  walls/      Rooms -> 5 cm grid -> walls (interior, exterior, low)
  openings/   Doors and windows snapped to walls, cut-outs for 2D/3D
  fixtures/   Fixed elements (kitchen, sanitary, stairs, chimney)
  collision/  Overlap, clearance and door-swing checks
  history/    Undo/redo with transactions (a drag is one step)
  measure/    Units (cm, mm, inch, feet), formatting, dimension lines
  editor/     Camera, snapping and hit-testing maths for the 2D editor
  samples/    Example plans
ui/         React components: design system (ui/components) and the 2D editor
three/      3D view (E04), lazy loaded
catalog/    Generic furniture catalogue (E08), lazy loaded
i18n/       Dutch and English texts
e2e/        Playwright tests
```

Rules of thumb:

- Everything risky lives in `/core` with unit tests. ESLint blocks React and
  three.js imports there.
- The model is immutable (immer). Every action returns a new project that shares
  untouched branches, which is what undo/redo builds on.
- Projects carry a `schemaVersion`. Bump `core/model/version.ts` and add a step
  to `core/model/migrations.ts` whenever the stored shape changes.
- Lengths are always centimetres internally; units only exist at the UI edge.
- Plan coordinates: x to the right, y down.

## Deploy

Every push to `main` builds and deploys to GitHub Pages
(`.github/workflows/deploy.yml`). The workflow sets `NEXT_PUBLIC_BASE_PATH` to
`/<repo>` so assets and routes work under the Pages sub-path. Pull requests
get the static build as a downloadable artifact.

### One-time repository settings

These are not in code and need a repo admin:

1. **Settings > Pages > Source: GitHub Actions** (enables the deploy job).
2. **Settings > Branches > Add rule for `main`**: require a pull request and
   the status checks `Lint, typecheck and unit tests`, `End-to-end (Chromium)`
   and `Static build`, so a red PR cannot be merged.
