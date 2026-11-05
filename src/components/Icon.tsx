import type { ReactNode } from "react";

export type IconName =
  | "arrow-left"
  | "arrow-right"
  | "calendar"
  | "check"
  | "chevron-down"
  | "copy"
  | "indent"
  | "layout"
  | "lock"
  | "outdent"
  | "pencil"
  | "plus"
  | "share"
  | "shield"
  | "signout"
  | "trash"
  | "x";

const PATHS: Record<IconName, ReactNode> = {
  "arrow-left": <path d="M13 8H3M7.25 4.25 3.5 8l3.75 3.75" />,
  "arrow-right": <path d="M3 8h10M8.75 4.25 12.5 8l-3.75 3.75" />,
  calendar: (
    <>
      <rect x="2.25" y="3.25" width="11.5" height="10.5" />
      <path d="M2.25 6.25h11.5M5.25 1.75v3M10.75 1.75v3" />
    </>
  ),
  check: <path d="m3.25 8.5 3 3 6.5-7" />,
  "chevron-down": <path d="m4.25 6.25 3.75 3.5 3.75-3.5" />,
  copy: (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" />
      <path d="M10.5 5.5v-3h-8v8h3" />
    </>
  ),
  indent: (
    <>
      <path d="M3 3h10M3 13h10M3 8h4M10 5.25 12.75 8 10 10.75" />
    </>
  ),
  layout: (
    <>
      <path d="M3.25 2.25h9.5v11.5h-9.5z" />
      <path d="M5.5 5.25h5M5.5 8h5M5.5 10.75h3" />
    </>
  ),
  lock: (
    <>
      <rect x="3.5" y="7" width="9" height="6.75" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </>
  ),
  outdent: (
    <>
      <path d="M3 3h10M3 13h10M7 8h6M6 5.25 3.25 8 6 10.75" />
    </>
  ),
  pencil: (
    <>
      <path d="m3 13 1-3.5 7.5-7.5 2.5 2.5L6.5 12 3 13Z" />
      <path d="m10.25 3.25 2.5 2.5" />
    </>
  ),
  plus: <path d="M8 3.25v9.5M3.25 8h9.5" />,
  share: (
    <>
      <circle cx="12.25" cy="3.25" r="1.5" />
      <circle cx="3.75" cy="8" r="1.5" />
      <circle cx="12.25" cy="12.75" r="1.5" />
      <path d="m5.1 7.25 5.55-3.1M5.1 8.75l5.55 3.1" />
    </>
  ),
  shield: (
    <>
      <path d="M8 2.25 13 4v4c0 3-2.25 5-5 5.75C5.25 13 3 11 3 8V4l5-1.75Z" />
      <path d="m5.75 8 1.5 1.5 3-3.25" />
    </>
  ),
  signout: (
    <>
      <path d="M9 3H3.25v10H9M10.75 5.25 13.5 8l-2.75 2.75M6.5 8h7" />
    </>
  ),
  trash: (
    <>
      <path d="M3 4.5h10M6 4.5v-2h4v2M4.5 4.5l.75 9h5.5l.75-9M6.75 7v4.25M9.25 7v4.25" />
    </>
  ),
  x: <path d="m4 4 8 8M12 4l-8 8" />,
};

export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={`ds-icon ${className}`.trim()}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
