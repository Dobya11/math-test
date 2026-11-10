import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import "./App.css";
import AccountGate from "./AccountGate.tsx";
import { StudentDashboard, TeacherDashboard } from "./Classroom.tsx";
import { getAccountProfile } from "./ts/classroom.ts";
import { getSupabase, isSupabaseConfigured } from "./ts/supabase.ts";
import type { User } from "./ts/types.ts";

function App() {
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
    if (!isSupabaseConfigured) return;

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
          error instanceof Error
            ? error.message
            : "Не вдалося перевірити профіль.",
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
    if (!session) return;

    let active = true;
    void getAccountProfile(session.user.id)
      .then((nextProfile) => {
        if (active) {
          setProfile({ userId: session.user.id, account: nextProfile });
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
      "Після виходу цей профіль не можна буде відновити. Вийти?",
    );
    if (!confirmed) return;
    const { error } = await getSupabase().auth.signOut();
    if (error) {
      setProfileError(error.message);
      return;
    }
    setProfileError("");
  }

  return (
    <div className="App">
      <Analytics />
      {!isSupabaseConfigured ? (
        <main className="account-main">
          <section className="setup-notice">
            <h1>Застосунок поки недоступний</h1>
            <p>Попроси вчителя перевірити підключення та спробуй ще раз.</p>
          </section>
        </main>
      ) : !authReady ? (
        <main className="account-main">
          <p>Зачекай, відкриваємо профіль…</p>
        </main>
      ) : session && !account ? (
        <main className="account-main">
          <section className="setup-notice">
            <h1>Не вдалося відкрити профіль</h1>
            <p role="alert">
              {profileError || "Зачекай, профіль завантажується."}
            </p>
            <button type="button" onClick={() => void handleSignOut()}>
              Повернутися
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
        <AccountGate inviteCode={inviteCode} />
      )}
    </div>
  );
}

export default App;
