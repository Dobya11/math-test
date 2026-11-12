import { useCallback, useEffect, useMemo, useState } from "react";
import PageCard from "./components/Card.tsx";
import {
  completeAssignmentAttempt,
  createAssignment,
  createClassroom,
  getAssignmentQuestions,
  getStudentSnapshot,
  getTeacherSnapshot,
  joinClassroom,
  startAssignmentAttempt,
  submitAssignmentAnswer,
  subscribeToClassChanges,
  type Assignment,
  type AssignmentQuestion,
  type StudentSnapshot,
  type TeacherSnapshot,
} from "./ts/classroom.ts";
import type { User } from "./ts/types.ts";

const TOPICS = [
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
];
const QUESTIONS_PER_TOPIC = [4, 8, 12] as const;

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="account-error" role="alert">
      {message}
    </p>
  );
}

function TeacherDashboard({ user }: { user: User }) {
  const [snapshot, setSnapshot] = useState<TeacherSnapshot | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [questionsPerTopic, setQuestionsPerTopic] =
    useState<(typeof QUESTIONS_PER_TOPIC)[number]>(4);
  const [title, setTitle] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const nextSnapshot = await getTeacherSnapshot(user.id);
      setSnapshot(nextSnapshot);
      setError("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося завантажити дані класу.",
      );
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    // Load the snapshot after mount; refresh updates state after its async request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const unsubscribe = subscribeToClassChanges(() => void refresh(), setError);
    return unsubscribe;
  }, [refresh]);

  async function handleCreateClassroom() {
    setSaving(true);
    setError("");
    try {
      await createClassroom();
      await refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося створити клас.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateAssignment(event: React.FormEvent) {
    event.preventDefault();
    if (!snapshot?.classroom || selectedTopics.length === 0) return;

    setSaving(true);
    setError("");
    try {
      await createAssignment({
        classroomId: snapshot.classroom.id,
        title: title.trim() || `Завдання ${snapshot.assignments.length + 1}`,
        topics: selectedTopics,
        questionsPerTopic,
      });
      setTitle("");
      setSelectedTopics([]);
      await refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося створити завдання.",
      );
    } finally {
      setSaving(false);
    }
  }

  const startedStudents = useMemo(
    () => new Set(snapshot?.attempts.map(({ student_id }) => student_id) ?? []),
    [snapshot?.attempts],
  );
  const completedStudents = useMemo(
    () =>
      new Set(
        snapshot?.attempts
          .filter(({ status }) => status === "completed")
          .map(({ student_id }) => student_id) ?? [],
      ),
    [snapshot?.attempts],
  );
  const selectedStudent = snapshot?.members.find(
    ({ id }) => id === selectedStudentId,
  );
  const selectedAttempts =
    snapshot?.attempts.filter(
      ({ student_id }) => student_id === selectedStudentId,
    ) ?? [];
  const classProgress =
    snapshot && snapshot.members.length > 0
      ? Math.round((completedStudents.size / snapshot.members.length) * 100)
      : 0;

  return (
    <div className="screen classroom-screen">
      <PageCard type="header">
        <div className="dashboard-heading">
          <div>
            <h1>{user.name}</h1>
            <p>Кабінет учителя · 2 клас</p>
          </div>
        </div>
      </PageCard>

      {error && <ErrorMessage message={error} />}
      {loading && (
        <PageCard type="analysis">
          <p>Завантаження класу…</p>
        </PageCard>
      )}

      {!loading && snapshot && !snapshot.classroom && (
        <PageCard type="analysis">
          <h2>Створіть свій клас</h2>
          <p>Класу буде призначено унікальний код для запрошення учнів.</p>
          <button
            type="button"
            disabled={saving}
            onClick={handleCreateClassroom}
          >
            Створити клас
          </button>
        </PageCard>
      )}

      {snapshot?.classroom && (
        <>
          <PageCard type="analysis">
            <h2>Ваш клас · 2 клас</h2>
            <p>
              Код запрошення:{" "}
              <strong className="class-code">
                {snapshot.classroom.class_code}
              </strong>
            </p>
            <p>
              Посилання для учнів:{" "}
              <a href={`/class/${snapshot.classroom.class_code}`}>
                {window.location.origin}/class/{snapshot.classroom.class_code}
              </a>
            </p>
          </PageCard>

          <PageCard type="analysis">
            <h2>Аналітика класу</h2>
            <div className="profile-stats">
              <div>
                <strong>{snapshot.members.length}</strong>
                <span className="muted">учнів у класі</span>
              </div>
              <div>
                <strong>{startedStudents.size}</strong>
                <span className="muted">почали виконання</span>
              </div>
              <div>
                <strong>{completedStudents.size}</strong>
                <span className="muted">завершили</span>
              </div>
              <div>
                <strong>{classProgress}%</strong>
                <span className="muted">прогрес класу</span>
              </div>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-label="Прогрес класу"
              aria-valuenow={classProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="progress-bar"
                style={{ width: `${classProgress}%` }}
              />
            </div>
            {snapshot.members.length === 0 ? (
              <p>Ще ніхто не приєднався до класу.</p>
            ) : (
              <div className="history-list">
                {snapshot.members.map((member) => {
                  const attempts = snapshot.attempts.filter(
                    ({ student_id }) => student_id === member.id,
                  );
                  const completed = attempts.filter(
                    ({ status }) => status === "completed",
                  );
                  return (
                    <button
                      className="history-item student-row"
                      key={member.id}
                      type="button"
                      onClick={() => setSelectedStudentId(member.id)}
                    >
                      <div>
                        <strong>{member.name}</strong>
                        <p>
                          {attempts.length
                            ? `${attempts.length} спроб · ${completed.length} завершено`
                            : "Ще не починав завдань"}
                        </p>
                      </div>
                      <span aria-hidden="true">›</span>
                    </button>
                  );
                })}
              </div>
            )}
          </PageCard>

          <PageCard type="analysis">
            <h2>Створити завдання</h2>
            <p>
              Для кожної теми учні отримають приклади на додавання з вибором
              правильної відповіді.
            </p>
            <form className="assignment-form" onSubmit={handleCreateAssignment}>
              <label className="info-field">
                <span>Назва завдання (необов’язково)</span>
                <input
                  className="account-input"
                  value={title}
                  maxLength={80}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Наприклад, Робота за темами"
                />
              </label>
              <fieldset className="topic-picker">
                <legend>Навчальні теми</legend>
                <div className="topic-grid">
                  {TOPICS.map((topic) => (
                    <label className="topic-option" key={topic}>
                      <input
                        type="checkbox"
                        checked={selectedTopics.includes(topic)}
                        onChange={(event) =>
                          setSelectedTopics((current) =>
                            event.target.checked
                              ? [...current, topic]
                              : current.filter((value) => value !== topic),
                          )
                        }
                      />
                      <span>{topic}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="topic-picker">
                <legend>Завдань на одну тему</legend>
                <div className="topic-grid">
                  {QUESTIONS_PER_TOPIC.map((count) => (
                    <label className="topic-option" key={count}>
                      <input
                        type="radio"
                        name="questions-per-topic"
                        checked={questionsPerTopic === count}
                        onChange={() => setQuestionsPerTopic(count)}
                      />
                      <span>{count} завдань</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="assignment-total">
                Загальна кількість:{" "}
                <strong>{selectedTopics.length * questionsPerTopic}</strong>
              </p>
              <button
                type="submit"
                disabled={saving || selectedTopics.length === 0}
              >
                {saving ? "Збереження…" : "Створити завдання"}
              </button>
            </form>
          </PageCard>

          <PageCard type="analysis">
            <h2>Завдання класу</h2>
            {snapshot.assignments.length === 0 ? (
              <p>Створених завдань поки немає.</p>
            ) : (
              <div className="history-list">
                {snapshot.assignments.map((assignment) => {
                  const completed = snapshot.attempts.filter(
                    (attempt) =>
                      attempt.assignment_id === assignment.id &&
                      attempt.status === "completed",
                  );
                  const answered = completed.reduce(
                    (sum, attempt) => sum + attempt.total_questions,
                    0,
                  );
                  const correct = completed.reduce(
                    (sum, attempt) => sum + (attempt.score ?? 0),
                    0,
                  );
                  const percentage = answered
                    ? Math.round((correct / answered) * 100)
                    : 0;

                  return (
                    <div className="history-item" key={assignment.id}>
                      <div>
                        <strong>{assignment.title}</strong>
                        <p>{assignment.topics.join(", ")}</p>
                        <p>
                          {assignment.total_questions} завдань · завершено{" "}
                          {completed.length} спроб
                        </p>
                      </div>
                      <div className="assignment-analytics">
                        <strong>{percentage}%</strong>
                        <p>
                          {answered
                            ? `${correct} з ${answered} правильно`
                            : "Ще немає результатів"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PageCard>
        </>
      )}

      {selectedStudent && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="student-details"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-details-title"
          >
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedStudentId("")}
            >
              Закрити
            </button>
            <h2 id="student-details-title">{selectedStudent.name}</h2>
            <h3>Спроби виконання</h3>
            {selectedAttempts.length === 0 ? (
              <p>Учень ще не розпочинав завдань.</p>
            ) : (
              <div className="history-list">
                {selectedAttempts.map((attempt) => {
                  const assignment = snapshot?.assignments.find(
                    ({ id }) => id === attempt.assignment_id,
                  );
                  return (
                    <div className="history-item" key={attempt.id}>
                      <div>
                        <strong>{assignment?.title ?? "Завдання"}</strong>
                        <p>
                          {attempt.status === "completed"
                            ? `Завершено · ${attempt.completed_at ? new Date(attempt.completed_at).toLocaleString("uk-UA") : ""}`
                            : "У процесі"}
                        </p>
                      </div>
                      <div className="assignment-analytics">
                        <strong>
                          {attempt.score ?? 0} з {attempt.total_questions}
                        </strong>
                        <p>
                          {attempt.status === "completed" &&
                          attempt.total_questions > 0
                            ? `${Math.round(((attempt.score ?? 0) / attempt.total_questions) * 100)}% правильно`
                            : "Ще не завершено"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function AssignmentTest({
  assignment,
  onExit,
}: {
  assignment: Assignment;
  onExit: () => void;
}) {
  const [questions, setQuestions] = useState<AssignmentQuestion[]>([]);
  const [attemptId, setAttemptId] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [result, setResult] = useState<boolean[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleStart() {
    setBusy(true);
    setError("");
    try {
      const nextAttemptId = await startAssignmentAttempt(assignment.id);
      const nextQuestions = await getAssignmentQuestions(nextAttemptId);
      if (nextQuestions.length === 0) {
        throw new Error(
          "Для цього завдання ще немає питань. Попроси вчителя створити нове.",
        );
      }
      setQuestions(nextQuestions);
      setAttemptId(nextAttemptId);
      setCurrentIndex(0);
      setAnswers([]);
      setFeedback(null);
      setResult(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося почати завдання.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAnswer(answer: "Правильно" | "Неправильно") {
    const question = questions[currentIndex];
    if (!question || !attemptId || feedback !== null) return;

    setBusy(true);
    setError("");
    try {
      const isCorrect = await submitAssignmentAnswer(
        attemptId,
        question.id,
        answer,
      );
      setAnswers((current) => [...current, isCorrect]);
      setFeedback(isCorrect);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося зберегти відповідь.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleNext() {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((index) => index + 1);
      setFeedback(null);
      return;
    }

    setBusy(true);
    setError("");
    try {
      await completeAssignmentAttempt(attemptId);
      setResult(answers);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося завершити завдання.",
      );
    } finally {
      setBusy(false);
    }
  }

  const topicStats =
    result?.reduce((stats, isCorrect, index) => {
      const topic = questions[index].topic;
      const current = stats.get(topic) ?? { total: 0, correct: 0 };
      current.total += 1;
      if (isCorrect) current.correct += 1;
      stats.set(topic, current);
      return stats;
    }, new Map<string, { total: number; correct: number }>()) ??
    new Map<string, { total: number; correct: number }>();

  if (result) {
    const correct = result.filter(Boolean).length;
    const percentage = Math.round((correct / result.length) * 100);

    return (
      <div className="screen classroom-screen">
        <PageCard type="header">
          <div className="dashboard-heading">
            <h1>Результат</h1>
            <button type="button" className="secondary-button" onClick={onExit}>
              До завдань
            </button>
          </div>
        </PageCard>
        <PageCard type="analysis">
          <h2>{assignment.title}</h2>
          <strong className="result-score">
            {correct} з {result.length}
          </strong>
          <p>{percentage}% правильних відповідей</p>
          <div className="skill-list">
            {[...topicStats].map(([topic, stat]) => {
              const topicPercentage = Math.round(
                (stat.correct / stat.total) * 100,
              );
              return (
                <div className="skill-item" key={topic}>
                  <div className="skill-item__label">
                    <strong>{topic}</strong>
                    <span>
                      {stat.correct} з {stat.total} правильно
                    </span>
                  </div>
                  <div
                    className="progress progress--small"
                    role="progressbar"
                    aria-label={topic}
                    aria-valuenow={topicPercentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="progress-bar"
                      style={{ width: `${topicPercentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </PageCard>
      </div>
    );
  }

  if (!attemptId) {
    return (
      <div className="screen classroom-screen">
        <PageCard type="header">
          <div className="dashboard-heading">
            <h1>{assignment.title}</h1>
            <button type="button" className="secondary-button" onClick={onExit}>
              Назад
            </button>
          </div>
        </PageCard>
        <PageCard type="test">
          <p>{assignment.topics.join(", ")}</p>
          <p>У кожному прикладі обери, чи правильно пораховано суму.</p>
          {error && <ErrorMessage message={error} />}
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleStart()}
          >
            {busy ? "Завантаження…" : "Почати"}
          </button>
        </PageCard>
      </div>
    );
  }

  const question = questions[currentIndex];

  return (
    <div className="screen classroom-screen">
      <PageCard type="header">
        <div className="dashboard-heading">
          <h1>{assignment.title}</h1>
          <span>
            {currentIndex + 1} з {questions.length}
          </span>
        </div>
      </PageCard>
      <PageCard type="test">
        <p className="task-type">{question.topic}</p>
        <h2>{question.prompt}</h2>
        {feedback !== null && (
          <p className="result-message" role="status">
            {feedback ? "Правильно!" : "Неправильно. Спробуй наступне!"}
          </p>
        )}
        {error && <ErrorMessage message={error} />}
        {feedback === null ? (
          <div className="answer-buttons answer-buttons--text">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAnswer("Правильно")}
            >
              Правильно
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAnswer("Неправильно")}
            >
              Неправильно
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleNext()}
          >
            {currentIndex + 1 === questions.length
              ? "Показати результат"
              : "Наступне завдання"}
          </button>
        )}
      </PageCard>
    </div>
  );
}

function StudentDashboard({
  user,
  inviteCode,
}: {
  user: User;
  inviteCode: string;
}) {
  const [snapshot, setSnapshot] = useState<StudentSnapshot | null>(null);
  const [code, setCode] = useState(inviteCode);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(
    null,
  );

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await getStudentSnapshot(user.id));
      setError("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося завантажити завдання.",
      );
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    // Load the snapshot after mount; refresh updates state after its async request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const unsubscribe = subscribeToClassChanges(() => void refresh(), setError);
    return unsubscribe;
  }, [refresh]);

  async function handleJoinClass(event: React.FormEvent) {
    event.preventDefault();
    setJoining(true);
    setError("");
    try {
      await joinClassroom(code.trim());
      await refresh();
      window.history.replaceState(null, "", "/");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося приєднатися до класу.",
      );
    } finally {
      setJoining(false);
    }
  }

  function exitAssignment() {
    setActiveAssignment(null);
    void refresh();
  }

  if (activeAssignment) {
    return (
      <AssignmentTest assignment={activeAssignment} onExit={exitAssignment} />
    );
  }

  const completedAttempts =
    snapshot?.attempts.filter(({ status }) => status === "completed") ?? [];

  return (
    <div className="screen classroom-screen">
      <PageCard type="header">
        <div className="dashboard-heading">
          <div>
            <h1>{user.name}</h1>
            <p>Учень · 2 клас</p>
          </div>
        </div>
      </PageCard>

      {error && <ErrorMessage message={error} />}
      {loading && (
        <PageCard type="analysis">
          <p>Завантаження…</p>
        </PageCard>
      )}

      {!loading && snapshot && !snapshot.classroom && (
        <PageCard type="analysis">
          <h2>Приєднатися до класу</h2>
          <p>
            Уведи код класу від учителя. Якщо складно — попроси його допомогти
            або відкрий посилання.
          </p>
          <form className="assignment-form" onSubmit={handleJoinClass}>
            <label className="info-field">
              <span>Код класу</span>
              <input
                className="account-input class-code-input"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </label>
            <button type="submit" disabled={joining || code.length !== 6}>
              {joining ? "Приєднання…" : "Приєднатися"}
            </button>
          </form>
        </PageCard>
      )}

      {snapshot?.classroom && (
        <>
          <PageCard type="analysis">
            <h2>Мій клас</h2>
            <p>2 клас · код {snapshot.classroom.class_code}</p>
          </PageCard>
          <PageCard type="analysis">
            <h2>Доступні завдання</h2>
            {snapshot.assignments.length === 0 ? (
              <p>Учитель ще не створив завдань.</p>
            ) : (
              <div className="history-list">
                {snapshot.assignments.map((assignment) => {
                  const attempts = snapshot.attempts.filter(
                    (attempt) => attempt.assignment_id === assignment.id,
                  );
                  const completed = attempts.filter(
                    ({ status }) => status === "completed",
                  );
                  const latest = completed[0];
                  const percentage =
                    latest && latest.total_questions > 0
                      ? Math.round(
                          ((latest.score ?? 0) / latest.total_questions) * 100,
                        )
                      : null;

                  return (
                    <div
                      className="history-item assignment-item"
                      key={assignment.id}
                    >
                      <div>
                        <strong>{assignment.title}</strong>
                        <p>{assignment.topics.join(", ")}</p>
                        <p>
                          {assignment.total_questions} завдань · спроб:{" "}
                          {completed.length}
                          {percentage !== null
                            ? ` · останній результат ${percentage}%`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveAssignment(assignment)}
                      >
                        Почати
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="account-note">
              У кожному завданні потрібно визначити, чи правильно пораховано
              суму.
            </p>
          </PageCard>
          <PageCard type="analysis">
            <h2>Мої результати</h2>
            <p>
              Завершених спроб: <strong>{completedAttempts.length}</strong>
            </p>
            {completedAttempts.length > 0 && (
              <div className="history-list">
                {completedAttempts.map((attempt) => {
                  const assignment = snapshot.assignments.find(
                    ({ id }) => id === attempt.assignment_id,
                  );
                  const percentage = attempt.total_questions
                    ? Math.round(
                        ((attempt.score ?? 0) / attempt.total_questions) * 100,
                      )
                    : 0;
                  return (
                    <div className="history-item" key={attempt.id}>
                      <div>
                        <strong>{assignment?.title ?? "Завдання"}</strong>
                        <p>
                          {attempt.completed_at
                            ? new Date(attempt.completed_at).toLocaleString(
                                "uk-UA",
                              )
                            : ""}
                        </p>
                      </div>
                      <div>
                        <strong>
                          {attempt.score ?? 0} з {attempt.total_questions}
                        </strong>
                        <p>{percentage}% правильно</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PageCard>
        </>
      )}
    </div>
  );
}

export { StudentDashboard, TeacherDashboard };
