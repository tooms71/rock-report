import type { ReactNode } from "react";

// Small drawn icons (one stroke weight, 24px grid) so the interface doesn't depend
// on emoji, which render differently on every platform.

type IconProps = { className?: string; filled?: boolean };

function Svg({
  className,
  fill = "none",
  children,
}: {
  className?: string;
  fill?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={fill}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function FlagIcon({ className, filled = false }: IconProps) {
  return (
    <Svg className={className} fill={filled ? "currentColor" : "none"}>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2.5 4.5L17 13H5" />
    </Svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 12.5l4.5 4.5L19 7" pathLength={1} />
    </Svg>
  );
}

// Blocked or struggling: an exclamation mark in a circle.
export function AlertIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.5v.01" />
    </Svg>
  );
}

// A signed offer: a seal with a tick.
export function OffersIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.5" />
    </Svg>
  );
}

// An open role: a door left ajar.
export function RolesIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 21V4h9l3 2v15" />
      <path d="M3 21h18" />
      <path d="M12 12.5v.01" />
    </Svg>
  );
}

// A faceted stone, for the Rock of the Week.
export function RockIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3.5 17.5l3-8L11 5l6 2.5 3.5 5-2.5 5-5.5 2.5z" />
      <path d="M6.5 9.5L11 12l6-4.5M11 12l1.5 8" />
    </Svg>
  );
}
