import { expect, test, type Page } from "@playwright/test";

async function backgroundOf(page: Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

const WHITE = "rgb(255, 255, 255)";
const DARK = "rgb(18, 18, 18)";

for (const [scheme, background] of [
  ["light", WHITE],
  ["dark", DARK],
] as const) {
  test.describe(`${scheme} color scheme`, () => {
    test.use({ colorScheme: scheme });

    test(`follows the browser preference (${scheme})`, async ({ page }, testInfo) => {
      await page.goto("/");

      expect(await backgroundOf(page)).toBe(background);
      await testInfo.attach(`${scheme}.png`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
    });
  });
}

test("switches live when the operating system changes its preference", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  expect(await backgroundOf(page)).toBe(WHITE);

  await page.emulateMedia({ colorScheme: "dark" });

  await expect.poll(() => backgroundOf(page)).toBe(DARK);
});
