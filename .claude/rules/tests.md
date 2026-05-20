---
paths:
  - "**/*_test.go"
  - "frontend/**/*.test.{ts,tsx}"
  - "frontend/tests/e2e/**/*.spec.ts"
---

# Test Code Rules

## Table-driven tests

Prefer `it.each` (vitest) / `t.Run` over a table (Go) when **3 or more cases share the same shape** — same setup, same kind of action(s), same assertion form, only the data varies.

**Skip the refactor when:**

- The body would need branching (`if` / `switch` / ternary on a `kind` field) inside the loop to dispatch over case-specific behavior. That trades duplication for control-flow complexity.
- Cases differ in shape (different setup, different assertions, different mocks). Keep them as separate `it()` / `t.Run` blocks.

**When cases differ by *action*, pass function references in the table** rather than stringly-typed identifiers. The body then stays a flat `for (const fn of actions) act(() => fn())` — no `if`, no `switch`.

**When cases differ in arity** (some have 0 actions, some have 1, some have 2), express the variation as a list length in the table, not as separate fields with `undefined`s.

### Example: `frontend/src/components/preview.test.tsx`

```tsx
describe("drag cursor", () => {
  const startPan = () => lastPanningStart?.();
  const stopPan = () => lastPanningStop?.();

  it.each([
    { name: "defaults to cursor-grab when not panning", actions: [], expected: "cursor-grab" },
    {
      name: "switches to cursor-grabbing while panning",
      actions: [startPan],
      expected: "cursor-grabbing",
    },
    {
      name: "returns to cursor-grab when panning stops",
      actions: [startPan, stopPan],
      expected: "cursor-grab",
    },
  ])("$name", ({ actions, expected }) => {
    render(<Preview svg={SAMPLE_SVG} />);
    for (const action of actions) {
      act(() => action());
    }
    expect(panWrapper().className).toBe(expected);
  });
});
```

The three rows differ only in the action sequence and the expected class. Passing `startPan` / `stopPan` as values keeps the body free of `if (action === "start") …`.
