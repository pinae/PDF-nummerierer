/** Abandoned uploads are cleaned up; the user can also delete an upload at once. */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { timing } from "../generation/timing";
import { strings } from "../strings";
import { renderRoute } from "../test/render";
import { server } from "../test/server";

const text = strings.workspace;
const originalTiming = { ...timing };
let keepAlives = 0;
let deleted = false;

beforeEach(() => {
  keepAlives = 0;
  deleted = false;
  document.cookie = "csrftoken=t; path=/";
  timing.keepAliveMs = 20;
  timing.documentPollMs = 10;
  server.use(
    http.get("/api/documents/d1/", () =>
      deleted
        ? HttpResponse.json({ error: { code: "not_found", message: "Gone." } }, { status: 404 })
        : HttpResponse.json({
            id: "d1",
            name: "HCI exam.pdf",
            size: 1,
            page_count: 3,
            page_sizes: Array.from({ length: 3 }, () => [595.28, 841.89]),
            created_at: "2026-11-04T12:00:00+00:00",
            expires_at: "2026-11-04T14:00:00+00:00",
          }),
    ),
    http.post("/api/documents/d1/keepalive/", () => {
      keepAlives += 1;
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete("/api/documents/d1/", () => {
      deleted = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
});

afterEach(() => Object.assign(timing, originalTiming));

async function openWorkspace() {
  const result = renderRoute("/exams/d1");
  await screen.findByText("HCI exam.pdf");
  return result;
}

describe("keeping an open exam alive", () => {
  it("tells the server at once and then regularly that the exam is still open", async () => {
    await openWorkspace();

    await waitFor(() => expect(keepAlives).toBeGreaterThanOrEqual(3));
  });

  it("stops when the user leaves, so an abandoned upload expires", async () => {
    await openWorkspace();
    await waitFor(() => expect(keepAlives).toBeGreaterThanOrEqual(1));

    await userEvent.click(screen.getByRole("link", { name: "PDF-Nummerierer" }));
    const afterLeaving = keepAlives;
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(keepAlives).toBe(afterLeaving);
  });

  it("keeps the exam alive on the done screen until the download completed", async () => {
    renderRoute({
      pathname: "/done",
      state: {
        documentId: "d1",
        fileName: "HCI exam-numbered.pdf",
        downloadUrl: "/api/jobs/j1/download/",
        copies: 1,
        totalPages: 4,
      },
    });
    await waitFor(() => expect(keepAlives).toBeGreaterThanOrEqual(2));

    deleted = true;
    await screen.findByText(strings.done.deleted);
    const afterDeletion = keepAlives;
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(keepAlives).toBe(afterDeletion);
  });
});

describe("deleting the uploaded PDF", () => {
  it("deletes it immediately after a confirmation and returns to the upload page", async () => {
    const { router } = await openWorkspace();

    await userEvent.click(screen.getByRole("button", { name: text.deletePdf }));
    const dialog = await screen.findByRole("dialog", { name: text.deleteTitle });
    expect(within(dialog).getByText(text.deleteText("HCI exam.pdf"))).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: text.deleteConfirm }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(deleted).toBe(true);
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("keeps everything when the user cancels", async () => {
    const { router } = await openWorkspace();

    await userEvent.click(screen.getByRole("button", { name: text.deletePdf }));
    const dialog = await screen.findByRole("dialog", { name: text.deleteTitle });
    await userEvent.click(within(dialog).getByRole("button", { name: text.cancel }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(deleted).toBe(false);
    expect(router.state.location.pathname).toBe("/exams/d1");
  });

  it("returns to the upload page if the PDF was already gone", async () => {
    server.use(
      http.delete("/api/documents/d1/", () =>
        HttpResponse.json({ error: { code: "not_found", message: "Gone." } }, { status: 404 }),
      ),
    );
    const { router } = await openWorkspace();

    await userEvent.click(screen.getByRole("button", { name: text.deletePdf }));
    await userEvent.click(
      within(await screen.findByRole("dialog", { name: text.deleteTitle })).getByRole("button", {
        name: text.deleteConfirm,
      }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("explains when deleting failed and stays", async () => {
    server.use(http.delete("/api/documents/d1/", () => HttpResponse.error()));
    const { router } = await openWorkspace();

    await userEvent.click(screen.getByRole("button", { name: text.deletePdf }));
    const dialog = await screen.findByRole("dialog", { name: text.deleteTitle });
    await userEvent.click(within(dialog).getByRole("button", { name: text.deleteConfirm }));

    expect(await within(dialog).findByText(strings.errors.network)).toBeVisible();
    expect(router.state.location.pathname).toBe("/exams/d1");
  });
});
