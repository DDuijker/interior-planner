# Contributing

Maison is a small project for friends and family. Contributions are welcome
as long as they follow the choices in [CLAUDE.md](CLAUDE.md).

## Way of working

1. Pick a GitHub issue from the backlog (E01 to E13). Work per issue.
2. Branch: `epic/E02-walls-from-rooms` or similar.
3. Pure logic goes in `/core`, without React or three.js, with unit tests.
4. Keep changes small, tested and mergeable. No large refactors outside the issue.
5. Open a PR that closes the issue (`Closes #nn`). CI must be green.

## Checks

```bash
npm run lint          # ESLint, no warnings allowed
npm run typecheck     # TypeScript strict
npm run format:check  # Prettier
npm test              # unit tests (Vitest)
npm run test:coverage # coverage, at least 85% on /core
npm run e2e           # Playwright (builds first)
npm run e2e:update    # refresh visual snapshots after an intended design change
npm run budget        # first-load JS per page, after `npm run build`
```

A pre-commit hook runs ESLint and Prettier on staged files.

## Definition of done

- Acceptance criteria met, tests written and green, no console errors.
- Works on a narrow screen (the e2e suite runs a phone profile).
- Texts in Dutch and English (`i18n/messages/nl.ts` and `en.ts`; a test checks
  both have the same keys and placeholders).
- A short note in the PR on what you did and what you did not test.

## Rules that are not negotiable

- No API keys, passwords or personal data in the repo or in logs.
- No network requests except to the AI service the user configures
  (Anthropic, with the user's own key) and Google Fonts.
- No brand data or models from IKEA or other shops.
- No backend, accounts or cloud storage.
- UI: real `<button>`, `<a>` and `<input>` with `<label>`, 44 px touch targets,
  keyboard operable, `aria-label` on icon buttons, no emoji as icons.
