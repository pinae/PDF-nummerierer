/**
 * The modern pdf.js build calls new JavaScript built-ins without fallback
 * (e.g. Map.prototype.getOrInsertComputed, missing in Safari). The legacy
 * build polyfills them, in the page and in the worker. The page side is
 * checked in e2e/tests/browser-compat.spec.ts; the worker is configured here.
 */
import { pdfjs } from "react-pdf";
import { describe, expect, it } from "vitest";

import "./PdfViewer";

describe("pdf.js build", () => {
  it("runs the legacy worker, which polyfills recent built-ins", () => {
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toMatch(/\/legacy\/build\/pdf\.worker\.min\.mjs$/);
  });
});
