import { expect, test } from "@playwright/test";

test("the app shell loads", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("PDF-Nummerierer");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "PDF-Nummerierer" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Number an exam" })).toBeVisible();
});

test("the backend is reachable through the frontend origin", async ({ request }) => {
  const response = await request.get("/api/health/");

  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("screens can be opened directly by URL", async ({ page }) => {
  // Deep links into a real exam's workspace are covered in viewer.spec.ts.
  await page.goto("/done");
  await expect(
    page.getByRole("heading", { level: 1, name: "Your copies are ready" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "PDF-Nummerierer" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Number an exam" })).toBeVisible();
});
