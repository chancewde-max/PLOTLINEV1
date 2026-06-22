Plotline's primary text button — use it for the main action in any view, with `secondary`/`ghost`/`danger` variants for supporting and destructive actions.

```jsx
<Button variant="primary" onClick={save}>Save estimate</Button>
<Button variant="secondary" iconLeft={<PlusIcon/>}>Add measurement</Button>
<Button variant="ghost" size="sm">Cancel</Button>
<Button variant="danger">Delete sheet</Button>
```

Variants: `primary` (brand green, one per view), `secondary` (bordered white), `ghost` (transparent, low-emphasis), `danger` (red). Sizes: `sm` / `md` / `lg`. Props: `iconLeft`, `iconRight`, `fullWidth`, `disabled`, plus all native `<button>` attributes.
