import { useEffect, useState } from "react";
import "./App.css";

import Tests from "./Tests.tsx";
import Profile, { TeacherOverview } from "./Profie.tsx";
import Test from "./Test.tsx";
import AccountGate from "./AccountGate.tsx";

import type { Grade, User } from "./ts/types.ts";
import { getCurrentAccount, signOut } from "./ts/accounts.ts";

type Screen = "tests" | "overview" | "profile" | "test";

const screenTitles: Record<Screen, string> = {
  tests: "Тести",
  overview: "Успішність",
  profile: "Профіль",
  test: "Тест",
};

function App() {
  const [account, setAccount] = useState<User | null>(getCurrentAccount);
  const [screen, setScreen] = useState<Screen>(
    getCurrentAccount()?.role === "teacher" ? "overview" : "tests",
  );

  const [testSettings, setTestSettings] = useState<{
    grade: Grade;
    questionCount: number;
    timeLimitSec: number | null;
  } | null>(null);

  useEffect(() => {
    if (!account) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScreen(account.role === "teacher" ? "overview" : "tests");
  }, [account]);

  const screens: Screen[] =
    account?.role === "teacher"
      ? ["overview", "profile"]
      : ["tests", "profile"];

  const index = screens.indexOf(screen);

  function handleSignOut() {
    const nextScreen = account?.role === "teacher" ? "overview" : "tests";
    signOut();
    setAccount(null);
    setScreen(nextScreen);
    setTestSettings(null);
  }

  function startTest(
    grade: Grade,
    questionCount: number,
    timeLimitSec: number | null,
  ) {
    setTestSettings({
      grade,
      questionCount,
      timeLimitSec,
    });

    setScreen("test");
  }

  if (!account) {
    return (
      <div className="App">
        <AccountGate
          onAuthenticated={(signedInAccount) => setAccount(signedInAccount)}
        />
      </div>
    );
  }

  return (
    <div className="App">
      <main>
        {screen === "tests" && (
          <Tests
            initialGrade={testSettings?.grade ?? 1}
            onStartTest={startTest}
          />
        )}

        {screen === "overview" && (
          <section className="screen">
            <TeacherOverview user={account} />
          </section>
        )}

        {screen === "test" && testSettings && (
          <Test
            grade={testSettings.grade}
            questionCount={testSettings.questionCount}
            timeLimitSec={testSettings.timeLimitSec}
            onExit={() => setScreen("tests")}
          />
        )}

        {screen === "profile" && (
          <section className="screen">
            <Profile user={account} onSignOut={handleSignOut} />
          </section>
        )}
      </main>

      {screen === "test" ? (
        <header className="test-nav">
          <button type="button" onClick={() => setScreen("tests")}>
            Назад до тестів
          </button>
        </header>
      ) : (
        <header>
          <nav aria-label="Основна навігація">
            <div
              className="selector"
              style={
                {
                  "--index": index,
                } as React.CSSProperties
              }
            />

            <button
              aria-current={screen === screens[0] ? "page" : undefined}
              onClick={() => setScreen(screens[0])}
            >
              {screenTitles[screens[0]]}
            </button>

            <button
              aria-current={screen === screens[1] ? "page" : undefined}
              onClick={() => setScreen(screens[1])}
            >
              {screenTitles[screens[1]]}
            </button>
          </nav>
        </header>
      )}
    </div>
  );
}

export default App;
