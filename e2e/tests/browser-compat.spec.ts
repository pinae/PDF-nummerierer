/**
 * Browsers lag behind each other in new JavaScript built-ins. Safari, for
 * example, lacked Map.prototype.getOrInsertComputed, which the modern pdf.js
 * build calls without a fallback ("this.#t.getOrInsertComputed is not a
 * function"). This test removes such built-ins before the app loads, so
 * Chromium behaves like those browsers, and the app must still work.
 */
import { expect, test } from "@playwright/test";

import { examPdf } from "./api";

const RECENT_BUILT_INS = ["getOrInsertComputed", "getOrInsert"];

test("works in browsers without the newest JavaScript built-ins", async ({ page }) => {
  await page.addInitScript((names) => {
    for (const prototype of [Map.prototype, WeakMap.prototype]) {
      for (const name of names) Reflect.deleteProperty(prototype, name);
    }
  }, RECENT_BUILT_INS);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await page
    .getByLabel("Exam PDF")
    .setInputFiles({ name: "exam.pdf", mimeType: "application/pdf", buffer: examPdf });

  await expect(page.locator("canvas.react-pdf__Page__canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Number on/ })).toBeVisible();
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  expect(errors).toEqual([]);
});
