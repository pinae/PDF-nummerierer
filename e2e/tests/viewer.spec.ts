import { expect, test, type Page } from "@playwright/test";

import { examPdf } from "./api";

/** The page indicator (phones show "2 / 3" but announce "Page 2 of 3"). */
const pageIndicator = (page: Page) => page.getByRole("toolbar").getByRole("status");

async function openUploadedExam(page: Page) {
  await page.goto("/");
  await page
    .getByLabel("Exam PDF")
    .setInputFiles({ name: "exam.pdf", mimeType: "application/pdf", buffer: examPdf });
  await expect(page).toHaveURL(/\/exams\/[0-9a-f-]{36}$/);
  return page.locator("canvas.react-pdf__Page__canvas");
}

/** Share of dark pixels and the colour of the top-left pixel of the rendered page. */
async function inkOf(page: Page) {
  return page.locator("canvas.react-pdf__Page__canvas").evaluate((canvas: HTMLCanvasElement) => {
    if (canvas.width === 0 || canvas.height === 0) return { dark: 0, corner: [] as number[] };
    const context = canvas.getContext("2d")!;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i]! < 128) dark += 1;
    return { dark, corner: Array.from(data.slice(0, 3)) };
  });
}

test.describe("PDF viewer", () => {
  test("renders the real PDF page with its text", async ({ page }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (/must be specified|Setting up fake worker|Failed to/i.test(message.text())) {
        warnings.push(message.text());
      }
    });

    const canvas = await openUploadedExam(page);
    await expect(canvas).toBeVisible();
    // The fixture is a single line of 12 pt text, so a few dozen dark pixels are real ink.
    await expect.poll(async () => (await inkOf(page)).dark).toBeGreaterThan(10);

    expect(warnings).toEqual([]);
  });

  test("pages through the document", async ({ page }) => {
    await openUploadedExam(page);
    await expect(pageIndicator(page)).toContainText("Page 1 of 3");

    await page.getByRole("button", { name: "Next page" }).click();
    await expect(pageIndicator(page)).toContainText("Page 2 of 3");
    await page.getByRole("button", { name: "Last page" }).click();
    await expect(pageIndicator(page)).toContainText("Page 3 of 3");
    await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
    await page.getByRole("button", { name: "First even page" }).click();
    await expect(pageIndicator(page)).toContainText("Page 2 of 3");
  });

  test("fits the page by default and can fit the width or zoom", async ({ page }) => {
    const canvas = await openUploadedExam(page);
    await expect(canvas).toBeVisible();
    const preview = page.getByRole("region", { name: "Page preview" });
    const previewBox = (await preview.boundingBox())!;
    const fitted = (await canvas.boundingBox())!;
    expect(fitted.height).toBeLessThanOrEqual(previewBox.height);

    // Fit width fills the preview minus its 24 px padding on each side (and a
    // scrollbar, if the page becomes taller than the preview). On a portrait
    // phone this equals fit page, so compare against the preview, not the fit.
    await page.getByRole("button", { name: "Fit width" }).click();
    const available = previewBox.width - 2 * 24;
    await expect
      .poll(async () => (await canvas.boundingBox())!.width)
      .toBeGreaterThanOrEqual(Math.max(available - 20, fitted.width));
    expect((await canvas.boundingBox())!.width).toBeLessThanOrEqual(available + 1);

    const zoomLabel = page.getByRole("toolbar").getByText(/^\d+ %$/);
    const before = await zoomLabel.textContent();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(zoomLabel).not.toHaveText(before!);
  });

  test.describe("in dark mode", () => {
    test.use({ colorScheme: "dark" });

    test("the paper stays white", async ({ page }) => {
      await openUploadedExam(page);

      await expect.poll(async () => (await inkOf(page)).corner).toEqual([255, 255, 255]);
    });
  });

  test("survives a reload", async ({ page }) => {
    await openUploadedExam(page);

    await page.reload();

    await expect(page.getByText("exam.pdf")).toBeVisible();
    await expect(page.locator("canvas.react-pdf__Page__canvas")).toBeVisible();
  });

  test("explains that an unknown exam is gone", async ({ page }) => {
    await page.goto("/exams/00000000-0000-4000-8000-000000000000");

    await expect(
      page.getByRole("heading", { level: 1, name: "This exam is no longer here" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Upload a PDF" }).click();
    await expect(page).toHaveURL("/");
  });
});
