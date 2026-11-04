import { expect, test, type Browser } from "@playwright/test";

import { csrfToken, examPdf, uploadExam } from "./api";

/** A separate browser profile, e.g. a student trying to reach the professor's exam. */
async function otherBrowser(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL });
  return { context, request: context.request };
}

test.describe("uploaded exams are private to the uploading browser", () => {
  test("another browser cannot read or delete an uploaded exam", async ({
    browser,
    request,
    baseURL,
  }) => {
    const uploaded = await uploadExam(request);
    expect(uploaded.status()).toBe(201);
    const { id, page_count } = await uploaded.json();
    expect(page_count).toBe(3);

    const ownFile = await request.get(`/api/documents/${id}/file/`);
    expect(ownFile.status()).toBe(200);
    expect(Buffer.compare(await ownFile.body(), examPdf)).toBe(0);

    // The student uploads a file too, so their session is a fully valid one.
    const student = await otherBrowser(browser, baseURL);
    expect((await uploadExam(student.request)).status()).toBe(201);
    for (const path of [`/api/documents/${id}/`, `/api/documents/${id}/file/`]) {
      expect((await student.request.get(path)).status()).toBe(404);
    }
    const deleteAttempt = await student.request.delete(`/api/documents/${id}/`, {
      headers: { "X-CSRFToken": await csrfToken(student.request) },
    });
    expect(deleteAttempt.status()).toBe(404);
    await student.context.close();

    expect((await request.get(`/api/documents/${id}/`)).status()).toBe(200);
  });

  test("the owner can delete the exam immediately", async ({ request }) => {
    const { id } = await (await uploadExam(request)).json();

    const deleted = await request.delete(`/api/documents/${id}/`, {
      headers: { "X-CSRFToken": await csrfToken(request) },
    });

    expect(deleted.status()).toBe(204);
    expect((await request.get(`/api/documents/${id}/file/`)).status()).toBe(404);
  });

  test("uploads without CSRF token are rejected", async ({ request }) => {
    const response = await request.post("/api/documents/", {
      multipart: {
        file: { name: "exam.pdf", mimeType: "application/pdf", buffer: examPdf },
      },
    });

    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe("csrf_failed");
  });
});
