import { expect, test } from "@playwright/test";

test("the app shell loads", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("PDF-Nummerierer");
  await expect(page.getByRole("heading", { level: 1, name: "PDF-Nummerierer" })).toBeVisible();
});

test("the backend is reachable through the frontend origin", async ({ request }) => {
  const response = await request.get("/api/health/");

  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "ok" });
});
