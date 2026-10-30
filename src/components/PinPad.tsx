"use client";

const KEYS: Array<{ label: string; value: string; kind: "digit" | "back" | "blank" }> = [
  { label: "1", value: "1", kind: "digit" },
  { label: "2", value: "2", kind: "digit" },
  { label: "3", value: "3", kind: "digit" },
  { label: "4", value: "4", kind: "digit" },
  { label: "5", value: "5", kind: "digit" },
  { label: "6", value: "6", kind: "digit" },
  { label: "7", value: "7", kind: "digit" },
  { label: "8", value: "8", kind: "digit" },
  { label: "9", value: "9", kind: "digit" },
  { label: "", value: "", kind: "blank" },
  { label: "0", value: "0", kind: "digit" },
  { label: "⌫", value: "back", kind: "back" },
];

export function PinPad({
  onDigit,
  onBackspace,
  disabled = false,
}: {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid w-full grid-cols-3 gap-2.5" role="group" aria-label="Number pad">
      {KEYS.map((key, index) => {
        if (key.kind === "blank") {
          return <span key={`blank-${index}`} aria-hidden />;
        }
        return (
          <button
            key={key.label}
            type="button"
            disabled={disabled}
            onClick={() => (key.kind === "back" ? onBackspace() : onDigit(key.value))}
            aria-label={key.kind === "back" ? "Delete last digit" : key.label}
            className={`flex h-16 items-center justify-center rounded-2xl border text-2xl font-medium transition active:scale-[0.97] disabled:opacity-40 ${
              key.kind === "back"
                ? "border-transparent bg-transparent text-muted hover:text-ink"
                : "border-edge bg-raised text-ink hover:border-muted/60 hover:bg-hover"
            }`}
            style={{ touchAction: "manipulation" }}
          >
            {key.label}
          </button>
        );
      })}
    </div>
  );
}

export function CodeDots({
  value,
  length = 6,
  masked = false,
  label,
}: {
  value: string;
  length?: number;
  masked?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2" role="status" aria-label={`${label}: ${value.length} of ${length} digits entered`}>
      {Array.from({ length }).map((_, index) => {
        const digit = value[index];
        const filled = digit !== undefined;
        return (
          <span
            key={index}
            className={`flex h-12 w-10 items-center justify-center rounded-xl border text-xl font-semibold transition ${
              filled ? "border-accent/60 bg-accent/10 text-ink" : "border-edge bg-panel text-muted"
            }`}
          >
            {filled ? (masked ? "•" : digit) : ""}
          </span>
        );
      })}
    </div>
  );
}
