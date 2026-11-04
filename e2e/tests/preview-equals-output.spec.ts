/**
 * The central promise: the number is printed exactly where the preview shows it.
 * Compares the ink of the number in the browser preview with the ink in the
 * generated PDF (rendered by PDFium), in PDF points of the displayed page.
 */
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { pdfInk, pngInk } from "./pdfTools";

const fixture = (name: string) => new URL(`../fixtures/${name}`, import.meta.url);
/** One screen pixel is ~0.6 pt at this zoom; allow rasterisation of both renderers. */
const TOLERANCE_PT = 1.5;

interface Case {
  name: string;
  file: string;
  /** Displayed page width in points (after /Rotate and the crop box). */
  pageWidth: number;
  font?: string;
  size?: string;
  place: (page: Page) => Promise<void>;
}

const preset = (name: string) => async (page: Page) => {
  await page.getByRole("button", { name, exact: true }).click();
};

const exactly = (leftMm: string, bottomMm: string) => async (page: Page) => {
  await page.getByRole("button", { name: "Exact position" }).click();
  await page.getByLabel("From left", { exact: true }).fill(leftMm);
  await page.getByLabel("From bottom", { exact: true }).fill(bottomMm);
  await page.getByLabel("Copies", { exact: true }).click(); // blur: apply and format
};

const cases: Case[] = [
  {
    name: "Computer Modern, top right",
    file: "exam.pdf",
    pageWidth: 595.28,
    place: preset("Top right"),
  },
  {
    name: "Caveat 24 pt, bottom left",
    file: "exam.pdf",
    pageWidth: 595.28,
    font: "Caveat",
    size: "24",
    place: preset("Bottom left"),
  },
  {
    name: "DejaVu Sans on a rotated page with an offset crop box",
    file: "rotated.pdf",
    pageWidth: 820 - 30, // rotated: displayed width is the crop box height
    font: "DejaVu Sans",
    size: "14",
    place: exactly("40", "30"),
  },
];

test.describe("preview equals output", () => {
  test.use({ viewport: { width: 1600, height: 1500 } });

  for (const testCase of cases) {
    test(testCase.name, async ({ page, isMobile }, testInfo) => {
      test.skip(isMobile, "measured once, at high resolution on desktop");
      const upload = fixture(testCase.file);
      await page.goto("/");
      await page.getByLabel("Exam PDF").setInputFiles({
        name: testCase.file,
        mimeType: "application/pdf",
        buffer: readFileSync(upload),
      });
      const canvas = page.locator("canvas.react-pdf__Page__canvas");
      await expect(canvas).toBeVisible();

      if (testCase.font) {
        await page.getByRole("combobox", { name: "Font" }).click();
        await page.getByRole("option", { name: testCase.font }).click();
      }
      if (testCase.size) await page.getByLabel("Size", { exact: true }).fill(testCase.size);
      await testCase.place(page);
      await page.evaluate(() => document.fonts.ready);

      // Preview: the page with only the number's glyphs vs. the page without the number.
      const box = (await canvas.boundingBox())!;
      const frameHidden = await page.addStyleTag({
        content: '[data-testid="stamp-overlay"] rect { visibility: hidden }',
      });
      const withNumber = testInfo.outputPath("preview-with.png");
      await page.screenshot({ clip: box, path: withNumber });
      const overlayHidden = await page.addStyleTag({
        content: '[data-testid="stamp-overlay"] { visibility: hidden }',
      });
      const withoutNumber = testInfo.outputPath("preview-without.png");
      await page.screenshot({ clip: box, path: withoutNumber });
      await overlayHidden.evaluate((style) => (style as HTMLElement).remove());
      await frameHidden.evaluate((style) => (style as HTMLElement).remove());
      const preview = pngInk(withNumber, withoutNumber, testCase.pageWidth);

      // Output: generate one copy and compare it with the uploaded original.
      const downloadStarted = page.waitForEvent("download");
      await page.getByRole("button", { name: "Number it!" }).click();
      const output = testInfo.outputPath("output.pdf");
      await (await downloadStarted).saveAs(output);
      const printed = pdfInk(output, upload.pathname, 0, 0);

      testInfo.annotations.push({ type: "ink", description: JSON.stringify({ preview, printed }) });
      expect(preview, "number visible in the preview").not.toBeNull();
      expect(printed, "number printed in the PDF").not.toBeNull();
      for (const [index, edge] of ["left", "bottom", "right", "top"].entries()) {
        expect(
          Math.abs(preview![index]! - printed![index]!),
          `${edge} edge: preview ${preview![index]} pt, printed ${printed![index]} pt`,
        ).toBeLessThanOrEqual(TOLERANCE_PT);
      }
    });
  }
});
