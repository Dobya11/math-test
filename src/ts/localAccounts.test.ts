import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { loadSavedAccounts, saveAccountSession } from "./localAccounts.ts";

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

function createSession(id: string, name: string): Session {
  return {
    access_token: `access-${id}`,
    refresh_token: `refresh-${id}`,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id,
      app_metadata: {},
      user_metadata: { display_name: name, role: "student" },
      aud: "authenticated",
      created_at: "2026-11-11T00:00:00.000Z",
    },
  };
}

let memoryStorage: MemoryStorage;

beforeEach(() => {
  memoryStorage = new MemoryStorage();
  vi.stubGlobal("localStorage", memoryStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saved account sessions", () => {
  it("keeps multiple accounts and updates a session without duplicating it", () => {
    saveAccountSession(createSession("student-a", "Оля"));
    saveAccountSession(createSession("student-b", "Максим"));
    saveAccountSession(createSession("student-a", "Оля"));

    expect(loadSavedAccounts()).toEqual([
      {
        id: "student-a",
        name: "Оля",
        role: "student",
        accessToken: "access-student-a",
        refreshToken: "refresh-student-a",
      },
      {
        id: "student-b",
        name: "Максим",
        role: "student",
        accessToken: "access-student-b",
        refreshToken: "refresh-student-b",
      },
    ]);
  });

  it("reports malformed saved account data", () => {
    memoryStorage.setItem("mathTest_savedAccounts_v1", "{");
    expect(() => loadSavedAccounts()).toThrow("пошкоджений");

    memoryStorage.setItem(
      "mathTest_savedAccounts_v1",
      JSON.stringify([{ id: "incomplete" }]),
    );
    expect(() => loadSavedAccounts()).toThrow("неправильний формат");
  });
});
