import type { Grade, TestResult, Difficulty } from "./types.ts";
import { getActiveAccountId } from "./accounts.ts";

const STORAGE_KEY = "mathTest_history_v1";
const MAX_HISTORY = 30;
const SESSIONS_TO_CONSIDER = 5;
const WEAK_LEVEL_THRESHOLD = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTestResult(value: unknown): value is TestResult {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.date === "string" &&
    (value.grade === 1 ||
      value.grade === 2 ||
      value.grade === 3 ||
      value.grade === 4) &&
    Number.isInteger(value.totalQuestions) &&
    Number.isInteger(value.correctAnswers) &&
    (value.timeLimitSec === null || Number.isFinite(value.timeLimitSec)) &&
    Number.isFinite(value.timeTakenMs) &&
    Array.isArray(value.typeStats) &&
    value.typeStats.every(
      (stat) =>
        isRecord(stat) &&
        typeof stat.typeId === "string" &&
        typeof stat.typeLabel === "string" &&
        Number.isInteger(stat.total) &&
        Number.isInteger(stat.correct) &&
        (stat.finalDifficulty === "easy" ||
          stat.finalDifficulty === "medium" ||
          stat.finalDifficulty === "hard") &&
        Number.isFinite(stat.level),
    ) &&
    (value.bestTypeId === null || typeof value.bestTypeId === "string") &&
    (value.worstTypeId === null || typeof value.worstTypeId === "string")
  );
}

function getHistoryKey(): string {
  const accountId = getActiveAccountId();
  return accountId ? `${STORAGE_KEY}_${accountId}` : STORAGE_KEY;
}

function parseHistory(raw: string | null, key: string): TestResult[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error(`Stored test history "${key}" is not an array.`);
      return [];
    }

    const history = parsed.filter(isTestResult);
    if (history.length !== parsed.length) {
      console.error(`Stored test history "${key}" contains invalid entries.`);
    }
    return history;
  } catch (error) {
    console.error(`Unable to parse stored test history "${key}".`, error);
    return [];
  }
}

function loadHistoryFromKey(key: string): TestResult[] {
  try {
    return parseHistory(localStorage.getItem(key), key);
  } catch (error) {
    console.error(`Unable to read stored test history "${key}".`, error);
    return [];
  }
}

export function loadHistory(): TestResult[] {
  return loadHistoryFromKey(getHistoryKey());
}

export function loadHistoryForAccount(accountId: string): TestResult[] {
  return loadHistoryFromKey(`${STORAGE_KEY}_${accountId}`);
}

export function saveResult(result: TestResult): void {
  const key = getHistoryKey();
  let history: TestResult[];
  try {
    history = parseHistory(localStorage.getItem(key), key);
  } catch (error) {
    throw new Error("Не вдалося прочитати попередні результати тестів.", {
      cause: error,
    });
  }

  history.unshift(result);
  try {
    localStorage.setItem(key, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch (error) {
    throw new Error("Результат показано, але не вдалося його зберегти.", {
      cause: error,
    });
  }
}

export function getResultsForGrade(grade: Grade): TestResult[] {
  return loadHistory().filter((r) => r.grade === grade);
}

export function getWeakTypeIds(grade: Grade): Set<string> {
  const recent = getResultsForGrade(grade).slice(0, SESSIONS_TO_CONSIDER);
  const totals: Record<string, { sum: number; count: number }> = {};

  for (const result of recent) {
    for (const stat of result.typeStats) {
      if (!totals[stat.typeId]) totals[stat.typeId] = { sum: 0, count: 0 };
      totals[stat.typeId].sum += stat.level;
      totals[stat.typeId].count += 1;
    }
  }

  const weak = new Set<string>();
  for (const [typeId, { sum, count }] of Object.entries(totals)) {
    if (count > 0 && sum / count < WEAK_LEVEL_THRESHOLD) {
      weak.add(typeId);
    }
  }
  return weak;
}

export function levelFromStats(
  total: number,
  correct: number,
  finalDifficulty: Difficulty,
): number {
  if (total === 0) return 1;
  const ratio = correct / total;
  const difficultyScore =
    finalDifficulty === "hard" ? 1 : finalDifficulty === "medium" ? 0.5 : 0;
  const raw = ratio * 0.6 + difficultyScore * 0.4;
  return Math.max(1, Math.min(5, Math.round(raw * 4) + 1));
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(getHistoryKey());
  } catch (error) {
    console.error("Unable to clear stored test history.", error);
  }
}
