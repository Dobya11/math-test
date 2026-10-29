import { describe, expect, it } from "vitest";
import {
  decreaseDifficulty,
  GRADE_DIFFICULTIES,
  GRADE_TASK_TYPES,
  generateQuestion,
  generateTestQuestions,
} from "./taskGenerator.ts";
import type { Grade } from "./types.ts";

const grades: Grade[] = [1, 2, 3, 4];

describe("generateQuestion", () => {
  it("keeps topics appropriate for each grade", () => {
    expect(GRADE_TASK_TYPES[1].map(({ id }) => id)).toContain("word_problem");
    expect(GRADE_TASK_TYPES[2].map(({ id }) => id)).toContain("word_problem");
    expect(GRADE_TASK_TYPES[2].map(({ id }) => id)).not.toContain(
      "multiplication",
    );
    expect(GRADE_TASK_TYPES[2].map(({ id }) => id)).not.toContain("division");
    expect(GRADE_TASK_TYPES[3].map(({ id }) => id)).toEqual([
      "addition",
      "subtraction",
      "multiplication",
      "division",
    ]);
    expect(GRADE_TASK_TYPES[3].map(({ id }) => id)).not.toContain("geometry");
  });

  it("generates valid questions for every grade, task type, and difficulty", () => {
    for (const grade of grades) {
      for (const taskType of GRADE_TASK_TYPES[grade]) {
        for (const difficulty of GRADE_DIFFICULTIES[grade]) {
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

  it("avoids zero operands and answers in grades 1 through 3", () => {
    for (const grade of [1, 2, 3] as const) {
      for (const taskType of GRADE_TASK_TYPES[grade]) {
        for (const difficulty of GRADE_DIFFICULTIES[grade]) {
          for (let sample = 0; sample < 100; sample += 1) {
            const question = generateQuestion(grade, taskType.id, difficulty);

            expect(question.prompt).not.toMatch(/(?:^|[^\d])0(?:$|[^\d])/);
            expect(question.answer).not.toBe("0");
          }
        }
      }
    }
  });

  it("generates simple addition and subtraction word problems for grades 1 and 2", () => {
    for (const grade of [1, 2] as const) {
      const max = grade === 1 ? 20 : 100;

      for (let sample = 0; sample < 100; sample += 1) {
        const question = generateQuestion(grade, "word_problem", "medium");
        const numbers = question.prompt.match(/\d+/g)?.map(Number) ?? [];
        const [first, second] = numbers;
        const expected =
          question.prompt.includes("разом") || question.prompt.includes("ще")
            ? first + second
            : first - second;

        expect(numbers).toHaveLength(2);
        expect(numbers.every((number) => number <= max)).toBe(true);
        expect(question.answer).toBe(String(expected));
      }
    }
  });

  it("avoids carrying and borrowing in grade 1 arithmetic and word problems", () => {
    for (const typeId of ["addition", "subtraction", "word_problem"]) {
      for (const difficulty of GRADE_DIFFICULTIES[1]) {
        for (let sample = 0; sample < 100; sample += 1) {
          const question = generateQuestion(1, typeId, difficulty);
          const numbers = question.prompt.match(/\d+/g)?.map(Number) ?? [];
          const [first, second] = numbers;

          if (typeId === "addition" || question.prompt.includes("разом")) {
            expect((first % 10) + (second % 10)).toBeLessThan(10);
          } else {
            expect(first % 10).toBeGreaterThanOrEqual(second % 10);
          }
        }
      }
    }
  });

  it("offers only easy and medium difficulty for every grade", () => {
    for (const grade of grades) {
      expect(GRADE_DIFFICULTIES[grade]).toEqual(["easy", "medium"]);
    }
  });

  describe("generateTestQuestions", () => {
    it("allocates at least two thirds of a test to weak topics", () => {
      const questions = generateTestQuestions(
        3,
        12,
        new Set(["multiplication"]),
      );

      expect(questions).toHaveLength(12);
      expect(
        questions.filter(({ typeId }) => typeId === "multiplication"),
      ).toHaveLength(8);
    });

    it("uses only weak topics when all topics are weak", () => {
      const weakTypeIds = new Set(
        GRADE_TASK_TYPES[1].map(({ id }) => id),
      );
      const questions = generateTestQuestions(1, 8, weakTypeIds);

      expect(questions).toHaveLength(8);
      expect(
        questions.every(({ typeId }) => weakTypeIds.has(typeId)),
      ).toBe(true);
    });

    it("uses all grade topics when there are no weak topics", () => {
      const questions = generateTestQuestions(2, 12, new Set());

      expect(questions).toHaveLength(12);
      expect(
        questions.every(({ typeId }) =>
          GRADE_TASK_TYPES[2].some((type) => type.id === typeId),
        ),
      ).toBe(true);
    });
  });

  describe("decreaseDifficulty", () => {
    it("lowers medium difficulty while keeping easy as the minimum", () => {
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
