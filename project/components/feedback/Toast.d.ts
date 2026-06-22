import * as React from "react";

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "success" | "warning" | "danger" | "info";
  title?: React.ReactNode;
  message?: React.ReactNode;
  onClose?: () => void;
}

/** Notification toast with status icon. Presentational — position the stack yourself (bottom-right is conventional). */
export function Toast(props: ToastProps): React.JSX.Element;
