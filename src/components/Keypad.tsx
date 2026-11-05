interface KeypadProps {
  onDigit(digit: string): void;
  onBackspace(): void;
  onSecondary?(): void;
  secondaryLabel?: string;
  disabled?: boolean;
}

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function Keypad({
  onDigit,
  onBackspace,
  onSecondary,
  secondaryLabel,
  disabled = false,
}: KeypadProps) {
  return (
    <div className="ds-keypad" role="group" aria-label="Number pad">
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          className="ds-key"
          onClick={() => onDigit(digit)}
          disabled={disabled}
          aria-label={digit}
        >
          {digit}
        </button>
      ))}
      {onSecondary ? (
        <button
          type="button"
          className="ds-key ds-key--word"
          onClick={onSecondary}
          disabled={disabled}
        >
          {secondaryLabel ?? "More"}
        </button>
      ) : (
        <span className="ds-key ds-key--empty" aria-hidden="true" />
      )}
      <button
        type="button"
        className="ds-key"
        onClick={() => onDigit("0")}
        disabled={disabled}
        aria-label="0"
      >
        0
      </button>
      <button
        type="button"
        className="ds-key ds-key--word"
        onClick={onBackspace}
        disabled={disabled}
        aria-label="Delete last digit"
      >
        Back
      </button>
    </div>
  );
}
