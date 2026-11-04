import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, "../../backend");
const script = path.resolve(here, "../tools/inspect_pdf.py");

/** [left, bottom, right, top] in PDF points of the displayed page. */
export type InkBox = [number, number, number, number];

function inspect<T>(...args: string[]): T {
  const output = execFileSync(
    "uv",
    ["run", "--quiet", "--project", backendDir, "python", script, ...args],
    { encoding: "utf8" },
  );
  return JSON.parse(output) as T;
}

/** Page count and extracted text per page (pypdf). */
export const pdfSummary = (pdf: string) =>
  inspect<{ pages: number; texts: string[] }>("summary", pdf);

/** Ink that `pdf` adds to `reference` on a page, rendered by PDFium. */
export const pdfInk = (
  pdf: string,
  reference: string,
  page: number,
  referencePage: number,
  scale = 3,
) =>
  inspect<InkBox | null>(
    "ink-pdf",
    pdf,
    reference,
    String(page),
    String(referencePage),
    String(scale),
  );

/** Ink that one screenshot adds to another of the same page. */
export const pngInk = (withInk: string, without: string, pageWidthPt: number) =>
  inspect<InkBox | null>("ink-png", withInk, without, String(pageWidthPt));
