# PDF-Nummerierer — Planning Document

A web application that stamps serial numbers onto exam PDFs so the pages of a
multi-page exam cannot be mixed up between students, then joins all numbered
copies into one print-ready PDF.

Status: **all work packages (WP0–WP12) done.** The app is feature complete and deployable as a Docker image behind Traefik. This document is the
binding plan for all work packages.

---

## 1. The idea

A professor uploads an exam PDF. The browser shows the PDF (zoomable, pageable).
The professor places the serial-number stamp visually — separately for the
**first page**, **odd pages** (3, 5, 7, …) and **even pages** (2, 4, 6, …); each
of the three placements is optional. Font and size come from a short list
(fewer than 10 fonts: serif such as Computer Modern Roman, sans-serif and
handwritten). The number itself is
configurable: optional prefix and suffix, zero-padding width, start number
(e.g. `Exam A – 0042`).

Placements + font + number format form a named **config** stored in the
database. Selecting a saved config immediately previews the stamp on every page
of the currently uploaded document. Saving under an existing name creates a
**new version** of that config instead of silently overwriting (configs are
global: every user of the app sees all of them).

When the preview looks right, the professor enters how many copies they need
and clicks **"Number it!"**. The server generates N stamped copies (copy k gets
number `start + k − 1` on all of its stamped pages), concatenates them into one
PDF, and the browser downloads it. After a successful download — and at the
latest after a retention TTL — the server deletes the uploaded PDF and the
generated output.

No authentication. Uploaded documents are bound to the browser session and
unguessable UUIDs so one user can never reach another user's exam.

### Decisions already made (with the project owner)

| Topic | Decision |
|---|---|
| Saved configs | Global (everyone sees all), identified by name; saving to an existing name creates a new version, never overwrites |
| Placements | First / odd / even each individually optional; a page without a placement gets no number. "Odd pages" means odd page numbers **excluding page 1** (page 1 has its own placement), matching the original script |
| Number format | Configurable: prefix, zero-padding width, suffix; start number chosen per run (default 1) |
| Deployment | Docker + docker-compose for production, plus local dev instructions |
| Fonts | Fewer than 10 entries in total; several per category (serif, sans-serif, handwritten) are allowed. The list is data-driven (one registry module), so changing it needs no code changes elsewhere |
| Duplex printing | **On by default**: each copy is padded with blank pages to an even page count, so in duplex printing no copy starts on the back of another copy's last page. A simple switch in the generation options turns it off |
| UI language | English (strings stay centralized, so adding a translation later stays easy) |
| Limits | Max upload **500 MB**, max **9999 copies** per run, retention TTL 2 hours (all adjustable via settings/env) |

### Font list (proposal, 9 entries, all freely licensed and bundled)

| Category | Fonts |
|---|---|
| Serif | Computer Modern Roman (CMU Serif, as in the original script), Libertinus Serif, Noto Serif |
| Sans-serif | CMU Sans Serif, Source Sans 3, DejaVu Sans |
| Handwritten | Caveat, Patrick Hand, Indie Flower |

All of these are under the SIL Open Font License or a similarly permissive font
license, so they can be committed to the repository and served to the browser.
The list can be changed until WP1, where the font registry is implemented.

### Consequences of the limits

A 500 MB upload multiplied by 9999 copies must not produce terabytes of output.
The generator therefore must **reuse shared resources** (images, embedded fonts,
form XObjects) across copies, so only the per-copy page content and the tiny
number overlay are duplicated, and must **stream** the output to disk instead of
holding it in memory. WP1 includes a test asserting that output size grows with
pages, not with copies × input size, and WP4 checks free disk space before
starting a job.

---

## 2. Architecture

### Monorepo layout

```
PDF-nummerierer/
├── backend/                 # Django project (Python, managed with uv)
│   ├── pdfnum/              # settings, urls, asgi/wsgi
│   ├── stamping/            # PURE PYTHON pdf-stamping library — no Django imports
│   │   └── fonts/           # bundled TTFs + licenses (see the font list in §1)
│   ├── documents/           # Django app: upload, preview file serving, deletion
│   ├── configs/             # Django app: numbering configs (name + version)
│   ├── generation/          # Django app: jobs, progress, download
│   ├── manage.py
│   └── pyproject.toml
├── frontend/                # Vite + React + TypeScript + MUI, yarn 4
│   ├── src/
│   │   ├── api/             # typed API client (fetch + CSRF handling)
│   │   ├── pdf/             # coordinate mapping utilities (pure, unit-tested)
│   │   ├── components/      # viewer, placement tools, sidebar, …
│   │   ├── screens/         # Upload, Workspace, Download
│   │   └── theme/           # MUI theme, light/dark via prefers-color-scheme
│   └── package.json
├── e2e/                     # Playwright tests against the real stack
├── docs/                    # this document, ADRs if needed
├── docker/                  # Dockerfile(s), nginx conf if needed
├── docker-compose.yml
├── Makefile                 # one entry point: make dev / test / e2e / build
├── AGENTS.md / CLAUDE.md    # instructions for AI agents
└── README.md
```

