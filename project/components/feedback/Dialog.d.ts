import * as React from "react";

export interface DialogProps {
  /** Whether the dialog is shown. */
  open: boolean;
  /** Called on close (× button, scrim click, Escape). */
  onClose?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Footer node, typically right-aligned buttons. */
  footer?: React.ReactNode;
  /** Max width in px (default 460). */
  width?: number;
  children?: React.ReactNode;
}

/** Centered modal dialog with scrim, blur, Escape-to-close and pop-in animation. */
export function Dialog(props: DialogProps): React.JSX.Element | null;
