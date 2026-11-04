# Instructions for AI agents working in this repository

PDF-Nummerierer: a Django + React web app that stamps serial numbers onto exam
PDFs and joins N numbered copies into one print-ready PDF. Read
`docs/PLANNING.md` first — it defines the architecture, data model, security
model, UX design and the work packages (WP0–WP12). Do not re-decide what is
decided there; if a decision must change, update `docs/PLANNING.md` in the same
commit and say why.

## Non-negotiable: Test Driven Development

Every behavior change follows red → green → refactor:

1. Write the failing test(s) first and run them — confirm they fail for the
   right reason.
2. Implement the minimal code to make them pass.
3. Refactor with the suite green.

Never commit with failing tests, never delete or skip a test to get green, and
never write implementation code for which no test exists. Bug fixes start with
a regression test that reproduces the bug.

## Project layout (see docs/PLANNING.md §2 for details)

- `backend/` — Django (managed with **uv**; run tools via `uv run …`).
  - `backend/stamping/` — pure-Python PDF stamping library. **No Django
    imports in this package, ever.** All PDF logic lives here so it is testable
    without DB/HTTP.
  - `documents/`, `configs/`, `generation/` — thin Django apps.
- `frontend/` — Vite + React + TypeScript + MUI. Package manager is **yarn 4
  via corepack** — never use npm or pnpm, never delete `yarn.lock`.
- `e2e/` — Playwright tests against the real stack.

## Commands (via the root Makefile once WP0 lands)

- `make dev` — run backend (:8000) and frontend (:5173, proxies /api) together
- `make test` — all backend + frontend tests
- `make test-backend` — `cd backend && uv run pytest`
- `make test-frontend` — `cd frontend && yarn test`
- `make e2e` — Playwright suite
- `make lint` — all linters/formatters

Run the relevant test target before every commit; run `make test` before every
push.

## Conventions

- Coordinates are **PDF points, origin bottom-left**, everywhere in storage and
  APIs. Only the UI layer converts to mm/pixels. Use the pdf.js viewport
  conversion helpers in the frontend, never hand-rolled math.
- Security invariants (do not weaken, add tests when touching them):
  session-key binding on every Document/Job query, 404 (never 403) on foreign
  objects, UUID ids in URLs, CSRF on all mutations, uploads validated by magic
  bytes + pypdf parse, media never served statically, files deleted after
  download and by TTL sweep.
- Frontend strings live centralized (prepared for i18n), themes must work in
  light **and** dark, layouts must work at phone width and on large screens.
- Conventional commit messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`),
  one work package per PR where feasible.
- Do not add dependencies beyond the stack pinned in `docs/PLANNING.md`
  without recording the reason in the commit message.
- Keep `README.md` truthful: whenever a command or setup step changes, update
  the README in the same commit.
