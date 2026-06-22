import * as React from "react";

/**
 * Surface container with optional header (title/subtitle/actions) and body.
 * @startingPoint section="Surfaces" subtitle="Content card with header & actions" viewport="420x240"
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Header title (renders the header row). */
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned header actions (buttons, menus). */
  actions?: React.ReactNode;
  elevation?: "flat" | "default" | "raised";
  /** Adds hover-lift affordance for clickable cards. */
  interactive?: boolean;
  padding?: "none" | "tight" | "default";
  children?: React.ReactNode;
}

export function Card(props: CardProps): React.JSX.Element;
