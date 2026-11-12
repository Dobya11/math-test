import { useState, type FormEvent } from "react";
import PageCard from "./components/Card.tsx";
import type { SavedAccount } from "./ts/localAccounts.ts";

interface AccountGateProps {
  inviteCode: string;
  savedAccounts: SavedAccount[];
  activeAccountId: string | null;
  onSelectAccount: (account: SavedAccount) => Promise<void>;
  onCreateAccount: (
    username: string,
    displayName: string,
    role: "teacher" | "student",
  ) => Promise<void>;
}

function AccountGate({
  inviteCode,
  savedAccounts,
  activeAccountId,
  onSelectAccount,
  onCreateAccount,
}: AccountGateProps) {
  const [username, setUsername] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"teacher" | "student">(
    inviteCode ? "student" : "teacher",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSelectAccount(account: SavedAccount) {
    setError("");
    setBusy(true);
    try {
      await onSelectAccount(account);
    } catch (caughtError) {
      const errorMessage =
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося відкрити збережений профіль.";
      console.error("Unable to restore the saved account.", new Error(errorMessage));
      setError(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetUsername = loginUsername.trim().toLowerCase();
    setError("");
    if (!targetUsername) {
      setError("Введи username, щоб увійти до локального профілю.");
      return;
    }
    const matchingAccount = savedAccounts.find(
      (account) => account.username.toLowerCase() === targetUsername,
    );
    if (!matchingAccount) {
      setError("Профіль з таким username не знайдено на цьому пристрої.");
      return;
    }
    setBusy(true);
    try {
      await handleSelectAccount(matchingAccount);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      await onCreateAccount(
        username.trim().toLowerCase(),
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
            {savedAccounts.length
              ? "Обери профіль, збережений на цьому пристрої"
              : inviteCode
                ? `Запрошення до класу ${inviteCode}`
                : "Створи профіль, щоб почати"}
          </p>
        </PageCard>

        <PageCard type="account">
          {savedAccounts.length > 0 && (
            <>
              <h2>Збережені профілі</h2>
              <div className="account-list">
                {savedAccounts.map((account) => (
                  <button
                    className="account-profile"
                    key={account.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSelectAccount(account)}
                  >
                    <div className="account-profile-info">
                      <strong>{account.name}</strong>
                      <span>@{account.username}</span>
                    </div>
                    <span>
                      {account.id === activeAccountId
                        ? "Продовжити"
                        : account.role === "teacher"
                          ? "Учитель"
                          : account.role === "student"
                            ? "Учень"
                            : "Відкрити профіль"}
                    </span>
                  </button>
                ))}
              </div>
              <p className="account-note">
                Профілі збережені лише в цьому браузері на цьому пристрої.
              </p>
            </>
          )}

          {savedAccounts.length > 0 && (
            <form className="account-form" onSubmit={handleQuickLogin}>
              <label className="info-field">
                <span>Швидкий вхід за username</span>
                <input
                  className="account-input"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={loginUsername}
                  placeholder="Наприклад: user_olya"
                  maxLength={20}
                  onChange={(event) => setLoginUsername(event.target.value)}
                />
              </label>
              <button type="submit" disabled={busy}>
                {busy ? "Вхід…" : "Увійти у локальний профіль"}
              </button>
            </form>
          )}

          <h2>{savedAccounts.length ? "Створити профіль" : "Почати"}</h2>
          <form className="account-form" onSubmit={handleSubmit}>
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
                Username відрізняє профілі, але не є способом входу. Профіль
                можна відкрити лише на пристрої, де його збережено.
              </small>
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

            {error && (
              <p className="account-error" role="alert">
                {error}
              </p>
            )}

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
