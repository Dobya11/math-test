import { generateQuestion } from "./taskGenerator.ts";
import type { Difficulty, Question } from "./types.ts";

export const ASSIGNMENT_TOPICS = [
  "Повторення матеріалу 1 класу",
  "Додавання і віднімання в межах 20",
  "Додавання двоцифрових чисел",
  "Віднімання двоцифрових чисел",
  "Числа, нумерація та порівняння",
  "Вирази й порядок дій",
  "Текстові задачі",
  "Величини та вимірювання",
  "Геометрія й периметр",
  "Множення та ділення",
] as const;

export interface AssignmentQuestionDraft {
  topic: string;
  prompt: string;
  answer_type: Question["answerType"];
  correct_answer: string;
  options: string[] | null;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function shuffle<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function generateGeometryQuestion(difficulty: Difficulty): Question {
  const firstSide = randomInt(3, difficulty === "easy" ? 9 : 20);
  const isSquare = Math.random() < 0.5;
  const secondSide = isSquare ? firstSide : randomInt(2, firstSide - 1);
  const answer = 2 * (firstSide + secondSide);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    grade: 2,
    typeId: "geometry",
    typeLabel: "Геометрія й периметр",
    difficulty,
    prompt: isSquare
      ? `Знайди периметр квадрата зі стороною ${firstSide} см.`
      : `Знайди периметр прямокутника зі сторонами ${firstSide} см і ${secondSide} см.`,
    answer: String(answer),
    answerType: "number",
  };
}

function generateForTopic(topic: string, difficulty: Difficulty): Question {
  switch (topic) {
    case "Повторення матеріалу 1 класу":
      return generateQuestion(
        1,
        pick(["addition", "subtraction", "compare", "word_problem"]),
        difficulty,
      );
    case "Додавання і віднімання в межах 20":
      return generateQuestion(1, pick(["addition", "subtraction"]), difficulty);
    case "Додавання двоцифрових чисел":
      return generateQuestion(2, "addition", "medium");
    case "Віднімання двоцифрових чисел": {
      const first = randomInt(21, 99);
      const second = randomInt(10, first - 10);
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        grade: 2,
        typeId: "subtraction",
        typeLabel: "Віднімання",
        difficulty,
        prompt: `${first} - ${second} = ?`,
        answer: String(first - second),
        answerType: "number",
      };
    }
    case "Числа, нумерація та порівняння":
      return generateQuestion(
        2,
        pick(["numeration", "comparison"]),
        difficulty,
      );
    case "Вирази й порядок дій":
      return generateQuestion(2, "expressions", difficulty);
    case "Текстові задачі":
      return generateQuestion(2, "word_problem", difficulty);
    case "Величини та вимірювання":
      return generateQuestion(2, "measurements", difficulty);
    case "Геометрія й периметр":
      return generateGeometryQuestion(difficulty);
    case "Множення та ділення":
      return generateQuestion(
        2,
        pick(["multiplication", "division"]),
        difficulty,
      );
    default:
      throw new Error(`Невідома тема завдання: ${topic}`);
  }
}

function makeOptions(question: Question): string[] {
  if (question.answerType === "comparator") {
    return shuffle(["<", "=", ">"]);
  }

  const answer = Number(question.answer);
  if (!Number.isFinite(answer)) {
    throw new Error(
      "Для варіантів відповіді потрібна числова правильна відповідь.",
    );
  }

  const options = new Set([question.answer]);
  for (const offset of [1, -1, 2, -2, 10, -10, 5, -5, 20, -20]) {
    const distractor = answer + offset;
    if (distractor >= 0) options.add(String(distractor));
    if (options.size === 4) break;
  }
  if (options.size !== 4) {
    throw new Error("Не вдалося створити варіанти відповіді.");
  }
  return shuffle([...options]);
}

export function generateAssignmentQuestions(
  topics: string[],
  questionsPerTopic: number,
): AssignmentQuestionDraft[] {
  if (
    topics.length === 0 ||
    topics.some(
      (topic) =>
        !ASSIGNMENT_TOPICS.some((allowedTopic) => allowedTopic === topic),
    ) ||
    new Set(topics).size !== topics.length
  ) {
    throw new Error("Оберіть одну або кілька різних навчальних тем.");
  }
  if (![4, 8, 12].includes(questionsPerTopic)) {
    throw new Error("Кількість завдань на тему має бути 4, 8 або 12.");
  }

  return topics.flatMap((topic) =>
    Array.from({ length: questionsPerTopic }, (_, index) => {
      const difficulty: Difficulty =
        index < Math.ceil(questionsPerTopic / 2) ? "easy" : "medium";
      const question = generateForTopic(topic, difficulty);
      const isComparatorQuestion = question.answerType === "comparator";
      const usesTextInput =
        !isComparatorQuestion &&
        (question.typeId === "word_problem" ||
          (question.typeId === "measurements" && index % 2 === 0) ||
          index % 4 === 3);

      return {
        topic,
        prompt: question.prompt,
        answer_type: question.answerType,
        correct_answer: question.answer,
        options: usesTextInput ? null : makeOptions(question),
      };
    }),
  );
}
