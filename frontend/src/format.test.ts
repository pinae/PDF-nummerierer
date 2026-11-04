import { describe, expect, it } from "vitest";

import { formatBytes, formatDuration } from "./format";

describe("formatBytes", () => {
  it.each([
    [800, "800 bytes"],
    [1, "1 byte"],
    [1536, "1.5 KB"],
    [500 * 1024 * 1024, "500 MB"],
    [1.25 * 1024 * 1024, "1.3 MB"],
    [2 * 1024 ** 3, "2 GB"],
  ])("%d bytes reads as %s", (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});

describe("formatDuration", () => {
  it.each([
    [7200, "2 hours"],
    [3600, "1 hour"],
    [5400, "90 minutes"],
    [60, "1 minute"],
    [86400, "24 hours"],
    [30, "30 seconds"],
  ])("%d seconds reads as %s", (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});
