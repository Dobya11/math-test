export type Grade = 1 | 2 | 3 | 4;
export type Difficulty = "easy" | "medium" | "hard";
export type AnswerType = "number" | "comparator" | "text";

export interface TaskTypeConfig {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  grade: Grade;
  typeId: string;
  typeLabel: string;
  difficulty: Difficulty;
  prompt: string;
  hint?: string;
  answer: string;
  answerType: AnswerType;
}

export interface AnsweredQuestion extends Question {
  userAnswer: string;
  isCorrect: boolean;
  timeSpentMs: number;
}

export interface TypeStat {
  typeId: string;
  typeLabel: string;
  total: number;
  correct: number;
  finalDifficulty: Difficulty;
  level: number;
}

export interface TestResult {
  id: string;
  date: string;
  grade: Grade;
  totalQuestions: number;
  correctAnswers: number;
  timeLimitSec: number | null;
  timeTakenMs: number;
  typeStats: TypeStat[];
  bestTypeId: string | null;
  worstTypeId: string | null;
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Легка",
  medium: "Середня",
  hard: "Складна",
};
export interface User {
  id: string;
  name: string;
  role: "teacher" | "student";
}
