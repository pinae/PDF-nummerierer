import { readFileSync } from "node:fs";

import type { APIRequestContext } from "@playwright/test";

export const examPdf = readFileSync(new URL("../fixtures/exam.pdf", import.meta.url));

export async function csrfToken(request: APIRequestContext): Promise<string> {
  await request.get("/api/csrf/");
  const { cookies } = await request.storageState();
  const token = cookies.find((cookie) => cookie.name === "csrftoken")?.value;
  if (!token) throw new Error("No csrftoken cookie was set");
  return token;
}

export async function uploadExam(request: APIRequestContext) {
  return request.post("/api/documents/", {
    headers: { "X-CSRFToken": await csrfToken(request) },
    multipart: {
      file: { name: "exam.pdf", mimeType: "application/pdf", buffer: examPdf },
    },
  });
}
