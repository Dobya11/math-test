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
    { id: "add_sub", label: "Додавання/віднімання" },
    { id: "compare", label: "Порівняння" },
    { id: "missing_number", label: "Пропущене число" },
  ],
  2: [
    { id: "add_sub", label: "Додавання/віднімання" },
    { id: "mul_div", label: "Множення/ділення" },
    { id: "expressions", label: "Вирази" },
  ],
  3: [
    { id: "numbers", label: "Дії з числами" },
    { id: "mul_div", label: "Множення/ділення" },
    { id: "geometry", label: "Геометрія" },
  ],
  4: [
    { id: "expressions", label: "Вирази" },
    { id: "equations", label: "Рівняння" },
    { id: "word_problem", label: "Текстова задача" },
  ],
};

function g1_add_sub(difficulty: Difficulty): Question {
  const max = difficulty === "easy" ? 10 : difficulty === "medium" ? 20 : 100;
  const isAdd = Math.random() < 0.5;

  if (isAdd) {
    const a = randInt(0, max);
    const aUnits = a % 10;

    const remaining = max - a;
    const maxBUnits = Math.min(9 - aUnits, remaining);
    const bUnits = randInt(0, Math.max(maxBUnits, 0));

    const remainingAfterUnits = remaining - bUnits;
    const maxBTens = Math.max(Math.floor(remainingAfterUnits / 10), 0);
    const bTens = randInt(0, maxBTens);

    const b = bTens * 10 + bUnits;
    const answer = a + b;

    return build(
      1,
      "add_sub",
      "Додавання/віднімання",
      difficulty,
      `${a} + ${b} = ?`,
      answer,
    );
  }

  const a = randInt(1, max);
  const aUnits = a % 10;
  const aTens = Math.floor(a / 10);

  const bUnits = randInt(0, aUnits);
  const bTens = randInt(0, aTens);

  let b = bTens * 10 + bUnits;
  if (b > a) b = a;

  return build(
    1,
    "add_sub",
    "Додавання/віднімання",
    difficulty,
    `${a} - ${b} = ?`,
    a - b,
  );
}

