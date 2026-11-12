import { describe, expect, it } from "vitest";
import {
  ASSIGNMENT_TOPICS,
  generateAssignmentQuestions,
} from "./assignmentGenerator.ts";

describe("generateAssignmentQuestions", () => {
  it("generates the requested number of questions for every selected topic", () => {
    const questions = generateAssignmentQuestions([...ASSIGNMENT_TOPICS], 4);

    expect(questions).toHaveLength(ASSIGNMENT_TOPICS.length * 4);
    for (const topic of ASSIGNMENT_TOPICS) {
      expect(
        questions.filter((question) => question.topic === topic),
      ).toHaveLength(4);
    }
    expect(
      questions.every(({ prompt, correct_answer }) => prompt && correct_answer),
    ).toBe(true);
  });

  it("provides answer choices and text-entry word problems", () => {
    const questions = generateAssignmentQuestions(["Текстові задачі"], 12);

    expect(questions.every(({ options }) => options === null)).toBe(true);

    const choiceQuestions = generateAssignmentQuestions(
      ["Додавання двоцифрових чисел", "Числа, нумерація та порівняння"],
      8,
    );
    expect(choiceQuestions.some(({ options }) => options !== null)).toBe(true);
    for (const question of choiceQuestions) {
      if (!question.options) continue;
      expect(question.options).toContain(question.correct_answer);
      expect(new Set(question.options).size).toBe(question.options.length);
      expect(question.options.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("generates perimeter questions with the matching numeric answer", () => {
    const questions = generateAssignmentQuestions(["Геометрія й периметр"], 12);

    for (const question of questions) {
      const sides = question.prompt.match(/\d+/g)?.map(Number) ?? [];
      const expected =
        sides.length === 1 ? 4 * sides[0] : 2 * (sides[0] + sides[1]);
      expect(question.correct_answer).toBe(String(expected));
      if (question.options) {
        expect(question.options).toContain(question.correct_answer);
      }
    }
    expect(questions.some(({ options }) => options !== null)).toBe(true);
  });

  it("uses two-digit operands and results for two-digit subtraction", () => {
    const questions = generateAssignmentQuestions(
      ["Віднімання двоцифрових чисел"],
      12,
    );

    for (const question of questions) {
      const [minuend, subtrahend] =
        question.prompt.match(/\d+/g)?.map(Number) ?? [];
      expect(minuend).toBeGreaterThanOrEqual(21);
      expect(subtrahend).toBeGreaterThanOrEqual(10);
      expect(minuend - subtrahend).toBeGreaterThanOrEqual(10);
      expect(question.correct_answer).toBe(String(minuend - subtrahend));
    }
  });

  it("rejects unknown, duplicate, or empty topics and unsupported counts", () => {
    expect(() => generateAssignmentQuestions([], 4)).toThrow();
    expect(() => generateAssignmentQuestions(["Неіснуюча тема"], 4)).toThrow();
    expect(() =>
      generateAssignmentQuestions(["Текстові задачі", "Текстові задачі"], 4),
    ).toThrow();
    expect(() => generateAssignmentQuestions(["Текстові задачі"], 5)).toThrow();
  });
});
