import { expect, test } from "@playwright/test";

import { examPdf } from "./api";

test.describe("upload screen", () => {
  test("states limit and privacy, uploads a PDF and opens its workspace", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("PDF, up to 500 MB")).toBeVisible();
    await expect(page.getByText(/at the latest after 2 hours/)).toBeVisible();

    await page
      .getByLabel("Exam PDF")
      .setInputFiles({ name: "exam.pdf", mimeType: "application/pdf", buffer: examPdf });

    await expect(page).toHaveURL(/\/exams\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Place the number" })).toBeVisible();
    const documentId = page.url().split("/").pop();
    const stored = await page.request.get(`/api/documents/${documentId}/`);
    expect(stored.status()).toBe(200);
    expect((await stored.json()).page_count).toBe(3);
  });

  test("accepts a PDF dropped onto the drop zone", async ({ page, isMobile }) => {
    test.skip(isMobile, "phones have no drag and drop");
    await page.goto("/");

    const dataTransfer = await page.evaluateHandle((bytes) => {
      const transfer = new DataTransfer();
      const file = new File([new Uint8Array(bytes)], "dropped.pdf", { type: "application/pdf" });
      transfer.items.add(file);
      return transfer;
    }, Array.from(examPdf));
    const dropzone = page.getByRole("region", { name: "PDF upload" });
    await dropzone.dispatchEvent("dragenter", { dataTransfer });
    await expect(page.getByText("Drop the PDF to upload it")).toBeVisible();
    await dropzone.dispatchEvent("drop", { dataTransfer });

    await expect(page).toHaveURL(/\/exams\/[0-9a-f-]{36}$/);
  });

  test("rejects a non-PDF in the browser", async ({ page }) => {
    await page.goto("/");

    await page
      .getByLabel("Exam PDF")
      .setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });

    await expect(page.getByRole("alert")).toContainText("This file is not a PDF");
    await expect(page).toHaveURL("/");
  });

  test("shows the server's verdict on a damaged PDF", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Exam PDF").setInputFiles({
      name: "broken.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\nthis is not really a PDF\n%%EOF"),
    });

    await expect(page.getByRole("alert")).toContainText("damaged or empty");
    await expect(page).toHaveURL("/");
  });
});
