import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestResult } from "./types.ts";

const { getActiveAccountId } = vi.hoisted(() => ({
  getActiveAccountId: vi.fn<() => string | null>(),
}));

vi.mock("./accounts.ts", () => ({ getActiveAccountId }));

import {
  getResultsForGrade,
  getWeakTypeIds,
  levelFromStats,
  loadHistory,
  loadHistoryForAccount,
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
        typeId: "add_sub",
        typeLabel: "Додавання/віднімання",
        total: 2,
        correct: 1,
        finalDifficulty: "medium",
        level: 2,
      },
    ],
    bestTypeId: "add_sub",
    worstTypeId: "add_sub",
  };
}

let memoryStorage: MemoryStorage;

beforeEach(() => {
  memoryStorage = new MemoryStorage();
  vi.stubGlobal("localStorage", memoryStorage);
  getActiveAccountId.mockReturnValue("student-a");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("test result storage", () => {
  it("stores results per account and filters them by grade", () => {
    saveResult(createResult("grade-1"));
    memoryStorage.setItem(
      "mathTest_history_v1_student-b",
      JSON.stringify([createResult("other-account", 2)]),
    );

    expect(loadHistory()).toHaveLength(1);
    expect(loadHistoryForAccount("student-b").map(({ id }) => id)).toEqual([
      "other-account",
    ]);
    expect(getResultsForGrade(1).map(({ id }) => id)).toEqual(["grade-1"]);
    expect(getResultsForGrade(2)).toEqual([]);
  });

  it("limits saved history to the newest 30 results", () => {
    memoryStorage.setItem(
      "mathTest_history_v1_student-a",
      JSON.stringify(
        Array.from({ length: 30 }, (_, index) => createResult(`old-${index}`)),
      ),
    );

    saveResult(createResult("newest"));

    const history = loadHistory();
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

    expect(loadHistory().map(({ id }) => id)).toEqual(["valid"]);
    expect(error).toHaveBeenCalledOnce();
  });

  it("propagates write failures so the UI can warn that the result was not saved", () => {
    vi.spyOn(memoryStorage, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });

    expect(() => saveResult(createResult("unsaved"))).toThrow(
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
              typeId: "geometry",
              level: 4,
            },
          ],
        },
      ]),
    );

    expect(getWeakTypeIds(1)).toEqual(new Set(["add_sub"]));
  });

  it("maps performance and difficulty to levels from 1 to 5", () => {
    expect(levelFromStats(0, 0, "easy")).toBe(1);
    expect(levelFromStats(10, 10, "hard")).toBe(5);
    expect(levelFromStats(10, 0, "easy")).toBe(1);
  });
});
