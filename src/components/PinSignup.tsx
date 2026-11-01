"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { signUpPinAction } from "@/actions/auth";
import type { ActionState } from "@/lib/action-types";
import { CodeDots, PinPad } from "@/components/PinPad";

const CODE_LENGTH = 6;

export function PinSignup() {
  const [state, action, pending] = useActionState<ActionState, FormData>(signUpPinAction, {
    error: null,
  });

  const [step, setStep] = useState<"details" | "pin" | "confirm">("details");
  const [name, setName] = useState("");
  const [workspace, setWorkspace] = useState("Personal");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const detailsRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (step === "confirm" && confirm.length === CODE_LENGTH && !pending) {
      formRef.current?.requestSubmit();
    }
  }, [confirm, step, pending]);

  useEffect(() => {
    if (state.error && (state.error.includes("PIN") || state.error.includes("match"))) {
      setStep("pin");
      setPin("");
      setConfirm("");
    }
  }, [state.error]);

  const pressDigit = useCallback(
    (digit: string) => {
      if (pending) return;
      if (step === "pin") {
        setPin((current) => {
          if (current.length >= CODE_LENGTH) return current;
          const next = current + digit;
          if (next.length === CODE_LENGTH) setStep("confirm");
          return next;
        });
        return;
      }
      if (step === "confirm") {
        setConfirm((current) => (current.length >= CODE_LENGTH ? current : current + digit));
      }
    },
    [pending, step],
  );

  const backspace = useCallback(() => {
    if (pending) return;
    if (step === "pin") setPin((current) => current.slice(0, -1));
    if (step === "confirm") setConfirm((current) => current.slice(0, -1));
  }, [pending, step]);

  useEffect(() => {
    if (step === "details") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key >= "0" && event.key <= "9") pressDigit(event.key);
      else if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [backspace, pressDigit, step]);

  if (step === "details") {
    return (
      <form
        ref={detailsRef}
        className="flex w-full flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim().length < 2) return;
          setStep("pin");
        }}
      >
        <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Alex Rivera"
          autoComplete="name"
          className="ds-input"
          required
          minLength={2}
        />
        <label
          className="mt-1 text-xs font-medium uppercase tracking-wide text-muted"
          htmlFor="workspace"
        >
          First workspace
        </label>
        <input
          id="workspace"
          value={workspace}
          onChange={(event) => setWorkspace(event.target.value)}
          placeholder="Work"
          className="ds-input"
          maxLength={40}
        />
        <p className="text-xs leading-relaxed text-muted">
          Next you&apos;ll pick a 6-digit PIN. We generate your Daystream ID and show it once — it&apos;s
          what you sign in with on any device.
        </p>
        <button
          type="submit"
          disabled={name.trim().length < 2}
          className="ds-button ds-button-primary mt-2 py-2.5 disabled:opacity-40"
        >
          Continue
        </button>
        <p className="mt-2 text-center text-sm text-muted">
          Already have an ID?{" "}
          <Link href="/login" className="text-ink underline decoration-edge underline-offset-4">
            Sign in
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form ref={formRef} action={action} className="flex w-full flex-col">
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="workspace" value={workspace} />
      <input type="hidden" name="pin" value={pin} />
      <input type="hidden" name="confirm" value={confirm} />

      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          {step === "pin" ? "Choose a 6-digit PIN" : "Confirm your PIN"}
        </p>
        <button
          type="button"
          onClick={() => {
            setStep(step === "confirm" ? "pin" : "details");
            if (step === "confirm") setConfirm("");
          }}
          className="mt-1 text-sm text-muted hover:text-ink"
        >
          {step === "confirm" ? "Re-enter from scratch" : "Back to details"}
        </button>
      </div>

      <div className="mt-6">
        {step === "pin" ? (
          <CodeDots value={pin} masked label="New PIN" />
        ) : (
          <CodeDots value={confirm} masked label="Confirm PIN" />
        )}
      </div>

      <div className="mt-4 min-h-[2.25rem] text-center">
        {pending && <p className="text-sm text-muted">Creating your account…</p>}
        {!pending && state.error && (
          <p className="text-sm text-danger">{state.error}</p>
        )}
        {!pending && !state.error && step === "confirm" && confirm.length > 0 && confirm !== pin && (
          <p className="text-sm text-warning">Those PINs don&apos;t match yet.</p>
        )}
      </div>

      <PinPad onDigit={pressDigit} onBackspace={backspace} disabled={pending} />
    </form>
  );
}
