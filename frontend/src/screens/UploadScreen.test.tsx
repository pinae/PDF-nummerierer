import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { strings } from "../strings";
import { renderRoute } from "../test/render";
import { server } from "../test/server";

const MB = 1024 * 1024;

function mockLimits(overrides: Partial<Record<string, number>> = {}) {
  server.use(
    http.get("/api/limits/", () =>
      HttpResponse.json({
        max_upload_bytes: 500 * MB,
        retention_seconds: 7200,
        max_copies: 9999,
        max_output_pages: 100000,
        idle_seconds: 900,
        ...overrides,
      }),
    ),
  );
}

function pdf(name = "exam.pdf", content = "%PDF-1.7") {
  return new File([content], name, { type: "application/pdf" });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const dropzone = () => screen.getByRole("region", { name: strings.upload.dropzoneLabel });
const fileInput = () => screen.getByLabelText(strings.upload.inputLabel);

function drop(files: File[]) {
  fireEvent.drop(dropzone(), { dataTransfer: { files, types: ["Files"] } });
}

beforeEach(() => {
  document.cookie = "csrftoken=t; path=/";
  mockLimits();
});

describe("upload screen", () => {
  it("states the size limit and the deletion promise before anything is uploaded", async () => {
    renderRoute("/");

    expect(await screen.findByText("PDF, up to 500 MB")).toBeVisible();
    expect(screen.getByText(/only this browser can open it/)).toBeVisible();
    expect(screen.getByText(/at the latest after 2 hours/)).toBeVisible();
    expect(screen.getByText(/15 minutes after you close this page/)).toBeVisible();
  });

  it("explains the three steps", () => {
    renderRoute("/");

    const steps = screen.getByRole("list", { name: strings.upload.stepsLabel });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
  });

  it("uploads a chosen PDF and opens its workspace", async () => {
    // The raw multipart body is inspected instead of request.formData(): Node's
    // multipart parser rejects jsdom's File class on newer Node versions.
    let body = "";
    server.use(
      http.post("/api/documents/", async ({ request }) => {
        body = await request.text();
        return HttpResponse.json({ id: "d1" }, { status: 201 });
      }),
    );
    const { router } = renderRoute("/");

    await userEvent.upload(fileInput(), pdf("exam.pdf", "%PDF-1.7 exam content"));

    await waitFor(() => expect(router.state.location.pathname).toBe("/exams/d1"));
    expect(body).toMatch(/Content-Disposition: form-data; name="file"; filename="exam\.pdf"/);
    expect(body).toContain("%PDF-1.7 exam content");
  });

  it("uploads a dropped PDF", async () => {
    server.use(
      http.post("/api/documents/", () => HttpResponse.json({ id: "d2" }, { status: 201 })),
    );
    const { router } = renderRoute("/");

    drop([pdf()]);

    await waitFor(() => expect(router.state.location.pathname).toBe("/exams/d2"));
  });

  it("shows progress and can be cancelled while uploading", async () => {
    const gate = deferred();
    server.use(
      http.post("/api/documents/", async () => {
        await gate.promise;
        return HttpResponse.json({ id: "late" }, { status: 201 });
      }),
    );
    const { router } = renderRoute("/");

    await userEvent.upload(fileInput(), pdf("final-exam.pdf"));

    expect(await screen.findByRole("progressbar")).toBeVisible();
    expect(screen.getByText(/Uploading final-exam\.pdf/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: strings.upload.cancel }));

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(dropzone()).toBeVisible();
    gate.resolve();
    await new Promise((r) => setTimeout(r, 20));
    expect(router.state.location.pathname).toBe("/");
  });

  it("highlights the drop zone while a file is dragged over it", () => {
    renderRoute("/");

    fireEvent.dragEnter(dropzone(), { dataTransfer: { types: ["Files"] } });
    expect(screen.getByText(strings.upload.dropNow)).toBeVisible();

    fireEvent.dragLeave(dropzone(), { dataTransfer: { types: ["Files"] } });
    expect(screen.queryByText(strings.upload.dropNow)).not.toBeInTheDocument();
  });

  it("rejects files that are not PDFs without uploading them", async () => {
    renderRoute("/");

    drop([new File(["png"], "photo.png", { type: "image/png" })]);

    expect(await screen.findByRole("alert")).toHaveTextContent(strings.upload.errors.not_pdf);
  });

  it("rejects files above the limit without uploading them", async () => {
    mockLimits({ max_upload_bytes: 10 });
    renderRoute("/");
    await screen.findByText("PDF, up to 10 bytes");

    drop([pdf("big.pdf", "%PDF-" + "x".repeat(20))]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The file is too large (25 bytes). The maximum is 10 bytes.",
    );
  });

  it("accepts only one file at a time", async () => {
    renderRoute("/");

    drop([pdf("a.pdf"), pdf("b.pdf")]);

    expect(await screen.findByRole("alert")).toHaveTextContent(strings.upload.errors.single_file);
  });

  it.each([
    ["encrypted_pdf", strings.upload.errors.encrypted_pdf],
    ["invalid_pdf", strings.upload.errors.invalid_pdf],
    ["not_pdf", strings.upload.errors.not_pdf],
    ["throttled", strings.upload.errors.throttled],
  ])("explains the server's %s error", async (code, message) => {
    server.use(
      http.post("/api/documents/", () =>
        HttpResponse.json({ error: { code, message: "server text" } }, { status: 400 }),
      ),
    );
    renderRoute("/");

    await userEvent.upload(fileInput(), pdf());

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("explains when the server is unreachable", async () => {
    server.use(http.post("/api/documents/", () => HttpResponse.error()));
    renderRoute("/");

    await userEvent.upload(fileInput(), pdf());

    expect(await screen.findByRole("alert")).toHaveTextContent(strings.errors.network);
  });

  it("falls back to the server's message for unexpected errors", async () => {
    server.use(
      http.post("/api/documents/", () =>
        HttpResponse.json(
          { error: { code: "teapot", message: "I am a teapot." } },
          { status: 418 },
        ),
      ),
    );
    renderRoute("/");

    await userEvent.upload(fileInput(), pdf());

    expect(await screen.findByRole("alert")).toHaveTextContent("I am a teapot.");
  });

  it("lets the user try another file after an error", async () => {
    let calls = 0;
    server.use(
      http.post("/api/documents/", () =>
        ++calls === 1
          ? HttpResponse.json({ error: { code: "invalid_pdf", message: "x" } }, { status: 400 })
          : HttpResponse.json({ id: "d3" }, { status: 201 }),
      ),
    );
    const { router } = renderRoute("/");
    await userEvent.upload(fileInput(), pdf("broken.pdf"));
    await screen.findByRole("alert");

    await userEvent.upload(fileInput(), pdf("fixed.pdf"));

    await waitFor(() => expect(router.state.location.pathname).toBe("/exams/d3"));
  });

  it("still works when the limits cannot be loaded", async () => {
    server.use(
      http.get("/api/limits/", () => new HttpResponse(null, { status: 500 })),
      http.post("/api/documents/", () => HttpResponse.json({ id: "d4" }, { status: 201 })),
    );
    const { router } = renderRoute("/");

    await userEvent.upload(fileInput(), pdf());

    await waitFor(() => expect(router.state.location.pathname).toBe("/exams/d4"));
  });

  it("offers a keyboard-accessible button to choose a file", () => {
    renderRoute("/");

    const button = screen.getByRole("button", { name: strings.upload.choose });
    button.focus();
    expect(button).toHaveFocus();
  });
});