function g1_compare(difficulty: Difficulty): Question {
  const max = difficulty === "easy" ? 10 : difficulty === "medium" ? 20 : 100;
  const a = randInt(0, max);
  const b = randInt(0, max);
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

function g1_missing_number(difficulty: Difficulty): Question {
  const max = difficulty === "easy" ? 10 : difficulty === "medium" ? 20 : 100;
  const forms = ["a+?=c", "?+a=c", "a-?=c", "?-a=c"] as const;
  const form =
    difficulty === "hard" ? pick(["a-?=c", "?-a=c"] as const) : pick(forms);
  let a: number, c: number, answer: number, prompt: string;
  switch (form) {
    case "a+?=c":
      a = randInt(0, max);
      answer = randInt(0, max - a);
      c = a + answer;
      prompt = `${a} + ? = ${c}`;
      break;
    case "?+a=c":
      a = randInt(0, max);
      answer = randInt(0, max - a);
      c = a + answer;
      prompt = `? + ${a} = ${c}`;
      break;
    case "a-?=c":
      a = randInt(0, max);
      answer = randInt(0, a);
      c = a - answer;
      prompt = `${a} - ? = ${c}`;
      break;
    case "?-a=c":
    default:
      a = randInt(0, max);
      c = randInt(0, max - a);
      answer = a + c;
      prompt = `? - ${a} = ${c}`;
      break;
  }
  return build(
    1,
    "missing_number",
    "Пропущене число",
    difficulty,
    prompt,
    answer,
  );
}

function g2_add_sub(difficulty: Difficulty): Question {
  if (difficulty === "hard") {
    // two operations, numbers up to 100
    const a = randInt(10, 90);
    const b = randInt(1, Math.min(a, 50));
    const running = a - b;
    const c = randInt(1, 100 - running > 0 ? 100 - running : 1);
    const answer = running + c;
    return build(
      2,
      "add_sub",
      "Додавання/віднімання",
      difficulty,
      `${a} - ${b} + ${c} = ?`,
      answer,
    );
  }
  const a = randInt(10, 99);
  let b: number;
  if (difficulty === "easy") {
    const aUnits = a % 10;
    const bUnits = randInt(0, 9 - aUnits);
    const bTens = randInt(0, Math.floor((99 - a) / 10));
    b = bTens * 10 + bUnits;
  } else {
    b = randInt(1, 99);
  }
  const isAdd = Math.random() < 0.5 && a + b <= 100;
  if (isAdd) {
    return build(
      2,
      "add_sub",
      "Додавання/віднімання",
      difficulty,
      `${a} + ${b} = ?`,
      a + b,
    );
  }
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  return build(
    2,
    "add_sub",
    "Додавання/віднімання",
    difficulty,
    `${big} - ${small} = ?`,
    big - small,
  );
}

function g2_mul_div(difficulty: Difficulty): Question {
  if (difficulty === "hard") {
    const a = randInt(2, 10);
    const b = randInt(2, 10);
    const c = a * b;
    const askDiv = Math.random() < 0.5;
    if (askDiv) {
      const missingDivisor = Math.random() < 0.5;
      return missingDivisor
        ? build(
            2,
            "mul_div",
            "Множення/ділення",
            difficulty,
            `${c} : ? = ${a}`,
            b,
          )
        : build(
            2,
            "mul_div",
            "Множення/ділення",
            difficulty,
            `${c} : ${a} = ?`,
            b,
          );
    }
    const missingFirst = Math.random() < 0.5;
    return missingFirst
      ? build(
          2,
          "mul_div",
          "Множення/ділення",
          difficulty,
          `? × ${b} = ${c}`,
          a,
        )
      : build(
          2,
          "mul_div",
          "Множення/ділення",
          difficulty,
          `${a} × ? = ${c}`,
          b,
        );
  }
  const upper = difficulty === "easy" ? 5 : 10;
  const a = randInt(2, upper);
  const b = randInt(2, upper);
  const isMul = Math.random() < 0.5;
  if (isMul) {
    return build(
      2,
      "mul_div",
      "Множення/ділення",
      difficulty,
      `${a} × ${b} = ?`,
      a * b,
    );
  }
  const product = a * b;
  return build(
    2,
    "mul_div",
    "Множення/ділення",
    difficulty,
    `${product} : ${a} = ?`,
    b,
  );
}

function g2_expressions(difficulty: Difficulty): Question {
  const opsCount = difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3;
  let value = randInt(5, 30);
  let prompt = `${value}`;
  for (let i = 0; i < opsCount; i++) {
    const isAdd = Math.random() < 0.5;
    if (isAdd) {
      const add = randInt(1, 20);
      value += add;
      prompt += ` + ${add}`;
    } else {
      const sub = randInt(1, Math.min(value, 20));
      value -= sub;
      prompt += ` - ${sub}`;
    }
  }
  return build(2, "expressions", "Вирази", difficulty, `${prompt} = ?`, value);
}

function g3_numbers(difficulty: Difficulty): Question {
  if (difficulty === "hard") {
    const a = randInt(100, 900);
    const b = randInt(10, 400);
    const c = randInt(10, 300);
    const answer = a - b + c;
    return build(
      3,
      "numbers",
      "Дії з числами",
      difficulty,
      `${a} - ${b} + ${c} = ?`,
      answer,
    );
  }
  const a = randInt(100, 999);
  let b: number;
  if (difficulty === "easy") {
    const aUnits = a % 10;
    const aTens = Math.floor((a % 100) / 10);
    const bUnits = randInt(0, 9 - aUnits);
    const bTens = randInt(0, 9 - aTens);
    b = bTens * 10 + bUnits;
  } else {
    b = randInt(10, 999);
  }
  const isAdd = Math.random() < 0.5 && a + b <= 1000;
  if (isAdd) {
    return build(
      3,
      "numbers",
      "Дії з числами",
      difficulty,
      `${a} + ${b} = ?`,
      a + b,
    );
  }
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  return build(
    3,
    "numbers",
    "Дії з числами",
    difficulty,
    `${big} - ${small} = ?`,
    big - small,
  );
}

function g3_mul_div(difficulty: Difficulty): Question {
  if (difficulty === "hard") {
    const a = randInt(2, 10);
    const b = randInt(2, 10);
    const c = a * b;
    const missingFirst = Math.random() < 0.5;
    const askDiv = Math.random() < 0.5;
    if (askDiv) {
      return missingFirst
        ? build(
            3,
            "mul_div",
            "Множення/ділення",
            difficulty,
            `${c} : ? = ${a}`,
            b,
          )
        : build(
            3,
            "mul_div",
            "Множення/ділення",
            difficulty,
            `? : ${a} = ${b}`,
            c,
          );
    }
    return missingFirst
      ? build(
          3,
          "mul_div",
          "Множення/ділення",
          difficulty,
          `? × ${b} = ${c}`,
          a,
        )
      : build(
          3,
          "mul_div",
          "Множення/ділення",
          difficulty,
          `${a} × ? = ${c}`,
          b,
        );
  }
  if (difficulty === "easy") {
    const a = randInt(2, 9);
    const b = randInt(2, 9);
    const isMul = Math.random() < 0.5;
    if (isMul) {
      return build(
        3,
        "mul_div",
        "Множення/ділення",
        difficulty,
        `${a} × ${b} = ?`,
        a * b,
      );
    }
    const product = a * b;
    return build(
      3,
      "mul_div",
      "Множення/ділення",
      difficulty,
      `${product} : ${a} = ?`,
      b,
    );
  }
  const divisor = randInt(2, 9);
  const quotient = randInt(2, 9);
  const remainder = randInt(1, divisor - 1);
  const dividend = divisor * quotient + remainder;
  return build(
    3,
    "mul_div",
    "Множення/ділення",
    difficulty,
    `${dividend} : ${divisor} = ?`,
    `${quotient},${remainder}`,
    "text",
    "Формат відповіді: частка,залишок (наприклад 6,2)",
  );
}

function g3_geometry(difficulty: Difficulty): Question {
  if (difficulty === "easy") {
    const isSquare = Math.random() < 0.5;
    if (isSquare) {
      const side = randInt(2, 20);
      return build(
        3,
        "geometry",
        "Геометрія",
        difficulty,
        `Знайди периметр квадрата зі стороною ${side} см`,
        side * 4,
      );
    }
    const w = randInt(2, 20);
    const h = randInt(2, 20);
    return build(
      3,
      "geometry",
      "Геометрія",
      difficulty,
      `Знайди периметр прямокутника зі сторонами ${w} см і ${h} см`,
      (w + h) * 2,
    );
  }
  if (difficulty === "medium") {
    const isSquare = Math.random() < 0.5;
    if (isSquare) {
      const side = randInt(2, 15);
      return build(
        3,
        "geometry",
        "Геометрія",
        difficulty,
        `Знайди площу квадрата зі стороною ${side} см`,
        side * side,
      );
    }
    const w = randInt(2, 15);
    const h = randInt(2, 15);
    return build(
      3,
      "geometry",
      "Геометрія",
      difficulty,
      `Знайди площу прямокутника зі сторонами ${w} см і ${h} см`,
      w * h,
    );
  }
  const perimeter = randInt(20, 60) * 2;
  const side1 = randInt(3, perimeter / 2 - 3);
  const side2 = perimeter / 2 - side1;
  return build(
    3,
    "geometry",
    "Геометрія",
    difficulty,
    `Периметр прямокутника ${perimeter} см, одна сторона ${side1} см. Знайди площу прямокутника`,
    side2 * side1,
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
  if (difficulty === "medium") {
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
  const a = randInt(10, 40);
  const b = randInt(1, 20);
  const bracketVal = Math.random() < 0.5 ? a + b : a - b;
  const c = randInt(2, 9);
  const d = randInt(1, 20);
  const useMul = Math.random() < 0.5;
  const op = Math.random() < 0.5 ? "+" : "-";
  const bracketOp = a + b === bracketVal ? "+" : "-";
  const answer = useMul
    ? bracketVal * c + (op === "+" ? d : -d)
    : evalChain([bracketVal, c, d], ["+", op]);
  const prompt = useMul
    ? `(${a} ${bracketOp} ${b}) × ${c} ${op} ${d} = ?`
    : `(${a} ${bracketOp} ${b}) + ${c} ${op} ${d} = ?`;
  return build(4, "expressions", "Вирази", difficulty, prompt, answer);
}

function g4_equations(difficulty: Difficulty): Question {
  if (difficulty === "easy") {
    const x = randInt(1, 40);
    const a = randInt(1, 40);
    const c = x + a;
    return build(4, "equations", "Рівняння", difficulty, `x + ${a} = ${c}`, x);
  }
  if (difficulty === "medium") {
    const x = randInt(2, 12);
    const a = randInt(2, 9);
    const c = a * x;
    return build(4, "equations", "Рівняння", difficulty, `${a}x = ${c}`, x);
  }
  const x = randInt(2, 15);
  const a = randInt(2, 9);
  const b = randInt(1, 20);
  const c = a * x + b;
  return build(
    4,
    "equations",
    "Рівняння",
    difficulty,
    `${a}x + ${b} = ${c}`,
    x,
  );
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
        prompt: `У Марка ${a} наліпок, а в Олі ${b} наліпок. Скільки наліпок у них разом?`,
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

const wordTemplatesHard: WordTemplate[] = [
  {
    build: () => {
      const boxes = randInt(3, 8);
      const perBox = randInt(4, 12);
      const given = randInt(1, boxes * perBox - 5);
      const friends = randInt(2, 5);
      const total = boxes * perBox - given;
      return {
        prompt: `У ${boxes} коробках по ${perBox} олівців у кожній. ${given} олівців віддали. Решту порівну розділили між ${friends} дітьми. Скільки олівців отримала кожна дитина? (округли до цілого, якщо не ділиться точно — округли вниз)`,
        answer: Math.floor(total / friends),
      };
    },
  },
  {
    build: () => {
      const speed = randInt(3, 8);
      const hours1 = randInt(2, 4);
      const hours2 = randInt(1, 3);
      const extraDistance = randInt(2, 10);
      const dist1 = speed * hours1;
      const dist2 = speed * hours2 + extraDistance;
      return {
        prompt: `Турист пройшов ${hours1} год зі швидкістю ${speed} км/год, а потім ще ${hours2} год з тією ж швидкістю і додатково подолав ${extraDistance} км по прямій стежці. Скільки всього км пройшов турист?`,
        answer: dist1 + dist2,
      };
    },
  },
];

function g4_word_problem(difficulty: Difficulty): Question {
  const templates =
    difficulty === "easy"
      ? wordTemplatesEasy
      : difficulty === "medium"
        ? wordTemplatesMedium
        : wordTemplatesHard;
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
    add_sub: g1_add_sub,
    compare: g1_compare,
    missing_number: g1_missing_number,
  },
  2: {
    add_sub: g2_add_sub,
    mul_div: g2_mul_div,
    expressions: g2_expressions,
  },
  3: {
    numbers: g3_numbers,
    mul_div: g3_mul_div,
    geometry: g3_geometry,
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
  const fn = GENERATORS[grade]?.[typeId];
  if (!fn) {
    throw new Error(`No generator for grade ${grade}, type ${typeId}`);
  }
  return fn(difficulty);
}
