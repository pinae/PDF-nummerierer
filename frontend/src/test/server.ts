import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const defaultLimits = {
  max_upload_bytes: 500 * 1024 * 1024,
  retention_seconds: 7200,
  max_copies: 9999,
  max_output_pages: 100000,
};

/** Endpoints every screen may call; tests override them with server.use(...). */
const defaultHandlers = [http.get("/api/limits/", () => HttpResponse.json(defaultLimits))];

/** API mock for all frontend tests. Requests without a handler fail the test. */
export const server = setupServer(...defaultHandlers);
