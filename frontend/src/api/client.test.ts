import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "../test/server";
import { ApiError, apiRequest } from "./client";

describe("apiRequest", () => {
  it("returns parsed JSON for safe requests without a CSRF header", async () => {
    let csrfHeader: string | null = "unset";
    server.use(
      http.get("/api/configs/", ({ request }) => {
        csrfHeader = request.headers.get("X-CSRFToken");
        return HttpResponse.json([{ id: "1" }]);
      }),
    );

    await expect(apiRequest("/api/configs/")).resolves.toEqual([{ id: "1" }]);
    expect(csrfHeader).toBeNull();
  });

  it("sends JSON with the CSRF token from the cookie on mutating requests", async () => {
    document.cookie = "csrftoken=token-from-cookie; path=/";
    let received: { token: string | null; type: string | null; body: unknown } | undefined;
    server.use(
      http.post("/api/configs/", async ({ request }) => {
        received = {
          token: request.headers.get("X-CSRFToken"),
          type: request.headers.get("Content-Type"),
          body: await request.json(),
        };
        return HttpResponse.json({ id: "new" }, { status: 201 });
      }),
    );

    await apiRequest("/api/configs/", { method: "POST", json: { name: "Exam" } });

    expect(received).toEqual({
      token: "token-from-cookie",
      type: "application/json",
      body: { name: "Exam" },
    });
  });

  it("fetches a CSRF cookie first when there is none", async () => {
    const calls: string[] = [];
    server.use(
      http.get("/api/csrf/", () => {
        calls.push("csrf");
        document.cookie = "csrftoken=fresh-token; path=/";
        return HttpResponse.json({ status: "ok" });
      }),
      http.delete("/api/documents/abc/", ({ request }) => {
        calls.push(`delete:${request.headers.get("X-CSRFToken")}`);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(apiRequest("/api/documents/abc/", { method: "DELETE" })).resolves.toBeUndefined();
    expect(calls).toEqual(["csrf", "delete:fresh-token"]);
  });

  it("uses the token from the response while the new cookie is not readable yet", async () => {
    // Safari hands cookies from a response to document.cookie only a moment
    // later; the first upload must not go out without a token.
    let token: string | null = "unset";
    server.use(
      http.get("/api/csrf/", () => HttpResponse.json({ csrf_token: "token-from-response" })),
      http.delete("/api/documents/abc/", ({ request }) => {
        token = request.headers.get("X-CSRFToken");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await apiRequest("/api/documents/abc/", { method: "DELETE" });

    expect(token).toBe("token-from-response");
  });

  it("turns API errors into a typed ApiError with code, message and fields", async () => {
    document.cookie = "csrftoken=t; path=/";
    server.use(
      http.post("/api/configs/", () =>
        HttpResponse.json(
          {
            error: {
              code: "invalid",
              message: "Some values are not valid.",
              fields: { "placements.first.font_size": ["Too big."] },
            },
          },
          { status: 400 },
        ),
      ),
    );

    const error = await apiRequest("/api/configs/", { method: "POST", json: {} }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "invalid",
      message: "Some values are not valid.",
      fields: { "placements.first.font_size": ["Too big."] },
    });
  });

  it("reports server errors without a JSON body as server_error", async () => {
    server.use(
      http.get("/api/configs/", () => new HttpResponse("<h1>Bad Gateway</h1>", { status: 502 })),
    );

    await expect(apiRequest("/api/configs/")).rejects.toMatchObject({
      status: 502,
      code: "server_error",
      fields: {},
    });
  });

  it("reports unreachable servers as network_error", async () => {
    server.use(http.get("/api/configs/", () => HttpResponse.error()));

    await expect(apiRequest("/api/configs/")).rejects.toMatchObject({
      status: 0,
      code: "network_error",
    });
  });

  it("sends FormData as multipart without forcing a content type", async () => {
    document.cookie = "csrftoken=t; path=/";
    let type: string | null = null;
    server.use(
      http.post("/api/documents/", ({ request }) => {
        type = request.headers.get("Content-Type");
        return HttpResponse.json({ id: "d" }, { status: 201 });
      }),
    );
    const form = new FormData();
    form.append("file", new Blob(["%PDF-"]), "exam.pdf");

    await apiRequest("/api/documents/", { method: "POST", body: form });

    expect(type).toMatch(/^multipart\/form-data; boundary=/);
  });
});
