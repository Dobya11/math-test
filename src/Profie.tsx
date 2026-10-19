import "./App.css";
import type { User } from "./ts/types.ts";
import PageCard from "./components/Card";
import { getAccounts } from "./ts/accounts.ts";
import { loadHistory, loadHistoryForAccount } from "./ts/storage.ts";

interface ProfileProps {
  user: User;
  onSignOut: () => void;
}

function TeacherOverview({ user }: { user: User }) {
  const students = getAccounts()
    .filter((account) => account.role === "student")
    .map((account) => {
      const studentResults = loadHistoryForAccount(account.id);
      const questions = studentResults.reduce(
        (sum, result) => sum + result.totalQuestions,
        0,
      );
      const correct = studentResults.reduce(
        (sum, result) => sum + result.correctAnswers,
        0,
      );
      const averagePercentage = questions
        ? Math.round((correct / questions) * 100)
        : 0;

      return {
        account,
        results: studentResults,
        questions,
        correct,
        averagePercentage,
      };
    });

  const classTotalQuestions = students.reduce(
    (sum, student) => sum + student.questions,
    0,
  );
  const classCorrectAnswers = students.reduce(
    (sum, student) => sum + student.correct,
    0,
  );
  const classAveragePercentage =
    students.length > 0
      ? Math.round(
          students.reduce(
            (sum, student) => sum + student.averagePercentage,
            0,
          ) / students.length,
        )
      : 0;
  const activeStudents = students.filter(
    (student) => student.results.length > 0,
  ).length;
  const sortedStudents = [...students].sort(
    (left, right) => right.averagePercentage - left.averagePercentage,
  );

  return (
    <div className="screen">
      <PageCard type="header">
        <h1>{user.name}</h1>
        <p>Вчитель</p>
      </PageCard>

      <PageCard type="analysis">
        <h2>Загальна успішність учнів</h2>
        {students.length === 0 ? (
          <p>Поки немає учнів на цьому пристрої.</p>
        ) : (
          <>
            <div className="profile-stats">
              <div>
                <strong>{students.length}</strong>
                <span>учнів</span>
              </div>
              <div>
                <strong>{classAveragePercentage}%</strong>
                <span>середній результат</span>
              </div>
              <div>
                <strong>{activeStudents}</strong>
                <span>мають результати</span>
              </div>
              <div>
                <strong>
                  {classCorrectAnswers} з {classTotalQuestions}
                </strong>
                <span>правильних відповідей</span>
              </div>
            </div>
            <p className="result-message">
              Клас показує загальну успішність на {classAveragePercentage}%.
            </p>
            <div className="progress">
              <div
                className="progress-bar"
                style={{ width: `${classAveragePercentage}%` }}
              />
            </div>
          </>
        )}
      </PageCard>

      <PageCard type="analysis">
        <h2>Учні на цьому пристрої</h2>
        <p>
          Тут відображаються результати профілів учнів, створених на цьому
          пристрої.
        </p>
        {students.length === 0 ? (
          <p>Поки немає учнів на цьому пристрої.</p>
        ) : (
          <div className="history-list">
            {sortedStudents.map((student) => (
              <div className="history-item" key={student.account.id}>
                <div>
                  <strong>{student.account.name}</strong>
                  <p>
                    {student.results.length === 0
                      ? "Ще не проходив тестів"
                      : `Тестів пройдено: ${student.results.length}`}
                  </p>
                </div>
                <div>
                  <strong>
                    {student.correct} з {student.questions}
                  </strong>
                  <p>{student.averagePercentage}% успішність</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageCard>
    </div>
  );
}

function Profile({ user, onSignOut }: ProfileProps) {
  const results = loadHistory();
  const studentCount = getAccounts().filter(
    (account) => account.role === "student",
  ).length;
  const totalQuestions = results.reduce(
    (sum, result) => sum + result.totalQuestions,
    0,
  );
  const correctAnswers = results.reduce(
    (sum, result) => sum + result.correctAnswers,
    0,
  );
  const averagePercentage = results.length
    ? Math.round(
        results.reduce(
          (sum, result) =>
            sum +
            (result.totalQuestions
              ? (result.correctAnswers / result.totalQuestions) * 100
              : 0),
          0,
        ) / results.length,
      )
    : 0;
  return (
    <div className="screen">
      <PageCard type="header">
        <h1>{user.name}</h1>
        <p>{user.role === "teacher" ? "Вчитель" : "Учень"}</p>
        <button type="button" onClick={onSignOut}>
          Змінити профіль
        </button>
      </PageCard>

      {user.role === "teacher" ? (
        <PageCard type="analysis">
          <h2>Профіль вчителя</h2>
          <div className="profile-stats">
            <div>
              <strong>{studentCount}</strong>
              <span>учнів на пристрої</span>
            </div>
            <div>
              <strong>{user.name}</strong>
              <span>роль</span>
            </div>
          </div>
          <p className="result-message">
            Керуйте класом через вкладку «Успішність».
          </p>
        </PageCard>
      ) : (
        <>
          <PageCard type="analysis">
            <h2>Мій прогрес</h2>
            {results.length === 0 ? (
              <p>Пройди перший тест, і тут з’являться твої результати.</p>
            ) : (
              <>
                <div className="profile-stats">
                  <div>
                    <strong>{results.length}</strong>
                    <span>тестів пройдено</span>
                  </div>
                  <div>
                    <strong>
                      {correctAnswers} з {totalQuestions}
                    </strong>
                    <span>відповідей правильні</span>
                  </div>
                </div>
                <p>Зазвичай ти відповідаєш правильно на {averagePercentage}%</p>
                <div className="progress">
                  <div
                    className="progress-bar"
                    style={{ width: `${averagePercentage}%` }}
                  />
                </div>
                <p className="result-message">
                  {averagePercentage >= 80
                    ? "Чудова робота! Продовжуй у тому ж дусі!"
                    : "Тренуйся далі — у тебе все вийде!"}
                </p>
              </>
            )}
          </PageCard>

          {results.length > 0 && (
            <PageCard type="analysis">
              <h2>Мої останні тести</h2>
              <div className="history-list">
                {results.slice(0, 10).map((result, index) => {
                  const percentage = result.totalQuestions
                    ? Math.round(
                        (result.correctAnswers / result.totalQuestions) * 100,
                      )
                    : 0;

                  return (
                    <div className="history-item" key={result.id}>
                      <div>
                        <strong>
                          {result.grade} клас · тест {results.length - index}
                        </strong>
                        <p>{new Date(result.date).toLocaleString("uk-UA")}</p>
                      </div>
                      <div>
                        <strong>
                          {result.correctAnswers} з {result.totalQuestions}
                        </strong>
                        <p>відповідей правильні · {percentage}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </PageCard>
          )}
        </>
      )}
    </div>
  );
}

export { TeacherOverview };
export default Profile;
