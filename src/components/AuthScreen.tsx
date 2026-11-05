import { useEffect, useState } from "react";
import { useSession } from "../lib/session";
import { Digits } from "./Digits";
import { Keypad } from "./Keypad";

type Step = "id" | "pin" | "newPin" | "confirmPin" | "created";

export function AuthScreen() {
  const session = useSession();
  const [step, setStep] = useState<Step>("id");
  const [value, setValue] = useState("");
  const [userId, setUserId] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const go = (next: Step) => {
    setValue("");
    setError("");
    setStep(next);
  };

  const submit = async (digits: string) => {
    if (step === "id") {
      setUserId(digits);
      go("pin");
      return;
    }
    if (step === "pin") {
      try {
        await session.signIn(userId, digits);
      } catch {
        setValue("");
      }
      return;
    }
    if (step === "newPin") {
      setFirstPin(digits);
      go("confirmPin");
      return;
    }
    if (step === "confirmPin") {
      if (digits !== firstPin) {
        setFirstPin("");
        setValue("");
        setError("Those PINs don't match. Start again.");
        setStep("newPin");
        return;
      }
      try {
        const created = await session.register(digits);
        setCreatedId(created.userId);
        setStep("created");
      } catch {
        setValue("");
        setFirstPin("");
        setStep("newPin");
      }
    }
  };

  const push = (digit: string) => {
    if (session.busy || step === "created") return;
    const next = (value + digit).slice(0, 6);
    setValue(next);
    setError("");
    if (next.length === 6) void submit(next);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (step === "created") return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        push(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        setValue((current) => current.slice(0, -1));
        setError("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(createdId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (step === "created") {
    return (
      <main className="ds-auth">
        <header className="ds-auth-head">
          <span className="ds-wordmark">DAYSTREAM</span>
        </header>
        <section className="ds-auth-panel">
          <span className="ds-eyebrow">Your Daystream ID</span>
          <p className="ds-created-id">{createdId}</p>
          <p className="ds-auth-caption">
            Write this down. This ID and your PIN are the only way back in.
          </p>
          <div className="ds-auth-actions">
            <button type="button" className="ds-text-btn" onClick={() => void copyId()}>
              {copied ? "Copied" : "Copy ID"}
            </button>
            <button type="button" className="ds-primary" onClick={session.enter}>
              Enter Daystream
            </button>
          </div>
        </section>
      </main>
    );
  }

  const heading =
    step === "id"
      ? "Six digits in."
      : step === "pin"
        ? "Your PIN."
        : step === "newPin"
          ? "Choose a PIN."
          : "Once more.";
  const caption =
    step === "id"
      ? "Your Daystream ID."
      : step === "pin"
        ? `ID ${userId}`
        : step === "newPin"
          ? "Six digits. Numbers only."
          : "Type the same six digits again.";

  return (
    <main className="ds-auth">
      <header className="ds-auth-head">
        <span className="ds-wordmark">DAYSTREAM</span>
        <span className="ds-eyebrow">A calendar you can write in</span>
      </header>

      <section className="ds-auth-panel" aria-label={heading}>
        <h1 className="ds-auth-title">{heading}</h1>
        <p className="ds-auth-caption">{caption}</p>
        <Digits count={value.length} error={Boolean(error)} />
        <p className="ds-auth-error" role="status">
          {error || session.message}
        </p>

        <Keypad
          onDigit={push}
          onBackspace={() => {
            setValue((current) => current.slice(0, -1));
            setError("");
          }}
          onSecondary={() => {
            if (step === "id") {
              go("newPin");
            } else if (step === "pin") {
              setUserId("");
              go("id");
            } else {
              go("id");
            }
          }}
          secondaryLabel={
            step === "id" ? "New account" : step === "pin" ? "Another ID" : "Sign in"
          }
          disabled={session.busy}
        />

        <p className="ds-auth-footnote">
          {step === "id"
            ? "Lose the ID and the notebook is gone. Keep it somewhere whole."
            : step === "pin"
              ? "Four hours idle locks this device. Your PIN opens it again."
              : "A PIN cannot be recovered, only replaced with a new account."}
        </p>
      </section>
    </main>
  );
}