The stamping logic lives in `backend/stamping/` as a **pure, framework-free
package** (the port of `nummererierer.py`): it takes bytes + a config dataclass
and returns bytes. This makes the core domain logic fast to test without a
database or HTTP, and keeps the Django apps thin.

### Technology choices (newest stable, verified 2026-11-04)

| Layer | Choice | Version | Why |
|---|---|---|---|
| Backend | Django | 6.1.x | newest stable series |
| | Python | 3.14.x | newest with mature ecosystem support (3.15.0 is 4 weeks old; easy to bump later) |
| | Django REST Framework | 3.18.x | the conventional, best-documented choice for this size of JSON API |
| | pypdf | 6.x | page merging/concatenation (as in the original script) |
| | reportlab | 5.x | overlay generation with embedded TTF fonts |
| | uv | latest | Python dependency management, lockfile |
| | pytest + pytest-django | 9.x / 4.14.x | backend tests |
| Frontend | React | 19.x | newest stable |
| | Vite | 8.x | the standard React scaffold (CRA is dead) |
| | TypeScript | 6.0.x | TS 7 is out but typescript-eslint doesn't support it yet; bump when it does |
| | MUI (@mui/material) | 9.x | newest major, React-19 compatible |
| | react-pdf (pdf.js 6) | 11.x | canvas PDF rendering with zoom/paging |
| | yarn | 4.x (via corepack) | as requested |
| | Vitest + React Testing Library | 5.x / 16.x | frontend tests, shares vite.config |
| E2E | Playwright | 1.64.x | drives the real Django + built frontend |

### Dev vs. production serving

- **Dev**: two processes (`manage.py runserver` on :8000, `vite dev` on :5173);
  Vite proxies `/api` to Django, so the browser sees one origin and
  cookies/CSRF behave exactly as in production.
- **Reverse proxy**: the deployment runs behind **Traefik**, which terminates
  TLS. WP12 therefore sets `SECURE_PROXY_SSL_HEADER` for Traefik's
  `X-Forwarded-Proto`, DRF `NUM_PROXIES = 1` so throttling sees the real client
  IP from `X-Forwarded-For`, `CSRF_TRUSTED_ORIGINS`/`ALLOWED_HOSTS` from env,
  HSTS, and documents Traefik labels including a buffering middleware whose
  `maxRequestBodyBytes` allows the 500 MB uploads.
- **Prod (Docker)**: `vite build` output is collected as Django static files and
  served by WhiteNoise behind gunicorn; Django serves `index.html` as SPA shell
  on non-API routes. One container, one origin → no CORS, no cross-site cookie
  complexity. docker-compose adds a volume for the SQLite DB + media and a cron
  sidecar (or compose `command`) for TTL cleanup.
- **Database**: SQLite. Configs are tiny, write volume is trivial, and it keeps
  deployment to one container. Postgres would be a drop-in swap via `DATABASE_URL`
  if ever needed.

### Data model

```
NumberingConfig               # immutable: rows are never updated
  id          UUID pk
  name        str            # user-visible name of this version (max 80 chars)
  name_key    str (indexed)  # name casefolded, whitespace collapsed: groups versions
  version     int            # (name_key, version) unique; "save" = insert max+1
  prefix, digits, suffix     # number format
  created_at  datetime

NumberPlacement               # 0–3 rows per config, immutable
  config      FK → NumberingConfig
  role        enum {first, odd, even}   # unique per config
  x_pt, y_pt  float          # PDF points, start of the text baseline, measured from
                             # the bottom-left corner of the page AS DISPLAYED
  font        str            # id from the font registry, e.g. "cmu-serif"
  font_size   float

Document
  id          UUID pk        # unguessable; used in all URLs
  owner       str (indexed)  # random owner token stored in the uploader's session
  file        FileField      # MEDIA_ROOT/documents/<id>.pdf, never the upload name
  name        str            # sanitized upload name, display only
  size        int
  page_count  int
  page_sizes  JSON           # [w_pt, h_pt] per page as displayed, for the frontend
  created_at  datetime       # drives expiry (expires_at = created_at + TTL)
  last_seen_at datetime      # refreshed by the open page's keep-alive; idle → expired

GenerationJob                 # lives exactly as long as its document (cascade)
  id          UUID pk
  document    FK → Document
  owner       str            # same owner token as the document
  status      enum {pending, running, done, failed}
  stage       str            # preparing | stamping | writing | done
  copies_total / copies_done  int      # determinate progress
  total_pages int
  params      JSON           # config snapshot + start + pad_to_even
  output      FileField      # MEDIA_ROOT/outputs/<id>.pdf, mode 0600
  error_code / error_message # generation_failed | interrupted
  created_at / updated_at (worker heartbeat) / finished_at
```

