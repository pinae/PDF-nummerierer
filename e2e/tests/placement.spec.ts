import { expect, test, type Page } from "@playwright/test";

import { examPdf } from "./api";

async function openWorkspace(page: Page) {
  await page.goto("/");
  await page
    .getByLabel("Exam PDF")
    .setInputFiles({ name: "exam.pdf", mimeType: "application/pdf", buffer: examPdf });
  await expect(page.locator("canvas.react-pdf__Page__canvas")).toBeVisible();
  // On phones the settings start collapsed below the page.
  const settings = page.getByRole("button", { name: "Number settings" });
  if ((await settings.isVisible()) && (await settings.getAttribute("aria-expanded")) === "false") {
    await settings.click();
  }
}

const marker = (page: Page) => page.getByRole("button", { name: /^Number on/ });

/** Position in mm as shown in the exact-position fields. */
async function positionMm(page: Page) {
  const exact = page.getByRole("button", { name: "Exact position" });
  if ((await exact.getAttribute("aria-expanded")) !== "true") await exact.click();
  return {
    left: Number(await page.getByLabel("From left", { exact: true }).inputValue()),
    bottom: Number(await page.getByLabel("From bottom", { exact: true }).inputValue()),
  };
}

test.describe("placing the number", () => {
  test("shows the number on the page in the bundled font", async ({ page }) => {
    await openWorkspace(page);

    await expect(marker(page)).toBeVisible();
    await expect(marker(page).getByText("0001")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.fonts.check('12px "pdfnum-cmu-serif"')))
      .toBe(true);
  });

  test("the number shows on all pages of a type and can be switched off", async ({ page }) => {
    await openWorkspace(page);

    await page.getByRole("button", { name: /^Odd pages/ }).click();
    await expect(marker(page)).toBeVisible();
    await page.getByRole("switch", { name: "Number on odd pages" }).click();

    await expect(marker(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Odd pages/ })).toContainText("off");
    await page.getByRole("button", { name: /^First page/ }).click();
    await expect(marker(page)).toBeVisible();
  });

  test("drags the number with the mouse", async ({ page, isMobile }) => {
    test.skip(isMobile, "phones use presets, nudge buttons and the mm fields");
    await openWorkspace(page);
    const before = await positionMm(page);
    const box = (await marker(page).boundingBox())!;

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 100, box.y + 150, { steps: 5 });
    await page.mouse.up();

    const after = await positionMm(page);
    expect(after.left).toBeLessThan(before.left - 10);
    expect(after.bottom).toBeLessThan(before.bottom - 10);
  });

  test("moves with the keyboard", async ({ page, isMobile }) => {
    test.skip(isMobile, "no hardware keyboard on phones");
    await openWorkspace(page);
    const before = await positionMm(page);

    await marker(page).focus();
    await page.keyboard.press("Shift+ArrowLeft");
    await page.keyboard.press("Shift+ArrowDown");

    const after = await positionMm(page);
    expect(after.left).toBeCloseTo(before.left - 3.5, 0);
    expect(after.bottom).toBeCloseTo(before.bottom - 3.5, 0);
  });

  test("uses presets, nudge buttons and exact millimetres", async ({ page }) => {
    await openWorkspace(page);

    await page.getByRole("button", { name: "Bottom left" }).click();
    expect(await positionMm(page)).toEqual({ left: 10, bottom: 10 });

    await page.getByRole("button", { name: "Move right 1 mm" }).click();
    expect((await positionMm(page)).left).toBe(11);

    await page.getByLabel("From bottom", { exact: true }).fill("42.5");
    await page.getByLabel("From left", { exact: true }).click();
    expect((await positionMm(page)).bottom).toBe(42.5);
  });
});

test("on phones the settings start collapsed so the page gets the room", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "phone layout only");
  await page.goto("/");
  await page
    .getByLabel("Exam PDF")
    .setInputFiles({ name: "exam.pdf", mimeType: "application/pdf", buffer: examPdf });

  const settings = page.getByRole("button", { name: "Number settings" });
  await expect(settings).toHaveAttribute("aria-expanded", "false");
  await settings.click();
  await expect(page.getByRole("switch", { name: "Number on the first page" })).toBeVisible();
});
