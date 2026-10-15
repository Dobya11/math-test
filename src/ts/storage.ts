import type { Grade, TestResult, Difficulty } from "./types.ts";
import { getActiveAccountId } from "./accounts.ts";

const STORAGE_KEY = "mathTest_history_v1";
const MAX_HISTORY = 30;
const SESSIONS_TO_CONSIDER = 5;
const WEAK_LEVEL_THRESHOLD = 3;

function getHistoryKey(): string {
  const accountId = getActiveAccountId();
  return accountId ? `${STORAGE_KEY}_${accountId}` : STORAGE_KEY;
}

function loadHistoryFromKey(key: string): TestResult[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
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
  try {
    const history = loadHistory();
    history.unshift(result);
    localStorage.setItem(
      getHistoryKey(),
      JSON.stringify(history.slice(0, MAX_HISTORY)),
    );
  } catch {
    // ignore
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
  } catch {
    // ignore
  }
}
