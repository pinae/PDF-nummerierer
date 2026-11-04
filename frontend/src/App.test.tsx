import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { strings } from "./strings";
import { renderRoute } from "./test/render";

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

  it("opens the workspace of an uploaded exam by URL", () => {
    renderRoute("/exams/0f5c6a1e-0000-4000-8000-000000000000");

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
