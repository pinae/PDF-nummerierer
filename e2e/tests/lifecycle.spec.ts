import { expect, test } from "@playwright/test";

import { examPdf } from "./api";

async function openWorkspace(page: import("@playwright/test").Page) {
  await page.goto("/");
  const keepAlive = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith("/keepalive/"),
  );
  await page
    .getByLabel("Exam PDF")
    .setInputFiles({ name: "wrong exam.pdf", mimeType: "application/pdf", buffer: examPdf });
  await expect(page.locator("canvas.react-pdf__Page__canvas")).toBeVisible();
  return { keepAlive, documentId: page.url().split("/").pop() };
}

test("an open exam tells the server it is still in use", async ({ page }) => {
  const { keepAlive } = await openWorkspace(page);

  expect((await (await keepAlive).response())?.status()).toBe(204);
});

test("a wrongly uploaded PDF can be deleted at once to start over", async ({ page }) => {
  const { documentId } = await openWorkspace(page);

  await page.getByRole("button", { name: "Delete PDF" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this PDF?" });
  await expect(dialog).toContainText("“wrong exam.pdf” is deleted from the server right away");
  await dialog.getByRole("button", { name: "Delete and start over" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Number an exam" })).toBeVisible();
  expect((await page.request.get(`/api/documents/${documentId}/`)).status()).toBe(404);
});
