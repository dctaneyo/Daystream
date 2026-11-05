interface DigitsProps {
  count: number;
  length?: number;
  error?: boolean;
}

export function Digits({ count, length = 6, error = false }: DigitsProps) {
  return (
    <div
      className={`ds-digits ${error ? "is-error" : ""}`}
      role="status"
      aria-label={`${count} of ${length} digits entered`}
    >
      {Array.from({ length }, (_, index) => (
        <span
          key={index}
          className={`ds-digit-slot ${index < count ? "is-filled" : ""}`}
        >
          <span className="ds-digit-dot" />
        </span>
      ))}
    </div>
  );
}
