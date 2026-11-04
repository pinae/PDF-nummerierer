import { describe, expect, it } from "vitest";

import { formatSerial } from "./serial";

describe("formatSerial (same rules as the backend)", () => {
  it("pads the number with zeros", () => {
    expect(formatSerial({ prefix: "", digits: 4, suffix: "" }, 1)).toBe("0001");
  });

  it("adds prefix and suffix", () => {
    expect(formatSerial({ prefix: "Exam A – ", digits: 3, suffix: " (B)" }, 7)).toBe(
      "Exam A – 007 (B)",
    );
  });

  it("never truncates long numbers", () => {
    expect(formatSerial({ prefix: "", digits: 2, suffix: "" }, 1234)).toBe("1234");
  });
});
