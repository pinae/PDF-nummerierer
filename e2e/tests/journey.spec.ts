/**
 * The whole happy path, on desktop and phone: upload, place the number on all
 * three page types, save the configuration, reload and reuse it, generate three
 * copies, check the downloaded PDF page by page, and check that the server
 * deleted the exam afterwards.
 */
import { expect, test, type Page } from "@playwright/test";

import { examPdf } from "./api";
import { pdfSummary } from "./pdfTools";

async function openSettings(page: Page) {
  // On phones the settings start collapsed below the page.
  const settings = page.getByRole("button", { name: "Number settings" });
  if ((await settings.isVisible()) && (await settings.getAttribute("aria-expanded")) === "false") {
    await settings.click();
  }
}

async function positionMm(page: Page) {
  const exact = page.getByRole("button", { name: "Exact position" });
  if ((await exact.getAttribute("aria-expanded")) !== "true") await exact.click();
  return {
    left: await page.getByLabel("From left", { exact: true }).inputValue(),
    bottom: await page.getByLabel("From bottom", { exact: true }).inputValue(),
  };
}

test("upload, place, save, reuse, number, download — and nothing is left", async ({
  page,
}, testInfo) => {
  const configName = `E2E journey ${testInfo.project.name} ${Date.now()}`;

  // Upload
  await page.goto("/");
  await page
    .getByLabel("Exam PDF")
    .setInputFiles({ name: "exam.pdf", mimeType: "application/pdf", buffer: examPdf });
  await expect(page.locator("canvas.react-pdf__Page__canvas")).toBeVisible();
  const documentId = page.url().split("/").pop();
  await openSettings(page);

  // Place the number on all three page types
  await page.getByRole("button", { name: "Top right", exact: true }).click();
  await page.getByRole("button", { name: /^Odd pages/ }).click();
  await page.getByRole("button", { name: "Bottom left", exact: true }).click();
  await page.getByRole("button", { name: /^Even pages/ }).click();
  await page.getByRole("button", { name: "Bottom right", exact: true }).click();

  // Save the configuration
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Save configuration" });
  await dialog.getByLabel("Name").fill(configName);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(`Saved “${configName}” as version 1.`)).toBeVisible();

  // Reload and reuse it
  await page.reload();
  await expect(page.locator("canvas.react-pdf__Page__canvas")).toBeVisible();
  await openSettings(page);
  await expect(page.getByText("Not saved yet")).toBeVisible();
  await page.getByRole("combobox", { name: "Saved configuration" }).click();
  await page.getByRole("option", { name: new RegExp(`^${configName}`) }).click();
  await expect(page.getByText("Version 1 of 1")).toBeVisible();
  await page.getByRole("button", { name: /^Odd pages/ }).click();
  expect(await positionMm(page)).toEqual({ left: "10.0", bottom: "10.0" });

  // Generate three copies and download them
  await page.getByLabel("Copies", { exact: true }).fill("3");
  await expect(page.getByText("3 copies × 4 pages = 12 pages")).toBeVisible();
  const downloadStarted = page.waitForEvent("download");
  await page.getByRole("button", { name: "Number it!" }).click();
  const download = await downloadStarted;
  expect(download.suggestedFilename()).toBe("exam-numbered.pdf");
  const file = testInfo.outputPath("exam-numbered.pdf");
  await download.saveAs(file);

  // Every copy: pages 1–3 carry its number, page 4 is the blank duplex page
  const { pages, texts } = pdfSummary(file);
  expect(pages).toBe(12);
  for (const copy of [1, 2, 3]) {
    const serial = `000${copy}`;
    const [first, second, third, padding] = texts.slice((copy - 1) * 4, copy * 4);
    expect(first).toContain("This is page 1");
    expect(first).toContain(serial);
    expect(second).toContain("This is page 2");
    expect(second).toContain(serial);
    expect(third).toContain("This is page 3");
    expect(third).toContain(serial);
    expect(padding?.trim()).toBe("");
  }

  // The exam and the copies are gone from the server
  await expect(page).toHaveURL("/done");
  await expect(
    page.getByText("Your exam and the numbered copies have been deleted from the server."),
  ).toBeVisible({ timeout: 15_000 });
  expect((await page.request.get(`/api/documents/${documentId}/`)).status()).toBe(404);
  await page.getByRole("link", { name: "Number another exam" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Number an exam" })).toBeVisible();
});
