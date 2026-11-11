import type { Session } from "@supabase/supabase-js";

const STORAGE_KEY = "mathTest_savedAccounts_v1";

export interface SavedAccount {
  id: string;
  username: string;
  name: string;
  role: "teacher" | "student" | null;
  accessToken: string;
  refreshToken: string;
}

type StoredAccount = Omit<SavedAccount, "username"> & { username?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStoredAccount(value: unknown): value is StoredAccount {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.username === undefined || typeof value.username === "string") &&
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
  if (!Array.isArray(parsed) || !parsed.every(isStoredAccount)) {
    throw new Error("Список збережених профілів має неправильний формат.");
  }
  return parsed.map((account) => ({
    ...account,
    username: account.username ?? fallbackUsername(account.id),
  }));
}

function fallbackUsername(id: string): string {
  return `user_${id.replace(/-/g, "").slice(0, 15)}`;
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
    username:
      typeof metadata.username === "string" &&
      /^[a-z0-9_]{3,20}$/.test(metadata.username)
        ? metadata.username
        : fallbackUsername(session.user.id),
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
