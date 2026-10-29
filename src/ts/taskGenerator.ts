import type {
  Grade,
  Difficulty,
  Question,
  TaskTypeConfig,
  AnswerType,
} from "./types";

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function build(
  grade: Grade,
  typeId: string,
  typeLabel: string,
  difficulty: Difficulty,
  prompt: string,
  answer: number | string,
  answerType: AnswerType = "number",
  hint?: string,
): Question {
  return {
    id: makeId(),
    grade,
    typeId,
    typeLabel,
    difficulty,
    prompt,
    answer: String(answer),
    answerType,
    hint,
  };
}

export const GRADE_TASK_TYPES: Record<Grade, TaskTypeConfig[]> = {
  1: [
    { id: "addition", label: "Додавання" },
    { id: "subtraction", label: "Віднімання" },
    { id: "compare", label: "Порівняння" },
    { id: "word_problem", label: "Текстова задача" },
  ],
  2: [
    { id: "addition", label: "Додавання" },
    { id: "subtraction", label: "Віднімання" },
    { id: "word_problem", label: "Текстова задача" },
  ],
  3: [
    { id: "addition", label: "Додавання" },
    { id: "subtraction", label: "Віднімання" },
    { id: "multiplication", label: "Множення" },
    { id: "division", label: "Ділення" },
  ],
  4: [
    { id: "expressions", label: "Вирази" },
    { id: "equations", label: "Рівняння" },
    { id: "word_problem", label: "Текстова задача" },
  ],
};

export const GRADE_DIFFICULTIES: Record<Grade, Difficulty[]> = {
  1: ["easy", "medium"],
  2: ["easy", "medium"],
  3: ["easy", "medium"],
  4: ["easy", "medium"],
};

function additionOperandsWithoutCarry(max: number): [number, number] {
  let a: number;
  let b: number;

  do {
    a = randInt(1, max - 1);
    b = randInt(1, max - a);
  } while ((a % 10) + (b % 10) >= 10);

  return [a, b];
}

function subtractionOperandsWithoutBorrow(max: number): [number, number] {
  let a: number;
  let b: number;

  do {
    a = randInt(2, max);
    b = randInt(1, a - 1);
  } while (b % 10 > a % 10);

  return [a, b];
}

function g1_addition(difficulty: Difficulty): Question {
  const max = difficulty === "easy" ? 10 : 20;
  const [a, b] = additionOperandsWithoutCarry(max);
  return build(
    1,
    "addition",
    "Додавання",
    difficulty,
    `${a} + ${b} = ?`,
    a + b,
  );
}

function g1_subtraction(difficulty: Difficulty): Question {
  const max = difficulty === "easy" ? 10 : 20;
  const [a, b] = subtractionOperandsWithoutBorrow(max);
  return build(
    1,
    "subtraction",
    "Віднімання",
    difficulty,
    `${a} - ${b} = ?`,
    a - b,
  );
}

function g1_compare(difficulty: Difficulty): Question {
  const max = difficulty === "easy" ? 10 : 20;
  const a = randInt(1, max);
  const b = randInt(1, max);
  const answer = a < b ? "<" : a > b ? ">" : "=";
  return build(
    1,
    "compare",
    "Порівняння",
    difficulty,
    `Порівняй: ${a} ? ${b}`,
    answer,
    "comparator",
  );
}

function g2_addition(difficulty: Difficulty): Question {
  const max = difficulty === "easy" ? 20 : 100;
  const a = randInt(10, max - 1);
  const b = randInt(1, max - a);
  return build(
    2,
    "addition",
    "Додавання",
    difficulty,
    `${a} + ${b} = ?`,
    a + b,
  );
}

function g2_subtraction(difficulty: Difficulty): Question {
  const max = difficulty === "easy" ? 20 : 100;
  const a = randInt(10, max);
  const b = randInt(1, a - 1);
  return build(
    2,
    "subtraction",
    "Віднімання",
    difficulty,
    `${a} - ${b} = ?`,
    a - b,
  );
}

function g3_addition(difficulty: Difficulty): Question {
  const max = difficulty === "easy" ? 100 : 1000;
  const a = randInt(10, max - 1);
  const b = randInt(1, max - a);
  return build(
    3,
    "addition",
    "Додавання",
    difficulty,
    `${a} + ${b} = ?`,
    a + b,
  );
}

