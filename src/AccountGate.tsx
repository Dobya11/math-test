import { useState, type FormEvent } from "react";
import PageCard from "./components/Card.tsx";
import { createAccount, getAccounts, selectAccount } from "./ts/accounts.ts";
import type { User } from "./ts/types.ts";

interface AccountGateProps {
  onAuthenticated: (account: User) => void;
}

function AccountGate({ onAuthenticated }: AccountGateProps) {
  const [profiles, setProfiles] = useState<User[]>(getAccounts);
  const [mode, setMode] = useState<"select" | "create">(() =>
    getAccounts().length > 0 ? "select" : "create",
  );
  const [name, setName] = useState("");
  const [role, setRole] = useState<User["role"]>("student");
  const [error, setError] = useState("");

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      const account = createAccount(name, role);
      setProfiles(getAccounts());
      onAuthenticated(account);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Щось пішло не так. Спробуйте ще раз.",
      );
    }
  }

  function handleSelect(accountId: string) {
    try {
      onAuthenticated(selectAccount(accountId));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося відкрити цей профіль.",
      );
    }
  }

  function changeMode(nextMode: "select" | "create") {
    setMode(nextMode);
    setError("");
    setName("");
  }

  return (
    <main className="account-main">
      <div className="screen account-screen">
        <PageCard type="header">
          <h1>Математика</h1>
          <p>Обери, хто буде займатися сьогодні</p>
        </PageCard>

        <PageCard type="account">
          {mode === "select" ? (
            <>
              <h2>Обери свій профіль</h2>
              <div className="account-list">
                {profiles.map((profile) => (
                  <button
                    className="account-profile"
                    type="button"
                    key={profile.id}
                    onClick={() => handleSelect(profile.id)}
                  >
                    <strong>{profile.name}</strong>
                    <span>
                      {profile.role === "teacher" ? "Вчитель" : "Учень"}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2>Створи профіль</h2>
              <p>Вибери ім’я та роль.</p>

              <form className="account-form" onSubmit={handleCreate}>
                <label className="info-field">
                  <span>Ім’я</span>
                  <input
                    className="account-input"
                    type="text"
                    autoComplete="name"
                    value={name}
                    maxLength={24}
                    required
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>

                <fieldset className="role-picker">
                  <legend>Я</legend>
                  <label className="role-option">
                    <input
                      type="radio"
                      name="role"
                      value="student"
                      checked={role === "student"}
                      onChange={() => setRole("student")}
                    />
                    <span>Учень</span>
                  </label>
                  <label className="role-option">
                    <input
                      type="radio"
                      name="role"
                      value="teacher"
                      checked={role === "teacher"}
                      onChange={() => setRole("teacher")}
                    />
                    <span>Вчитель</span>
                  </label>
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

          {error && mode === "select" && (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}

          {profiles.length > 0 && (
            <button
              className="account-switch"
              type="button"
              onClick={() =>
                changeMode(mode === "create" ? "select" : "create")
              }
            >
              {mode === "create" ? "До вибору профілю" : "Додати профіль"}
            </button>
          )}

          <p className="account-note">
            Профілі та результати зберігаються лише на цьому пристрої.
          </p>
        </PageCard>
      </div>
    </main>
  );
}

export default AccountGate;
