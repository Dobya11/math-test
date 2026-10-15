import { useMemo, useState } from "react";
import "./App.css";
import PageCard from "./components/Card.tsx";
import type { Grade } from "./ts/types.ts";
import { getResultsForGrade } from "./ts/storage.ts";

interface TestsProps {
  initialGrade: Grade;
  onStartTest: (
    grade: Grade,
    questionCount: number,
    timeLimitSec: number | null,
  ) => void;
}

function Tests({ initialGrade, onStartTest }: TestsProps) {
  const [grade, setGrade] = useState<Grade>(initialGrade);
  const [questionCount, setQuestionCount] = useState(8);
  const [timeLimit, setTimeLimit] = useState(15);

  const results = useMemo(() => {
    return getResultsForGrade(grade);
  }, [grade]);

  const lastResult = results[0];

  const percentage = lastResult
    ? lastResult.totalQuestions === 0
      ? 0
      : Math.round(
          (lastResult.correctAnswers / lastResult.totalQuestions) * 100,
        )
    : 0;

  function handleStart() {
    onStartTest(grade, questionCount, timeLimit === 0 ? null : timeLimit * 60);
  }

  return (
    <div className="screen">
      <PageCard type="header">
        <h1>Тести з математики</h1>
      </PageCard>

      <PageCard type="test">
        <h2>Новий тест</h2>

        <p>Обери завдання та перевір свої знання</p>

        <section className="info">
          <label className="info-field">
            <span>Клас</span>
            <select
              className="info-item"
              value={grade}
              onChange={(event) =>
                setGrade(Number(event.target.value) as Grade)
              }
            >
              <option value="1">1 клас</option>
              <option value="2">2 клас</option>
              <option value="3">3 клас</option>
              <option value="4">4 клас</option>
            </select>
          </label>

          <label className="info-field">
            <span>Завдань</span>
            <select
              className="info-item"
              value={questionCount}
              onChange={(event) => setQuestionCount(Number(event.target.value))}
            >
              <option value="8">8 завдань</option>
              <option value="12">12 завдань</option>
              <option value="24">24 завдання</option>
            </select>
          </label>

          <label className="info-field">
            <span>Час</span>
            <select
              className="info-item"
              value={timeLimit}
              onChange={(event) => setTimeLimit(Number(event.target.value))}
            >
              <option value="15">15 хв</option>
              <option value="30">30 хв</option>
              <option value="45">45 хв</option>
              <option value="0">Без обмеження</option>
            </select>
          </label>
        </section>

        <button onClick={handleStart}>Почати</button>
      </PageCard>

      <PageCard type="analysis">
        <h2>Мій останній тест</h2>

        {!lastResult ? (
          <p>Твій результат з’явиться тут після тесту.</p>
        ) : (
          <>
            <p>Правильних відповідей</p>
            <strong className="result-score">
              {lastResult.correctAnswers} з {lastResult.totalQuestions}
            </strong>

            <p className="result-message">
              {percentage === 100
                ? "Чудово! Усі відповіді правильні!"
                : percentage >= 70
                  ? "Гарна робота! Так тримати!"
                  : "Кожен тест допомагає вчитися. Спробуй ще раз!"}
            </p>

            <div className="progress">
              <div
                className="progress-bar"
                style={{
                  width: `${percentage}%`,
                }}
              />
            </div>

            <p>
              Тестів пройдено: <strong>{results.length}</strong>
            </p>

            <p className="result-meta">
              Час: {Math.floor(lastResult.timeTakenMs / 60000)} хв{" "}
              {Math.floor((lastResult.timeTakenMs % 60000) / 1000)} с
            </p>

            <h3>Що вже добре виходить</h3>
            <div className="skill-list">
              {lastResult.typeStats
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
          </>
        )}
      </PageCard>
    </div>
  );
}

export default Tests;
