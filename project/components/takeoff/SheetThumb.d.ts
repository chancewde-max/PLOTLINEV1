import * as React from "react";

/**
 * Plan-sheet thumbnail tile for the sheets panel or project grid.
 * @startingPoint section="Takeoff" subtitle="Plan sheet thumbnail tile" viewport="220x220"
 */
export interface SheetThumbProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Sheet code badge (e.g. "L-2", "A-101"). */
  code?: string;
  /** Sheet name. */
  name?: string;
  /** Scale label shown bottom-right of meta (e.g. '1" = 20\''). */
  scale?: string;
  /** Number of measurements on the sheet. */
  count?: number;
  /** Preview image URL; falls back to a blueprint-grid placeholder. */
  src?: string;
  selected?: boolean;
}

export function SheetThumb(props: SheetThumbProps): React.JSX.Element;
