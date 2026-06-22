Feedback & overlays — `Tooltip` (hover hints with shortcuts), `Dialog` (modal), `Toast` (notifications).

```jsx
<Tooltip label="Area tool" shortcut="A"><IconButton label="Area">…</IconButton></Tooltip>

<Dialog open={open} onClose={close} title="Delete sheet?"
        description="Markups on this sheet will be removed."
        footer={<><Button variant="ghost" onClick={close}>Cancel</Button>
                  <Button variant="danger" onClick={confirm}>Delete</Button></>}>
  This can't be undone.
</Dialog>

<Toast variant="success" title="Estimate exported" message="Saved to Downloads." onClose={dismiss} />
```

`Toast` is presentational — render it in a fixed bottom-right stack yourself. `Dialog` closes on ×, scrim click, or Escape.
