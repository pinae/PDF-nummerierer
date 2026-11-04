# PDF-Nummerierer

A web application that stamps serial numbers onto exam PDFs, so the pages of a
multi-page exam can never be mixed up between students. Upload the exam, place
the number visually on the first, odd and even pages, choose how many copies you
need and download one print-ready PDF that contains all numbered copies.

> **Status:** under development. The project scaffolding (work package WP0) is
> done; the features below are being implemented package by package following
> [`docs/PLANNING.md`](docs/PLANNING.md).

## Usage

1. **Upload** your exam PDF (up to 500 MB). It is bound to your browser
   session: nobody else can see or download it.
2. **Place the number.** Choose *First page*, *Odd pages* or *Even pages* and
   click a position preset or drag the number where you want it. Each of the
   three placements is optional. Pick a font, a size and the number format
   (e.g. `Exam A – 0042`). Page through the document: the number is previewed
   live on every page.
3. **Save the configuration** under a name to reuse it next semester. Saved
   configurations are visible to everyone using the app; saving under an
   existing name creates a new version and never overwrites the old one.
4. **Number it!** Enter the number of copies (up to 9999). By default every
   copy is padded to an even page count so duplex printing never puts two
   students' pages on one sheet; a switch turns this off. The joined PDF is
   downloaded.
5. After the download, the uploaded and the generated PDFs are deleted from the
   server automatically (at the latest after 2 hours). A **Delete now** button
   is available as well.

No account is needed.

## Repository layout

| Path | Contents |
|---|---|
| `backend/` | Django project (Python 3.14, managed with [uv](https://docs.astral.sh/uv/)) |
| `backend/stamping/` | Framework-free PDF stamping library |
| `frontend/` | React 19 + TypeScript + MUI single-page app (Vite) |
| `e2e/` | Playwright end-to-end tests against the real stack |
| `docs/PLANNING.md` | Architecture, security model, UX design and work packages |
| `AGENTS.md`, `CLAUDE.md` | Working rules for AI coding agents |

## Development setup

Requirements:

- [uv](https://docs.astral.sh/uv/getting-started/installation/) (it installs
  Python 3.14 automatically)
- Node.js ≥ 22.12 (the current LTS, 26, is recommended; see `.nvmrc`)
- yarn 4 via Corepack. Node 22/24 ship Corepack: run `corepack enable`. From
  Node 25 on, install it first: `npm install --global corepack && corepack enable`.
- GNU make

Install everything:

```bash
make install
```

Start backend (http://127.0.0.1:8000) and frontend (http://localhost:5173)
together, then open http://localhost:5173:

```bash
make dev
```

The Vite dev server proxies `/api` to Django, so the browser sees a single
origin exactly like in production. `make dev` runs Django with
`PDFNUM_DEBUG=1`; its database and files live in `backend/var/`.

Run `make help` to list all tasks.

## Running the tests

This project is developed test-first (see [`AGENTS.md`](AGENTS.md)).

Backend tests (pytest + pytest-django):

```bash
make test-backend
```

Frontend tests (Vitest + React Testing Library):

```bash
make test-frontend
```

Both suites at once:

```bash
make test
```

Linters, formatting checks and type checks (ruff, Prettier, ESLint, tsc):

```bash
make lint
```

Auto-format all code:

```bash
make format
```

### End-to-end tests

The Playwright tests start their own Django server (port 8765, fresh database
in `e2e/.data/`) and a production build of the frontend (port 4173) and run on
a desktop and a phone viewport:

```bash
make e2e
```

`make install` and `make e2e` download the Chromium build that matches the
installed Playwright version automatically (a no-op when it is already
there, and after a Playwright update they fetch the new one).

If Chromium then fails to start because system libraries are missing
(`error while loading shared libraries`), install them once (Debian/Ubuntu,
asks for your sudo password):

```bash
make e2e-deps
```

Everything CI runs (lint, unit tests, e2e):

```bash
make check
```

If your machine already has a Chromium that does not match the Playwright
version (for example in a container image), point Playwright at it instead of
downloading one:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chrome make e2e
```

Single backend test files or frontend tests in watch mode:

```bash
cd backend && uv run pytest pdfnum/tests/test_settings.py -v
```

```bash
yarn workspace frontend test:watch
```

## Configuration

The backend is configured with environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `PDFNUM_SECRET_KEY` | — (required unless debug) | Django secret key; use a long random value |
| `PDFNUM_DEBUG` | `0` | `1` enables Django debug mode (development only) |
| `PDFNUM_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated host names the app is served under |
| `PDFNUM_DATA_DIR` | `backend/var` | Directory for the SQLite database and uploaded/generated PDFs |
| `PDFNUM_SECURE_COOKIES` | on unless debug | Send session and CSRF cookies only over HTTPS |

Boolean variables accept `1/0`, `true/false` or `on/off`.

## Updating dependencies

After every update run `make check` and commit the changed lock files
(`backend/uv.lock`, `yarn.lock`).

### Backend (uv)

Show outdated packages:

```bash
cd backend && uv tree --outdated --depth 1
```

Upgrade everything within the version ranges in `backend/pyproject.toml`:

```bash
cd backend && uv lock --upgrade && uv sync
```

Move to a new feature release (ranges are pinned to one Django series on
purpose, so read its release notes first), e.g.:

```bash
cd backend && uv add "django>=6.2,<6.3"
```

To move to a new Python version, change `backend/.python-version` and
`requires-python` in `backend/pyproject.toml`, then run `uv sync`.

### Frontend and e2e (yarn)

Interactively choose upgrades (including new major versions) for all
workspaces:

```bash
yarn upgrade-interactive
```

Or upgrade packages by name pattern, e.g. all MUI packages:

```bash
yarn up '@mui/*'
```

Update yarn itself (rewrites the `packageManager` field in `package.json`):

```bash
yarn set version stable
```

Notes:

- After upgrading `@playwright/test`, the next `make e2e` fetches the
  matching browser automatically.
- TypeScript is held at 6.0.x until `typescript-eslint` supports TypeScript 7
  (check its `typescript` peer dependency range before upgrading).
- `@types/node` follows the oldest supported Node.js major (22), so the code
  only uses APIs available there.

### GitHub Actions

The workflow in `.github/workflows/ci.yml` pins action versions; bump them
when new major versions are released.

## License

GNU General Public License v3.0, see [`LICENSE`](LICENSE).
