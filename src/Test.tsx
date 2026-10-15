import { useCallback, useEffect, useMemo, useState } from "react";
import PageCard from "./components/Card.tsx";

import type {
  AnsweredQuestion,
  Difficulty,
  Grade,
  Question,
  TestResult,
  TypeStat,
} from "./ts/types.ts";

import { GRADE_TASK_TYPES, generateQuestion } from "./ts/taskGenerator.ts";
import { getWeakTypeIds, levelFromStats, saveResult } from "./ts/storage.ts";

interface TestProps {
  grade: Grade;
  questionCount: number;
  timeLimitSec: number | null;
  onExit: () => void;
}

const CORRECT_QUOTES = [
  "Чудово! Ти справжній математик!",
  "Так тримати!",
  "Точно в ціль!",
  "Ти на правильному шляху!",
  "Браво! Ще одна правильна відповідь!",
  "Супер! Продовжуй у такому ж дусі!",
  "Ідеально! Твій мозок сьогодні на висоті!",
];

const INCORRECT_QUOTES = [
  "Не сумуй, спробуй ще!",
  "Помилки — це шлях до успіху!",
  "Наступного разу вийде краще!",
  "Кожна помилка робить тебе сильнішим!",
  "Не здавайся, ти можеш це!",
  "Тренуйся — і вийде!",
  "Буває! Головне — рухатись далі.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickTypeId(typeIds: string[], weakIds: Set<string>): string {
  const weights = typeIds.map((id) => (weakIds.has(id) ? 2 : 1));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;

  for (let i = 0; i < typeIds.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return typeIds[i];
  }

  return typeIds[typeIds.length - 1];
}

