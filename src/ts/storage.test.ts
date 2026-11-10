import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestResult } from "./types.ts";

import {
  getResultsForGrade,
  getWeakTypeIds,
  levelFromStats,
  loadHistory,
  saveResult,
} from "./storage.ts";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

function createResult(id: string, grade: TestResult["grade"] = 1): TestResult {
  return {
    id,
    date: "2026-10-15T12:00:00.000Z",
    grade,
    totalQuestions: 2,
    correctAnswers: 1,
    timeLimitSec: 900,
    timeTakenMs: 120_000,
    typeStats: [
      {
        typeId: "addition",
        typeLabel: "Додавання",
        total: 2,
        correct: 1,
        finalDifficulty: "medium",
        level: 2,
      },
    ],
    bestTypeId: "addition",
    worstTypeId: "addition",
  };
}

let memoryStorage: MemoryStorage;

beforeEach(() => {
  memoryStorage = new MemoryStorage();
  vi.stubGlobal("localStorage", memoryStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("test result storage", () => {
  it("stores results per account and filters them by grade", () => {
    saveResult(createResult("grade-1"), "student-a");
    memoryStorage.setItem(
      "mathTest_history_v1_student-b",
      JSON.stringify([createResult("other-account", 2)]),
    );

    expect(loadHistory("student-a")).toHaveLength(1);
    expect(loadHistory("student-b").map(({ id }) => id)).toEqual([
      "other-account",
    ]);
    expect(getResultsForGrade(1, "student-a").map(({ id }) => id)).toEqual([
      "grade-1",
    ]);
    expect(getResultsForGrade(2, "student-a")).toEqual([]);
  });

  it("limits saved history to the newest 30 results", () => {
    memoryStorage.setItem(
      "mathTest_history_v1_student-a",
      JSON.stringify(
        Array.from({ length: 30 }, (_, index) => createResult(`old-${index}`)),
      ),
    );

    saveResult(createResult("newest"), "student-a");

    const history = loadHistory("student-a");
    expect(history).toHaveLength(30);
    expect(history[0].id).toBe("newest");
    expect(history.some(({ id }) => id === "old-29")).toBe(false);
  });

  it("reports malformed history and returns only valid results", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    memoryStorage.setItem(
      "mathTest_history_v1_student-a",
      JSON.stringify([createResult("valid"), { id: "invalid" }]),
    );

    expect(loadHistory("student-a").map(({ id }) => id)).toEqual(["valid"]);
    expect(error).toHaveBeenCalledOnce();
  });

  it("propagates write failures so the UI can warn that the result was not saved", () => {
    vi.spyOn(memoryStorage, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });

    expect(() => saveResult(createResult("unsaved"), "student-a")).toThrow(
      "не вдалося його зберегти",
    );
  });

  it("uses the recent type levels to identify topics for extra practice", () => {
    memoryStorage.setItem(
      "mathTest_history_v1_student-a",
      JSON.stringify([
        createResult("recent"),
        {
          ...createResult("other"),
          typeStats: [
            {
              ...createResult("other").typeStats[0],
              typeId: "equations",
              level: 4,
            },
          ],
        },
      ]),
    );

    expect(getWeakTypeIds(1, "student-a")).toEqual(new Set(["addition"]));
  });

  it("maps performance and difficulty to levels from 1 to 5", () => {
    expect(levelFromStats(0, 0, "easy")).toBe(1);
    expect(levelFromStats(10, 10, "medium")).toBe(4);
    expect(levelFromStats(10, 0, "easy")).toBe(1);
  });
});
