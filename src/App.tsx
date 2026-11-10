import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import "./App.css";
import AccountGate from "./AccountGate.tsx";
import { StudentDashboard, TeacherDashboard } from "./Classroom.tsx";
import Tests from "./Tests.tsx";
import Test from "./Test.tsx";
import Profile, { TeacherOverview } from "./Profie.tsx";
import { getCurrentAccount, signOut } from "./ts/accounts.ts";
import { getAccountProfile } from "./ts/classroom.ts";
import { getSupabase, isSupabaseConfigured } from "./ts/supabase.ts";
import type { Grade, User } from "./ts/types.ts";

type LocalScreen = "tests" | "overview" | "profile" | "test";

function App() {
  const [localAccount, setLocalAccount] = useState<User | null>(() =>
    isSupabaseConfigured ? null : getCurrentAccount(),
  );
  const [localScreen, setLocalScreen] = useState<LocalScreen>(
    localAccount?.role === "teacher" ? "overview" : "tests",
  );
  const [testSettings, setTestSettings] = useState<{
    grade: Grade;
    questionCount: number;
    timeLimitSec: number | null;
  } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{
    userId: string;
    account: User;
  } | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [profileError, setProfileError] = useState("");
  const account =
    profile && session && profile.userId === session.user.id
      ? profile.account
      : null;

  const inviteCode =
    window.location.pathname.match(/^\/class\/(\d{6})\/?$/)?.[1] ?? "";

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let active = true;
    const client = getSupabase();
    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setProfileError(error.message);
        setSession(data.session);
        setAuthReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setProfileError(
          error instanceof Error ? error.message : "Не вдалося перевірити сесію.",
        );
        setAuthReady(true);
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setProfileError("");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    let active = true;
    void getAccountProfile(session.user.id)
      .then((profile) => {
        if (active) {
          setProfile({ userId: session.user.id, account: profile });
          setProfileError("");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setProfileError(
            error instanceof Error
              ? error.message
              : "Не вдалося завантажити профіль.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [session]);

  async function handleSignOut() {
    const confirmed = window.confirm(
      "Це анонімний профіль. Після виходу його UUID не можна буде відновити на іншому пристрої. Ви впевнені, що хочете вийти?",
    );
    if (!confirmed) return;
    const { error } = await getSupabase().auth.signOut();
    if (error) {
      setProfileError(error.message);
      return;
    }
    setProfileError("");
  }

  function handleLocalAuthenticated(account: User) {
    setLocalAccount(account);
    setLocalScreen(account.role === "teacher" ? "overview" : "tests");
    setTestSettings(null);
  }

  function handleLocalSignOut() {
    signOut();
    setLocalAccount(null);
    setTestSettings(null);
  }

  function startLocalTest(
    grade: Grade,
    questionCount: number,
    timeLimitSec: number | null,
  ) {
    setTestSettings({ grade, questionCount, timeLimitSec });
    setLocalScreen("test");
  }

  if (localAccount) {
    const screens: LocalScreen[] =
      localAccount.role === "teacher"
        ? ["overview", "profile"]
        : ["tests", "profile"];
    const navigationIndex = screens.indexOf(localScreen);

    return (
      <div className="App local-layout">
        <Analytics />
        <main>
          {localScreen === "tests" && (
            <Tests
              initialGrade={testSettings?.grade ?? 1}
              onStartTest={startLocalTest}
            />
          )}
          {localScreen === "overview" && (
            <TeacherOverview user={localAccount} />
          )}
          {localScreen === "test" && testSettings && (
            <Test
              grade={testSettings.grade}
              questionCount={testSettings.questionCount}
              timeLimitSec={testSettings.timeLimitSec}
              onExit={() => setLocalScreen("tests")}
            />
          )}
          {localScreen === "profile" && (
            <Profile user={localAccount} onSignOut={handleLocalSignOut} />
          )}
        </main>
        <header className={localScreen === "test" ? "test-nav" : undefined}>
          {localScreen === "test" ? (
            <button type="button" onClick={() => setLocalScreen("tests")}>
              Назад до тестів
            </button>
          ) : (
            <nav aria-label="Основна навігація">
              <div
                className="selector"
                style={
                  {
                    "--index": navigationIndex,
                  } as React.CSSProperties
                }
              />
              {screens.map((screen) => (
                <button
                  key={screen}
                  type="button"
                  aria-current={localScreen === screen ? "page" : undefined}
                  onClick={() => setLocalScreen(screen)}
                >
                  {screen === "overview"
                    ? "Успішність"
                    : screen === "profile"
                      ? "Профіль"
                      : "Тести"}
                </button>
              ))}
            </nav>
          )}
        </header>
      </div>
    );
  }

  return (
    <div className="App">
      <Analytics />
      {isSupabaseConfigured && !authReady ? (
        <main className="account-main">
          <p>Перевірка облікового запису…</p>
        </main>
      ) : isSupabaseConfigured && session && !account ? (
        <main className="account-main">
          <section className="setup-notice">
            <h1>Не вдалося відкрити профіль</h1>
            <p role="alert">
              {profileError || "Зачекайте, профіль завантажується."}
            </p>
            <button type="button" onClick={() => void handleSignOut()}>
              Вийти
            </button>
          </section>
        </main>
      ) : account ? (
        <>
          {profileError && (
            <p className="auth-feedback" role="alert">
              {profileError}
            </p>
          )}
          {account.role === "teacher" ? (
            <TeacherDashboard
              user={account}
              onSignOut={() => void handleSignOut()}
            />
          ) : (
            <StudentDashboard
              user={account}
              inviteCode={inviteCode}
              onSignOut={() => void handleSignOut()}
            />
          )}
        </>
      ) : (
        <AccountGate
          inviteCode={inviteCode}
          onLocalAuthenticated={handleLocalAuthenticated}
        />
      )}
    </div>
  );
}

export default App;
