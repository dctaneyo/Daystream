export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={`grid place-items-center rounded-xl bg-raised ring-1 ring-edge ${
          compact ? "h-7 w-7" : "h-8 w-8"
        }`}
      >
        <span className="flex flex-col gap-[3px]">
          <span className="h-[2px] w-3.5 rounded-full bg-accent" />
          <span className="h-[2px] w-2.5 rounded-full bg-accent/80" />
          <span className="h-[2px] w-1.5 rounded-full bg-accent/60" />
        </span>
      </span>
      <span className={`font-semibold tracking-tight ${compact ? "text-sm" : "text-[15px]"}`}>
        Daystream
      </span>
    </span>
  );
}
