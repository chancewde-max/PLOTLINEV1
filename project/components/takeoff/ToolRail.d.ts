import * as React from "react";

export interface RailTool {
  id: string;
  label: string;
  /** Icon node (e.g. a Lucide <svg>). */
  icon: React.ReactNode;
  /** Single-key shortcut shown bottom-right. */
  shortcut?: string;
}

/**
 * Vertical takeoff tool rail (pan / area / linear / count / volume …).
 * @startingPoint section="Takeoff" subtitle="Vertical tool rail with shortcuts" viewport="72x360"
 */
export interface ToolRailProps {
  /** Tools and "divider" separators, in order. */
  tools: (RailTool | "divider")[];
  /** Id of the active tool. */
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
}

export function ToolRail(props: ToolRailProps): React.JSX.Element;
