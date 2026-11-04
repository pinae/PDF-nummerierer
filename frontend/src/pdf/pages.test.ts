import { describe, expect, it } from "vitest";

import { firstPageOfRole, roleOfPage } from "./pages";

describe("page roles (same rules as the backend)", () => {
  it.each([
    [1, "first"],
    [2, "even"],
    [3, "odd"],
    [4, "even"],
    [5, "odd"],
  ] as const)("page %d is %s", (page, role) => {
    expect(roleOfPage(page)).toBe(role);
  });

  it("finds the first page of each role", () => {
    expect(firstPageOfRole("first", 5)).toBe(1);
    expect(firstPageOfRole("even", 5)).toBe(2);
    expect(firstPageOfRole("odd", 5)).toBe(3);
  });

  it("returns null when a document has no page of a role", () => {
    expect(firstPageOfRole("even", 1)).toBeNull();
    expect(firstPageOfRole("odd", 2)).toBeNull();
  });
});
