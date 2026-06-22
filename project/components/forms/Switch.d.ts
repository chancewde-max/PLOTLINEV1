import * as React from "react";

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

/** Toggle switch for instant on/off settings (e.g. layer visibility, snapping). */
export function Switch(props: SwitchProps): React.JSX.Element;
