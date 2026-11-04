import { describe, expect, it } from "vitest";

import type { Job } from "../api/types";
import { strings } from "../strings";
import { progressOf, runSummary } from "./progress";

const job = (overrides: Partial<Job>): Job => ({
  id: "j1",
  document_id: "d1",
  status: "running",
  stage: "stamping",
  copies_done: 0,
  copies_total: 200,
  total_pages: 800,
  error: null,
  download_url: null,
  created_at: "2026-11-04T12:00:00+00:00",
  finished_at: null,
  ...overrides,
});

const text = strings.generation;

describe("progressOf", () => {
  it("waits before the worker starts", () => {
    expect(progressOf(job({ status: "pending", stage: "" }))).toEqual({
      label: text.stages.waiting,
      percent: 0,
    });
  });

  it("prepares", () => {
    expect(progressOf(job({ stage: "preparing" }))).toEqual({
      label: text.stages.preparing,
      percent: 2,
    });
  });

  it("counts copies while stamping", () => {
    expect(progressOf(job({ stage: "stamping", copies_done: 37 }))).toEqual({
      label: text.stages.stamping(37, 200),
      percent: 5 + Math.round((37 / 200) * 85),
    });
  });

  it("assembles the PDF at the end", () => {
    expect(progressOf(job({ stage: "writing", copies_done: 200 }))).toEqual({
      label: text.stages.writing,
      percent: 92,
    });
  });

  it("is complete when done", () => {
    expect(progressOf(job({ status: "done", stage: "done", copies_done: 200 })).percent).toBe(100);
  });

  it("never goes backwards within a stage", () => {
    const values = [0, 50, 100, 199, 200].map(
      (done) => progressOf(job({ stage: "stamping", copies_done: done })).percent,
    );
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });
});

describe("runSummary", () => {
  it("adds a blank page to odd-length copies for duplex printing", () => {
    expect(runSummary({ copies: 30, pageCount: 3, padToEven: true })).toEqual({
      pagesPerCopy: 4,
      totalPages: 120,
      padded: true,
    });
  });

  it("adds nothing when switched off or already even", () => {
    expect(runSummary({ copies: 30, pageCount: 3, padToEven: false }).totalPages).toBe(90);
    expect(runSummary({ copies: 30, pageCount: 4, padToEven: true })).toEqual({
      pagesPerCopy: 4,
      totalPages: 120,
      padded: false,
    });
  });
});
