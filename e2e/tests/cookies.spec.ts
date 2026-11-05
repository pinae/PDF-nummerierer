import { expect, test } from "@playwright/test";

/**
 * Chromium and Firefox keep `Secure` cookies on http://127.0.0.1 and
 * http://localhost, WebKit (Safari) drops them: without its CSRF cookie and
 * session every upload is rejected. So over plain HTTP (tests, a local trial)
 * the cookies must not be `Secure`, over HTTPS (a real deployment) they must.
 */
test("the CSRF cookie is stored and marked Secure exactly on HTTPS", async ({
  page,
  context,
  baseURL,
}) => {
  await page.goto("/");
  await page.evaluate(() => fetch("/api/csrf/", { credentials: "same-origin" }));

  const csrf = (await context.cookies()).find((cookie) => cookie.name === "csrftoken");
  expect(csrf, "the browser keeps the CSRF cookie").toBeDefined();
  expect(csrf!.secure, "Secure flag matches the scheme").toBe(baseURL!.startsWith("https:"));
});
