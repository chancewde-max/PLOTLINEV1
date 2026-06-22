import * as React from "react";

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Full name — used for initials fallback and tooltip. */
  name?: string;
  /** Image URL; falls back to initials if absent. */
  src?: string;
  /** Named size or pixel number. */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  /** Add a separating ring (for overlapping stacks). */
  ring?: boolean;
  /** Presence dot. */
  status?: "online" | "busy" | "away";
}

/** Round avatar with image or initials fallback, optional presence dot. */
export function Avatar(props: AvatarProps): React.JSX.Element;
