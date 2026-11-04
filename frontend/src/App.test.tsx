import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { strings } from "./strings";
import { renderRoute } from "./test/render";
import { server } from "./test/server";

describe("app shell and routing", () => {
  it("shows the app name in the header on every screen", () => {
    renderRoute("/");

    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: "PDF-Nummerierer" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("starts on the upload screen", () => {
    renderRoute("/");

    expect(screen.getByRole("heading", { level: 1, name: strings.upload.title })).toBeVisible();
    expect(screen.getByText(/serial numbers/i)).toBeVisible();
  });

  it("opens the workspace of an uploaded exam by URL", async () => {
    const id = "0f5c6a1e-0000-4000-8000-000000000000";
    server.use(
      http.get(`/api/documents/${id}/`, () =>
        HttpResponse.json({
          id,
          name: "exam.pdf",
          size: 1,
          page_count: 1,
          page_sizes: [[595.28, 841.89]],
          created_at: "2026-11-04T12:00:00+00:00",
          expires_at: "2026-11-04T14:00:00+00:00",
        }),
      ),
    );

    renderRoute(`/exams/${id}`);

    expect(await screen.findByText("exam.pdf")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: strings.workspace.title })).toBeVisible();
  });

  it("has a done screen", () => {
    renderRoute("/done");

    expect(screen.getByRole("heading", { level: 1, name: strings.done.title })).toBeVisible();
  });

  it("sends unknown URLs to the upload screen", () => {
    const { router } = renderRoute("/no/such/page");

    expect(router.state.location.pathname).toBe("/");
    expect(screen.getByRole("heading", { level: 1, name: strings.upload.title })).toBeVisible();
  });

  it("returns to the start via the app name", async () => {
    const { router } = renderRoute("/done");

    await userEvent.click(screen.getByRole("link", { name: "PDF-Nummerierer" }));

    expect(router.state.location.pathname).toBe("/");
  });

  it("has exactly one main landmark", () => {
    renderRoute("/");

    expect(screen.getAllByRole("main")).toHaveLength(1);
  });
});
