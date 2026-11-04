import { expect, test } from "@playwright/test";

import { csrfToken } from "./api";

test("configs are versioned and shared between browsers", async ({
  browser,
  request,
  baseURL,
}, testInfo) => {
  const name = `E2E exam ${testInfo.project.name} ${Date.now()}`;
  const save = async (x: number) =>
    request.post("/api/configs/", {
      headers: { "X-CSRFToken": await csrfToken(request) },
      data: {
        name,
        placements: { first: { x, y: 661, font: "cmu-serif", font_size: 12 } },
      },
    });

  const v1 = await save(227);
  expect(v1.status()).toBe(201);
  const v2 = await save(300);
  expect((await v2.json()).version).toBe(2);

  const colleague = await browser.newContext({ baseURL });
  const listed = await (await colleague.request.get("/api/configs/")).json();
  const entry = listed.find((config: { name: string }) => config.name === name);
  expect(entry.version).toBe(2);
  expect(entry.placements.first.x).toBe(300);
  const old = await colleague.request.get(`/api/configs/${(await v1.json()).id}/`);
  expect((await old.json()).placements.first.x).toBe(227);
  await colleague.close();
});

test("the font files used for the PDF are served for the preview", async ({ request }) => {
  const fonts = await (await request.get("/api/fonts/")).json();
  expect(fonts.length).toBeLessThan(10);

  const file = await request.get(fonts[0].url);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toBe("font/ttf");
});
