import { expect, test, type Page } from "@playwright/test";

import { examPdf } from "./api";

async function openWorkspace(page: Page) {
  await page.goto("/");
  await page
    .getByLabel("Exam PDF")
    .setInputFiles({ name: "exam.pdf", mimeType: "application/pdf", buffer: examPdf });
  await expect(page.locator("canvas.react-pdf__Page__canvas")).toBeVisible();
  const settings = page.getByRole("button", { name: "Number settings" });
  if ((await settings.isVisible()) && (await settings.getAttribute("aria-expanded")) === "false") {
    await settings.click();
  }
}

async function save(page: Page, name: string | null, expectedHint: RegExp) {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Save configuration" });
  if (name !== null) await dialog.getByLabel("Name").fill(name);
  await expect(dialog.getByText(expectedHint)).toBeVisible();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

async function leftMm(page: Page) {
  const exact = page.getByRole("button", { name: "Exact position" });
  if ((await exact.getAttribute("aria-expanded")) !== "true") await exact.click();
  return page.getByLabel("From left", { exact: true }).inputValue();
}

test("saves versions of a configuration and loads them in another browser", async ({
  page,
  browser,
}, testInfo) => {
  const name = `E2E ${testInfo.project.name} ${Date.now()}`;
  await openWorkspace(page);
  await page.getByRole("button", { name: "Bottom left" }).click();

  await save(page, name, /Creates a new configuration/);
  await expect(page.getByText(`Saved “${name}” as version 1.`)).toBeVisible();

  await page.getByRole("button", { name: "Move right 1 mm" }).click();
  await expect(page.getByText("Modified")).toBeVisible();
  await save(page, null, /Saves version 2/);
  await expect(page.getByText("Modified")).toHaveCount(0);

  // A colleague opens another exam and reuses the configuration.
  const colleague = await browser.newPage({ ...testInfo.project.use });
  await openWorkspace(colleague);
  await colleague.getByRole("combobox", { name: "Saved configuration" }).click();
  await colleague.getByRole("option", { name: new RegExp(`^${name}`) }).click();
  await expect(colleague.getByText("Version 2 of 2")).toBeVisible();
  expect(await leftMm(colleague)).toBe("11.0");

  await colleague.getByRole("combobox", { name: "Version" }).click();
  await colleague.getByRole("option", { name: /^Version 1/ }).click();
  await expect(colleague.getByText("Version 1 of 2")).toBeVisible();
  expect(await leftMm(colleague)).toBe("10.0");
  await colleague.close();
});
