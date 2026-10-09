# Maison

Free interior planner in the browser. Load a floor plan, see it in 2D and 3D,
furnish it and try out styles. No backend, no accounts: everything stays in
your browser (IndexedDB) plus a project file you can export.

Backlog: GitHub Issues E01 to E13 (source: `backlog.md`, created with
`create-issues.sh`). Decisions and conventions: `CLAUDE.md`.

## Setup

Requires Node 22 (see `.nvmrc`).

```bash
npm ci
npm run dev        # http://localhost:3000
```

## Scripts

| Script                  | What it does                                            |
| ----------------------- | ------------------------------------------------------- |
| `npm run dev`           | Dev server                                              |
| `npm run build`         | Static export to `out/`                                 |
| `npm run preview`       | Serve `out/` locally                                    |
| `npm run lint`          | ESLint (zero warnings allowed)                          |
| `npm run typecheck`     | `tsc --noEmit`, strict                                  |
| `npm run format`        | Prettier write (`format:check` to only check)           |
| `npm test`              | Unit tests (Vitest)                                     |
| `npm run test:coverage` | Unit tests with coverage on `/core` (85% minimum)       |
| `npm run e2e`           | Playwright end-to-end tests (builds and serves `out/`)  |
| `npm run e2e:update`    | Refresh the visual regression screenshots               |
| `npm run budget`        | First-load JS per page against its budget (after build) |

The editor opens a sample apartment at `/editor/`. Add `?stress=150` to load 150
extra chairs for performance checks.

A pre-commit hook (husky + lint-staged) runs ESLint and Prettier on staged files.

## Claude (AI)

Reading a floor plan from a photo or PDF, filling in the model from photos of
the current interior and taking a style from the moodboard use Claude by
Anthropic. Every user brings their own API key:

1. Create an account at [console.anthropic.com](https://console.anthropic.com/)
   and add some credit.
2. Create an API key and paste it in the app under **Settings > Claude**.

The key is stored in that browser only (localStorage). It is never in a
project file, a URL or a log, and only travels to Anthropic in requests the
user starts. Photos are sent only after a tick per photo, downsized and
without EXIF data. Without a key everything else works: plan-code, drawing,
3D, style, photos and palettes.

More: [architecture](docs/architecture.md), [plan-code](docs/plan-code.md),
[adding furniture](docs/catalog.md), [contributing](CONTRIBUTING.md).

## Architecture

See [docs/architecture.md](docs/architecture.md). In short: `core/` is pure,
tested TypeScript (model, walls from rooms, plan-code, placement, style,
photos, AI prompts and parsing), `ui/` and `app/` are React, `three/` is the
lazy-loaded 3D view and `catalog/` the generic parametric furniture.

## Deploy

Every push to `main` builds and deploys to GitHub Pages
(`.github/workflows/deploy.yml`). The workflow sets `NEXT_PUBLIC_BASE_PATH` to
`/<repo>` so assets and routes work under the Pages sub-path. Pull requests
get the static build as a downloadable artifact.

### One-time repository settings

These are not in code and need a repo admin:

1. **Settings > Pages > Source: GitHub Actions** (enables the deploy job).
2. **Settings > Branches > Add rule for `main`**: require a pull request and
   the status checks `Lint, typecheck and unit tests`,
   `End-to-end (Chromium, mobile, WebKit)`, `Bundle budget and Lighthouse`
   and `Static build`, so a red PR cannot be merged.
