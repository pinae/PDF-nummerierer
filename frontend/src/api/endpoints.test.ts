import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { server } from "../test/server";
import {
  deleteDocument,
  getDocument,
  getJob,
  listConfigs,
  listFonts,
  saveConfig,
  startGeneration,
} from "./endpoints";
import type { DocumentInfo, Job, NumberingConfig } from "./types";

const documentInfo: DocumentInfo = {
  id: "d1",
  name: "exam.pdf",
  size: 2169,
  page_count: 3,
  page_sizes: [[595.28, 841.89]],
  created_at: "2026-11-04T12:00:00+00:00",
  expires_at: "2026-11-04T14:00:00+00:00",
};

const config: NumberingConfig = {
  id: "c1",
  name: "HCI Exam",
  version: 2,
  created_at: "2026-11-04T12:00:00+00:00",
  number_format: { prefix: "", digits: 4, suffix: "" },
  placements: {
    first: { x: 227, y: 661, font: "cmu-serif", font_size: 12 },
    odd: null,
    even: null,
  },
};

beforeEach(() => {
  document.cookie = "csrftoken=t; path=/";
});

describe("endpoints", () => {
  it("reads and deletes documents", async () => {
    let deleted = false;
    server.use(
      http.get("/api/documents/d1/", () => HttpResponse.json(documentInfo)),
      http.delete("/api/documents/d1/", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(getDocument("d1")).resolves.toEqual(documentInfo);
    await deleteDocument("d1");
    expect(deleted).toBe(true);
  });

  it("lists and saves configs", async () => {
    let saved: unknown;
    server.use(
      http.get("/api/configs/", () => HttpResponse.json([config])),
      http.post("/api/configs/", async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json(config, { status: 201 });
      }),
    );

    await expect(listConfigs()).resolves.toEqual([config]);
    const draft = {
      name: config.name,
      number_format: config.number_format,
      placements: config.placements,
    };
    await expect(saveConfig(draft)).resolves.toEqual(config);
    expect(saved).toEqual(draft);
  });

  it("starts a generation and polls the job", async () => {
    const job: Job = {
      id: "j1",
      document_id: "d1",
      status: "running",
      stage: "stamping",
      copies_done: 3,
      copies_total: 30,
      total_pages: 120,
      error: null,
      download_url: null,
      created_at: "2026-11-04T12:00:00+00:00",
      finished_at: null,
    };
    let body: unknown;
    server.use(
      http.post("/api/documents/d1/generate/", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(job, { status: 202 });
      }),
      http.get("/api/jobs/j1/", () => HttpResponse.json(job)),
    );
    const request = {
      copies: 30,
      start: 1,
      pad_to_even: true,
      number_format: config.number_format,
      placements: config.placements,
    };

    await expect(startGeneration("d1", request)).resolves.toEqual(job);
    expect(body).toEqual(request);
    await expect(getJob("j1")).resolves.toEqual(job);
  });

  it("lists fonts", async () => {
    const fonts = [
      { id: "caveat", label: "Caveat", category: "handwritten", url: "/api/fonts/caveat.ttf" },
    ];
    server.use(http.get("/api/fonts/", () => HttpResponse.json(fonts)));

    await expect(listFonts()).resolves.toEqual(fonts);
  });

  it("encodes ids in paths", async () => {
    server.use(
      http.get("/api/documents/a%2Fb/", () => HttpResponse.json({ ...documentInfo, id: "a/b" })),
    );

    await expect(getDocument("a/b")).resolves.toMatchObject({ id: "a/b" });
  });
});
