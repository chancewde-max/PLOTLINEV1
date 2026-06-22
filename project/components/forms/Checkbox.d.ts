import * as React from "react";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Optional secondary line under the label. */
  description?: string;
}

/** Checkbox with animated tick, optional label + description. */
export function Checkbox(props: CheckboxProps): React.JSX.Element;
