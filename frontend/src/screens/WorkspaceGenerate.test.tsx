/** WP10: numbers, copies, summary, "Number it!" with progress, then the download. */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Job } from "../api/types";
import { startDownload } from "../generation/download";
import { timing } from "../generation/timing";
import { strings } from "../strings";
import { renderRoute } from "../test/render";
import { defaultLimits, server } from "../test/server";

vi.mock("../generation/download", () => ({ startDownload: vi.fn() }));

const A4: [number, number] = [595.28, 841.89];
const text = strings.generation;
const originalTiming = { ...timing };

function mockDocument(pageCount = 3) {
  server.use(
    http.get("/api/documents/d1/", () =>
      HttpResponse.json({
        id: "d1",
        name: "HCI exam.pdf",
        size: 1,
        page_count: pageCount,
        page_sizes: Array.from({ length: pageCount }, () => A4),
        created_at: "2026-11-04T12:00:00+00:00",
        expires_at: "2026-11-04T14:00:00+00:00",
      }),
    ),
  );
}

async function openWorkspace(pageCount = 3) {
  mockDocument(pageCount);
  const result = renderRoute("/exams/d1");
  await screen.findByText("HCI exam.pdf");
  await waitFor(() => expect(numberIt()).toBeEnabled());
  return result;
}

const numberIt = () => screen.getByRole("button", { name: text.numberIt });
const field = (label: string) => screen.getByLabelText(label, { selector: "input" });

async function setField(label: string, value: string) {
  await userEvent.clear(field(label));
  if (value) await userEvent.type(field(label), value);
}

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

beforeEach(() => {
  document.cookie = "csrftoken=t; path=/";
  timing.jobPollMs = 10;
  timing.documentPollMs = 10;
  vi.mocked(startDownload).mockClear();
});

afterEach(() => Object.assign(timing, originalTiming));

describe("numbers and copies", () => {
  it("summarises the run before anything is generated", async () => {
    await openWorkspace();

    expect(screen.getByText(text.summary(1, 4, 4))).toBeVisible();
    expect(screen.getByText(text.paddingNote)).toBeVisible();
    expect(screen.getByRole("switch", { name: text.duplex })).toBeChecked();
  });

  it("updates the summary with copies and the duplex switch", async () => {
    await openWorkspace();

    await setField(text.copies, "30");
    expect(screen.getByText(text.summary(30, 4, 120))).toBeVisible();

    await userEvent.click(screen.getByRole("switch", { name: text.duplex }));
    expect(screen.getByText(text.summary(30, 3, 90))).toBeVisible();
    expect(screen.queryByText(text.paddingNote)).not.toBeInTheDocument();
  });

  it("needs no padding for documents with an even number of pages", async () => {
    await openWorkspace(4);

    expect(screen.getByText(text.summary(1, 4, 4))).toBeVisible();
    expect(screen.queryByText(text.paddingNote)).not.toBeInTheDocument();
  });

  it("shows the number range live and the widest number on the page", async () => {
    await openWorkspace();

    await setField(text.prefix, "A-");
    await userEvent.click(screen.getByRole("combobox", { name: text.digits }));
    await userEvent.click(await screen.findByRole("option", { name: "3" }));
    await setField(text.start, "5");
    await setField(text.copies, "30");

    expect(screen.getByText(text.sample("A-005", "A-034"))).toBeVisible();
    expect(screen.getByRole("button", { name: /^Number on/ })).toHaveTextContent("A-034");
  });

  it("refuses runs above the page limit", async () => {
    server.use(
      http.get("/api/limits/", () => HttpResponse.json({ ...defaultLimits, max_output_pages: 50 })),
    );
    await openWorkspace();

    await setField(text.copies, "30");

    expect(screen.getByText(text.tooManyPages("50"))).toBeVisible();
    expect(numberIt()).toBeDisabled();
  });

  it.each(["0", "10000", ""])("refuses %j copies", async (copies) => {
    await openWorkspace();

    await setField(text.copies, copies);

    expect(numberIt()).toBeDisabled();
    expect(screen.getByText(text.copiesRange(9999))).toBeVisible();
  });
});

describe("Number it!", () => {
  it("generates with the current settings, shows progress and starts the download", async () => {
    let posted: unknown;
    let current = job({ stage: "stamping", copies_done: 37 });
    server.use(
      http.post("/api/documents/d1/generate/", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(job({ status: "pending", stage: "" }), { status: 202 });
      }),
      http.get("/api/jobs/j1/", () => HttpResponse.json(current)),
    );
    const { router } = await openWorkspace();
    await setField(text.copies, "200");

    await userEvent.click(numberIt());

    const dialog = await screen.findByRole("dialog", { name: text.progressTitle });
    expect(await within(dialog).findByText(text.stages.stamping(37, 200))).toBeVisible();
    expect(within(dialog).getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      String(5 + Math.round((37 / 200) * 85)),
    );

    current = job({ stage: "writing", copies_done: 200 });
    expect(await within(dialog).findByText(text.stages.writing)).toBeVisible();

    current = job({
      status: "done",
      stage: "done",
      copies_done: 200,
      download_url: "/api/jobs/j1/download/",
    });
    await waitFor(() => expect(router.state.location.pathname).toBe("/done"));
    expect(startDownload).toHaveBeenCalledWith("/api/jobs/j1/download/");
    expect(posted).toMatchObject({
      copies: 200,
      start: 1,
      pad_to_even: true,
      number_format: { prefix: "", digits: 4, suffix: "" },
      placements: { first: expect.objectContaining({ font: "cmu-serif" }) },
    });
    expect(router.state.location.state).toMatchObject({
      documentId: "d1",
      fileName: "HCI exam-numbered.pdf",
      downloadUrl: "/api/jobs/j1/download/",
      copies: 200,
      totalPages: 800,
    });
  });

  it("explains a failed generation and lets the user try again", async () => {
    server.use(
      http.post("/api/documents/d1/generate/", () =>
        HttpResponse.json(job({ status: "pending", stage: "" }), { status: 202 }),
      ),
      http.get("/api/jobs/j1/", () =>
        HttpResponse.json(
          job({
            status: "failed",
            error: { code: "generation_failed", message: "The PDF could not be read." },
          }),
        ),
      ),
    );
    await openWorkspace();

    await userEvent.click(numberIt());

    const dialog = await screen.findByRole("dialog", { name: text.progressTitle });
    expect(await within(dialog).findByText("The PDF could not be read.")).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: text.close }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(numberIt()).toBeEnabled();
    expect(startDownload).not.toHaveBeenCalled();
  });

  it.each([
    [409, { code: "job_running", message: "Your copies are still being generated." }],
    [
      400,
      {
        code: "invalid",
        message: "Some values are not valid.",
        fields: { "number_format.prefix": ["Caveat cannot print these characters: 中"] },
      },
    ],
  ])("shows why the server refused to start (%d)", async (status, error) => {
    server.use(
      http.post("/api/documents/d1/generate/", () => HttpResponse.json({ error }, { status })),
    );
    await openWorkspace();

    await userEvent.click(numberIt());

    const dialog = await screen.findByRole("dialog", { name: text.progressTitle });
    const expected = "fields" in error ? /Caveat cannot print/ : error.message;
    expect(await within(dialog).findByText(expected)).toBeVisible();
  });
});
