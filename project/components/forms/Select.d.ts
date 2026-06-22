import * as React from "react";

export interface SelectOption { value: string; label: string; }

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  /** Options as strings or {value,label}. Omit if passing <option> children. */
  options?: (string | SelectOption)[];
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
}

/** Native select styled to match Plotline, with a custom chevron. */
export function Select(props: SelectProps): React.JSX.Element;
