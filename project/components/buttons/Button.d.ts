import * as React from "react";

/**
 * Primary text button for Plotline.
 * @startingPoint section="Buttons" subtitle="Primary, secondary, ghost & danger buttons" viewport="700x200"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Control height. */
  size?: "sm" | "md" | "lg";
  /** Icon node rendered before the label (e.g. a Lucide <svg>). */
  iconLeft?: React.ReactNode;
  /** Icon node rendered after the label. */
  iconRight?: React.ReactNode;
  /** Stretch to fill the container width. */
  fullWidth?: boolean;
  children?: React.ReactNode;
}

/**
 * Primary text button for Plotline. Use `primary` for the single main action
 * in a view, `secondary` for supporting actions, `ghost` for low-emphasis
 * toolbar/inline actions, and `danger` for destructive confirmation.
 */
export function Button(props: ButtonProps): React.JSX.Element;
