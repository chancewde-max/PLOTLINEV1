import * as React from "react";

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** A takeoff key (area|linear|count|volume|region|slope) or any CSS color. */
  color?: "area" | "linear" | "count" | "volume" | "region" | "slope" | string;
  /** Fill with a soft tint of the color (vs. a colored dot on white). */
  tinted?: boolean;
  /** When provided, renders a remove (×) button calling this handler. */
  onRemove?: () => void;
  children?: React.ReactNode;
}

/**
 * Categorical chip for takeoff layers & measurement categories. Pass a takeoff
 * key to color-code (area=green, linear=amber, count=blue, …) and `tinted` for
 * the filled variant; `onRemove` adds a × button.
 */
export function Tag(props: TagProps): React.JSX.Element;
