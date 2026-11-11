import { useState, type FormEvent } from "react";
import PageCard from "./components/Card.tsx";
import type { SavedAccount } from "./ts/localAccounts.ts";

interface AccountGateProps {
  inviteCode: string;
  savedAccounts: SavedAccount[];
  activeAccountId: string | null;
  onSelectAccount: (account: SavedAccount) => Promise<void>;
  onCreateAccount: (
    name: string,
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
      console.error("Unable to restore the saved account.", caughtError);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося відкрити збережений профіль.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      await onCreateAccount(name.trim().replace(/\s+/g, " "), role);
    } catch (caughtError) {
      console.error("Unable to create the account.", caughtError);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося створити профіль. Спробуйте ще раз.",
      );
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
                    <strong>{account.name}</strong>
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

          <h2>
            {savedAccounts.length ? "Створити профіль" : "Почати"}
          </h2>
          <form className="account-form" onSubmit={handleSubmit}>
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
