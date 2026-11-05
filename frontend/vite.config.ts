/// <reference types="vitest/config" />
import { createRequire } from "node:module";
import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, normalizePath } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

// Dev and preview servers proxy /api to Django, so the browser sees a single
// origin exactly like in production (cookies and CSRF behave identically).
const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

// pdf.js loads character maps, standard fonts, image decoders and colour
// profiles at runtime; they are served from /pdfjs/ (see PdfViewer.tsx).
const require = createRequire(import.meta.url);
const pdfjsDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
const pdfjsAssets = ["cmaps", "standard_fonts", "wasm", "iccs"].map((name) => ({
  src: normalizePath(path.join(pdfjsDir, name)),
  dest: "pdfjs",
  rename: { stripBase: 2 }, // node_modules/pdfjs-dist/<name>/… → pdfjs/<name>/…
}));

export default defineConfig({
  plugins: [react(), viteStaticCopy({ targets: pdfjsAssets })],
  resolve: {
    // Use pdf.js's legacy build everywhere (react-pdf imports these paths). The
    // modern build calls new JavaScript built-ins without fallback, e.g.
    // Map.prototype.getOrInsertComputed, which Safari lacked: "this.#t.
    // getOrInsertComputed is not a function". The legacy build polyfills them.
    alias: [
      { find: /^pdfjs-dist$/, replacement: "pdfjs-dist/legacy/build/pdf.mjs" },
      { find: /^pdfjs-dist\/build\/(.*)$/, replacement: "pdfjs-dist/legacy/build/$1" },
      { find: /^pdfjs-dist\/web\/(.*)$/, replacement: "pdfjs-dist/legacy/web/$1" },
    ],
  },
  server: {
    proxy: {
      "/api": { target: backendUrl, changeOrigin: false },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/main.tsx"],
    },
  },
});
