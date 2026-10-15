import type { User } from "./types.ts";

type StoredAccount = User;

const ACCOUNTS_KEY = "mathTest_accounts_v1";
const ACTIVE_ACCOUNT_KEY = "mathTest_activeAccount_v1";
const LEGACY_HISTORY_KEY = "mathTest_history_v1";
const HISTORY_KEY_PREFIX = "mathTest_history_v1_";

function readStoredAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (account): account is StoredAccount =>
        typeof account?.id === "string" &&
        typeof account?.name === "string" &&
        (account?.role === "teacher" || account?.role === "student"),
    );
  } catch {
    return [];
  }
}

function validateName(name: string): string {
  const normalizedName = name.trim().replace(/\s+/g, " ");
  if (normalizedName.length < 2 || normalizedName.length > 24) {
    throw new Error("Ім’я має містити від 2 до 24 символів.");
  }
  return normalizedName;
}

export function getAccounts(): User[] {
  return readStoredAccounts().map(({ id, name, role }) => ({ id, name, role }));
}

export function getActiveAccountId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

export function getCurrentAccount(): User | null {
  const activeId = getActiveAccountId();
  if (!activeId) return null;

  const account = readStoredAccounts().find(({ id }) => id === activeId);
  return account
    ? { id: account.id, name: account.name, role: account.role }
    : null;
}

export function createAccount(name: string, role: User["role"]): User {
  const normalizedName = validateName(name);
  const accounts = readStoredAccounts();
  const nameExists = accounts.some(
    (account) =>
      account.name.toLocaleLowerCase("uk-UA") ===
      normalizedName.toLocaleLowerCase("uk-UA"),
  );
  if (nameExists) {
    throw new Error("Це ім’я вже зайняте. Обери інше.");
  }

  const account: StoredAccount = {
    id: crypto.randomUUID(),
    name: normalizedName,
    role,
  };

  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, account]));

  if (accounts.length === 0) {
    const oldHistory = localStorage.getItem(LEGACY_HISTORY_KEY);
    if (oldHistory) {
      localStorage.setItem(`${HISTORY_KEY_PREFIX}${account.id}`, oldHistory);
      localStorage.removeItem(LEGACY_HISTORY_KEY);
    }
  }

  localStorage.setItem(ACTIVE_ACCOUNT_KEY, account.id);
  return { id: account.id, name: account.name, role: account.role };
}

export function selectAccount(accountId: string): User {
  const account = readStoredAccounts().find(({ id }) => id === accountId);
  if (!account) {
    throw new Error("Цей профіль не знайдено. Створи новий.");
  }

  localStorage.setItem(ACTIVE_ACCOUNT_KEY, account.id);
  return { id: account.id, name: account.name, role: account.role };
}

export function signOut(): void {
  try {
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  } catch {
    // ignore
  }
}
