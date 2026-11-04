import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { DocumentInfo } from "../api/types";
import { strings } from "../strings";
import { renderRoute } from "../test/render";
import { server } from "../test/server";

const documentInfo: DocumentInfo = {
  id: "d1",
  name: "HCI exam.pdf",
  size: 2169,
  page_count: 3,
  page_sizes: [
    [595.28, 841.89],
    [595.28, 841.89],
    [595.28, 841.89],
  ],
  created_at: "2026-11-04T12:00:00+00:00",
  expires_at: "2026-11-04T14:00:00+00:00",
};

describe("workspace screen", () => {
  it("loads the exam and shows its pages", async () => {
    server.use(http.get("/api/documents/d1/", () => HttpResponse.json(documentInfo)));

    renderRoute("/exams/d1");

    expect(await screen.findByText("HCI exam.pdf")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: strings.workspace.title })).toBeVisible();
    expect(screen.getByTestId("pdf-document")).toHaveAttribute(
      "data-file",
      "/api/documents/d1/file/",
    );
    expect(screen.getByText("Page 1 of 3")).toBeVisible();
  });

  it("shows a loading indicator meanwhile", () => {
    server.use(http.get("/api/documents/d1/", () => new Promise<never>(() => undefined)));

    renderRoute("/exams/d1");

    expect(screen.getByRole("progressbar", { name: strings.workspace.loading })).toBeVisible();
  });

  it("explains that a deleted or expired exam is gone and offers a new upload", async () => {
    server.use(
      http.get("/api/documents/gone/", () =>
        HttpResponse.json({ error: { code: "not_found", message: "Not found." } }, { status: 404 }),
      ),
    );
    const { router } = renderRoute("/exams/gone");

    expect(
      await screen.findByRole("heading", { level: 1, name: strings.workspace.missingTitle }),
    ).toBeVisible();
    expect(screen.getByText(strings.workspace.missingText)).toBeVisible();
    await userEvent.click(screen.getByRole("link", { name: strings.workspace.uploadAgain }));
    expect(router.state.location.pathname).toBe("/");
  });

  it("explains other errors", async () => {
    server.use(http.get("/api/documents/d1/", () => HttpResponse.error()));

    renderRoute("/exams/d1");

    expect(await screen.findByRole("alert")).toHaveTextContent(strings.errors.network);
  });
});
