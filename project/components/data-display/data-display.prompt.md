Status and identity primitives — `Badge` (status pills), `Tag` (color-coded category chips), `Avatar` (initials/photo).

```jsx
<Badge variant="success" dot>Synced</Badge>
<Badge variant="warning">Draft</Badge>
<Tag color="area" tinted>Sod — rear lawn</Tag>
<Tag color="linear" onRemove={remove}>Edging</Tag>
<Avatar name="Amy Reyes" status="online" />
<Avatar src="/team/jt.jpg" name="JT" size="lg" ring />
```

`Tag.color` takes a takeoff key (area/linear/count/volume/region/slope) to match the layer color system, or any CSS color. `Badge` variants: neutral/brand/success/warning/danger/info/solid.
