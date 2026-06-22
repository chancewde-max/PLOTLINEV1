import * as React from "react";

/**
 * Text input with built-in label, hint, error, leading icon and unit suffix.
 * @startingPoint section="Forms" subtitle="Labeled text & numeric inputs with units" viewport="380x120"
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Field label rendered above the control. */
  label?: string;
  /** Helper text below the field. */
  hint?: string;
  /** Error message; turns the field red and overrides `hint`. */
  error?: string;
  /** Marks the field required (adds a red asterisk). */
  required?: boolean;
  size?: "sm" | "md" | "lg";
  /** Icon node rendered inside, before the text. */
  leadingIcon?: React.ReactNode;
  /** Trailing unit/label (e.g. "ft", "sq ft") rendered in mono. */
  suffix?: string;
  /** Render the value in mono with tabular figures (for quantities). */
  numeric?: boolean;
}

/**
 * Set `numeric` + `suffix="sq ft"` for measurement entry.
 */
export function Input(props: InputProps): React.JSX.Element;
