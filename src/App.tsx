import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import "./App.css";
import AccountGate from "./AccountGate.tsx";
import { StudentDashboard, TeacherDashboard } from "./Classroom.tsx";
import { getAccountProfile } from "./ts/classroom.ts";
import {
  loadSavedAccounts,
  saveAccountSession,
  type SavedAccount,
} from "./ts/localAccounts.ts";
import { getSupabase, isSupabaseConfigured } from "./ts/supabase.ts";
import type { User } from "./ts/types.ts";

async function signOutLocally() {
  const { error } = await getSupabase().auth.signOut({ scope: "local" });
  if (error) throw error;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
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
    if (!isSupabaseConfigured) return;

    let active = true;
    const client = getSupabase();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setProfileError("");
      if (nextSession) {
        try {
          setSavedAccounts(saveAccountSession(nextSession));
        } catch (error) {
          setProfileError(
            error instanceof Error
              ? error.message
              : "Не вдалося зберегти профіль на цьому пристрої.",
          );
        }
      }
    });

    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setProfileError(error.message);
        setSession(data.session);
        const accounts = loadSavedAccounts();
        setSavedAccounts(
          data.session ? saveAccountSession(data.session) : accounts,
        );
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

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSelectAccount(savedAccount: SavedAccount) {
    const { data, error } = await getSupabase().auth.setSession({
      access_token: savedAccount.accessToken,
      refresh_token: savedAccount.refreshToken,
    });
    if (error) {
      throw new Error(`Не вдалося відновити сесію: ${error.message}`, {
        cause: error,
      });
    }
    if (!data.session || data.session.user.id !== savedAccount.id) {
      throw new Error("Supabase повернув інший профіль замість вибраного.");
    }
    setSession(data.session);
    setAccountChosen(true);
  }

  async function handleCreateAccount(
    username: string,
    displayName: string,
    role: "teacher" | "student",
  ) {
    const { data: usernameAvailable, error: usernameError } =
      await getSupabase().rpc("is_username_available", {
        p_username: username,
      });
    if (usernameError) throw usernameError;
    if (usernameAvailable !== true) {
      throw new Error("Цей username вже зайнятий. Обери інший.");
    }

    if (session) {
      setSavedAccounts(saveAccountSession(session));
      await signOutLocally();
    }
    const { data, error } = await getSupabase().auth.signInAnonymously({
      options: {
        data: {
          username,
          display_name: displayName,
          role,
        },
      },
    });
    if (error) {
      if (error.code === "23505" || /username|зайнятий/i.test(error.message)) {
        throw new Error("Цей username вже зайнятий. Обери інший.", {
          cause: error,
        });
      }
      throw error;
    }
    if (!data.session) {
      throw new Error("Supabase не повернув сесію нового профілю.");
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
      "Поточний профіль залишиться збереженим на цьому пристрої. Перейти до вибору акаунта?",
    );
    if (!confirmed) return;
    if (session) {
      try {
        setSavedAccounts(saveAccountSession(session));
      } catch (error) {
        setProfileError(
          error instanceof Error
            ? error.message
            : "Не вдалося зберегти профіль на цьому пристрої.",
        );
        return;
      }
    }
    try {
      await signOutLocally();
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Не вдалося вийти з профілю.",
      );
      return;
    }
    setProfileError("");
    setAccountChosen(false);
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
      ) : !accountChosen ? (
        <AccountGate
          inviteCode={inviteCode}
          savedAccounts={savedAccounts}
          activeAccountId={session?.user.id ?? null}
          onSelectAccount={handleSelectAccount}
          onCreateAccount={handleCreateAccount}
        />
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
      ) : null}
    </div>
  );
}

export default App;
