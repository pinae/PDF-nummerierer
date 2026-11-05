import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const defaultLimits = {
  max_upload_bytes: 500 * 1024 * 1024,
  retention_seconds: 7200,
  max_copies: 9999,
  max_output_pages: 100000,
  idle_seconds: 900,
};

export const defaultFonts = [
  {
    id: "cmu-serif",
    label: "Computer Modern Roman",
    category: "serif",
    url: "/api/fonts/cmu-serif.ttf",
  },
  {
    id: "dejavu-sans",
    label: "DejaVu Sans",
    category: "sans-serif",
    url: "/api/fonts/dejavu-sans.ttf",
  },
  { id: "caveat", label: "Caveat", category: "handwritten", url: "/api/fonts/caveat.ttf" },
];

/** Endpoints every screen may call; tests override them with server.use(...). */
const defaultHandlers = [
  http.get("/api/limits/", () => HttpResponse.json(defaultLimits)),
  http.get("/api/fonts/", () => HttpResponse.json(defaultFonts)),
  http.get("/api/configs/", () => HttpResponse.json([])),
  http.post("/api/documents/:id/keepalive/", () => new HttpResponse(null, { status: 204 })),
];

/** API mock for all frontend tests. Requests without a handler fail the test. */
export const server = setupServer(...defaultHandlers);
