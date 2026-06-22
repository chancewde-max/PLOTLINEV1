import * as React from "react";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> {
  /** Visual style. `ghost` for toolbars, `solid` for floating controls. */
  variant?: "ghost" | "solid" | "primary";
  /** Control size. */
  size?: "sm" | "md" | "lg";
  /** Toggled / active-tool state (renders the brand-tinted pressed look). */
  selected?: boolean;
  /** Accessible label — also used as the tooltip title. Required. */
  label: string;
  /** Icon node (a Lucide <svg> or similar). */
  children?: React.ReactNode;
}

/**
 * Square icon-only button. The workhorse of the takeoff tool rail and panel
 * headers. Always pass `label` for accessibility; set `selected` for the
 * active tool in a toolbar.
 */
export function IconButton(props: IconButtonProps): React.JSX.Element;
