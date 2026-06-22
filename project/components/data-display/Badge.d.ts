import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "solid";
  /** Show a leading status dot. */
  dot?: boolean;
  children?: React.ReactNode;
}

/** Small status pill — bid stage, sync state, counts. Use `dot` for live status. */
export function Badge(props: BadgeProps): React.JSX.Element;
