import type { TestResult, User } from "./types.ts";

export type LegacyAccount = User;

export interface LegacyArchivePayload {
  format: "math-test-local-v1";
  exportedAt: string;
  sourceOrigin: string;
  accounts: LegacyAccount[];
  histories: Record<string, TestResult[]>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTestResult(value: unknown): value is TestResult {
  if (!isRecord(value)) return false;
  const statsValid =
    Array.isArray(value.typeStats) &&
    value.typeStats.every(
      (stat) =>
        isRecord(stat) &&
        typeof stat.typeId === "string" &&
        typeof stat.typeLabel === "string" &&
        Number.isInteger(stat.total) &&
        Number.isInteger(stat.correct) &&
        (stat.finalDifficulty === "easy" ||
          stat.finalDifficulty === "medium") &&
        Number.isFinite(stat.level),
    );

  return (
    typeof value.id === "string" &&
    typeof value.date === "string" &&
    [1, 2, 3, 4].includes(value.grade as number) &&
    Number.isInteger(value.totalQuestions) &&
    Number.isInteger(value.correctAnswers) &&
    (value.timeLimitSec === null || Number.isFinite(value.timeLimitSec)) &&
    Number.isFinite(value.timeTakenMs) &&
    statsValid &&
    (value.bestTypeId === null || typeof value.bestTypeId === "string") &&
    (value.worstTypeId === null || typeof value.worstTypeId === "string")
  );
}

function validatePayload(value: unknown): LegacyArchivePayload {
  if (!isRecord(value) || value.format !== "math-test-local-v1") {
    throw new Error("Це не файл експорту math-test-local-v1.");
  }
  if (
    typeof value.exportedAt !== "string" ||
    typeof value.sourceOrigin !== "string" ||
    !Array.isArray(value.accounts) ||
    !isRecord(value.histories)
  ) {
    throw new Error("Файл архіву має неправильну структуру.");
  }

  const accounts: LegacyAccount[] = [];
  const accountIds = new Set<string>();
  for (const account of value.accounts) {
    if (
      !isRecord(account) ||
      typeof account.id !== "string" ||
      typeof account.name !== "string" ||
      (account.role !== "teacher" && account.role !== "student")
    ) {
      throw new Error("У файлі є профіль із некоректними даними.");
    }
    if (accountIds.has(account.id)) {
      throw new Error("У файлі є дублікати профілів.");
    }
    accountIds.add(account.id);
    accounts.push({
      id: account.id,
      name: account.name,
      role: account.role,
    });
  }

  const histories: Record<string, TestResult[]> = {};
  for (const [accountId, results] of Object.entries(value.histories)) {
    if (!Array.isArray(results) || !results.every(isTestResult)) {
      throw new Error(`Історія профілю ${accountId} має некоректні записи.`);
    }
    histories[accountId] = results;
  }

  return {
    format: "math-test-local-v1",
    exportedAt: value.exportedAt,
    sourceOrigin: value.sourceOrigin,
    accounts,
    histories,
  };
}

export async function readLegacyArchive(file: File): Promise<{
  payload: LegacyArchivePayload;
  fingerprint: string;
  resultCount: number;
}> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Розмір файлу перевищує дозволені 10 МБ.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch (error) {
    throw new Error("Не вдалося прочитати JSON-файл архіву.", {
      cause: error,
    });
  }
  const payload = validatePayload(parsed);
  const canonical = JSON.stringify(payload);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  const fingerprint = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    payload,
    fingerprint,
    resultCount: Object.values(payload.histories).reduce(
      (count, history) => count + history.length,
      0,
    ),
  };
}
