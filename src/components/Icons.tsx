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

export function CheckIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 12.5l4.5 4.5L19 7" pathLength={1} />
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

// Upvote: an up arrow, solid once you have voted.
export function UpvoteIcon({ className, filled = false }: IconProps) {
  return (
    <Svg className={className} fill={filled ? "currentColor" : "none"}>
      {filled ? (
        <path d="M12 4.5l7 8h-4.5v7h-5v-7H5z" />
      ) : (
        <>
          <path d="M12 19V6" />
          <path d="M6.5 11.5L12 6l5.5 5.5" />
        </>
      )}
    </Svg>
  );
}

// Hive mind: a single honeycomb cell.
export function HiveIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3l7.5 4.3v9.4L12 21l-7.5-4.3V7.3z" />
      <path d="M12 9.5v5" />
    </Svg>
  );
}

// Anything cool: a four-point sparkle.
export function SparkIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M18.5 16.5v3" />
      <path d="M17 18h3" />
    </Svg>
  );
}

// Stalled: an exclamation mark in a circle.
export function AlertIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.5v.01" />
    </Svg>
  );
}

// Offer extended: a paper plane, on its way.
export function SendIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M20.5 4L3.5 11l6.5 2.5L12.5 20z" />
      <path d="M10 13.5L20.5 4" />
    </Svg>
  );
}

// Anomalies and trends: a line that climbs, with a break in it.
export function TrendIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3.5 17l5-5.5 3.5 3 6.5-8" />
      <path d="M14.5 6.5h4v4" />
    </Svg>
  );
}

// Topics added to the agenda: a list with bullets.
export function TopicsIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9.5 7h10M9.5 12h10M9.5 17h10" />
      <path d="M4.5 7v.01M4.5 12v.01M4.5 17v.01" />
    </Svg>
  );
}

// Comment: a speech bubble.
export function CommentIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 5.5h16v10H12l-4.5 3.5v-3.5H4z" />
    </Svg>
  );
}
