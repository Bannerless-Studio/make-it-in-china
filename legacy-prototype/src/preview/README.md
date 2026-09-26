# Content preview

DOM-only authoring view for Phase 1 content and strict checker output.

| File | Role |
| --- | --- |
| `main.ts` | Loads Phase 1 JSON, runs strict rules, lists sites/issues/coverage |
| `style.css` | Preview layout and pass/fail styling |

## Commands

```bash
npm run dev
```

Open `/preview.html` on the Vite URL. A red banner means at least one strict `FAIL`.

```bash
npm run check:content:strict
```

Same gate on the CLI.
