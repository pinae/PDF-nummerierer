import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./client";
import { uploadDocument } from "./upload";

/** Minimal XMLHttpRequest stand-in that the test drives by hand. */
class FakeRequest {
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown;
  status = 0;
  responseText = "";
  aborted = false;
  readonly upload = new EventTarget();
  private readonly events = new EventTarget();

  addEventListener(type: string, listener: EventListener) {
    this.events.addEventListener(type, listener);
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.events.dispatchEvent(new Event("abort"));
  }
  progress(loaded: number, total: number) {
    this.upload.dispatchEvent(
      Object.assign(new Event("progress"), { loaded, total, lengthComputable: true }),
    );
  }
  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = typeof body === "string" ? body : JSON.stringify(body);
    this.events.dispatchEvent(new Event("load"));
  }
  fail() {
    this.events.dispatchEvent(new Event("error"));
  }
}

function start(options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}) {
  const request = new FakeRequest();
  const file = new File(["%PDF-1.7"], "exam.pdf", { type: "application/pdf" });
  const promise = uploadDocument(file, {
    ...options,
    createRequest: () => request as unknown as XMLHttpRequest,
  });
  return { request, file, promise };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => vi.restoreAllMocks());

describe("uploadDocument", () => {
  it("posts the file as multipart with the CSRF token", async () => {
    document.cookie = "csrftoken=secret; path=/";
    const { request, file, promise } = start();
    await flush();

    expect(request.method).toBe("POST");
    expect(request.url).toBe("/api/documents/");
    expect(request.headers["X-CSRFToken"]).toBe("secret");
    expect((request.body as FormData).get("file")).toBe(file);

    request.respond(201, { id: "d1", page_count: 3 });
    await expect(promise).resolves.toMatchObject({ id: "d1", page_count: 3 });
  });

  it("reports upload progress as a fraction", async () => {
    document.cookie = "csrftoken=t; path=/";
    const progress: number[] = [];
    const { request, promise } = start({ onProgress: (p) => progress.push(p) });
    await flush();

    request.progress(25, 100);
    request.progress(100, 100);
    request.respond(201, { id: "d1" });
    await promise;

    expect(progress).toEqual([0.25, 1]);
  });

  it("turns API errors into ApiError", async () => {
    document.cookie = "csrftoken=t; path=/";
    const { request, promise } = start();
    await flush();

    request.respond(400, { error: { code: "encrypted_pdf", message: "Password protected." } });

    await expect(promise).rejects.toMatchObject({ status: 400, code: "encrypted_pdf" });
  });

  it("reports a failed connection as network_error", async () => {
    document.cookie = "csrftoken=t; path=/";
    const { request, promise } = start();
    await flush();

    request.fail();

    const error = await promise.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "network_error" });
  });

  it("can be cancelled", async () => {
    document.cookie = "csrftoken=t; path=/";
    const controller = new AbortController();
    const { request, promise } = start({ signal: controller.signal });
    await flush();

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(request.aborted).toBe(true);
  });
});
