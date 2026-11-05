import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, "../backend");
const dataDir = path.resolve(here, ".data");

const backendPort = Number(process.env.E2E_BACKEND_PORT ?? 8765);
const frontendPort = Number(process.env.E2E_FRONTEND_PORT ?? 4173);
const backendUrl = `http://127.0.0.1:${backendPort}`;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const frontendDist = path.resolve(here, "../frontend/dist");

/**
 * Where the tests run against:
 * - default: Django (runserver) + the production bundle served by `vite preview`
 * - E2E_TARGET=production: Django under gunicorn serving the built frontend
 *   itself (WhiteNoise, app shell, CSP), exactly like the Docker image
 * - E2E_BASE_URL=<url>: an already running deployment (e.g. docker compose);
 *   it needs a high PDFNUM_UPLOAD_RATE, the suite uploads many PDFs
 */
const externalUrl = process.env.E2E_BASE_URL;
const production = process.env.E2E_TARGET === "production";

const backendEnv = {
  PDFNUM_SECRET_KEY: "e2e-only-insecure-secret-key",
  PDFNUM_DATA_DIR: dataDir,
  PDFNUM_ALLOWED_HOSTS: "127.0.0.1,localhost",
  PDFNUM_UPLOAD_RATE: "1000/hour",
  PDFNUM_CONFIG_SAVE_RATE: "1000/hour",
  // The test servers speak plain HTTP. WebKit drops `Secure` cookies there
  // (Chromium and Firefox keep them on 127.0.0.1), so no CSRF token or session.
  PDFNUM_SECURE_COOKIES: "0",
};
// A fresh database per run, so tests never depend on leftovers.
const freshDatabase = [`rm -rf "${dataDir}"`, "uv run python manage.py migrate --noinput"];

const devServers = [
  {
    name: "backend",
    command: [
      ...freshDatabase,
      `uv run python manage.py runserver 127.0.0.1:${backendPort} --noreload`,
    ].join(" && "),
    cwd: backendDir,
    url: `${backendUrl}/api/health/`,
    env: backendEnv,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  {
    name: "frontend",
    // The production bundle, served by `vite preview`, which proxies /api.
    command: `yarn workspace frontend build && yarn workspace frontend preview --host 127.0.0.1 --port ${frontendPort} --strictPort`,
    url: frontendUrl,
    env: { BACKEND_URL: backendUrl },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
];

const productionServer = [
  {
    name: "app",
    command: [
      "yarn workspace frontend build",
      ...freshDatabase,
      `uv run gunicorn pdfnum.wsgi --bind 127.0.0.1:${backendPort} --worker-class gthread --workers 2 --threads 8`,
    ].join(" && "),
    cwd: backendDir,
    url: `${backendUrl}/api/health/`,
    env: { ...backendEnv, PDFNUM_FRONTEND_DIR: frontendDist },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
];

// Optional override for environments with a preinstalled Chromium that does not
// match this Playwright version (see README, "End-to-end tests").
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

/**
 * Every engine the app's users have: Chromium (Chrome, Edge), Firefox and
 * WebKit (Safari), on desktop and phone. E2E_BROWSERS=chromium,webkit limits a
 * run to some engines (e.g. where only Chromium is installed).
 */
const allProjects = [
  {
    name: "desktop",
    engine: "chromium",
    use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
  },
  {
    name: "phone",
    engine: "chromium",
    use: { ...devices["Pixel 7"], launchOptions: { executablePath } },
  },
  { name: "firefox", engine: "firefox", use: { ...devices["Desktop Firefox"] } },
  { name: "safari", engine: "webkit", use: { ...devices["Desktop Safari"] } },
  { name: "iphone", engine: "webkit", use: { ...devices["iPhone 15"] } },
];
const engines = process.env.E2E_BROWSERS?.split(",").map((engine) => engine.trim());
const projects = allProjects
  .filter((project) => !engines || engines.includes(project.engine))
  .map(({ name, use }) => ({ name, use }));

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // A first PDF render (pdf.js worker start-up) can take several seconds on
  // slow or busy CI machines; 5 s (the default) is too tight for that.
  expect: { timeout: 10_000 },
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: externalUrl ?? (production ? backendUrl : frontendUrl),
    trace: "on-first-retry",
  },
  projects,
  webServer: externalUrl ? undefined : production ? productionServer : devServers,
});
