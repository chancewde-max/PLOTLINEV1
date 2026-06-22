import * as React from "react";

export interface EstimateRowProps {
  /** Category type — drives the swatch color. */
  type?: "area" | "linear" | "count" | "volume" | "region" | "slope";
  name?: React.ReactNode;
  /** Secondary line under the name (e.g. source sheet). */
  source?: React.ReactNode;
  /** Measured quantity (mono tabular). */
  quantity?: React.ReactNode;
  unit?: string;
  /** Unit price label (e.g. "$3.85 / sq ft"). */
  unitPrice?: React.ReactNode;
  /** Line total (e.g. "$48,210"). */
  total?: React.ReactNode;
  /** Render the column-header row instead of a data row. */
  header?: boolean;
  /** Render the grand-total row (emphasized, brand-colored). */
  isTotal?: boolean;
  className?: string;
}

/**
 * One line item in the estimate / takeoff summary table. Use `header` for the
 * column header and `isTotal` for the grand-total row.
 */
export function EstimateRow(props: EstimateRowProps): React.JSX.Element;
