import { useCallback, useEffect, useMemo, useState } from "react";
import PageCard from "./components/Card.tsx";
import {
  createAssignment,
  createClassroom,
  getStudentSnapshot,
  getTeacherSnapshot,
  joinClassroom,
  subscribeToClassChanges,
  type StudentSnapshot,
  type TeacherSnapshot,
} from "./ts/classroom.ts";
import type { User } from "./ts/types.ts";

const TOPICS = Array.from({ length: 10 }, (_, index) => `Тема ${index + 1}`);
const QUESTIONS_PER_TOPIC = [4, 8, 12] as const;

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="account-error" role="alert">
      {message}
    </p>
  );
}

function TeacherDashboard({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
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
    const unsubscribe = subscribeToClassChanges(
      () => void refresh(),
      setError,
    );
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
          <button type="button" className="secondary-button" onClick={onSignOut}>
            Вийти
          </button>
        </div>
      </PageCard>

      {error && <ErrorMessage message={error} />}
      {loading && <PageCard type="analysis"><p>Завантаження класу…</p></PageCard>}

      {!loading && snapshot && !snapshot.classroom && (
        <PageCard type="analysis">
          <h2>Створіть свій клас</h2>
          <p>Класу буде призначено унікальний код для запрошення учнів.</p>
          <button type="button" disabled={saving} onClick={handleCreateClassroom}>
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
              <strong className="class-code">{snapshot.classroom.class_code}</strong>
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
              <div className="progress-bar" style={{ width: `${classProgress}%` }} />
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
              Оберіть теми-заглушки та кількість завдань. Загальна кількість
              оновлюється автоматично.
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
                {snapshot.assignments.map((assignment) => (
                  <div className="history-item" key={assignment.id}>
                    <div>
                      <strong>{assignment.title}</strong>
                      <p>{assignment.topics.join(", ")}</p>
                      <p>
                        {new Date(assignment.created_at).toLocaleDateString(
                          "uk-UA",
                        )}
                      </p>
                    </div>
                    <strong>{assignment.total_questions} завдань</strong>
                  </div>
                ))}
              </div>
            )}
            <p className="account-note">
              Теми поки є заглушками: генерація та проходження завдань буде
              доступна після визначення їхнього змісту.
            </p>
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
                            ? "Завершено"
                            : "У процесі"}
                        </p>
                      </div>
                      <strong>
                        {attempt.score ?? 0} / {attempt.total_questions}
                      </strong>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="account-note">
              Деталі окремих відповідей з’являться після підключення змісту тем.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function StudentDashboard({
  user,
  inviteCode,
  onSignOut,
}: {
  user: User;
  inviteCode: string;
  onSignOut: () => void;
}) {
  const [snapshot, setSnapshot] = useState<StudentSnapshot | null>(null);
  const [code, setCode] = useState(inviteCode);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

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
    const unsubscribe = subscribeToClassChanges(
      () => void refresh(),
      setError,
    );
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

  const completedAttempts = snapshot?.attempts.filter(
    ({ status }) => status === "completed",
  ).length;

  return (
    <div className="screen classroom-screen">
      <PageCard type="header">
        <div className="dashboard-heading">
          <div>
            <h1>{user.name}</h1>
            <p>Кабінет учня · 2 клас</p>
          </div>
          <button type="button" className="secondary-button" onClick={onSignOut}>
            Вийти
          </button>
        </div>
      </PageCard>

      {error && <ErrorMessage message={error} />}
      {loading && <PageCard type="analysis"><p>Завантаження…</p></PageCard>}

      {!loading && snapshot && !snapshot.classroom && (
        <PageCard type="analysis">
          <h2>Приєднатися до класу</h2>
          <p>Введіть шестизначний код від учителя або відкрийте його посилання.</p>
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
                {snapshot.assignments.map((assignment) => (
                  <div className="history-item assignment-item" key={assignment.id}>
                    <div>
                      <strong>{assignment.title}</strong>
                      <p>{assignment.topics.join(", ")}</p>
                      <p>
                        {assignment.total_questions} завдань · створено{" "}
                        {new Date(assignment.created_at).toLocaleDateString(
                          "uk-UA",
                        )}
                      </p>
                    </div>
                    <button type="button" disabled>
                      Скоро
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="account-note">
              Завдання не можна почати, доки навчальні теми не матимуть змісту.
              Це також не дозволяє показати учням штучні чи невідповідні вправи.
            </p>
          </PageCard>
          <PageCard type="analysis">
            <h2>Мої результати</h2>
            <p>
              Завершених спроб: <strong>{completedAttempts ?? 0}</strong>
            </p>
          </PageCard>
        </>
      )}
    </div>
  );
}

export { StudentDashboard, TeacherDashboard };
