import * as React from "react";

export type TakeoffType = "area" | "linear" | "count" | "volume" | "region" | "slope";

/**
 * A single takeoff measurement: color square + name + value/unit in mono.
 * @startingPoint section="Takeoff" subtitle="Measurement list item with type color & value" viewport="320x64"
 */
export interface MeasurementChipProps extends React.HTMLAttributes<HTMLElement> {
  /** Measurement type — drives the swatch color. */
  type?: TakeoffType;
  /** Measurement name (e.g. "Sod — rear lawn"). */
  label?: React.ReactNode;
  /** Measured value (string or number; rendered in mono tabular). */
  value?: React.ReactNode;
  /** Unit shown after the value (e.g. "sq ft", "ln ft", "ea"). */
  unit?: string;
  selected?: boolean;
  /** When provided, renders as a clickable button. */
  onClick?: () => void;
}

export function MeasurementChip(props: MeasurementChipProps): React.JSX.Element;
