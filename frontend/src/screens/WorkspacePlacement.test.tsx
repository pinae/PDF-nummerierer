/** WP8: placing the number on first, odd and even pages. */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { mmToPt, ptToMm, toPixels, toPoints } from "../pdf/coordinates";
import { measureText } from "../placement/measure";
import { strings } from "../strings";
import { renderRoute } from "../test/render";
import { server } from "../test/server";
import { TEST_VIEWPORT } from "../test/viewport";
import { resolveScale } from "../viewer/zoom";

const A4 = { width: 595.28, height: 841.89 };
const SCALE = resolveScale({ kind: "fit-page" }, A4, TEST_VIEWPORT);
const text = strings.placement;

async function openWorkspace(pageCount = 5) {
  server.use(
    http.get("/api/documents/d1/", () =>
      HttpResponse.json({
        id: "d1",
        name: "exam.pdf",
        size: 1,
        page_count: pageCount,
        page_sizes: Array.from({ length: pageCount }, () => [A4.width, A4.height]),
        created_at: "2026-11-04T12:00:00+00:00",
        expires_at: "2026-11-04T14:00:00+00:00",
      }),
    ),
  );
  const result = renderRoute("/exams/d1");
  await screen.findByText("exam.pdf");
  // Fonts load asynchronously; wait until the picker shows them.
  await waitFor(() => expect(screen.getByRole("combobox", { name: text.font })).toBeEnabled());
  return result;
}

const marker = () => screen.getByRole("button", { name: /^Number on/ });
const stampText = () => screen.getByText("0001");
const surface = () => screen.getByTestId("placement-surface");
/** A page-type button; its name gains "off" when that page type gets no number. */
const roleButton = (name: string) =>
  within(screen.getByRole("group", { name: text.rolesLabel })).getByRole("button", {
    name: new RegExp(`^${name}`),
  });
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

async function openExactPosition() {
  await userEvent.click(screen.getByRole("button", { name: text.exactPosition }));
}

/** Exact current position in points, read from the marker on the page. */
function position() {
  return toPoints(
    { left: Number(stampText().getAttribute("x")), top: Number(stampText().getAttribute("y")) },
    A4,
    SCALE,
  );
}

/** The millimetre field shows the position rounded to 0.1 mm. */
function expectMm(label: string, pt: number) {
  expect(Math.abs(Number(field(label).value) - ptToMm(pt))).toBeLessThanOrEqual(0.051);
}

