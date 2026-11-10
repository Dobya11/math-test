import { useState, type FormEvent } from "react";
import PageCard from "./components/Card.tsx";
import { getSupabase } from "./ts/supabase.ts";

interface AccountGateProps {
  inviteCode: string;
}

function AccountGate({ inviteCode }: AccountGateProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"teacher" | "student">(
    inviteCode ? "student" : "teacher",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
    } catch (caughtError) {
      console.error("Unable to create the account.", caughtError);
      setError("Не вдалося створити профіль. Спробуйте ще раз.");
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
              : "Створи профіль, щоб почати"}
          </p>
        </PageCard>

        <PageCard type="account">
          <h2>Почати</h2>
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
              {busy ? "Створення профілю…" : "Продовжити"}
            </button>
          </form>
        </PageCard>
      </div>
    </main>
  );
}

export default AccountGate;