function g3_subtraction(difficulty: Difficulty): Question {
  const max = difficulty === "easy" ? 100 : 1000;
  const a = randInt(10, max);
  const b = randInt(1, a - 1);
  return build(
    3,
    "subtraction",
    "Віднімання",
    difficulty,
    `${a} - ${b} = ?`,
    a - b,
  );
}

function g3_multiplication(difficulty: Difficulty): Question {
  const maxFactor = difficulty === "easy" ? 5 : 9;
  const a = randInt(2, maxFactor);
  const b = randInt(2, maxFactor);
  return build(
    3,
    "multiplication",
    "Множення",
    difficulty,
    `${a} × ${b} = ?`,
    a * b,
  );
}

function g3_division(difficulty: Difficulty): Question {
  const maxFactor = difficulty === "easy" ? 5 : 9;
  const divisor = randInt(2, maxFactor);
  const quotient = randInt(2, maxFactor);
  return build(
    3,
    "division",
    "Ділення",
    difficulty,
    `${divisor * quotient} : ${divisor} = ?`,
    quotient,
  );
}

function g1_word_problem(difficulty: Difficulty): Question {
  const max = difficulty === "easy" ? 10 : 20;
  const isAddition = Math.random() < 0.5;
  const [a, b] = isAddition
    ? additionOperandsWithoutCarry(max)
    : subtractionOperandsWithoutBorrow(max);
  const prompt = isAddition
    ? `У хлопчика ${a} яблук, а в дівчинки ${b}. Скільки яблук у них разом?`
    : `У хлопчика було ${a} яблук. Він віддав ${b}. Скільки яблук залишилося?`;
  return build(
    1,
    "word_problem",
    "Текстова задача",
    difficulty,
    prompt,
    isAddition ? a + b : a - b,
  );
}

function g2_word_problem(difficulty: Difficulty): Question {
  const max = difficulty === "easy" ? 20 : 100;
  const isAddition = Math.random() < 0.5;
  const a = randInt(10, isAddition ? max - 1 : max);
  const b = randInt(1, isAddition ? max - a : a - 1);
  const prompt = isAddition
    ? `У бібліотеці було ${a} книжок, а потім принесли ще ${b}. Скільки книжок стало?`
    : `У бібліотеці було ${a} книжок. ${b} книжок узяли читачі. Скільки книжок залишилося?`;
  return build(
    2,
    "word_problem",
    "Текстова задача",
    difficulty,
    prompt,
    isAddition ? a + b : a - b,
  );
}

function evalChain(nums: number[], ops: string[]): number {
  const values = [...nums];
  const operators = [...ops];
  let i = 0;
  while (i < operators.length) {
    if (operators[i] === "×" || operators[i] === ":") {
      const res =
        operators[i] === "×"
          ? values[i] * values[i + 1]
          : values[i] / values[i + 1];
      values.splice(i, 2, res);
      operators.splice(i, 1);
    } else {
      i++;
    }
  }
  let total = values[0];
  for (let j = 0; j < operators.length; j++) {
    total =
      operators[j] === "+" ? total + values[j + 1] : total - values[j + 1];
  }
  return total;
}

function g4_expressions(difficulty: Difficulty): Question {
  if (difficulty === "easy") {
    const a = randInt(10, 50);
    const b = randInt(1, 30);
    const c = randInt(1, 30);
    const op1 = Math.random() < 0.5 ? "+" : "-";
    const op2 = Math.random() < 0.5 ? "+" : "-";
    const answer = evalChain([a, b, c], [op1, op2]);
    return build(
      4,
      "expressions",
      "Вирази",
      difficulty,
      `${a} ${op1} ${b} ${op2} ${c} = ?`,
      answer,
    );
  }

  const a = randInt(2, 10);
  const b = randInt(2, 10);
  const c = randInt(1, 20);
  const d = randInt(1, 20);
  const answer = evalChain([a, b, c, d], ["×", "+", "-"]);
  return build(
    4,
    "expressions",
    "Вирази",
    difficulty,
    `${a} × ${b} + ${c} - ${d} = ?`,
    answer,
  );
}

function g4_equations(difficulty: Difficulty): Question {
  if (difficulty === "easy") {
    const x = randInt(1, 40);
    const a = randInt(1, 40);
    const c = x + a;
    return build(4, "equations", "Рівняння", difficulty, `x + ${a} = ${c}`, x);
  }
  const x = randInt(2, 12);
  const a = randInt(2, 9);
  const c = a * x;
  return build(4, "equations", "Рівняння", difficulty, `${a}x = ${c}`, x);
}

interface WordTemplate {
  build: () => { prompt: string; answer: number };
}

