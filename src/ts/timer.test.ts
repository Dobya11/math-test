import { describe, expect, it } from "vitest";
import { secondsUntil } from "./timer.ts";

describe("secondsUntil", () => {
  it("rounds a partial remaining second up for the countdown display", () => {
    expect(secondsUntil(10_000, 9_001)).toBe(1);
    expect(secondsUntil(10_000, 9_000)).toBe(1);
    expect(secondsUntil(10_000, 8_999)).toBe(2);
  });

  it("never returns negative time after the deadline", () => {
    expect(secondsUntil(10_000, 10_000)).toBe(0);
    expect(secondsUntil(10_000, 25_000)).toBe(0);
  });
});
