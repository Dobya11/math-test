import { useState, type FormEvent } from "react";
import PageCard from "./components/Card.tsx";

interface AccountGateProps {
  inviteCode: string;
  onSignIn: (username: string, password: string) => Promise<void>;
  onCreateAccount: (
    username: string,
    password: string,
    displayName: string,
    role: "teacher" | "student",
  ) => Promise<void>;
}

function AccountGate({
  inviteCode,
  onSignIn,
  onCreateAccount,
}: AccountGateProps) {
  const [username, setUsername] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"teacher" | "student">(
    inviteCode ? "student" : "teacher",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSignIn(loginUsername.trim().toLowerCase(), loginPassword);
    } catch (caughtError) {
      const errorMessage =
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося увійти. Перевір username і пароль.";
      console.error("Unable to sign in.", new Error(errorMessage));
      setError(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onCreateAccount(
        username.trim().toLowerCase(),
        password,
        name.trim().replace(/\s+/g, " "),
        role,
      );
    } catch (caughtError) {
      const errorMessage =
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося створити профіль. Спробуйте ще раз.";
      console.error("Unable to create the account.", new Error(errorMessage));
      setError(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account-main">
      <div className="screen account-screen">
        <PageCard type="header">
          <h1>Математика · 2 клас</h1>
          <p>
            {inviteCode
              ? `Запрошення до класу ${inviteCode}`
              : "Увійди або створи профіль"}
          </p>
        </PageCard>

        <PageCard type="account">
          {error && (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}

          <h2>Увійти</h2>
          <form className="account-form" onSubmit={handleSignIn}>
            <label className="info-field">
              <span>Username</span>
              <input
                className="account-input"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={loginUsername}
                maxLength={20}
                minLength={3}
                pattern="[a-zA-Z0-9_]{3,20}"
                required
                onChange={(event) => setLoginUsername(event.target.value)}
              />
            </label>

            <label className="info-field">
              <span>Пароль</span>
              <input
                className="account-input"
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                minLength={6}
                required
                onChange={(event) => setLoginPassword(event.target.value)}
              />
            </label>

            <button type="submit" disabled={busy}>
              {busy ? "Вхід…" : "Увійти"}
            </button>
          </form>

          <h2>Створити профіль</h2>
          <form className="account-form" onSubmit={handleCreateAccount}>
            <label className="info-field">
              <span>Username</span>
              <input
                className="account-input"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                maxLength={20}
                minLength={3}
                pattern="[a-zA-Z0-9_]{3,20}"
                title="Використовуй 3–20 латинських літер, цифр або символів _."
                required
                onChange={(event) => setUsername(event.target.value)}
              />
              <small className="account-note">
                Username відрізняє профілі. Використовуй його разом із паролем
                для входу з будь-якого пристрою.
              </small>
            </label>

            <label className="info-field">
              <span>Пароль (від 6 символів)</span>
              <input
                className="account-input"
                type="password"
                autoComplete="new-password"
                value={password}
                minLength={6}
                required
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            <label className="info-field">
              <span>Відображуване ім’я</span>
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
                  <span>{nextRole === "teacher" ? "Учитель" : "Учень"}</span>
                </label>
              ))}
            </fieldset>

            <button type="submit" disabled={busy}>
              {busy ? "Створення профілю…" : "Створити профіль"}
            </button>
          </form>
        </PageCard>
      </div>
    </main>
  );
}

export default AccountGate;
