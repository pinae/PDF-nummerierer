import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startDownload } from "../generation/download";
import { timing } from "../generation/timing";
import { strings } from "../strings";
import { renderRoute } from "../test/render";
import { server } from "../test/server";

vi.mock("../generation/download", () => ({ startDownload: vi.fn() }));

const text = strings.done;
const originalTiming = { ...timing };
const finished = {
  documentId: "d1",
  fileName: "HCI exam-numbered.pdf",
  downloadUrl: "/api/jobs/j1/download/",
  copies: 30,
  totalPages: 120,
};

function documentExists(exists: () => boolean) {
  server.use(
    http.get("/api/documents/d1/", () =>
      exists()
        ? HttpResponse.json({ id: "d1" })
        : HttpResponse.json(
            { error: { code: "not_found", message: "Not found." } },
            { status: 404 },
          ),
    ),
  );
}

beforeEach(() => {
  document.cookie = "csrftoken=t; path=/";
  timing.documentPollMs = 10;
  vi.mocked(startDownload).mockClear();
});

afterEach(() => Object.assign(timing, originalTiming));

describe("done screen", () => {
  it("confirms the download and what it contains", () => {
    documentExists(() => true);

    renderRoute({ pathname: "/done", state: finished });

    expect(screen.getByRole("heading", { level: 1, name: text.title })).toBeVisible();
    expect(screen.getByText(text.started("HCI exam-numbered.pdf"))).toBeVisible();
    expect(screen.getByText(text.summary(30, 120))).toBeVisible();
    expect(screen.getByText(text.waiting)).toBeVisible();
  });

  it("confirms the deletion once the download has completed", async () => {
    let polls = 0;
    documentExists(() => ++polls < 3);

    renderRoute({ pathname: "/done", state: finished });

    expect(await screen.findByText(text.deleted)).toBeVisible();
    expect(screen.queryByRole("button", { name: text.deleteNow })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: text.downloadAgain })).not.toBeInTheDocument();
  });

  it("deletes everything at once on request", async () => {
    let exists = true;
    documentExists(() => exists);
    server.use(
      http.delete("/api/documents/d1/", () => {
        exists = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderRoute({ pathname: "/done", state: finished });

    await userEvent.click(screen.getByRole("button", { name: text.deleteNow }));

    expect(await screen.findByText(text.deleted)).toBeVisible();
    expect(exists).toBe(false);
  });

  it("can download again while the files still exist", async () => {
    documentExists(() => true);
    renderRoute({ pathname: "/done", state: finished });

    await userEvent.click(screen.getByRole("button", { name: text.downloadAgain }));

    expect(startDownload).toHaveBeenCalledWith("/api/jobs/j1/download/");
  });

  it("starts over with another exam", async () => {
    documentExists(() => false);
    const { router } = renderRoute({ pathname: "/done", state: finished });

    await userEvent.click(screen.getByRole("link", { name: text.another }));

    expect(router.state.location.pathname).toBe("/");
  });

  it("explains when there is nothing to show", async () => {
    const { router } = renderRoute("/done");

    expect(screen.getByText(text.nothing)).toBeVisible();
    await userEvent.click(screen.getByRole("link", { name: text.start }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });
});
