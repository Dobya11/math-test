import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import "./App.css";
import AccountGate from "./AccountGate.tsx";
import { StudentDashboard, TeacherDashboard } from "./Classroom.tsx";
import { getAccountProfile } from "./ts/classroom.ts";
import { getSupabase, isSupabaseConfigured } from "./ts/supabase.ts";
import type { User } from "./ts/types.ts";

function normalizeError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "");
    if (message) {
      return new Error(message);
    }
  }
  return new Error(fallbackMessage);
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [accountChosen, setAccountChosen] = useState(false);
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
    try {
      localStorage.removeItem("mathTest_savedAccounts_v1");
    } catch (error) {
      console.error("Unable to remove legacy saved accounts.", error);
    }

    if (!isSupabaseConfigured) return;

    let active = true;
    const client = getSupabase();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAccountChosen(Boolean(nextSession));
      setProfileError("");
    });

    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setProfileError(error.message);
        setSession(data.session);
        setAccountChosen(Boolean(data.session));
        setAuthReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setProfileError(
          normalizeError(error, "Не вдалося перевірити профіль.").message,
        );
        setAuthReady(true);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleCreateAccount(
    displayName: string,
    role: "teacher" | "student",
  ) {
    const { data, error } = await getSupabase().auth.signInAnonymously({
      options: {
        data: {
          display_name: displayName,
          role,
        },
      },
    });
    if (error) {
      if (/anonymous.*disabled|anonymous.*not enabled/i.test(error.message)) {
        throw new Error(
          "У Supabase вимкнено анонімний вхід. Увімкни Anonymous Sign-Ins у налаштуваннях Auth.",
          { cause: error },
        );
      }
      throw error;
    }
    if (!data.session) {
      throw new Error("Supabase не повернув сесію для нового профілю.");
    }
    setSession(data.session);
    setAccountChosen(true);
  }

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
            normalizeError(error, "Не вдалося завантажити профіль.").message,
          );
        }
      });

    return () => {
      active = false;
    };
  }, [session]);

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
      ) : !accountChosen ? (
        <AccountGate
          inviteCode={inviteCode}
          onCreateAccount={handleCreateAccount}
        />
      ) : session && !account ? (
        <main className="account-main">
          <section className="setup-notice">
            <h1>Не вдалося відкрити профіль</h1>
            <p role="alert">
              {profileError || "Зачекай, профіль завантажується."}
            </p>
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
            <TeacherDashboard user={account} />
          ) : (
            <StudentDashboard user={account} inviteCode={inviteCode} />
          )}
        </>
      ) : null}
    </div>
  );
}

export default App;
