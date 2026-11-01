"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { pinLoginAction } from "@/actions/auth";
import type { ActionState } from "@/lib/action-types";
import { CodeDots, PinPad } from "@/components/PinPad";

const CODE_LENGTH = 6;

export function PinLogin({ initialError }: { initialError?: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(pinLoginAction, {
    error: initialError ?? null,
  });

  const [step, setStep] = useState<"id" | "pin">("id");
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const lastError = useRef<string | null>(null);

  useEffect(() => {
    if (state.error && state.error !== lastError.current) {
      lastError.current = state.error;
      setPin("");
    }
  }, [state.error]);

  useEffect(() => {
    if (step === "pin" && pin.length === CODE_LENGTH && !pending) {
      formRef.current?.requestSubmit();
    }
  }, [pin, step, pending]);

  const pressDigit = useCallback(
    (digit: string) => {
      if (pending) return;
      if (step === "id") {
        setUserId((current) => {
          if (current.length >= CODE_LENGTH) return current;
          const next = current + digit;
          if (next.length === CODE_LENGTH) setStep("pin");
          return next;
        });
        return;
      }
      setPin((current) => (current.length >= CODE_LENGTH ? current : current + digit));
    },
    [pending, step],
  );

  const backspace = useCallback(() => {
    if (pending) return;
    if (step === "id") {
      setUserId((current) => current.slice(0, -1));
      return;
    }
    setPin((current) => current.slice(0, -1));
  }, [pending, step]);

  // Hardware keyboard support for desktop.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key >= "0" && event.key <= "9") {
        pressDigit(event.key);
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [backspace, pressDigit]);

  return (
    <div className="flex w-full flex-col">
      <form ref={formRef} action={action} className="flex flex-col">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="pin" value={pin} />

        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            {step === "id" ? "Your Daystream ID" : "Enter your PIN"}
          </p>
          {step === "pin" ? (
            <button
              type="button"
              onClick={() => {
                setStep("id");
                setPin("");
              }}
              className="mt-1 text-sm text-muted hover:text-ink"
            >
              ID {userId} · change
            </button>
          ) : (
            <p className="mt-1 text-sm text-muted">Six digits, no email needed.</p>
          )}
        </div>

        <div className={`mt-6 ${state.error ? "animate-[shake_240ms_ease-in-out]" : ""}`}>
          {step === "id" ? (
            <CodeDots value={userId} label="Daystream ID" />
          ) : (
            <CodeDots value={pin} masked label="PIN" />
          )}
        </div>

        <div className="mt-4 min-h-[2.25rem] text-center">
          {pending && <p className="text-sm text-muted">Checking…</p>}
          {!pending && state.error && (
            <p className="text-sm text-danger">{state.error}</p>
          )}
        </div>

        <div className="mt-1">
          <PinPad onDigit={pressDigit} onBackspace={backspace} disabled={pending} />
        </div>
      </form>

      <div className="mt-7 flex flex-col items-center gap-2 text-sm text-muted">
        <p>
          New here?{" "}
          <Link href="/signup" className="text-ink underline decoration-edge underline-offset-4">
            Create an account
          </Link>
        </p>
        <p className="text-xs">
          No account yet? Your admin can issue an ID and PIN, or sign up to get one instantly.
        </p>
      </div>

      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}`}</style>
    </div>
  );
}
