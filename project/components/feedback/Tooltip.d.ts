import * as React from "react";

export interface TooltipProps {
  /** Tooltip text. */
  label: React.ReactNode;
  /** Optional keyboard shortcut shown in mono on the right (e.g. "A"). */
  shortcut?: string;
  side?: "top" | "bottom";
  children: React.ReactNode;
  className?: string;
}

/** Dark hover/focus tooltip. Wrap any control; great for tool-rail buttons with shortcuts. */
export function Tooltip(props: TooltipProps): React.JSX.Element;
