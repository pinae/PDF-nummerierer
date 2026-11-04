/** Fonts are large (≈ 4 MB together): load only those in use, the rest on demand. */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { strings } from "../strings";
import { renderRoute } from "../test/render";
import { server } from "../test/server";

const loaded: string[] = [];

class FakeFontFace {
  readonly family: string;
  constructor(family: string, source: string) {
    this.family = family;
    loaded.push(source.replace(/^url\((.*)\)$/, "$1"));
  }
  load() {
    return Promise.resolve(this);
  }
}

beforeEach(() => {
  loaded.length = 0;
  vi.stubGlobal("FontFace", FakeFontFace);
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { add: () => undefined, check: () => true, ready: Promise.resolve() },
  });
  server.use(
    http.get("/api/documents/d1/", () =>
      HttpResponse.json({
        id: "d1",
        name: "exam.pdf",
        size: 1,
        page_count: 3,
        page_sizes: Array.from({ length: 3 }, () => [595.28, 841.89]),
        created_at: "2026-11-04T12:00:00+00:00",
        expires_at: "2026-11-04T14:00:00+00:00",
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error -- remove the test double again
  delete document.fonts;
});

describe("font loading", () => {
  it("loads only the fonts in use when the workspace opens", async () => {
    renderRoute("/exams/d1");
    await screen.findByText("exam.pdf");

    await waitFor(() => expect(loaded).toEqual(["/api/fonts/cmu-serif.ttf"]));
  });

  it("loads the other fonts when the font menu is opened", async () => {
    renderRoute("/exams/d1");
    await screen.findByText("exam.pdf");
    const picker = screen.getByRole("combobox", { name: strings.placement.font });
    await waitFor(() => expect(picker).toBeEnabled());

    await userEvent.click(picker);

    await waitFor(() =>
      expect([...loaded].sort()).toEqual([
        "/api/fonts/caveat.ttf",
        "/api/fonts/cmu-serif.ttf",
        "/api/fonts/dejavu-sans.ttf",
      ]),
    );
  });
});
