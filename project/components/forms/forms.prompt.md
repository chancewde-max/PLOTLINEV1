Form controls — labeled text/numeric inputs, native selects, checkboxes, and toggle switches. All share the bordered-white-with-soft-shadow look and the brand-green focus ring.

```jsx
<Input label="Project name" placeholder="Maple Grove Estates" />
<Input label="Area" numeric suffix="sq ft" defaultValue="1,240" />
<Input label="Email" error="That address looks off" leadingIcon={<MailIcon/>} />
<Select label="Unit" options={["Imperial (ft)", "Metric (m)"]} />
<Checkbox label="Snap to grid" description="Vertices snap to the sheet grid" defaultChecked />
<Switch label="Show measurements" defaultChecked />
```

`Input` supports `numeric` (mono tabular figures), `suffix` (unit label), `leadingIcon`, `hint`, `error`, `required`, and `sm`/`md`/`lg`. Use `numeric`+`suffix` for any measurement entry.
