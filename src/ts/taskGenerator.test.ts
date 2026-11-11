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
    expect(GRADE_TASK_TYPES[2].map(({ id }) => id).sort()).toEqual(
      [
        "addition",
        "comparison",
        "division",
        "expressions",
        "measurements",
        "multiplication",
        "numeration",
        "subtraction",
        "word_problem",
      ].sort(),
    );
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

  it("generates grade 1 and grade 2 word problems with matching answers", () => {
    for (const grade of [1, 2] as const) {
      const max = grade === 1 ? 20 : 100;

      for (let sample = 0; sample < 100; sample += 1) {
        const question = generateQuestion(grade, "word_problem", "medium");
        const numbers = question.prompt.match(/\d+/g)?.map(Number) ?? [];
        const [first, second] = numbers;
        const expected =
          question.prompt.includes("разом") ||
          question.prompt.includes("стало")
          ? first + second
          : question.prompt.includes("залишилося")
            ? first - second
            : question.prompt.includes("коробках")
              ? first * second
              : first / second;

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
    it("rejects negative and fractional question counts", () => {
      expect(() => generateTestQuestions(2, -1, new Set())).toThrow(
        "non-negative integer",
      );
      expect(() => generateTestQuestions(2, 1.5, new Set())).toThrow(
        "non-negative integer",
      );
      expect(() =>
        generateTestQuestions(2, Number.POSITIVE_INFINITY, new Set()),
      ).toThrow("non-negative integer");
    });

    it("returns no questions for a zero-length test", () => {
      expect(generateTestQuestions(2, 0, new Set())).toEqual([]);
    });

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
      const weakTypeIds = new Set(GRADE_TASK_TYPES[1].map(({ id }) => id));
      const questions = generateTestQuestions(1, 8, weakTypeIds);

      expect(questions).toHaveLength(8);
      expect(questions.every(({ typeId }) => weakTypeIds.has(typeId))).toBe(
        true,
      );
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

  it("calculates every grade 2 through 4 arithmetic answer correctly", () => {
    for (let sample = 0; sample < 100; sample += 1) {
      for (const grade of [2, 3] as const) {
        for (const typeId of ["addition", "subtraction"] as const) {
          const question = generateQuestion(grade, typeId, "medium");
          const match = question.prompt.match(/^(\d+) ([+-]) (\d+) = \?$/);
          expect(match).not.toBeNull();
          if (!match) continue;
          const [, left, operator, right] = match;
          const expected =
            operator === "+"
              ? Number(left) + Number(right)
              : Number(left) - Number(right);
          expect(question.answer).toBe(String(expected));
        }
      }

      const multiplication = generateQuestion(3, "multiplication", "medium");
      const multiplicationMatch = multiplication.prompt.match(
        /^(\d+) × (\d+) = \?$/,
      );
      expect(multiplicationMatch).not.toBeNull();
      if (multiplicationMatch) {
        expect(multiplication.answer).toBe(
          String(Number(multiplicationMatch[1]) * Number(multiplicationMatch[2])),
        );
      }

      const division = generateQuestion(3, "division", "medium");
      const divisionMatch = division.prompt.match(/^(\d+) : (\d+) = \?$/);
      expect(divisionMatch).not.toBeNull();
      if (divisionMatch) {
        expect(division.answer).toBe(
          String(Number(divisionMatch[1]) / Number(divisionMatch[2])),
        );
      }

      const grade2Multiplication = generateQuestion(
        2,
        "multiplication",
        "medium",
      );
      const grade2MultiplicationMatch = grade2Multiplication.prompt.match(
        /^(\d+) × (\d+) = \?$/,
      );
      expect(grade2MultiplicationMatch).not.toBeNull();
      if (grade2MultiplicationMatch) {
        expect(grade2Multiplication.answer).toBe(
          String(
            Number(grade2MultiplicationMatch[1]) *
              Number(grade2MultiplicationMatch[2]),
          ),
        );
      }

      const grade2Division = generateQuestion(2, "division", "medium");
      const grade2DivisionMatch = grade2Division.prompt.match(
        /^(\d+) : (\d+) = \?$/,
      );
      expect(grade2DivisionMatch).not.toBeNull();
      if (grade2DivisionMatch) {
        expect(grade2Division.answer).toBe(
          String(
            Number(grade2DivisionMatch[1]) /
              Number(grade2DivisionMatch[2]),
          ),
        );
      }

      const grade2Expression = generateQuestion(2, "expressions", "medium");
      const grade2ExpressionMatch = grade2Expression.prompt.match(
        /^(\d+) \+ \((\d+) - (\d+)\) = \?$/,
      );
      if (grade2ExpressionMatch) {
        expect(grade2Expression.answer).toBe(
          String(
            Number(grade2ExpressionMatch[1]) +
              Number(grade2ExpressionMatch[2]) -
              Number(grade2ExpressionMatch[3]),
          ),
        );
      } else {
        const multiplicationExpressionMatch =
          grade2Expression.prompt.match(/^(\d+) × (\d+) \+ (\d+) = \?$/);
        expect(multiplicationExpressionMatch).not.toBeNull();
        if (multiplicationExpressionMatch) {
          expect(grade2Expression.answer).toBe(
            String(
              Number(multiplicationExpressionMatch[1]) *
                Number(multiplicationExpressionMatch[2]) +
                Number(multiplicationExpressionMatch[3]),
            ),
          );
        }
      }

      const expression = generateQuestion(4, "expressions", "medium");
      const expressionMatch = expression.prompt.match(
        /^(\d+) × (\d+) \+ (\d+) - (\d+) = \?$/,
      );
      expect(expressionMatch).not.toBeNull();
      if (expressionMatch) {
        const [, a, b, c, d] = expressionMatch.map(Number);
        expect(expression.answer).toBe(String(a * b + c - d));
      }

      const equation = generateQuestion(4, "equations", "medium");
      const equationMatch = equation.prompt.match(/^(\d+)x = (\d+)$/);
      expect(equationMatch).not.toBeNull();
      if (equationMatch) {
        expect(equation.answer).toBe(
          String(Number(equationMatch[2]) / Number(equationMatch[1])),
        );
      }
    }
  });

  it("generates number comparisons and curriculum-aligned measurement questions for grade 2", () => {
    for (let sample = 0; sample < 100; sample += 1) {
      const comparison = generateQuestion(2, "comparison", "medium");
      const match = comparison.prompt.match(
        /^Порівняй числа: (\d+) \? (\d+)$/,
      );
      if (match) {
        const expected = Number(match[1]) < Number(match[2]) ? "<" : ">";
        expect(comparison.answer).toBe(expected);
      } else {
        const expressionMatch = comparison.prompt.match(
          /^Порівняй вираз і число: (\d+) × (\d+) \+ (\d+) \? (\d+)$/,
        );
        expect(expressionMatch).not.toBeNull();
        if (expressionMatch) {
          const value =
            Number(expressionMatch[1]) * Number(expressionMatch[2]) +
            Number(expressionMatch[3]);
          const expected = value < Number(expressionMatch[4]) ? "<" : ">";
          expect(comparison.answer).toBe(expected);
        }
      }

      const measurement = generateQuestion(2, "measurements", "medium");
      const measurementMatch = measurement.prompt.match(
        /^Скільки (\S+) становлять (\d+) (\S+)\?$/,
      );
      expect(measurementMatch).not.toBeNull();
      if (measurementMatch) {
        const [, targetUnit, amount, sourceUnit] = measurementMatch;
        const factors: Record<string, number> = {
          м: 100,
          см: 10,
          год: 60,
          діб: 24,
          кг: 1000,
          ц: 100,
        };
        expect(factors[sourceUnit]).toBeDefined();
        expect(targetUnit).not.toBe(sourceUnit);
        expect(measurement.answer).toBe(
          String(Number(amount) * factors[sourceUnit]),
        );
      }
    }
  });

  it("calculates grade 2 numeration answers", () => {
    for (const difficulty of GRADE_DIFFICULTIES[2]) {
      for (let sample = 0; sample < 100; sample += 1) {
        const numeration = generateQuestion(2, "numeration", difficulty);
        const tensMatch = numeration.prompt.match(
          /розряді десятків числа (\d+)\?$/,
        );
        const nextMatch = numeration.prompt.match(/після числа (\d+)\?$/);
        const previousMatch = numeration.prompt.match(/перед числом (\d+)\?$/);

        if (tensMatch) {
          expect(numeration.answer).toBe(
            String(Math.floor(Number(tensMatch[1]) / 10)),
          );
        } else if (nextMatch) {
          expect(numeration.answer).toBe(String(Number(nextMatch[1]) + 1));
        } else {
          expect(previousMatch).not.toBeNull();
          if (previousMatch) {
            expect(numeration.answer).toBe(
              String(Number(previousMatch[1]) - 1),
            );
          }
        }

      }
    }
  });

  it("calculates grade 1 arithmetic and grade 4 expressions and word problems", () => {
    for (let sample = 0; sample < 100; sample += 1) {
      for (const typeId of ["addition", "subtraction"] as const) {
        const question = generateQuestion(1, typeId, "medium");
        const match = question.prompt.match(/^(\d+) ([+-]) (\d+) = \?$/);
        expect(match).not.toBeNull();
        if (match) {
          const expected =
            match[2] === "+"
              ? Number(match[1]) + Number(match[3])
              : Number(match[1]) - Number(match[3]);
          expect(question.answer).toBe(String(expected));
        }
      }

      const expression = generateQuestion(4, "expressions", "easy");
      const expressionMatch = expression.prompt.match(
        /^(\d+) ([+-]) (\d+) ([+-]) (\d+) = \?$/,
      );
      expect(expressionMatch).not.toBeNull();
      if (expressionMatch) {
        const [, first, firstOperator, second, secondOperator, third] =
          expressionMatch;
        const middle =
          firstOperator === "+"
            ? Number(first) + Number(second)
            : Number(first) - Number(second);
        const expected =
          secondOperator === "+"
            ? middle + Number(third)
            : middle - Number(third);
        expect(expression.answer).toBe(String(expected));
      }

      const equation = generateQuestion(4, "equations", "easy");
      const equationMatch = equation.prompt.match(/^x \+ (\d+) = (\d+)$/);
      expect(equationMatch).not.toBeNull();
      if (equationMatch) {
        expect(equation.answer).toBe(
          String(Number(equationMatch[2]) - Number(equationMatch[1])),
        );
      }

      for (const difficulty of GRADE_DIFFICULTIES[4]) {
        const wordProblem = generateQuestion(4, "word_problem", difficulty);
        const numbers = wordProblem.prompt.match(/\d+/g)?.map(Number) ?? [];
        let expected: number;
        if (wordProblem.prompt.startsWith("У кошику")) {
          expected = numbers[0] - numbers[1];
        } else if (wordProblem.prompt.startsWith("У хлопчика")) {
          expected = numbers[0] + numbers[1];
        } else if (wordProblem.prompt.startsWith("У класі")) {
          expected = numbers[0] + numbers[1] - numbers[2];
        } else {
          expected = numbers[2] - numbers[0] * numbers[1];
        }
        expect(wordProblem.answer).toBe(String(expected));
      }
    }
  });

  it("rejects an invalid grade passed at runtime", () => {
    expect(() => generateQuestion(5 as Grade, "addition", "easy")).toThrow(
      "No generator for grade 5",
    );
    expect(() => generateTestQuestions(5 as Grade, 1, new Set())).toThrow(
      "No task types are available for grade 5",
    );
  });
});
