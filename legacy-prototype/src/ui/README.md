# UI

DOM interface for dialogue, HUD, menus, and learner tools. Text stays outside WebGL. Do not import `src/render`.

| File | Role |
| --- | --- |
| `index.ts` | Public exports |
| `shell.ts` | Title, pause, settings, help, credits, save, sleep, rent, gate |
| `bubble.ts` | Speech bubble, replies, hints, activity chooser |
| `hud.ts` | Day, slots, wallet, objective, mute, menu, toasts |
| `notebook.ts` | Vocabulary filters, audio, mentor topics, inventory |
| `modal.ts` | Focus trap and restoration |
| `preferences.ts` | Persisted pinyin and text-size settings |
| `activityAvailability.ts` | Pure availability-reason labels (no DOM) |