Coordinates are stored and transmitted in **PDF points** end to end. A
placement (x, y) is the start of the text baseline (as in the original
`config.json`), measured from the **bottom-left corner of the page as
displayed**: the crop box (clipped to the media box) after applying `/Rotate`,
x to the right, y upwards. This is exactly what the browser preview shows, so:

- the frontend converts with a plain scale factor
  (`x = px / scale`, `y = (displayedHeightPx − py) / scale`) in one shared,
  unit-tested function, without pdf.js user-space helpers;
- rotated pages and offset crop boxes are handled once, in the backend
  (`stamping/geometry.py`); the number always reads upright as displayed;
- a saved config means the same visual position on any document.

The UI *displays* positions in millimetres.

### Output PDF semantics (implemented in WP1)

- Copy k carries the number `start + k − 1` on every page that has a placement
  for its role. Padding pages for duplex printing are blank and not numbered;
  they copy size, crop box and rotation of the copy's last page.
- The output is **print-ready**: printable form fields and other annotations
  with an appearance are flattened into the page (their look is kept), then all
  annotations and the AcroForm are dropped. The number is drawn last, so
  nothing, including white field backgrounds, can hide it.
- Each source page becomes one shared Form XObject, written once, and each
  serial a tiny Form XObject. Measured: 9999 copies of a 4-page exam take
  about 12 s and produce 16 MB (about 400 bytes per additional page) with
  about 400 MB peak memory.
- Progress is reported in stages: `preparing` → `stamping` (per copy) →
  `writing` → `done`.
- PDFs that open without a password (owner-password restrictions only) are
  accepted; PDFs needing a password raise `EncryptedPdfError`.

### API sketch (all JSON unless noted, all under `/api/`)

| Method & path | Purpose |
|---|---|
| `GET  /api/csrf/` | sets CSRF cookie for the SPA |
| `GET  /api/limits/` | `{max_upload_bytes, retention_seconds, idle_seconds, max_copies, max_output_pages}`, so the UI states the limits up front |
| `POST /api/documents/` | multipart upload (field `file`) → document payload (201) |
| `GET  /api/documents/{uuid}/` | document payload: `{id, name, size, page_count, page_sizes, created_at, expires_at}` |
| `GET  /api/documents/{uuid}/file/` | the PDF for preview (owner-checked, `nosniff`, `no-store`) |
| `DELETE /api/documents/{uuid}/` | "Delete now" / "Delete PDF" (204) |
| `POST /api/documents/{uuid}/keepalive/` | sent every minute while the workspace or done screen is open (204); refreshes `last_seen_at` |
| `GET/POST /api/configs/` | list latest version per name (sorted by name) / save as next version: 201, or 200 with the latest version if the content is unchanged |
| `GET /api/configs/{uuid}/` | one config version incl. placements (old versions stay retrievable) |
| `GET /api/configs/{uuid}/versions/` | all versions of that config's name, newest first |
| `GET /api/fonts/` | font registry `[{id, label, category, url}]` for the picker |
| `GET /api/fonts/{id}.ttf` | the TTF used for the PDF, for the browser preview (`font/ttf`, cacheable) |

Config payload (input and output; missing or `null` placement = no number):

```json
{
  "name": "HCI Exam SoSe 2026",
  "number_format": {"prefix": "", "digits": 4, "suffix": ""},
  "placements": {
    "first": {"x": 227, "y": 661, "font": "cmu-serif", "font_size": 12},
    "odd":   {"x": 144, "y": 780, "font": "cmu-serif", "font_size": 12},
    "even":  null
  }
}
```

Output adds `id`, `version` and `created_at`. Names match case-insensitively
with whitespace normalized ("HCI  Exam" and "hci exam" are versions of one
config; the newest spelling is shown). Configs cannot be changed or deleted
through the API: they are shared by everybody without login, so nobody can
destroy someone else's config. Saving is throttled per IP
(`PDFNUM_CONFIG_SAVE_RATE`, default 60/hour).
| `POST /api/documents/{uuid}/generate/` | `{number_format, placements, copies, start = 1, pad_to_even = true}` (the current, possibly unsaved config) → 202 + job payload |
| `GET  /api/jobs/{uuid}/` | job payload for polling: `{id, document_id, status, stage, copies_done, copies_total, total_pages, error, download_url, created_at, finished_at}` |
| `GET  /api/jobs/{uuid}/download/` | the joined PDF as attachment `<upload name>-numbered.pdf`; document, job and both files are deleted *before* the last 64 bytes are sent, so a client holding the complete file can never still find the exam on the server; an aborted download deletes nothing, so it can be retried |

