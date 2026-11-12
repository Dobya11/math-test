import { useState, type FormEvent } from "react";
import PageCard from "./components/Card.tsx";

interface AccountGateProps {
  inviteCode: string;
  onCreateAccount: (
    displayName: string,
    role: "teacher" | "student",
  ) => Promise<void>;
}

function AccountGate({ inviteCode, onCreateAccount }: AccountGateProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"teacher" | "student">(
    inviteCode ? "student" : "teacher",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onCreateAccount(name.trim().replace(/\s+/g, " "), role);
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
              : "Створи профіль на цьому пристрої"}
          </p>
        </PageCard>

        <PageCard type="account">
          {error && (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}

          <h2>Створити профіль</h2>
          <form className="account-form" onSubmit={handleCreateAccount}>
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

            <small className="account-note">
              Профіль прив’язаний до цього браузера. Якщо очистити його дані,
              створиться новий профіль.
            </small>

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
