import type { Session } from "@supabase/supabase-js";

const STORAGE_KEY = "mathTest_savedAccounts_v1";

export interface SavedAccount {
  id: string;
  name: string;
  role: "teacher" | "student" | null;
  accessToken: string;
  refreshToken: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSavedAccount(value: unknown): value is SavedAccount {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.role === "teacher" ||
      value.role === "student" ||
      value.role === null) &&
    typeof value.accessToken === "string" &&
    typeof value.refreshToken === "string"
  );
}

export function loadSavedAccounts(): SavedAccount[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    throw new Error("Не вдалося прочитати збережені профілі.", {
      cause: error,
    });
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("Список збережених профілів пошкоджений.", {
      cause: error,
    });
  }
  if (!Array.isArray(parsed) || !parsed.every(isSavedAccount)) {
    throw new Error("Список збережених профілів має неправильний формат.");
  }
  return parsed;
}

export function saveAccountSession(session: Session): SavedAccount[] {
  const accounts = loadSavedAccounts();
  const metadata = session.user.user_metadata;
  const role =
    metadata.role === "teacher" || metadata.role === "student"
      ? metadata.role
      : null;
  const account: SavedAccount = {
    id: session.user.id,
    name:
      typeof metadata.display_name === "string" && metadata.display_name.trim()
        ? metadata.display_name.trim()
        : "Профіль",
    role,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  };
  const nextAccounts = [
    account,
    ...accounts.filter(({ id }) => id !== account.id),
  ];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAccounts));
  } catch (error) {
    throw new Error("Не вдалося зберегти профіль на цьому пристрої.", {
      cause: error,
    });
  }
  return nextAccounts;
}
