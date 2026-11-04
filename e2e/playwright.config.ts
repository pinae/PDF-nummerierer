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

// Optional override for environments with a preinstalled browser that does not
// match this Playwright version (see README, "End-to-end tests").
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: frontendUrl,
    trace: "on-first-retry",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      name: "backend",
      // A fresh database per run, so tests never depend on leftovers.
      command: [
        `rm -rf "${dataDir}"`,
        "uv run python manage.py migrate --noinput",
        `uv run python manage.py runserver 127.0.0.1:${backendPort} --noreload`,
      ].join(" && "),
      cwd: backendDir,
      url: `${backendUrl}/api/health/`,
      env: {
        PDFNUM_SECRET_KEY: "e2e-only-insecure-secret-key",
        PDFNUM_DATA_DIR: dataDir,
        PDFNUM_ALLOWED_HOSTS: "127.0.0.1,localhost",
        PDFNUM_UPLOAD_RATE: "1000/hour",
      },
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
  ],
});