const wordTemplatesEasy: WordTemplate[] = [
  {
    build: () => {
      const a = randInt(10, 50);
      const b = randInt(1, a - 1);
      return {
        prompt: `У кошику було ${a} яблук. З'їли ${b} яблук. Скільки яблук залишилось?`,
        answer: a - b,
      };
    },
  },
  {
    build: () => {
      const a = randInt(5, 40);
      const b = randInt(1, 40);
      return {
        prompt: `У хлопчика ${a} наліпок, а в дівчинки ${b} наліпок. Скільки наліпок у них разом?`,
        answer: a + b,
      };
    },
  },
];

const wordTemplatesMedium: WordTemplate[] = [
  {
    build: () => {
      const boys = randInt(10, 20);
      const girls = randInt(10, 20);
      const left = randInt(1, boys + girls - 1);
      return {
        prompt: `У класі ${boys} хлопців і ${girls} дівчат. ${left} учнів пішли на екскурсію. Скільки учнів залишилось у класі?`,
        answer: boys + girls - left,
      };
    },
  },
  {
    build: () => {
      const price = randInt(5, 20);
      const count = randInt(2, 9);
      const paid = price * count + randInt(1, 20);
      return {
        prompt: `Зошит коштує ${price} грн. Купили ${count} зошитів і заплатили ${paid} грн. Скільки грн решти отримали?`,
        answer: paid - price * count,
      };
    },
  },
];

function g4_word_problem(difficulty: Difficulty): Question {
  const templates =
    difficulty === "easy"
      ? wordTemplatesEasy
      : wordTemplatesMedium;
  const { prompt, answer } = pick(templates).build();
  return build(
    4,
    "word_problem",
    "Текстова задача",
    difficulty,
    prompt,
    answer,
  );
}

type GeneratorFn = (difficulty: Difficulty) => Question;

const GENERATORS: Record<Grade, Record<string, GeneratorFn>> = {
  1: {
    addition: g1_addition,
    subtraction: g1_subtraction,
    compare: g1_compare,
    word_problem: g1_word_problem,
  },
  2: {
    addition: g2_addition,
    subtraction: g2_subtraction,
    word_problem: g2_word_problem,
  },
  3: {
    addition: g3_addition,
    subtraction: g3_subtraction,
    multiplication: g3_multiplication,
    division: g3_division,
  },
  4: {
    expressions: g4_expressions,
    equations: g4_equations,
    word_problem: g4_word_problem,
  },
};

export function generateQuestion(
  grade: Grade,
  typeId: string,
  difficulty: Difficulty,
): Question {
  if (!GRADE_DIFFICULTIES[grade].includes(difficulty)) {
    throw new Error(
      `Difficulty ${difficulty} is not available for grade ${grade}`,
    );
  }

  const fn = GENERATORS[grade]?.[typeId];
  if (!fn) {
    throw new Error(`No generator for grade ${grade}, type ${typeId}`);
  }
  return fn(difficulty);
}

export function generateTestQuestions(
  grade: Grade,
  questionCount: number,
  weakTypeIds: ReadonlySet<string>,
): Question[] {
  const taskTypes = GRADE_TASK_TYPES[grade];
  const weakTypes = taskTypes.filter(({ id }) => weakTypeIds.has(id));
  const otherTypes = taskTypes.filter(({ id }) => !weakTypeIds.has(id));
  const hasOtherTypes = weakTypes.length > 0 && otherTypes.length > 0;
  const weakQuestionCount = hasOtherTypes
    ? Math.ceil((questionCount * 2) / 3)
    : questionCount;
  const selectedTypes: TaskTypeConfig[] = [];

  for (let i = 0; i < questionCount; i += 1) {
    const types =
      weakTypes.length === 0
        ? taskTypes
        : i < weakQuestionCount || otherTypes.length === 0
          ? weakTypes
          : otherTypes;
    selectedTypes.push(types[randInt(0, types.length - 1)]);
  }

  for (let i = selectedTypes.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    [selectedTypes[i], selectedTypes[j]] = [selectedTypes[j], selectedTypes[i]];
  }

  return selectedTypes.map(({ id }, index) => {
    const progress = index / Math.max(questionCount - 1, 1);
    const difficulty: Difficulty = progress < 0.5 ? "easy" : "medium";
    return generateQuestion(grade, id, difficulty);
  });
}

export function decreaseDifficulty(difficulty: Difficulty): Difficulty {
  return difficulty === "medium" ? "easy" : difficulty;
}