function Test({ grade, questionCount, timeLimitSec, onExit }: TestProps) {
  const weakTypeIds = useMemo(() => getWeakTypeIds(grade), [grade]);

  const questions = useMemo(() => {
    const types = GRADE_TASK_TYPES[grade];
    const typeIds = types.map((t) => t.id);
    const generated: Question[] = [];

    for (let i = 0; i < questionCount; i++) {
      const typeId = pickTypeId(typeIds, weakTypeIds);
      const progress = i / Math.max(questionCount - 1, 1);

      let difficulty: Difficulty;

      if (progress < 0.34) {
        difficulty = "easy";
      } else if (progress < 0.67) {
        difficulty = "medium";
      } else {
        difficulty = "hard";
      }

      generated.push(generateQuestion(grade, typeId, difficulty));
    }

    return generated;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, questionCount]);

  const [currentIndex, setCurrentIndex] = useState(0);

  const [answers, setAnswers] = useState<AnsweredQuestion[]>([]);
  const [userAnswer, setUserAnswer] = useState("");

  const [timeLeft, setTimeLeft] = useState<number | null>(timeLimitSec);

  const [questionStartTime, setQuestionStartTime] = useState(() => Date.now());
  const [testStartTime] = useState(() => Date.now());

  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(
    null,
  );
  const [feedbackQuote, setFeedbackQuote] = useState("");
  const [correctAnswerText, setCorrectAnswerText] = useState("");

  const finishTest = useCallback(
    (finalAnswers: AnsweredQuestion[] = answers) => {
      setFinished(true);

      const typeStats: TypeStat[] = GRADE_TASK_TYPES[grade].map((t) => {
        const forType = finalAnswers.filter((a) => a.typeId === t.id);
        const total = forType.length;
        const correct = forType.filter((a) => a.isCorrect).length;
        const finalDifficulty: Difficulty =
          forType.length > 0 ? forType[forType.length - 1].difficulty : "easy";

        return {
          typeId: t.id,
          typeLabel: t.label,
          total,
          correct,
          finalDifficulty,
          level: levelFromStats(total, correct, finalDifficulty),
        };
      });

      const withData = typeStats.filter((s) => s.total > 0);
      const best = withData.length
        ? withData.reduce((a, b) => (b.level > a.level ? b : a))
        : null;
      const worst = withData.length
        ? withData.reduce((a, b) => (b.level < a.level ? b : a))
        : null;

      const finalResult: TestResult = {
        id: `${Date.now()}`,
        date: new Date().toISOString(),
        grade,
        totalQuestions: finalAnswers.length,
        correctAnswers: finalAnswers.filter((a) => a.isCorrect).length,
        timeLimitSec,
        timeTakenMs: Date.now() - testStartTime,
        typeStats,
        bestTypeId: best?.typeId ?? null,
        worstTypeId: worst?.typeId ?? null,
      };

      saveResult(finalResult);
      setResult(finalResult);
    },
    [answers, grade, testStartTime, timeLimitSec],
  );

  useEffect(() => {
    if (timeLimitSec === null || finished) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((value) => {
        if (value === null) {
          return null;
        }

        if (value <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [timeLimitSec, finished]);

  useEffect(() => {
    if (timeLimitSec !== null && timeLeft === 0 && !finished) {
      const finishTimer = window.setTimeout(() => {
        finishTest(answers);
      }, 0);

      return () => window.clearTimeout(finishTimer);
    }

    return undefined;
  }, [timeLeft, timeLimitSec, finished, answers, finishTest]);

  if (questions.length === 0) {
    return (
      <div className="screen">
        <PageCard type="test">
          <p>Підготовка тесту...</p>
        </PageCard>
      </div>
    );
  }

  function submitAnswer() {
    if (!userAnswer.trim() || finished || feedback) {
      return;
    }

    const currentQuestion = questions[currentIndex];

    const timeSpentMs = Date.now() - questionStartTime;

    const normalizedUserAnswer = userAnswer.trim().toLowerCase();

    const normalizedCorrectAnswer = currentQuestion.answer.trim().toLowerCase();

    const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;

    const answered: AnsweredQuestion = {
      ...currentQuestion,
      userAnswer: userAnswer.trim(),
      isCorrect,
      timeSpentMs,
    };

    const newAnswers = [...answers, answered];

    setAnswers(newAnswers);
    setCorrectAnswerText(currentQuestion.answer);
    setFeedback(isCorrect ? "correct" : "incorrect");
    setFeedbackQuote(pick(isCorrect ? CORRECT_QUOTES : INCORRECT_QUOTES));
  }

  function goToNext() {
    const isLast = currentIndex + 1 >= questions.length;

    setFeedback(null);
    setFeedbackQuote("");
    setUserAnswer("");

    if (isLast) {
      finishTest(answers);
      return;
    }

    setCurrentIndex((index) => index + 1);
    setQuestionStartTime(Date.now());
  }

  function formatTime(seconds: number | null) {
    if (seconds === null) {
      return "Без часу";
    }

    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  function difficultyLabel(difficulty: Difficulty) {
    switch (difficulty) {
      case "easy":
        return "Легка";

      case "medium":
        return "Середня";

      case "hard":
        return "Складна";
    }
  }

  if (finished && result) {
    const correct = result.correctAnswers;
    const total = result.totalQuestions;

    const percentage = total === 0 ? 0 : Math.round((correct / total) * 100);

    const bestStat = result.typeStats.find(
      (s) => s.typeId === result.bestTypeId,
    );
    const worstStat = result.typeStats.find(
      (s) => s.typeId === result.worstTypeId,
    );

    return (
      <div className="screen">
        <PageCard type="header">
          <h1>Ось як ти впорався!</h1>
        </PageCard>

        <PageCard type="test">
          <p>Правильних відповідей</p>
          <h2 className="result-score">
            {correct} з {total}
          </h2>

          <p className="result-message">
            {percentage === 100
              ? "Чудово! Усі відповіді правильні!"
              : percentage >= 70
                ? "Гарна робота! Так тримати!"
                : "Кожен тест допомагає вчитися. Спробуй ще раз!"}
          </p>

          <h3>Як вийшли різні завдання</h3>
          <div className="skill-list">
            {result.typeStats
              .filter((stat) => stat.total > 0)
              .map((stat) => {
                const skillPercentage = Math.round(
                  (stat.correct / stat.total) * 100,
                );

                return (
                  <div className="skill-item" key={stat.typeId}>
                    <div className="skill-item__label">
                      <strong>{stat.typeLabel}</strong>
                      <span>
                        {stat.correct} з {stat.total} правильно
                      </span>
                    </div>
                    <div
                      className="progress progress--small"
                      role="progressbar"
                      aria-label={stat.typeLabel}
                      aria-valuenow={skillPercentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="progress-bar"
                        style={{ width: `${skillPercentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>

          {bestStat && <p>Найкраще вийшло: {bestStat.typeLabel}</p>}
          {worstStat && <p>Ще потренуй: {worstStat.typeLabel}</p>}

          <p className="result-meta">
            Час: {Math.floor(result.timeTakenMs / 60000)} хв{" "}
            {Math.floor((result.timeTakenMs % 60000) / 1000)} с
          </p>

          <button onClick={onExit}>До тестів</button>
        </PageCard>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  const progress = ((currentIndex + 1) / questions.length) * 100;

  const isAnswered = feedback !== null;

  return (
    <div className="screen">
      <PageCard type="header">
        <div className="test-header">
          {timeLimitSec !== null && (
            <span className="test-timer">{formatTime(timeLeft)}</span>
          )}
        </div>
      </PageCard>

      <PageCard type="test">
        <span>
          Питання {currentIndex + 1} / {questions.length}
        </span>
        <div className="progress">
          <div
            className="progress-bar"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <p className="task-type">{currentQuestion.typeLabel}</p>

        <p className="difficulty">
          {difficultyLabel(currentQuestion.difficulty)}
        </p>

        <h2>{currentQuestion.prompt}</h2>

        {currentQuestion.hint && <p className="hint">{currentQuestion.hint}</p>}

        {currentQuestion.answerType === "comparator" ? (
          <div className="answer-buttons">
            {["<", "=", ">"].map((value) => (
              <button
                key={value}
                type="button"
                className={userAnswer === value ? "selected" : ""}
                disabled={isAnswered}
                onClick={() => setUserAnswer(value)}
              >
                {value}
              </button>
            ))}
          </div>
        ) : (
          <input
            type={currentQuestion.answerType === "number" ? "number" : "text"}
            value={userAnswer}
            disabled={isAnswered}
            onChange={(event) => setUserAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submitAnswer();
              }
            }}
            placeholder="Введіть відповідь"
            autoFocus
            className="answer-input"
          />
        )}

        <button
          onClick={submitAnswer}
          disabled={!userAnswer.trim() || isAnswered}
        >
          {currentIndex + 1 === questions.length
            ? "Завершити тест"
            : "Наступне питання"}
        </button>
      </PageCard>

      <div
        className={`feedback-bar ${feedback ? "feedback-bar--visible" : ""} ${
          feedback === "correct"
            ? "feedback-bar--correct"
            : feedback === "incorrect"
              ? "feedback-bar--incorrect"
              : ""
        }`}
      >
        <div className="feedback-bar__text">
          <p className="feedback-bar__title">
            {feedback === "correct" ? "Правильно!" : "Неправильно"}
          </p>
          {feedback === "incorrect" && (
            <p className="feedback-bar__answer">
              Відповідь: {correctAnswerText}
            </p>
          )}
          <p className="feedback-bar__quote">{feedbackQuote}</p>
        </div>

        <button className="feedback-bar__next" onClick={goToNext}>
          Далі
        </button>
      </div>
    </div>
  );
}

export default Test;
