import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { strings } from "../strings";
import { TEST_VIEWPORT } from "../test/viewport";
import { AppThemeProvider } from "../theme/AppThemeProvider";
import { PdfViewer, type OverlayInfo } from "./PdfViewer";
import { CSS_PX_PER_PT, resolveScale } from "./zoom";

const A4: [number, number] = [595.28, 841.89];
const LANDSCAPE: [number, number] = [841.89, 595.28];
const text = strings.viewer;

function Harness({
  pageSizes = [A4, A4, A4, A4, A4],
  fileUrl = "/api/documents/d1/file/",
  overlays,
}: {
  pageSizes?: [number, number][];
  fileUrl?: string;
  overlays?: OverlayInfo[];
}) {
  const [page, setPage] = useState(1);
  return (
    <AppThemeProvider>
      <PdfViewer
        fileUrl={fileUrl}
        pageSizes={pageSizes}
        page={page}
        onPageChange={setPage}
        renderOverlay={
          overlays
            ? (info) => {
                overlays.push(info);
                return <span>overlay on page {info.pageNumber}</span>;
              }
            : undefined
        }
      />
    </AppThemeProvider>
  );
}

const renderedPage = () => screen.getByTestId("pdf-page");
const button = (name: string) => screen.getByRole("button", { name });

describe("PdfViewer", () => {
  it("renders the first page of the given file", () => {
    render(<Harness />);

    expect(screen.getByTestId("pdf-document")).toHaveAttribute(
      "data-file",
      "/api/documents/d1/file/",
    );
    expect(renderedPage()).toHaveAttribute("data-page-number", "1");
    expect(screen.getByText("Page 1 of 5")).toBeVisible();
  });

  it("pages forward and back, with buttons disabled at the ends", async () => {
    render(<Harness />);
    expect(button(text.previous)).toBeDisabled();

    await userEvent.click(button(text.next));
    expect(screen.getByText("Page 2 of 5")).toBeVisible();
    await userEvent.click(button(text.previous));
    expect(screen.getByText("Page 1 of 5")).toBeVisible();
  });

  it("jumps to the first odd, first even, last and first page", async () => {
    render(<Harness />);

    await userEvent.click(button(text.jump.odd));
    expect(renderedPage()).toHaveAttribute("data-page-number", "3");
    await userEvent.click(button(text.jump.even));
    expect(renderedPage()).toHaveAttribute("data-page-number", "2");
    await userEvent.click(button(text.jump.last));
    expect(renderedPage()).toHaveAttribute("data-page-number", "5");
    expect(button(text.next)).toBeDisabled();
    await userEvent.click(button(text.jump.first));
    expect(renderedPage()).toHaveAttribute("data-page-number", "1");
  });

  it("disables jumps to roles the document does not have", () => {
    render(<Harness pageSizes={[A4, A4]} />);

    expect(button(text.jump.odd)).toBeDisabled();
    expect(button(text.jump.even)).toBeEnabled();
  });

  it("pages with Page Up/Down, Home and End on the preview", () => {
    render(<Harness />);
    const preview = screen.getByRole("region", { name: text.previewLabel });

    fireEvent.keyDown(preview, { key: "PageDown" });
    fireEvent.keyDown(preview, { key: "PageDown" });
    expect(screen.getByText("Page 3 of 5")).toBeVisible();
    fireEvent.keyDown(preview, { key: "PageUp" });
    expect(screen.getByText("Page 2 of 5")).toBeVisible();
    fireEvent.keyDown(preview, { key: "End" });
    expect(screen.getByText("Page 5 of 5")).toBeVisible();
    fireEvent.keyDown(preview, { key: "Home" });
    expect(screen.getByText("Page 1 of 5")).toBeVisible();
  });

  it("fits the whole page by default", () => {
    render(<Harness />);
    const scale = resolveScale(
      { kind: "fit-page" },
      { width: A4[0], height: A4[1] },
      TEST_VIEWPORT,
    );

    expect(Number(renderedPage().dataset.width)).toBeCloseTo(A4[0] * scale, 6);
    expect(button(text.fitPage)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(`${Math.round((scale / CSS_PX_PER_PT) * 100)} %`)).toBeVisible();
  });

  it("can fit the page width instead", async () => {
    render(<Harness />);

    await userEvent.click(button(text.fitWidth));

    const scale = resolveScale(
      { kind: "fit-width" },
      { width: A4[0], height: A4[1] },
      TEST_VIEWPORT,
    );
    expect(Number(renderedPage().dataset.width)).toBeCloseTo(A4[0] * scale, 6);
    expect(button(text.fitWidth)).toHaveAttribute("aria-pressed", "true");
  });

  it("zooms in and out in steps", async () => {
    render(<Harness />);
    const before = Number(renderedPage().dataset.width);

    await userEvent.click(button(text.zoomIn));
    const zoomed = Number(renderedPage().dataset.width);
    expect(zoomed).toBeGreaterThan(before);
    expect(button(text.fitPage)).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(button(text.zoomOut));
    expect(Number(renderedPage().dataset.width)).toBeLessThan(zoomed);
  });

  it("sizes every page by its own displayed size", async () => {
    render(<Harness pageSizes={[A4, LANDSCAPE]} />);
    await userEvent.click(button(text.fitWidth));
    const portraitWidth = Number(renderedPage().dataset.width);

    await userEvent.click(button(text.next));

    expect(Number(renderedPage().dataset.width)).toBeCloseTo(portraitWidth, 6);
    await userEvent.click(button(text.fitPage));
    const scale = resolveScale(
      { kind: "fit-page" },
      { width: LANDSCAPE[0], height: LANDSCAPE[1] },
      TEST_VIEWPORT,
    );
    expect(Number(renderedPage().dataset.width)).toBeCloseTo(LANDSCAPE[0] * scale, 6);
  });

  it("gives an overlay the page, its size in points and the scale", async () => {
    const overlays: OverlayInfo[] = [];
    render(<Harness overlays={overlays} pageSizes={[A4, LANDSCAPE]} />);
    await userEvent.click(button(text.next));

    expect(screen.getByText("overlay on page 2")).toBeVisible();
    const last = overlays.at(-1);
    expect(last?.pageNumber).toBe(2);
    expect(last?.pageSize).toEqual({ width: LANDSCAPE[0], height: LANDSCAPE[1] });
    expect(Number(renderedPage().dataset.width)).toBeCloseTo(LANDSCAPE[0] * (last?.scale ?? 0), 6);
  });

  it("explains when the PDF cannot be displayed", () => {
    render(<Harness fileUrl="/api/documents/broken/file/" />);

    expect(screen.getByRole("alert")).toHaveTextContent(text.loadError);
  });
});