Errors always have the shape `{"error": {"code": "...", "message": "..."}}`
with a stable `code` for the frontend and an English `message` for humans.
Upload codes: `missing_file`, `too_large` (413), `not_pdf`, `invalid_pdf`,
`encrypted_pdf`; general codes: `not_found`, `csrf_failed`, `throttled` (429),
`method_not_allowed`. Validation errors use code `invalid` plus
`"fields": {"placements.first.font_size": ["message", ...], ...}` with dotted
paths into the request body, so the UI can highlight the exact input.

Generation runs in an in-process thread pool (`PDFNUM_GENERATION_WORKERS`,
default 2; a departmental tool doesn't need Celery/Redis). The job row carries
determinate progress ("copy 37 of 200"), written at most twice a second and on
every stage change. Limits checked before a job starts: at most
`PDFNUM_MAX_COPIES` (9999) copies and `PDFNUM_MAX_OUTPUT_PAGES` (100,000)
output pages per run (memory), enough free disk space, and one active job per
session. Deleting the document ("Delete now") cancels a running job. SQLite runs
in WAL mode with `BEGIN IMMEDIATE` transactions so the worker thread and
requests do not block each other.

Generation error codes: `too_many_pages` (400), `job_running` (409),
`insufficient_storage` (507), `not_ready` (409, download before done); a job
itself can end with `generation_failed` or `interrupted`.

**Cleanup**: `manage.py cleanup` (run every few minutes by cron/compose in
production) deletes expired documents with their jobs and files, expired
sessions, orphaned and abandoned temporary files, and marks jobs without a
worker heartbeat for `PDFNUM_JOB_TIMEOUT_SECONDS` as `interrupted` (e.g. after
a restart). Expired documents are also purged at the start of every upload.

### Security model (no authentication, hostile students assumed)

1. **Session binding**: on the first upload a random owner token is stored in
   the session and the session key is rotated (`cycle_key`), so a session
   cookie planted beforehand (session fixation) never leads to the exam. Every
   `Document`/`GenerationJob` stores this owner token; every
   read/download/delete filters by it, and expired documents count as gone
   even before the sweep deletes them. A miss returns **404** (not 403 — don't
   confirm existence).
2. **Unguessable IDs**: UUID4 primary keys in all URLs — defense in depth on
   top of, never instead of, the session check.
3. **Session cookie hardening**: `SESSION_COOKIE_SECURE`, `HTTPONLY`,
   `SAMESITE=Lax`; short `SESSION_COOKIE_AGE` aligned with the file TTL.
   No state change ever happens on GET.
4. **CSRF**: Django's double-submit cookie; the SPA reads the `csrftoken`
   cookie and echoes it as `X-CSRFToken` on every mutating request.
   Same-origin deployment means no CORS surface at all. DRF skips CSRF for
   anonymous users, so `pdfnum.api.CsrfEnforcingAnonymousAuthentication`
   enforces it on every API view (tested).
5. **Upload validation**: size cap enforced server-side, first from the
   `Content-Length` header by a middleware before any body is read, then on
   the parsed file; magic-byte check
   (`%PDF-`); the file must actually parse with pypdf; encrypted PDFs are
   rejected with a clear message. Stored under a server-generated name outside
   anything statically served; original filename is never used on disk.
6. **Downloads** stream through a Django view (`FileResponse`,
   `as_attachment`, `X-Content-Type-Options: nosniff`) after the session check —
   the web server never serves media directly.
7. **Deletion**: (a) immediately after a job's output download completes,
   upload + output + rows are removed; (b) a visible **"Delete now"** button
   on the done screen and **"Delete PDF"** in the workspace; (c) TTL sweep
   (default 2 h) as a management command run by cron/compose, plus
   opportunistic cleanup at the start of upload requests; (d) abandoned
   uploads: the open page sends a keep-alive every minute, and a document
   without one for `PDFNUM_IDLE_SECONDS` (default 15 min) counts as expired,
   so files die soon after the user closes the browser. The keep-alive never
   extends the hard 2 h limit.
8. **Headers & misc**: `SECURE_*` settings, CSP for the SPA, upload endpoint
   throttling per client IP (`PDFNUM_UPLOAD_RATE`, default 60/hour) to blunt
   abuse. Files are written with mode 0600 and never get a URL (`MEDIA_URL`
   is not routed). WP12 must configure the proxy count for the client IP
   (`NUM_PROXIES`) and a shared cache for throttling with several workers.

The e2e suite contains an explicit **hijack test**: a second browser context
requests the first context's document and job URLs and must get 404s.

---

## 3. Frontend UX design

Grounded in how iLovePDF/Sejda/Stirling-PDF/DocuSign solve the same problem,
plus form-vs-wizard research (details in §5 Research notes).

**Flow: two screens, no wizard.** Three steps is below the threshold where
steppers pay off; the successful PDF tools all use *upload gate → single
workspace → download*.

### Screen 1 — Upload
- Large dropzone (drag & drop + file picker), size limit stated **next to**
  the dropzone, retention promise ("your file is deleted after download, at the
  latest after 2 h") stated **before** upload — trust is committed here.
- Validation happens immediately on drop; errors are specific and recoverable:
  not a PDF / encrypted / corrupt / too large.

### Screen 2 — Workspace (place, preview, generate)
- **Canvas is the preview**: react-pdf renders the current page; the stamp is
  drawn live on it (and re-drawn on every page as you navigate) as the **real
  text in the real font at real size**, using the *widest* serial the run will
  produce — placement boxes that don't match output are DocuSign's #1 user
  complaint.
- **Three placement targets** as a segmented control: `First | Odd | Even`,
  each with an on/off switch (placements are optional). Editing happens on a
  representative page of that class; jump buttons go straight to *first / first
  odd / first even / last* page.
- **Placing**: a 3×3 preset grid (+ margin control) gets 90 % of cases in one
  click; the marker is then **draggable**, clicking elsewhere on the page moves
  it, **arrow keys nudge** (1 pt, Shift = 10 pt), and exact X/Y fields in mm
  (two-way synced with the drag) sit behind an "exact position" disclosure.
  Light snapping to page center and the 9 anchors with a visible guide line.
- **Sidebar (right)**: config selector (saved configs, latest version per
  name) → applying one previews instantly; font + size; number format (prefix,
  digits, suffix) with a live sample `Exam A – 0042`; save config (new name or
  new version of existing); copies count + start number; the primary
  **"Number it!"** button.
- **Zoom**: fit-page default (placement is judged relative to page edges),
  fit-width, ± with visible percentage. Prev/next + "page X of Y".
- **Progress**: determinate, staged — "Generating copy 37 of 200 → assembling →
  downloading". Never a bare spinner.

### Screen 3 — Done
- Download confirmation, **"Delete now"** button, confirmation once files are
  gone, "number another exam" restart.

### Responsive & themes
- MUI theme with `colorSchemes` light + dark following `prefers-color-scheme`.
- ≥ md screens: canvas + permanent right sidebar (uses big-screen space).
- Phones: sidebar becomes a swipe-up **bottom sheet**; segmented control stays
  pinned above the canvas; free drag is replaced by preset grid + on-screen
  nudge arrows + mm fields (fat-finger dragging is imprecise; this is what the
  mobile versions of the successful tools do). Pinch = zoom; one-finger drag
  moves the marker only when the marker itself is hit, otherwise it pans.

### Fonts
Bundled in the repo (all freely licensed), used identically by reportlab (TTF)
and the browser preview (@font-face), so preview = output:
- Serif → CMU Serif (Computer Modern Roman, `cmunrm.ttf` as in the original
  script), Libertinus Serif, Noto Serif
- Sans-serif → CMU Sans Serif, Source Sans 3, DejaVu Sans
- Handwritten → Caveat, Patrick Hand, Indie Flower

The font picker groups entries by category (serif / sans-serif / handwritten).

---

## 4. Work packages (TDD)

Strict order inside every package: **write failing tests → implement → green →
refactor**. Every package ends with all suites green and a conventional commit.
Each package is independently reviewable and small enough to land in one PR.

**WP0 — Scaffolding & tooling.**
Monorepo skeleton as in §2; uv-managed Django project; Vite+React+TS+MUI+yarn 4
scaffold; pytest/Vitest/Playwright wired; `Makefile` targets `dev`, `test`,
`test-backend`, `test-frontend`, `e2e`, `lint`; GitHub Actions running all three
suites; README skeleton (usage, running tests, updating dependencies).
*Acceptance: `make test` and `make e2e` run (trivial smoke tests) locally and in CI.*
*Status: done.*

**WP1 — Core stamping library (`backend/stamping/`, pure Python).**
Tests first against generated fixture PDFs (ports of `create_dummy.py` /
`create_form_dummy.py`): serial formatting (prefix/digits/suffix/start);
overlay creation with embedded fonts; page-class resolution (first/odd/even,
odd excludes page 1); form-field transparency handling (from
`make_annots_transparent`); stamping one copy; generating + concatenating N
copies with a progress callback; duplex padding (blank page appended to
odd-length copies, on by default, page size matching the copy's last page);
font registry (fewer than 10 entries, each with category and bundled TTF);
shared resources written once across copies (output size test); correct
behavior for pages without a placement, odd page sizes, rotated pages.
*Acceptance: library reproduces the original script's output semantics; no Django import.*
*Status: done (see §2, output PDF semantics).*

**WP2 — Documents API.**
Tests first: upload happy path returns id/page_count/page_sizes; session
binding (second session → 404); size cap, magic-byte, parse and encrypted-PDF
rejections with distinct error codes; preview file endpoint with `nosniff`;
DELETE; CSRF enforced on mutations; csrf bootstrap endpoint.
*Acceptance: full test matrix green; no way to read a foreign document.*
*Status: done. Expired documents are also purged at the start of every upload; the TTL sweep command follows in WP4.*

**WP3 — Configs API.**
Tests first: save creates (name, version=1); saving same name creates version 2
and never mutates version 1; list returns latest version per name; placements
validated (role unique, 0–3 of them, coordinates within page bounds not
required — configs are document-independent); fetch by id.
*Acceptance: version semantics proven by tests.*
*Status: done. Includes the font endpoints for the frontend picker and preview.*

**WP4 — Generation jobs API.**
Tests first: generate creates job bound to session; worker thread updates
`copies_done` (progress observable by polling); download streams the result and
triggers deletion of upload+output+rows; failed generation reports `failed`
with message; TTL cleanup command removes expired documents/jobs and files;
opportunistic cleanup hook.
*Acceptance: after a completed download the media directory is empty for that session.*
*Status: done.*

**WP5 — Frontend foundation.**
Tests first (Vitest/RTL): theme switches with `prefers-color-scheme`; API
client attaches `X-CSRFToken` and surfaces typed errors; app shell renders;
routing between the three screens.
*Acceptance: suite green; dark/light verified by test and by eye.*
*Status: done.* Routes: `/` upload, `/exams/:documentId` workspace (reload-safe),
`/done`; unknown URLs redirect to `/` (React Router, added for reload-safe
URLs and the browser back button). The theme uses MUI CSS variables with
`colorSchemeSelector: "media"`: the browser's `prefers-color-scheme` picks the
palette in pure CSS (no flash, follows OS changes live); verified in Chromium
by the e2e theme test. `src/api/client.ts` adds the CSRF token (fetching the
cookie first if needed) and turns every failure into an `ApiError` with
`status`, `code`, `message` and `fields`.

**WP6 — Upload screen.**
Tests first: dropzone accept/reject states, limit + retention copy visible
pre-upload, upload progress, specific error rendering per backend error code,
navigation to workspace on success.
*Status: done.* Limits and the deletion promise come from `/api/limits/` and
are shown before upload; non-PDFs, several files and oversized files are
rejected in the browser before any byte is sent; the upload uses
XMLHttpRequest for determinate progress and can be cancelled; every server
error code has its own explanation. The drag hint is hidden on touch devices.

**WP7 — PDF viewer.**
Tests first (coordinate utilities as pure functions; viewer behavior with
mocked pdf.js): render page, prev/next + page indicator, jump to first/first
odd/first even/last, zoom fit-page/fit-width/percentage; **pt↔px mapping** of
displayed-page coordinates (see §2, coordinates) as one pure function,
round-trips proven in unit tests; rotated pages render rotated by pdf.js and
need no special casing.
*Status: done.* `src/pdf/coordinates.ts` is the one pt ↔ px conversion
(`left = x·scale`, `top = (height − y)·scale`, scale = CSS px per pt; 100 %
zoom = real paper size, 96/72 px per pt). The viewer renders with react-pdf
(pdf.js 6.3, text and annotation layers off; forms are drawn into the canvas,
like the flattened output), fits the page by default, offers fit width and
zoom steps, Page Up/Down/Home/End, and an overlay slot that WP8 uses for the
marker. pdf.js character maps, standard fonts, wasm decoders and ICC profiles
are copied to `/pdfjs/` in the build: **WP12 must serve that path** next to
the SPA assets. Vitest mocks react-pdf; Playwright checks real rendering
(ink on the canvas, white paper in dark mode, no pdf.js resource warnings).

**WP8 — Placement tools.**
Tests first: segmented control switches target + navigates to a representative
page; enable/disable per placement; preset grid sets expected pt coordinates;
drag and click-to-move update state; arrow-key nudge (1/10 pt) and Escape
cancel; mm fields two-way sync; marker renders widest serial in correct
font/size; live preview appears on all matching pages.
*This is the heart of the app — budget accordingly.*
*Status: done.* A First page | Odd pages | Even pages selector above the
preview jumps to the first page of that type and follows the page shown; it
replaces the viewer's jump buttons in the workspace. The marker is an SVG
`<text>` positioned at its baseline (exactly the PDF semantics) in the bundled
TTF at true size. Moving it: drag (Escape cancels), click on the page (centres
the number there; on a switched-off page type it switches it on), arrow keys
(1 pt, Shift 10 pt), a 3 × 3 preset grid with a margin (default 10 mm), nudge
buttons (1 mm, for touch screens) and exact mm fields (from left / from bottom
to the baseline start), all kept in sync. Per page type: on/off switch (off
remembers the position), font and size; "Use for all pages" copies one page
type's settings. Defaults: all page types on, top right, 10 mm margin,
Computer Modern 12 pt. On phones the settings panel starts collapsed below the
preview. Not built: snapping to centre/anchors (presets and mm fields cover
aligned positions). Verified once by hand: the ink of the number in the
browser preview and in the generated PDF (rendered by PDFium) agree within
one screen pixel for CMU Serif, DejaVu Sans and Caveat; WP11 turns this into
an automated test.

**WP9 — Config management UI.**
Tests first: load + apply config previews instantly; save-as-new vs
save-new-version flows; dirty-state indicator ("modified since load").
*Status: done.* A "Configuration" section at the top of the settings lists the
latest version of every saved configuration; choosing one applies positions,
fonts and number format at once (with a confirmation if there are unsaved
changes). A version picker loads older versions. One save dialog covers both
flows: the hint says "Creates a new configuration" or "Saves version N of …"
depending on whether the name already exists (matched like the backend:
case-insensitive, whitespace collapsed); unchanged content is reported as
already saved. A "Modified" chip shows unsaved changes to a loaded
configuration. Validation errors from the server are shown in the dialog.

**WP10 — Generate & download flow.**
Tests first: copies/start/prefix/suffix inputs with live sample; duplex-padding
switch (on by default) reflected in the page-count summary; summary before
the expensive step ("200 copies, ~1800 pages"); staged determinate progress via
polling; browser download; post-download deleted-confirmation + Delete now;
restart flow.
*Status: done.* A "Numbers" section sets prefix, digits, suffix and the first
number, with a live sample ("Numbers A-005 to A-034"); the marker on the page
shows the widest (last) number of the run. The duplex switch (on by default)
explains the blank page. A footer that stays visible (also while the settings
are collapsed on phones) holds the number of copies, the summary
("30 copies × 4 pages = 120 pages", plus a note about padding) and
"Number it!"; runs above the server's page limit are refused with an
explanation. Generation is started from the click (never from an effect, so
React StrictMode cannot start it twice); a dialog polls the job and shows
"Preparing…", "Numbering copy 37 of 200", "Assembling the PDF…" with a
determinate bar; errors (server refusal or failed job) are explained there.
The download is a normal browser download of the attachment (streamed to
disk, never held in memory). The done screen polls the document: because the
backend deletes everything before the last bytes are sent, the document
disappears exactly when the download completes, and the screen then confirms
the deletion. Until then it offers "Download again" and "Delete now";
"Number another exam" restarts.

**WP11 — E2E suite (Playwright).**
Preview-equals-output test: place the number in the browser, generate the PDF
with the same settings, render it, and compare the ink positions (done by hand
in WP8, to be automated).
Whole happy path on desktop viewport **and** phone viewport (upload → place on
all three classes → save config → reload-and-reselect config → generate 3
copies → download → verify the downloaded PDF's page count and stamped text
with pypdf → verify server-side deletion). Security spec: second browser
context gets 404 on foreign document/job/download URLs. Dark-mode smoke shot.
*(E2E skeletons are written per-package from WP6 on; WP11 completes and hardens the suite.)*
*Status: done.* `e2e/tests/preview-equals-output.spec.ts` compares the ink of
the number in the browser preview (screenshot with vs. without the marker)
with the ink in the generated PDF (PDFium render of output vs. upload) for
CMU Serif, Caveat 24 pt and DejaVu Sans on a rotated page with an offset crop
box; they agree within 1.5 pt (measured: about 0.7 pt), and a 5 pt shift in the
backend's rotation mapping makes it fail. `journey.spec.ts` runs the whole
happy path on desktop and phone and checks the downloaded PDF page by page
with pypdf. PDF inspection uses `e2e/tools/inspect_pdf.py` in the backend's
uv environment (no PDF libraries in Node). Security: `documents-security.spec.ts`
and `generation.spec.ts` (a second browser with its own valid session gets
404 for documents, files, jobs and downloads). The suite runs twice in a row
without retries without failures.

**WP12 — Production packaging & docs.**
Dockerfile (multi-stage: yarn build → collectstatic → gunicorn+WhiteNoise),
docker-compose with volumes + TTL-cleanup schedule, settings via env vars,
Traefik integration (labels, TLS via Traefik, forwarded headers, body size
limit, see §2 reverse proxy),
final README (usage with screenshots, dev setup, all test commands, dependency
update procedure for uv + yarn, deployment).
*Acceptance: `docker compose up` serves the working app; e2e suite can run against it.*
*Status: done.* Three-stage Dockerfile (Node: yarn build; Python: uv sync of
the locked runtime dependencies; slim runtime with only the virtualenv, the
backend and the built frontend, user `pdfnum`, volume `/data`, healthcheck that
bypasses proxy settings). WhiteNoise serves the built frontend including
`/pdfjs/` (hashed `/assets/` immutable); every non-API path gets the app shell
with a strict Content Security Policy (no inline scripts, no `eval`, only
`wasm-unsafe-eval` for pdf.js decoders, no framing). `PDFNUM_TRUST_PROXY`
(set by the compose file) trusts Traefik's `X-Forwarded-Proto` and one
`X-Forwarded-For` entry; off by default, so forwarding headers cannot be
spoofed. Rate limiting uses a file cache in `/data` shared by all gunicorn
processes. `docker-compose.yml` runs the app behind Traefik (labels via
`.env`) plus a cleanup service; `docker-compose.local.yml` publishes it on
localhost for a trial. The e2e suite runs against gunicorn serving the built
app (`make e2e-production`, also in CI with a Docker build job) and against any
deployment (`E2E_BASE_URL`); both were run in full against the image.

### After WP12 (feedback from the first deployment)

*Status: done.*
- **Abandoned uploads** are deleted after `PDFNUM_IDLE_SECONDS` without a
  keep-alive (`Document.last_seen_at`, `POST …/keepalive/` every 60 s from the
  workspace and done screen). An `unload` beacon was rejected: it also fires on
  reloads and is unreliable on mobile.
- **"Delete PDF"** button with a confirmation dialog in the workspace header:
  deletes the upload and returns to the upload page.
- **Safari fix**: pdf.js's modern build uses `Map.prototype.getOrInsertComputed`
  without a fallback, which Safari lacks ("getOrInsertComputed is not a
  function"). Vite aliases `pdfjs-dist` to its legacy build (page and worker),
  which polyfills it; `e2e/tests/browser-compat.spec.ts` removes such built-ins
  in Chromium to guard against regressions.
- **Browser matrix**: the e2e suite runs in Chromium (desktop, phone),
  Firefox and WebKit (desktop, iPhone); `E2E_BROWSERS` selects engines.
- **Compose**: `pull_policy: build`/`never`, so `docker compose pull` (e.g. from
  Ansible) skips the locally built image instead of failing.

Suggested order: WP0 → WP1 → WP2 → WP5 → WP6 → WP3 → WP7 → WP8 → WP9 → WP4 →
WP10 → WP11 → WP12 (backend/frontend pairs can interleave; WP1 unblocks
everything server-side, WP7/8 are the risky UI core — start them early).

---

## 5. Research notes (what the design leans on)

- **Version choices** verified against PyPI/npm on 2026-11-04 (Django 6.1.3,
  React 19.3.1, MUI 9.5.0, Vite 8.3.5, yarn 4.18.1, react-pdf 11 / pdf.js 6,
  Playwright 1.64.1, pypdf 6.21, reportlab 5.1, DRF 3.18.3). TS 7 exists but
  typescript-eslint lags → TS 6.0.x for now.
- **Placement UX**: iLovePDF leads with a 3×3 grid + live thumbnails; Sejda
  pairs a draggable live watermark with X/Y fields; DocuSign's top complaint is
  placement-marker ≠ rendered output → render the true text at true size;
  dnd-kit/Primer/Salesforce document arrow-key nudging + aria-live as the
  accessible drag pattern.
- **Wizard vs workspace**: PatternFly's study (5/7 users prefer progressive
  single page) and Visa's design system (wizards at 4+ steps) → single
  workspace, upload as the only gate.
- **Mobile**: Syncfusion's reference PDF viewers move tools to a bottom
  toolbar/sheet; mobile versions of the big PDF tools drop free drag for
  presets + nudge.
- **Trust/feedback**: iLovePDF states a concrete deletion window *and* offers
  "delete now"; determinate staged progress ("copy X of N") over spinners
  (Uploadcare/Filestack upload-UX guidelines).
- **Coordinate correctness**: pdf.js `viewport.convertToPdfPoint/
  convertToViewportPoint` instead of hand-rolled math; store positions in PDF
  points so browser preview and reportlab output share one source of truth.
