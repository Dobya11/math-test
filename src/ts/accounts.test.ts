import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAccounts,
  getCurrentAccount,
  selectAccount,
} from "./accounts.ts";

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

let memoryStorage: MemoryStorage;

beforeEach(() => {
  memoryStorage = new MemoryStorage();
  vi.stubGlobal("localStorage", memoryStorage);
  memoryStorage.setItem(
    "mathTest_accounts_v1",
    JSON.stringify([
      { id: "student-1", name: "Оля", role: "student" },
      { id: "teacher-1", name: "Олена", role: "teacher" },
    ]),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("local accounts", () => {
  it("lists stored profiles and signs in to the selected profile", () => {
    expect(getAccounts()).toEqual([
      { id: "student-1", name: "Оля", role: "student" },
      { id: "teacher-1", name: "Олена", role: "teacher" },
    ]);

    expect(selectAccount("student-1")).toEqual({
      id: "student-1",
      name: "Оля",
      role: "student",
    });
    expect(getCurrentAccount()).toEqual({
      id: "student-1",
      name: "Оля",
      role: "student",
    });
  });

  it("rejects IDs that do not match a stored profile", () => {
    expect(() => selectAccount("missing")).toThrow("Цей профіль не знайдено");
  });
});
