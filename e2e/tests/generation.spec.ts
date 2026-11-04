import { expect, test, type APIRequestContext } from "@playwright/test";

import { csrfToken, uploadExam } from "./api";

const generation = {
  copies: 3,
  placements: {
    first: { x: 227, y: 661, font: "cmu-serif", font_size: 12 },
    odd: { x: 144, y: 780, font: "cmu-serif", font_size: 12 },
  },
};

async function waitUntilDone(request: APIRequestContext, jobId: string) {
  await expect
    .poll(async () => (await (await request.get(`/api/jobs/${jobId}/`)).json()).status, {
      timeout: 30_000,
    })
    .toBe("done");
  return (await request.get(`/api/jobs/${jobId}/`)).json();
}

test("upload, generate, download, and nothing is left afterwards", async ({
  request,
  browser,
  baseURL,
}) => {
  const document = await (await uploadExam(request)).json();

  const started = await request.post(`/api/documents/${document.id}/generate/`, {
    headers: { "X-CSRFToken": await csrfToken(request) },
    data: generation,
  });
  expect(started.status()).toBe(202);
  const job = await waitUntilDone(request, (await started.json()).id);
  expect(job.copies_done).toBe(3);
  expect(job.total_pages).toBe(12);

  const student = await browser.newContext({ baseURL });
  expect((await uploadExam(student.request)).status()).toBe(201);
  expect((await student.request.get(`/api/jobs/${job.id}/`)).status()).toBe(404);
  expect((await student.request.get(job.download_url)).status()).toBe(404);
  await student.close();

  const download = await request.get(job.download_url);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-disposition"]).toBe(
    'attachment; filename="exam-numbered.pdf"',
  );
  const pdf = await download.body();
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

  expect((await request.get(`/api/documents/${document.id}/`)).status()).toBe(404);
  expect((await request.get(job.download_url)).status()).toBe(404);
});
