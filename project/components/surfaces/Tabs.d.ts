import * as React from "react";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  /** Optional trailing count (e.g. number of measurements). */
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  /** Controlled active value. */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  variant?: "underline" | "pill";
  className?: string;
}

/** Tab bar — `underline` for page/panel sections, `pill` for compact toggles. */
export function Tabs(props: TabsProps): React.JSX.Element;
