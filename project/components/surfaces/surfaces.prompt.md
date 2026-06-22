Layout surfaces — `Card` (bordered container with optional header/actions) and `Tabs` (section navigation).

```jsx
<Card title="Estimate summary" subtitle="3 sheets · 18 measurements"
      actions={<Button size="sm" variant="ghost">Export</Button>}>
  …body…
</Card>

<Tabs variant="underline" defaultValue="layers"
      items={[{value:"layers",label:"Layers",count:6},
              {value:"sheets",label:"Sheets",count:3},
              {value:"notes",label:"Notes"}]} />
```

`Card`: `elevation` flat/default/raised, `interactive` for hover-lift, `padding` none/tight/default. `Tabs`: `underline` (panel sections) or `pill` (compact toggle); controlled via `value`+`onChange` or uncontrolled via `defaultValue`.
