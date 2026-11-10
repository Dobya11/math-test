import { useState, type FormEvent } from "react";
import PageCard from "./components/Card.tsx";
import { createAccount, getAccounts, selectAccount } from "./ts/accounts.ts";
import { isSupabaseConfigured, getSupabase } from "./ts/supabase.ts";
import type { User } from "./ts/types.ts";

interface AccountGateProps {
  inviteCode: string;
  onLocalAuthenticated: (account: User) => void;
}

type Mode = "remote" | "local-select" | "local-create";

function AccountGate({ inviteCode, onLocalAuthenticated }: AccountGateProps) {
  const [profiles, setProfiles] = useState(getAccounts);
  const [mode, setMode] = useState<Mode>(() => {
    if (isSupabaseConfigured) return "remote";
    return getAccounts().length > 0 ? "local-select" : "local-create";
  });
  const [name, setName] = useState("");
  const [role, setRole] = useState<User["role"]>(
    inviteCode ? "student" : "teacher",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleRemoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const { error: authError } = await getSupabase().auth.signInAnonymously({
        options: {
          data: {
            display_name: name.trim().replace(/\s+/g, " "),
            role,
          },
        },
      });
      if (authError) throw authError;
    } catch {
      setError("Не вдалося створити профіль. Спробуйте ще раз.");
    } finally {
      setBusy(false);
    }
  }

  function handleLocalCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      const account = createAccount(name, role);
      setProfiles(getAccounts());
      onLocalAuthenticated(account);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося створити профіль.",
      );
    }
  }

  function handleLocalSelect(accountId: string) {
    setError("");
    try {
      onLocalAuthenticated(selectAccount(accountId));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося відкрити цей профіль.",
      );
    }
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setName("");
  }

  return (
    <main className="account-main">
      <div className="screen account-screen">
        <PageCard type="header">
          <h1>Математика · 2 клас</h1>
          <p>
            {inviteCode
              ? `Запрошення до класу ${inviteCode}`
              : "Система навчальних завдань"}
          </p>
        </PageCard>

        <PageCard type="account">
          {mode === "remote" ? (
            <>
              <h2>Почати</h2>
              <form className="account-form" onSubmit={handleRemoteSubmit}>
                <label className="info-field">
                  <span>Ім’я</span>
                  <input
                    className="account-input"
                    type="text"
                    autoComplete="nickname"
                    value={name}
                    maxLength={60}
                    minLength={2}
                    required
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>

                <fieldset className="role-picker">
                  <legend>Я</legend>
                  {(["teacher", "student"] as const).map((nextRole) => (
                    <label className="role-option" key={nextRole}>
                      <input
                        type="radio"
                        name="role"
                        value={nextRole}
                        checked={role === nextRole}
                        onChange={() => setRole(nextRole)}
                      />
                      <span>
                        {nextRole === "teacher" ? "Учитель" : "Учень"}
                      </span>
                    </label>
                  ))}
                </fieldset>

                {error && (
                  <p className="account-error" role="alert">
                    {error}
                  </p>
                )}

                <button type="submit" disabled={busy}>
                  {busy ? "Створення профілю…" : "Продовжити"}
                </button>
              </form>
            </>
          ) : mode === "local-select" ? (
            <>
              <h2>Обери локальний профіль</h2>
              <div className="account-list">
                {profiles.map((profile) => (
                  <button
                    className="account-profile"
                    type="button"
                    key={profile.id}
                    onClick={() => handleLocalSelect(profile.id)}
                  >
                    <strong>{profile.name}</strong>
                    <span>
                      {profile.role === "teacher" ? "Учитель" : "Учень"}
                    </span>
                  </button>
                ))}
              </div>
              <p className="account-note">
                Локальні профілі й результати доступні лише на цьому пристрої
                та не підключаються до класу Supabase.
              </p>
              {error && (
                <p className="account-error" role="alert">
                  {error}
                </p>
              )}
            </>
          ) : (
            <>
              <h2>Створи локальний профіль</h2>
              <p>Профіль і результати зберігатимуться лише на цьому пристрої.</p>
              <form className="account-form" onSubmit={handleLocalCreate}>
                <label className="info-field">
                  <span>Ім’я</span>
                  <input
                    className="account-input"
                    type="text"
                    autoComplete="nickname"
                    value={name}
                    maxLength={24}
                    minLength={2}
                    required
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>

                <fieldset className="role-picker">
                  <legend>Я</legend>
                  {(["teacher", "student"] as const).map((nextRole) => (
                    <label className="role-option" key={nextRole}>
                      <input
                        type="radio"
                        name="local-role"
                        value={nextRole}
                        checked={role === nextRole}
                        onChange={() => setRole(nextRole)}
                      />
                      <span>
                        {nextRole === "teacher" ? "Учитель" : "Учень"}
                      </span>
                    </label>
                  ))}
                </fieldset>

                {error && (
                  <p className="account-error" role="alert">
                    {error}
                  </p>
                )}

                <button type="submit">Створити профіль</button>
              </form>
            </>
          )}

          {isSupabaseConfigured && mode !== "remote" && (
            <button
              className="account-switch"
              type="button"
              onClick={() => changeMode("remote")}
            >
              До входу через Supabase
            </button>
          )}
          {mode === "remote" && (
            <button
              className="account-switch"
              type="button"
              onClick={() =>
                changeMode(profiles.length > 0 ? "local-select" : "local-create")
              }
            >
              {profiles.length > 0
                ? "Увійти в локальний профіль"
                : "Створити локальний профіль"}
            </button>
          )}
          {mode === "local-select" && (
            <button
              className="account-switch"
              type="button"
              onClick={() => changeMode("local-create")}
            >
              Додати профіль
            </button>
          )}
          {mode === "local-create" && profiles.length > 0 && (
            <button
              className="account-switch"
              type="button"
              onClick={() => changeMode("local-select")}
            >
              До вибору профілю
            </button>
          )}
        </PageCard>
      </div>
    </main>
  );
}

export default AccountGate;
