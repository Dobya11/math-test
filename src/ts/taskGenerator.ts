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
    { id: "numeration", label: "Числа та нумерація" },
    { id: "comparison", label: "Порівняння чисел і виразів" },
    { id: "addition", label: "Додавання" },
    { id: "subtraction", label: "Віднімання" },
    { id: "expressions", label: "Вирази та порядок дій" },
    { id: "multiplication", label: "Множення" },
    { id: "division", label: "Ділення" },
    { id: "word_problem", label: "Текстова задача" },
    { id: "measurements", label: "Величини та вимірювання" },
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
  const a =
    difficulty === "easy" ? randInt(1, 19) : randInt(10, 79);
  const b =
    difficulty === "easy" ? randInt(1, 20 - a) : randInt(10, 99 - a);
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
  const a = difficulty === "easy" ? randInt(11, 20) : randInt(21, 99);
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
  const operationCount = difficulty === "easy" ? 2 : 4;
  const operation = randInt(0, operationCount - 1);
  let prompt: string;
  let answer: number;

  if (operation === 0) {
    const a = randInt(10, 79);
    const b = randInt(1, 99 - a);
    prompt = `У бібліотеці було ${a} книжок, а потім принесли ще ${b}. Скільки книжок стало?`;
    answer = a + b;
  } else if (operation === 1) {
    const a = randInt(11, 99);
    const b = randInt(1, a - 1);
    prompt = `У бібліотеці було ${a} книжок. ${b} книжок узяли читачі. Скільки книжок залишилося?`;
    answer = a - b;
  } else if (operation === 2) {
    const boxes = randInt(2, 9);
    const itemsPerBox = randInt(2, 9);
    prompt = `У ${boxes} коробках лежить по ${itemsPerBox} олівців. Скільки олівців усього?`;
    answer = boxes * itemsPerBox;
  } else {
    const groups = randInt(2, 9);
    const itemsPerGroup = randInt(2, 9);
    prompt = `${groups * itemsPerGroup} яблук розклали порівну у ${groups} кошиків. Скільки яблук у кожному кошику?`;
    answer = itemsPerGroup;
  }

  return build(
    2,
    "word_problem",
    "Текстова задача",
    difficulty,
    prompt,
    answer,
  );
}

function g2_numeration(difficulty: Difficulty): Question {
  const min = difficulty === "easy" ? 11 : 21;
  const max = difficulty === "easy" ? 20 : 99;
  const number = randInt(min, max);
  const choice = randInt(0, 2);

  if (choice === 0) {
    return build(
      2,
      "numeration",
      "Числа та нумерація",
      difficulty,
      `Яка цифра стоїть у розряді десятків числа ${number}?`,
      Math.floor(number / 10),
    );
  }
  if (choice === 1) {
    return build(
      2,
      "numeration",
      "Числа та нумерація",
      difficulty,
      `Яке число буде наступним після числа ${number}?`,
      number + 1,
    );
  }
  return build(
    2,
    "numeration",
    "Числа та нумерація",
    difficulty,
    `Яке число було перед числом ${number}?`,
    number - 1,
  );
}

function g2_comparison(difficulty: Difficulty): Question {
  const min = difficulty === "easy" ? 10 : 21;
  const max = difficulty === "easy" ? 20 : 99;
  let prompt: string;
  let left: number;
  let right: number;

  if (difficulty === "medium" && Math.random() < 0.5) {
    const first = randInt(2, 9);
    const second = randInt(2, 9);
    const addend = randInt(1, 20);
    right = randInt(20, 99);
    left = first * second + addend;
    while (left === right) {
      right = randInt(20, 99);
    }
    prompt = `Порівняй вираз і число: ${first} × ${second} + ${addend} ? ${right}`;
  } else {
    left = randInt(min, max);
    right = randInt(min, max);
    while (left === right) {
      right = randInt(min, max);
    }
    prompt = `Порівняй числа: ${left} ? ${right}`;
  }

  const answer = left < right ? "<" : ">";
  return build(
    2,
    "comparison",
    "Порівняння чисел і виразів",
    difficulty,
    prompt,
    answer,
    "comparator",
  );
}

function g2_expressions(difficulty: Difficulty): Question {
  if (difficulty === "medium" && Math.random() < 0.5) {
    const first = randInt(2, 9);
    const second = randInt(2, 9);
    const third = randInt(1, 20);
    return build(
      2,
      "expressions",
      "Вирази та порядок дій",
      difficulty,
      `${first} × ${second} + ${third} = ?`,
      first * second + third,
    );
  }

  const first = difficulty === "easy" ? randInt(5, 20) : randInt(20, 70);
  const second = randInt(2, difficulty === "easy" ? 10 : 30);
  const third = randInt(1, second - 1);
  const answer = first + second - third;
  return build(
    2,
    "expressions",
    "Вирази та порядок дій",
    difficulty,
    `${first} + (${second} - ${third}) = ?`,
    answer,
  );
}

function g2_multiplication(difficulty: Difficulty): Question {
  const maxFactor = difficulty === "easy" ? 5 : 9;
  const left = randInt(1, maxFactor);
  const right = randInt(2, maxFactor);
  return build(
    2,
    "multiplication",
    "Множення",
    difficulty,
    `${left} × ${right} = ?`,
    left * right,
  );
}

function g2_division(difficulty: Difficulty): Question {
  const maxFactor = difficulty === "easy" ? 5 : 9;
  const divisor = randInt(1, maxFactor);
  const quotient = randInt(1, maxFactor);
  return build(
    2,
    "division",
    "Ділення",
    difficulty,
    `${divisor * quotient} : ${divisor} = ?`,
    quotient,
  );
}

function g2_measurements(difficulty: Difficulty): Question {
  const multiplier = randInt(1, difficulty === "easy" ? 3 : 9);
  const conversions = [
    { from: "м", factor: 100, to: "см" },
    { from: "см", factor: 10, to: "мм" },
    { from: "год", factor: 60, to: "хв" },
    { from: "діб", factor: 24, to: "год" },
    { from: "кг", factor: 1000, to: "г" },
    { from: "ц", factor: 100, to: "кг" },
  ];
  const { from, factor, to } = pick(conversions);
  return build(
    2,
    "measurements",
    "Величини та вимірювання",
    difficulty,
    `Скільки ${to} становлять ${multiplier} ${from}?`,
    multiplier * factor,
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
    difficulty === "easy" ? wordTemplatesEasy : wordTemplatesMedium;
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
    numeration: g2_numeration,
    comparison: g2_comparison,
    addition: g2_addition,
    subtraction: g2_subtraction,
    expressions: g2_expressions,
    multiplication: g2_multiplication,
    division: g2_division,
    word_problem: g2_word_problem,
    measurements: g2_measurements,
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
  const difficulties = GRADE_DIFFICULTIES[grade];
  if (!difficulties) {
    throw new Error(`No generator for grade ${grade}, type ${typeId}`);
  }
  if (!difficulties.includes(difficulty)) {
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
  if (!taskTypes) {
    throw new Error(`No task types are available for grade ${grade}`);
  }
  if (!Number.isSafeInteger(questionCount) || questionCount < 0) {
    throw new RangeError("Question count must be a non-negative integer.");
  }
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
