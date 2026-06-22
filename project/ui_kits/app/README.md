# Plotline App — UI Kit

Full-screen, interactive recreation of the Plotline product (the plan viewer + takeoff
workspace). Open `index.html`.

## Flow
1. **Projects dashboard** (`Projects.jsx`) — pipeline stats + project grid. Click any project
   (or "New project") to open it.
2. **Takeoff workspace** (`Workspace.jsx`) — the core screen: topbar with breadcrumb / zoom /
   share / export, the vertical **tool rail**, a **layers/sheets** panel, the **plan canvas**
   (warm paper sheet on a blueprint grid, with live area/linear/count/volume markups and
   value callouts), and the **live estimate** panel. Switch tools, toggle layer visibility,
   select measurements, and **Export** to see the export dialog → success toast.
3. Use the floating **Projects** button (top-left) to go back.

## Files
- `index.html` — mounts the app, owns view state, export dialog + toast.
- `RegionCount.html` — **Region takeoff** tool: draw a polygon on the plan and it counts the
  point items inside (trees, shrubs, limestone blocks, irrigation), totals the area materials
  in sq ft (sod, rock, hydroseed — each labeled on the plan), totals limestone walls in ln ft,
  and measures the drawn region's own area + perimeter. Real point-in-polygon math; updates
  live while drawing. Categories are toggleable. Material colors come from the `--mat-*`
  tokens in `tokens/colors.css`.
- `common.jsx` — `KitIcon` (Lucide-backed React icon).
- `Projects.jsx` — `Projects` dashboard screen.
- `Workspace.jsx` — `Workspace` takeoff screen.

## Built from the design system
Composes the real components — `Button`, `IconButton`, `Tabs`, `Badge`, `Avatar`, `Input`,
`Select`, `Checkbox`, `Dialog`, `Toast`, `Tooltip`, and the takeoff primitives `ToolRail`-style
rail, `MeasurementChip`, `SheetThumb`, `EstimateRow`. Colors/type/spacing all come from
`styles.css`. The takeoff-type color system (area=green, linear=amber, count=blue,
volume=violet) is used consistently on canvas, layers, and estimate.

This is a cosmetic recreation: geometry and quantities are illustrative, not a real
measurement engine.