describe("number placement", () => {
  it("shows the number on the page in the chosen font at true size", async () => {
    await openWorkspace();

    expect(stampText()).toHaveAttribute("font-family", expect.stringContaining("pdfnum-cmu-serif"));
    expect(Number(stampText().getAttribute("font-size"))).toBeCloseTo(12 * SCALE, 6);
  });

  it("places the text baseline exactly where the PDF output puts it", async () => {
    await openWorkspace();
    await openExactPosition();
    const x = mmToPt(Number(field(text.fromLeft).value));
    const y = mmToPt(Number(field(text.fromBottom).value));

    const pixel = toPixels({ x, y }, A4, SCALE);
    // Fields show 0.1 mm, so compare with that precision.
    expect(Number(stampText().getAttribute("x"))).toBeCloseTo(pixel.left, 0);
    expect(Number(stampText().getAttribute("y"))).toBeCloseTo(pixel.top, 0);
  });

  it("switches between page types and jumps to a page of that type", async () => {
    await openWorkspace();
    expect(roleButton(text.roles.first)).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(roleButton(text.roles.odd));
    expect(screen.getByRole("status")).toHaveTextContent("Page 3 of 5");

    await userEvent.click(screen.getByRole("button", { name: strings.viewer.next }));
    expect(roleButton(text.roles.even)).toHaveAttribute("aria-pressed", "true");
  });

  it("can switch the number off for one page type and back on at the same place", async () => {
    await openWorkspace();
    await userEvent.click(roleButton(text.roles.odd));
    const before = stampText().getAttribute("x");

    await userEvent.click(screen.getByRole("switch", { name: text.enable.odd }));
    expect(screen.queryByText("0001")).not.toBeInTheDocument();
    expect(roleButton(text.roles.odd)).toHaveTextContent(text.off);

    await userEvent.click(roleButton(text.roles.first));
    expect(stampText()).toBeInTheDocument();

    await userEvent.click(roleButton(text.roles.odd));
    await userEvent.click(screen.getByRole("switch", { name: text.enable.odd }));
    expect(stampText()).toHaveAttribute("x", before);
  });

  it("shows the number on every page of a type", async () => {
    await openWorkspace();
    await userEvent.click(roleButton(text.roles.odd));
    const onPage3 = stampText().getAttribute("x");

    await userEvent.click(screen.getByRole("button", { name: strings.viewer.next }));
    await userEvent.click(screen.getByRole("button", { name: strings.viewer.next }));

    expect(screen.getByRole("status")).toHaveTextContent("Page 5 of 5");
    expect(stampText()).toHaveAttribute("x", onPage3);
  });

  it("puts the number at a preset position", async () => {
    await openWorkspace();

    await userEvent.click(screen.getByRole("button", { name: text.presets["bottom-left"] }));

    await openExactPosition();
    expectMm(text.fromLeft, mmToPt(10));
    expectMm(text.fromBottom, mmToPt(10));
  });

  it("uses the margin for presets", async () => {
    await openWorkspace();
    const margin = field(text.margin);

    await userEvent.clear(margin);
    await userEvent.type(margin, "20");
    await userEvent.click(screen.getByRole("button", { name: text.presets["bottom-left"] }));

    await openExactPosition();
    expectMm(text.fromLeft, mmToPt(20));
  });

  it("centres the number where the page is clicked", async () => {
    await openWorkspace();

    fireEvent.click(surface(), { clientX: 300, clientY: 400 });

    const clicked = toPoints({ left: 300, top: 400 }, A4, SCALE);
    const metrics = measureText("0001", "cmu-serif", 12);
    await openExactPosition();
    expectMm(text.fromLeft, clicked.x - metrics.width / 2);
    expectMm(text.fromBottom, clicked.y - metrics.ascent / 2);
  });

  it("clicking a page whose type is switched off switches it on there", async () => {
    await openWorkspace();
    await userEvent.click(screen.getByRole("switch", { name: text.enable.first }));

    fireEvent.click(surface(), { clientX: 300, clientY: 400 });

    expect(stampText()).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: text.enable.first })).toBeChecked();
  });

  it("moves the number by dragging it", async () => {
    await openWorkspace();
    const start = position();

    // Left and down: the default position is top right, near the page edges.
    fireEvent.pointerDown(marker(), { clientX: 100, clientY: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(marker(), { clientX: 50, clientY: 180, pointerId: 1 });
    fireEvent.pointerUp(marker(), { clientX: 50, clientY: 180, pointerId: 1 });

    await openExactPosition();
    expectMm(text.fromLeft, start.x - 50 / SCALE);
    expectMm(text.fromBottom, start.y - 80 / SCALE);
  });

  it("Escape cancels a drag", async () => {
    await openWorkspace();
    const start = position();

    fireEvent.pointerDown(marker(), { clientX: 100, clientY: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(marker(), { clientX: 20, clientY: 300, pointerId: 1 });
    fireEvent.keyDown(marker(), { key: "Escape" });
    fireEvent.pointerUp(marker(), { clientX: 20, clientY: 300, pointerId: 1 });

    await openExactPosition();
    expectMm(text.fromLeft, start.x);
    expectMm(text.fromBottom, start.y);
  });

  it("nudges with the arrow keys: 1 pt, or 10 pt with Shift", async () => {
    await openWorkspace();
    const start = position();

    marker().focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{Shift>}{ArrowUp}{/Shift}");

    await openExactPosition();
    expectMm(text.fromLeft, start.x + 2);
    expectMm(text.fromBottom, start.y + 10);
  });

  it("nudges with buttons in 1 mm steps (for touch screens)", async () => {
    await openWorkspace();
    const start = position();

    await userEvent.click(screen.getByRole("button", { name: text.nudge.left }));
    await userEvent.click(screen.getByRole("button", { name: text.nudge.down }));

    await openExactPosition();
    expectMm(text.fromLeft, start.x - mmToPt(1));
    expectMm(text.fromBottom, start.y - mmToPt(1));
  });

  it("moves the number when exact millimetres are typed", async () => {
    await openWorkspace();
    await openExactPosition();

    await userEvent.clear(field(text.fromLeft));
    await userEvent.type(field(text.fromLeft), "50");
    await userEvent.clear(field(text.fromBottom));
    await userEvent.type(field(text.fromBottom), "25.5");

    const pixel = toPixels({ x: mmToPt(50), y: mmToPt(25.5) }, A4, SCALE);
    expect(Number(stampText().getAttribute("x"))).toBeCloseTo(pixel.left, 6);
    expect(Number(stampText().getAttribute("y"))).toBeCloseTo(pixel.top, 6);
  });

  it("changes font and size of one page type", async () => {
    await openWorkspace();

    await userEvent.click(screen.getByRole("combobox", { name: text.font }));
    await userEvent.click(await screen.findByRole("option", { name: "Caveat" }));
    await userEvent.clear(field(text.size));
    await userEvent.type(field(text.size), "18");

    expect(stampText()).toHaveAttribute("font-family", expect.stringContaining("pdfnum-caveat"));
    expect(Number(stampText().getAttribute("font-size"))).toBeCloseTo(18 * SCALE, 6);
    await userEvent.click(roleButton(text.roles.odd));
    expect(stampText()).toHaveAttribute("font-family", expect.stringContaining("pdfnum-cmu-serif"));
  });

  it("can use one page type's settings for all pages", async () => {
    await openWorkspace();
    await userEvent.click(screen.getByRole("button", { name: text.presets["bottom-left"] }));

    await userEvent.click(screen.getByRole("button", { name: text.applyToAll }));
    await userEvent.click(roleButton(text.roles.even));

    await openExactPosition();
    expectMm(text.fromLeft, mmToPt(10));
    expectMm(text.fromBottom, mmToPt(10));
  });

  it("disables page types a document does not have", async () => {
    await openWorkspace(1);

    expect(roleButton(text.roles.odd)).toBeDisabled();
    expect(roleButton(text.roles.even)).toBeDisabled();
  });
});
