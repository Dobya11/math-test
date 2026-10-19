import { describe, expect, it } from "vitest";
import {
  decreaseDifficulty,
  GRADE_TASK_TYPES,
  generateQuestion,
} from "./taskGenerator.ts";
import type { Difficulty, Grade } from "./types.ts";

const grades: Grade[] = [1, 2, 3, 4];
const difficulties: Difficulty[] = ["easy", "medium", "hard"];

describe("generateQuestion", () => {
  it("generates valid questions for every grade, task type, and difficulty", () => {
    for (const grade of grades) {
      for (const taskType of GRADE_TASK_TYPES[grade]) {
        for (const difficulty of difficulties) {
          for (let sample = 0; sample < 25; sample += 1) {
            const question = generateQuestion(grade, taskType.id, difficulty);

            expect(question.grade).toBe(grade);
            expect(question.typeId).toBe(taskType.id);
            expect(question.typeLabel).toBe(taskType.label);
            expect(question.difficulty).toBe(difficulty);
            expect(question.prompt.trim()).not.toBe("");
            expect(question.answer.trim()).not.toBe("");

            if (question.answerType === "number") {
              expect(Number.isFinite(Number(question.answer))).toBe(true);
            } else if (question.answerType === "comparator") {
              expect(["<", "=", ">"]).toContain(question.answer);
            }
          }
        }
      }
    }
  });

  describe("decreaseDifficulty", () => {
    it("lowers hard and medium difficulty while keeping easy as the minimum", () => {
      expect(decreaseDifficulty("hard")).toBe("medium");
      expect(decreaseDifficulty("medium")).toBe("easy");
      expect(decreaseDifficulty("easy")).toBe("easy");
    });
  });

  it("rejects unknown task types", () => {
    expect(() => generateQuestion(1, "unknown", "easy")).toThrow(
      "No generator for grade 1, type unknown",
    );
  });

  it("generates comparisons whose answer matches the displayed numbers", () => {
    for (let sample = 0; sample < 100; sample += 1) {
      const question = generateQuestion(1, "compare", "medium");
      const match = question.prompt.match(/^Порівняй: (\d+) \? (\d+)$/);

      expect(match).not.toBeNull();
      if (!match) continue;

      const left = Number(match[1]);
      const right = Number(match[2]);
      const expected = left < right ? "<" : left > right ? ">" : "=";
      expect(question.answer).toBe(expected);
    }
  });
});
