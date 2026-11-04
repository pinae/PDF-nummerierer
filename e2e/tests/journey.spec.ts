import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { examPdf } from "./api";

test("upload, number, download — and the exam is gone from the server", async ({ page }) => {
  await page.goto("/");
  await page
    .getByLabel("Exam PDF")
    .setInputFiles({ name: "exam.pdf", mimeType: "application/pdf", buffer: examPdf });
  await expect(page.locator("canvas.react-pdf__Page__canvas")).toBeVisible();
  const documentId = page.url().split("/").pop();

  // The copies field and "Number it!" stay visible, also on phones.
  const copies = page.getByLabel("Copies", { exact: true });
  await copies.fill("3");
  await expect(page.getByText("3 copies × 4 pages = 12 pages")).toBeVisible();

  const downloadStarted = page.waitForEvent("download");
  await page.getByRole("button", { name: "Number it!" }).click();
  const download = await downloadStarted;

  expect(download.suggestedFilename()).toBe("exam-numbered.pdf");
  const pdf = await readFile((await download.path())!);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g)).toHaveLength(12);

  await expect(page).toHaveURL("/done");
  await expect(page.getByText("The download of “exam-numbered.pdf” has started.")).toBeVisible();
  await expect(
    page.getByText("Your exam and the numbered copies have been deleted from the server."),
  ).toBeVisible({ timeout: 15_000 });
  expect((await page.request.get(`/api/documents/${documentId}/`)).status()).toBe(404);

  await page.getByRole("link", { name: "Number another exam" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Number an exam" })).toBeVisible();
});
