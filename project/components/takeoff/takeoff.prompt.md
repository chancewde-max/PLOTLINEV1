Domain primitives for the plan-markup + takeoff workflow. These are what make Plotline *Plotline* — compose them with the core components.

```jsx
// Vertical tool rail
<ToolRail value={tool} onChange={setTool} tools={[
  {id:"pan",label:"Pan",icon:<HandIcon/>,shortcut:"H"},
  {id:"area",label:"Area",icon:<SquareDashedIcon/>,shortcut:"A"},
  {id:"linear",label:"Linear",icon:<SplineIcon/>,shortcut:"L"},
  {id:"count",label:"Count",icon:<LocateIcon/>,shortcut:"C"}, "divider",
  {id:"note",label:"Note",icon:<MessageSquareIcon/>,shortcut:"N"} ]} />

// Measurement list item
<MeasurementChip type="area" label="Sod — rear lawn" value="4,820" unit="sq ft" selected />

// Plan sheet tile
<SheetThumb code="L-2" name="Planting Plan" scale={'1" = 20\''} count={12} selected />

// Estimate table
<EstimateRow header />
<EstimateRow type="area"   name="Sod & turf"   source="L-2 · 3 areas" quantity="12,480" unit="sq ft" unitPrice="$0.85 / sq ft" total="$10,608" />
<EstimateRow type="linear" name="Steel edging" source="L-2 · 5 runs"  quantity="840"    unit="ln ft" unitPrice="$6.20 / ln ft" total="$5,208" />
<EstimateRow isTotal name="Estimated total" total="$48,210" />
```

Measurement-type colors (area=green, linear=amber, count=blue, volume=violet, region=magenta, slope=cyan) are consistent across `MeasurementChip`, `EstimateRow`, and `Tag`.
