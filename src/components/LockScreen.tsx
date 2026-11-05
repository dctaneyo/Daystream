import { useEffect, useState } from "react";
import { useSession } from "../lib/session";
import { Digits } from "./Digits";
import { Keypad } from "./Keypad";

export function LockScreen() {
  const session = useSession();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [signOutArmed, setSignOutArmed] = useState(false);

  const push = (digit: string) => {
    if (session.busy) return;
    const next = (value + digit).slice(0, 6);
    setValue(next);
    setError("");
    if (next.length === 6) {
      void session.unlock(next).finally(() => setValue(""));
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
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

  return (
    <main className="ds-auth ds-lock">
      <header className="ds-auth-head">
        <span className="ds-wordmark">DAYSTREAM</span>
        <span className="ds-eyebrow">Locked</span>
      </header>

      <section className="ds-auth-panel" aria-label="Unlock Daystream">
        <h1 className="ds-auth-title">Your PIN.</h1>
        <p className="ds-auth-caption">
          ID {session.me?.user.userId ?? "——————"}
        </p>
        <Digits count={value.length} error={Boolean(error || session.message)} />
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
            if (!signOutArmed) {
              setSignOutArmed(true);
              return;
            }
            void session.signOut();
          }}
          secondaryLabel={signOutArmed ? "Sign out" : "Not you?"}
          disabled={session.busy}
        />

        <p className="ds-auth-footnote">
          {signOutArmed
            ? "Tap Sign out again to leave this device."
            : "The notebook is still syncing underneath. The PIN only opens the view."}
        </p>
      </section>
    </main>
  );
}
