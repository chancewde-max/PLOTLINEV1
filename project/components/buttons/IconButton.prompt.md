Square, icon-only button — the workhorse of the takeoff tool rail, panel headers, and dense toolbars.

```jsx
<IconButton label="Pan" variant="ghost"><HandIcon/></IconButton>
<IconButton label="Area tool" selected variant="ghost"><SquareIcon/></IconButton>
<IconButton label="Zoom in" variant="solid"><PlusIcon/></IconButton>
```

Variants: `ghost` (toolbars), `solid` (floating/overlay controls), `primary`. Sizes: `sm`/`md`/`lg`. Set `selected` for the active tool (brand-tinted pressed state). `label` is required and doubles as the tooltip.
