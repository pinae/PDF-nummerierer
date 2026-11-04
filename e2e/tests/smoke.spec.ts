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
  await page.goto("/exams/0f5c6a1e-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { level: 1, name: "Place the number" })).toBeVisible();

  await page.getByRole("link", { name: "PDF-Nummerierer" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Number an exam" })).toBeVisible();
});
